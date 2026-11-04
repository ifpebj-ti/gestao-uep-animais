import { ApiError } from "../../utils/ApiError.js";
import { parseId, parseData, hojeISO } from "../../utils/validacao.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
import { animaisRepository } from "../animais/animais.repository.js";
import { estoqueRepository } from "../estoque/estoque.repository.js";
import { comprasRepository } from "../compras/compras.repository.js";
import { consolidarInsumos, DIAS_PADRAO } from "../compras/compras.algoritmo.js";
import { relatoriosRepository } from "./relatorios.repository.js";
import { renderizarPdf } from "./render.pdf.js";
import { renderizarXlsx } from "./render.xlsx.js";

/*
 * Geração de relatórios do gestor (Sprint 13). Cada tipo monta uma estrutura
 * neutra { titulo, filtros, secoes[] } que vira PDF ou Excel no render.*.js.
 * Contrato com o front: POST /api/relatorios/:tipo/gerar (ver script.js 8D).
 */

export const FORMATOS = Object.freeze({
  pdf: { contentType: "application/pdf", ext: "pdf" },
  xlsx: {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
});

export const PERIODO_MAX_DIAS = 366;

const ROTULOS = Object.freeze({
  NAO_APLICAVEL: "Não aplicável",
  NAO_INFORMADO: "Não informado",
  EM_CRESCIMENTO: "Em crescimento",
  EM_TRATAMENTO: "Em tratamento",
  LEITAO: "Leitão",
  CACHACO: "Cachaço",
  OBITO: "Óbito",
  SAIDA: "Saída",
  FEMEA: "Fêmea",
  CRITICA: "Crítica",
  ATENCAO: "Atenção",
});

/** "EM_CRESCIMENTO" -> "Em crescimento" (com os acentos que o enum não tem). */
export function rotulo(valor) {
  if (valor === null || valor === undefined) return null;
  if (ROTULOS[valor]) return ROTULOS[valor];
  const texto = String(valor).toLowerCase().replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Acrescenta a linha "Total" (em negrito) somando as colunas numéricas. */
export function comTotal(linhas, colunaRotulo, chavesSoma) {
  if (!linhas.length) return linhas;
  const total = { __destaque: true, [colunaRotulo]: "Total" };
  for (const c of chavesSoma) total[c] = linhas.reduce((acc, l) => acc + (Number(l[c]) || 0), 0);
  return [...linhas, total];
}

function brData(iso) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// ---------------------------------------------------------------- tipos

async function censoGeral({ uepIds }) {
  const filtros = { uepIds };
  const [porUep, porCategoria, porRaca, porEstagio, disponibilidade] = await Promise.all([
    relatoriosRepository.censoPorUep(uepIds),
    animaisRepository.countByCategoria(filtros),
    animaisRepository.countByRaca(filtros),
    animaisRepository.countByEstagioVida(filtros),
    animaisRepository.resumoDisponibilidade(filtros),
  ]);

  return {
    titulo: "Censo geral do rebanho",
    secoes: [
      {
        titulo: "Animais por UEP",
        colunas: [
          { chave: "uep", rotulo: "UEP", peso: 3 },
          { chave: "total", rotulo: "Total", alinhar: "right" },
          { chave: "disponiveis", rotulo: "Disponíveis", alinhar: "right" },
          { chave: "indisponiveis", rotulo: "Indisponíveis", alinhar: "right" },
        ],
        linhas: comTotal(porUep, "uep", ["total", "disponiveis", "indisponiveis"]),
      },
      {
        titulo: "Por categoria e sexo",
        colunas: [
          { chave: "categoria", rotulo: "Categoria", peso: 2 },
          { chave: "sexo", rotulo: "Sexo" },
          { chave: "total", rotulo: "Total", alinhar: "right" },
        ],
        linhas: comTotal(
          porCategoria.map((l) => ({ categoria: rotulo(l.categoria), sexo: rotulo(l.sexo), total: l.total })),
          "categoria",
          ["total"]
        ),
      },
      {
        titulo: "Por raça",
        colunas: [
          { chave: "raca", rotulo: "Raça", peso: 3 },
          { chave: "total", rotulo: "Total", alinhar: "right" },
        ],
        linhas: porRaca.map((l) => ({ raca: l.raca === "Nao informada" ? "Não informada" : l.raca, total: l.total })),
      },
      {
        titulo: "Por estágio de vida",
        colunas: [
          { chave: "estagio", rotulo: "Estágio", peso: 2 },
          { chave: "total", rotulo: "Total", alinhar: "right" },
        ],
        linhas: porEstagio.map((l) => ({ estagio: rotulo(l.estagio_vida), total: l.total })),
      },
      {
        titulo: "Indisponíveis por motivo",
        colunas: [
          { chave: "motivo", rotulo: "Motivo", peso: 2 },
          { chave: "total", rotulo: "Total", alinhar: "right" },
        ],
        linhas: disponibilidade.por_motivo.map((l) => ({ motivo: rotulo(l.motivo), total: l.total })),
        vazio: "Todos os animais estão disponíveis.",
      },
    ],
  };
}

async function statusReprodutivo({ uepIds }) {
  const [matriz, animais] = await Promise.all([
    relatoriosRepository.statusPorCategoria(uepIds),
    animaisRepository.findAll({ uepIds }),
  ]);
  animais.sort(
    (a, b) =>
      String(a.uep_nome).localeCompare(String(b.uep_nome), "pt-BR") ||
      a.categoria.localeCompare(b.categoria) ||
      a.status_reprodutivo.localeCompare(b.status_reprodutivo) ||
      String(a.brinco ?? "").localeCompare(String(b.brinco ?? ""), "pt-BR", { numeric: true })
  );

  return {
    titulo: "Status reprodutivo do rebanho",
    secoes: [
      {
        titulo: "Resumo por categoria",
        colunas: [
          { chave: "categoria", rotulo: "Categoria", peso: 2 },
          { chave: "status", rotulo: "Fase reprodutiva", peso: 2 },
          { chave: "total", rotulo: "Total", alinhar: "right" },
        ],
        linhas: comTotal(
          matriz.map((l) => ({ categoria: rotulo(l.categoria), status: rotulo(l.status_reprodutivo), total: l.total })),
          "categoria",
          ["total"]
        ),
      },
      {
        titulo: "Animais",
        colunas: [
          { chave: "uep", rotulo: "UEP", peso: 1.6 },
          { chave: "brinco", rotulo: "Brinco", peso: 1.2 },
          { chave: "categoria", rotulo: "Categoria", peso: 1.3 },
          { chave: "sexo", rotulo: "Sexo", peso: 0.9 },
          { chave: "raca", rotulo: "Raça", peso: 1.6 },
          { chave: "status", rotulo: "Fase reprodutiva", peso: 1.5 },
          { chave: "estagio", rotulo: "Estágio", peso: 1 },
          { chave: "idade", rotulo: "Meses", alinhar: "right", peso: 0.8 },
        ],
        linhas: animais.map((a) => ({
          uep: a.uep_nome,
          brinco: a.brinco,
          categoria: rotulo(a.categoria),
          sexo: rotulo(a.sexo),
          raca: a.raca,
          status: rotulo(a.status_reprodutivo),
          estagio: rotulo(a.estagio_vida),
          idade: a.idade_meses,
        })),
        vazio: "Nenhum animal cadastrado.",
      },
    ],
  };
}

async function movimentacaoEstoque({ uepIds, dataInicio, dataFim }) {
  const [movs, resumo] = await Promise.all([
    relatoriosRepository.movimentacoes(uepIds, dataInicio, dataFim),
    relatoriosRepository.resumoMovimentacoes(uepIds, dataInicio, dataFim),
  ]);
  return {
    titulo: "Movimentação de estoque",
    secoes: [
      {
        titulo: "Resumo por insumo no período",
        colunas: [
          { chave: "uep", rotulo: "UEP", peso: 1.6 },
          { chave: "insumo", rotulo: "Insumo", peso: 2 },
          { chave: "unidade", rotulo: "Unid.", peso: 0.7 },
          { chave: "entradas", rotulo: "Entradas", alinhar: "right" },
          { chave: "saidas", rotulo: "Saídas", alinhar: "right" },
          { chave: "saldo_atual", rotulo: "Saldo atual", alinhar: "right" },
        ],
        linhas: resumo,
        vazio: "Nenhum insumo cadastrado.",
      },
      {
        titulo: "Movimentações",
        colunas: [
          { chave: "data", rotulo: "Data", peso: 1 },
          { chave: "uep", rotulo: "UEP", peso: 1.4 },
          { chave: "insumo", rotulo: "Insumo", peso: 1.6 },
          { chave: "tipo", rotulo: "Tipo", peso: 0.9 },
          { chave: "quantidade", rotulo: "Qtd.", alinhar: "right", peso: 0.9 },
          { chave: "unidade", rotulo: "Unid.", peso: 0.6 },
          { chave: "responsavel", rotulo: "Responsável", peso: 1.4 },
          { chave: "observacao", rotulo: "Observação", peso: 2 },
        ],
        linhas: movs.map((m) => ({ ...m, tipo: rotulo(m.tipo) })),
        vazio: "Nenhuma movimentação no período.",
      },
    ],
  };
}

async function necessidadesCompras({ uepIds, dias }) {
  const ueps = (await uepsRepository.findAll({})).filter((u) => !uepIds || uepIds.includes(u.id));
  const linhas = [];
  const rebanho = [];
  for (const uep of ueps) {
    const [insumos, animais] = await Promise.all([
      estoqueRepository.findInsumos(uep.id),
      comprasRepository.countAnimaisPorCategoria(uep.id),
    ]);
    for (const i of consolidarInsumos(insumos, dias)) linhas.push({ uep: uep.nome, ...i, urgencia: rotulo(i.urgencia) });
    for (const a of animais.filter((l) => l.em_descarte > 0)) {
      rebanho.push({ uep: uep.nome, categoria: rotulo(a.categoria), total: a.total, reposicao: a.em_descarte });
    }
  }
  return {
    titulo: "Necessidades de compra",
    filtrosExtras: [`Horizonte: ${dias} dias`],
    secoes: [
      {
        titulo: "Insumos",
        colunas: [
          { chave: "uep", rotulo: "UEP", peso: 1.5 },
          { chave: "nome", rotulo: "Insumo", peso: 1.8 },
          { chave: "unidade", rotulo: "Unid.", peso: 0.6 },
          { chave: "saldo_atual", rotulo: "Saldo", alinhar: "right" },
          { chave: "estoque_minimo", rotulo: "Mínimo", alinhar: "right" },
          { chave: "previsao_dias", rotulo: "Dura (dias)", alinhar: "right" },
          { chave: "quantidade_sugerida", rotulo: "Comprar", alinhar: "right" },
          { chave: "urgencia", rotulo: "Urgência" },
        ],
        linhas,
        vazio: "Nenhum insumo cadastrado.",
      },
      {
        titulo: "Reposição de animais (descarte)",
        colunas: [
          { chave: "uep", rotulo: "UEP", peso: 1.5 },
          { chave: "categoria", rotulo: "Categoria", peso: 1.5 },
          { chave: "total", rotulo: "No rebanho", alinhar: "right" },
          { chave: "reposicao", rotulo: "Repor", alinhar: "right" },
        ],
        linhas: rebanho,
        vazio: "Nenhum animal em descarte.",
      },
    ],
  };
}

export const TIPOS = Object.freeze({
  "censo-geral": { montar: censoGeral, usaPeriodo: false },
  "status-reprodutivo": { montar: statusReprodutivo, usaPeriodo: false },
  "movimentacao-estoque": { montar: movimentacaoEstoque, usaPeriodo: true },
  "necessidades-compras": { montar: necessidadesCompras, usaPeriodo: false },
});

// ------------------------------------------------------------ validação

/**
 * Valida tipo e parâmetros (puro, sem banco — ver test/relatorios.test.js).
 * Devolve { tipo, formato, uepId|null, dataInicio, dataFim, dias }.
 */
export function validarPedido(tipo, corpo = {}, { hoje = hojeISO(), formatosAceitos = Object.keys(FORMATOS) } = {}) {
  const def = TIPOS[tipo];
  if (!def) {
    throw ApiError.badRequest(`Relatório desconhecido: ${tipo}. Tipos: ${Object.keys(TIPOS).join(", ")}`);
  }
  const formato = corpo.formato ?? "pdf";
  if (!formatosAceitos.includes(formato)) {
    throw ApiError.badRequest(`formato inválido: ${formato}. Aceitos: ${formatosAceitos.join(", ")}`);
  }
  const uepId =
    corpo.uepId === undefined || corpo.uepId === null || corpo.uepId === "" ? null : parseId(corpo.uepId, "uepId");

  let dataInicio = null;
  let dataFim = null;
  if (def.usaPeriodo) {
    dataInicio = parseData(corpo.dataInicio, "dataInicio");
    dataFim = parseData(corpo.dataFim, "dataFim");
    if (!dataInicio || !dataFim) {
      throw ApiError.badRequest("Informe dataInicio e dataFim (AAAA-MM-DD) para este relatório.");
    }
    if (dataInicio > dataFim) throw ApiError.badRequest("dataInicio não pode ser depois de dataFim.");
    if (dataInicio > hoje) throw ApiError.badRequest("O período não pode começar no futuro.");
    const dias = (Date.parse(dataFim) - Date.parse(dataInicio)) / 86400000 + 1;
    if (dias > PERIODO_MAX_DIAS) {
      throw ApiError.badRequest(`O período pode ter no máximo ${PERIODO_MAX_DIAS} dias.`);
    }
  }

  let dias = DIAS_PADRAO;
  if (corpo.dias !== undefined && corpo.dias !== null && corpo.dias !== "") {
    dias = Number(corpo.dias);
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
      throw ApiError.badRequest("dias deve ser um inteiro entre 1 e 365.");
    }
  }

  return { tipo, formato, uepId, dataInicio, dataFim, dias };
}

/**
 * Monta e renderiza o relatório. Devolve { buffer, contentType, nome }.
 * Também usado pela união de PDFs (documentos), sempre em PDF.
 */
export async function gerarRelatorio(tipo, corpo = {}, opcoes = {}) {
  const pedido = validarPedido(tipo, corpo, opcoes);

  let nomeUep = "Todas as UEPs";
  if (pedido.uepId !== null) {
    const uep = await uepsRepository.findById(pedido.uepId);
    if (!uep) throw ApiError.notFound(`UEP ${pedido.uepId} não encontrada`);
    nomeUep = uep.nome;
  }
  const uepIds = pedido.uepId === null ? null : [pedido.uepId];

  const dados = await TIPOS[tipo].montar({ ...pedido, uepIds });
  const filtros = [`Setor: ${nomeUep}`];
  if (pedido.dataInicio) filtros.push(`Período: ${brData(pedido.dataInicio)} a ${brData(pedido.dataFim)}`);
  filtros.push(...(dados.filtrosExtras ?? []));

  const relatorio = { titulo: dados.titulo, filtros, geradoEm: new Date(), secoes: dados.secoes };
  const fmt = FORMATOS[pedido.formato];
  const buffer = pedido.formato === "xlsx" ? renderizarXlsx(relatorio) : await renderizarPdf(relatorio);

  return { buffer, contentType: fmt.contentType, nome: `relatorio-${tipo}-${hojeISO()}.${fmt.ext}` };
}
