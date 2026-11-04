import { ApiError } from "../../utils/ApiError.js";
import {
  ANIMAL_CATEGORIAS,
  ANIMAL_SEXOS,
  STATUS_REPRODUTIVOS,
} from "../../config/enums.js";
import { ESTAGIOS_VIDA } from "./animais.genetica.js";
import {
  parseId,
  parseEnumOpcional,
  parseBooleanoOpcional,
  parseTexto,
  parseData,
  hojeISO,
} from "../../utils/validacao.js";

/*
 * Validação do corpo de criação/edição de animal. Funções puras (sem banco)
 * — ver test/animaisValidators.test.js.
 *
 * Devolve só as chaves que vieram no corpo, já no nome da coluna e
 * normalizadas. Isso permite que o PATCH LIMPE um campo opcional mandando
 * null (antes o COALESCE do UPDATE ignorava o null e, por exemplo, apagar as
 * observações no formulário não tinha efeito nenhum).
 */

// campo do corpo (camelCase) -> coluna no banco
const CAMPOS_TEXTO = {
  raca: { coluna: "raca", max: 100 },
  brinco: { coluna: "brinco", max: 50 },
  corteAustraliano: { coluna: "corte_australiano", max: 50 },
  sisbov: { coluna: "sisbov", max: 15 },
  observacoes: { coluna: "observacoes", max: 2000 },
  grauSangue: { coluna: "grau_sangue", max: 30 },
};

// genealogia (Sprint 6): id do pai/mãe; null ou "" desfaz o vínculo
const CAMPOS_PARENTESCO = { paiId: "pai_id", maeId: "mae_id" };

// obrigatórios no banco: no PATCH, null/"" é tratado como "não mexer"
const CAMPOS_ENUM = {
  categoria: { coluna: "categoria", valores: ANIMAL_CATEGORIAS },
  sexo: { coluna: "sexo", valores: ANIMAL_SEXOS },
  statusReprodutivo: { coluna: "status_reprodutivo", valores: STATUS_REPRODUTIVOS },
};

function presente(body, chave) {
  return Object.prototype.hasOwnProperty.call(body, chave);
}

export function parseDataNascimento(value, hoje = hojeISO()) {
  const data = parseData(value, "dataNascimento");
  if (data && data > hoje) {
    throw ApiError.badRequest("dataNascimento não pode ser uma data futura.");
  }
  return data;
}

/**
 * @param {object} body  corpo da requisição
 * @param {{ parcial?: boolean }} opcoes  parcial = PATCH (só o que veio)
 * @returns {object} colunas -> valores
 */
export function validarAnimal(body = {}, { parcial = false } = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw ApiError.badRequest("Corpo da requisição inválido.");
  }
  const dados = {};

  for (const [chave, def] of Object.entries(CAMPOS_ENUM)) {
    const valor = parseEnumOpcional(body[chave], def.valores, chave);
    if (valor !== undefined) dados[def.coluna] = valor;
  }

  if (!parcial) {
    if (!dados.categoria || !dados.sexo) {
      throw ApiError.badRequest("categoria e sexo são obrigatórios");
    }
    dados.status_reprodutivo = dados.status_reprodutivo ?? "NAO_APLICAVEL";
  }

  for (const [chave, def] of Object.entries(CAMPOS_TEXTO)) {
    if (presente(body, chave)) dados[def.coluna] = parseTexto(body[chave], chave, { max: def.max });
  }

  for (const [chave, coluna] of Object.entries(CAMPOS_PARENTESCO)) {
    if (!presente(body, chave)) continue;
    const valor = body[chave];
    dados[coluna] = valor === null || valor === "" ? null : parseId(valor, chave);
  }

  if (presente(body, "dataNascimento")) {
    dados.data_nascimento = parseDataNascimento(body.dataNascimento);
  }

  if (presente(body, "disponivel")) {
    const disponivel = parseBooleanoOpcional(body.disponivel, "disponivel");
    if (disponivel !== undefined) dados.disponivel = disponivel;
  }

  return dados;
}

/** Filtros de listagem/censo vindos da query string. */
export function validarFiltros(query = {}) {
  const busca = parseTexto(query.busca, "busca", { max: 50 });
  return {
    categoria: parseEnumOpcional(query.categoria, ANIMAL_CATEGORIAS, "categoria"),
    sexo: parseEnumOpcional(query.sexo, ANIMAL_SEXOS, "sexo"),
    statusReprodutivo: parseEnumOpcional(
      query.statusReprodutivo,
      STATUS_REPRODUTIVOS,
      "statusReprodutivo"
    ),
    disponivel: parseBooleanoOpcional(query.disponivel, "disponivel"),
    estagioVida: parseEnumOpcional(query.estagioVida, ESTAGIOS_VIDA, "estagioVida"),
    busca: busca ?? undefined,
  };
}
