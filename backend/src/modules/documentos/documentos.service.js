import crypto from "node:crypto";
import { ApiError } from "../../utils/ApiError.js";
import { parseId, parseTexto, parseEnumOpcional, hojeISO } from "../../utils/validacao.js";
import { ROLES } from "../../config/roles.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
import { temAcessoAUep } from "../ueps/ueps.acesso.js";
import { gerarRelatorio } from "../relatorios/relatorios.service.js";
import { documentosRepository } from "./documentos.repository.js";
import { validarPdf, unirPdfs } from "./documentos.pdf.js";

export const DOCUMENTO_TIPOS = Object.freeze(["NOTA_FISCAL", "OUTRO"]);
export const UNIAO_MAX_ITENS = 30;

/*
 * Documentos dos professores e da Diretoria (Sprint 13). Regras de acesso:
 *   enviar   -> PROFESSOR e ADMIN (rota já barra os demais)
 *   listar   -> ADMIN vê todos; PROFESSOR só os próprios
 *   baixar   -> ADMIN qualquer um; PROFESSOR só o próprio
 *   remover  -> ADMIN qualquer um; PROFESSOR só o próprio
 *   unir     -> só ADMIN
 * Documento fora do alcance responde 404, para não revelar que existe.
 */

/** Nome do arquivo como o usuário vê: UTF-8, sem pasta, no máximo 255 caracteres, terminando em .pdf. */
export function normalizarNomeArquivo(original) {
  let nome = String(original ?? "").trim();
  // O multipart costuma chegar com o nome UTF-8 lido como latin1 ("RelatÃ³rio").
  const reinterpretado = Buffer.from(nome, "latin1").toString("utf8");
  if (!reinterpretado.includes("�") && reinterpretado !== nome) nome = reinterpretado;
  nome = nome.split(/[\\/]/).pop().replace(/[\u0000-\u001f"<>|*?:]/g, "_"); // eslint-disable-line no-control-regex
  if (!nome || nome === "." || nome === "..") nome = "documento.pdf";
  if (!/\.pdf$/i.test(nome)) nome += ".pdf";
  if (nome.length > 255) nome = nome.slice(0, 251) + ".pdf";
  return nome;
}

function podeVer(user, documento) {
  return user.role === ROLES.ADMIN || Number(documento.enviado_por) === Number(user.id);
}

async function carregarVisivel(user, idRaw) {
  const id = parseId(idRaw, "id");
  const doc = await documentosRepository.findById(id);
  if (!doc || !podeVer(user, doc)) throw ApiError.notFound("Documento não encontrado");
  return doc;
}

export const documentosService = {
  async enviar(user, arquivo, campos = {}) {
    if (!arquivo || !arquivo.buffer || arquivo.size === 0) {
      throw ApiError.badRequest("Escolha o arquivo PDF que você quer enviar (campo 'arquivo').");
    }
    const nomeOriginal = normalizarNomeArquivo(arquivo.originalname);
    await validarPdf(arquivo.buffer, nomeOriginal);

    const tipo = parseEnumOpcional(campos.tipo, DOCUMENTO_TIPOS, "tipo") ?? "OUTRO";
    const descricao = parseTexto(campos.descricao, "descricao", { max: 120 });

    let uepId = null;
    if (campos.uepId !== undefined && campos.uepId !== null && campos.uepId !== "") {
      uepId = parseId(campos.uepId, "uepId");
      const uep = await uepsRepository.findById(uepId);
      if (!uep) throw ApiError.notFound(`UEP ${uepId} não encontrada`);
      if (!(await temAcessoAUep(user, uepId))) {
        throw ApiError.forbidden("Você só pode vincular o documento a uma UEP sua.");
      }
    }

    return documentosRepository.create({
      nomeOriginal,
      tipo,
      descricao,
      tamanhoBytes: arquivo.buffer.length,
      sha256: crypto.createHash("sha256").update(arquivo.buffer).digest("hex"),
      conteudo: arquivo.buffer,
      uepId,
      enviadoPor: user.id,
    });
  },

  async listar(user) {
    return documentosRepository.findAll(user.role === ROLES.ADMIN ? {} : { enviadoPor: user.id });
  },

  async arquivo(user, idRaw) {
    const doc = await carregarVisivel(user, idRaw);
    const arquivo = await documentosRepository.findArquivo(doc.id);
    return { buffer: arquivo.conteudo, contentType: "application/pdf", nome: arquivo.nome_original };
  },

  async remover(user, idRaw) {
    const doc = await carregarVisivel(user, idRaw);
    await documentosRepository.remove(doc.id);
  },

  /**
   * itens (na ordem das páginas):
   *   { origem: 'documento', id }
   *   { origem: 'relatorio', relatorio, uepId?, dataInicio?, dataFim? }
   */
  async unir(itens) {
    if (!Array.isArray(itens) || itens.length < 2) {
      throw ApiError.badRequest("Selecione pelo menos 2 PDFs para unir.");
    }
    if (itens.length > UNIAO_MAX_ITENS) {
      throw ApiError.badRequest(`Dá para unir no máximo ${UNIAO_MAX_ITENS} arquivos de uma vez.`);
    }

    // valida tudo antes de gerar qualquer coisa
    const pedidos = itens.map((item, i) => {
      const posicao = `Item ${i + 1}`;
      if (!item || typeof item !== "object") throw ApiError.badRequest(`${posicao} inválido.`);
      if (item.origem === "documento") return { origem: "documento", id: parseId(item.id, `${posicao}: id`) };
      if (item.origem === "relatorio") {
        if (typeof item.relatorio !== "string") throw ApiError.badRequest(`${posicao}: informe o relatório.`);
        return { origem: "relatorio", relatorio: item.relatorio, params: item };
      }
      throw ApiError.badRequest(`${posicao}: origem deve ser 'documento' ou 'relatorio'.`);
    });

    const ids = [...new Set(pedidos.filter((p) => p.origem === "documento").map((p) => p.id))];
    const arquivos = ids.length ? await documentosRepository.findArquivos(ids) : [];
    const porId = new Map(arquivos.map((a) => [a.id, a]));
    const faltando = ids.filter((id) => !porId.has(id));
    if (faltando.length) {
      throw ApiError.notFound(`Documento não encontrado: ${faltando.join(", ")}`);
    }

    const partes = [];
    for (const p of pedidos) {
      if (p.origem === "documento") {
        const a = porId.get(p.id);
        partes.push({ nome: a.nome_original, buffer: a.conteudo });
      } else {
        const { relatorio: tipo, uepId, dataInicio, dataFim, dias } = p.params;
        const gerado = await gerarRelatorio(
          tipo,
          { formato: "pdf", uepId, dataInicio, dataFim, dias },
          { formatosAceitos: ["pdf"] }
        );
        partes.push({ nome: gerado.nome, buffer: gerado.buffer });
      }
    }

    return {
      buffer: await unirPdfs(partes),
      contentType: "application/pdf",
      nome: `uniao-documentos-${hojeISO()}.pdf`,
    };
  },
};
