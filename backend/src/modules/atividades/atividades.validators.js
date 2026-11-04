import { ApiError } from "../../utils/ApiError.js";
import { parseId, parseEnumOpcional, parseTexto, parseData } from "../../utils/validacao.js";

export const ATIVIDADE_TIPOS = Object.freeze(["GESTACAO", "VERMIFUGO", "VACINA", "AULA_MANEJO", "OUTRO"]);

// Tipos que sempre se referem a um animal específico (o front exige também).
export const TIPOS_COM_ANIMAL = Object.freeze(["GESTACAO", "VERMIFUGO", "VACINA"]);

export const ANO_MINIMO = 2000;
export const ANO_MAXIMO = 2100;

/** "HH:MM" (00:00 a 23:59). Ausente/vazio -> null. */
export function parseHora(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.slice(0, 5)) || value.length > 8) {
    throw ApiError.badRequest("hora inválida. Use o formato HH:MM.");
  }
  return value.slice(0, 5);
}

export function parseAno(value, anoAtual) {
  if (value === undefined || value === null || value === "") return anoAtual;
  const ano = typeof value === "string" && /^\d{4}$/.test(value) ? Number(value) : value;
  if (!Number.isInteger(ano) || ano < ANO_MINIMO || ano > ANO_MAXIMO) {
    throw ApiError.badRequest(`ano deve estar entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`);
  }
  return ano;
}

function presente(body, chave) {
  return Object.prototype.hasOwnProperty.call(body, chave);
}

/**
 * Corpo de POST/PATCH (camelCase, como o front manda). Devolve só as colunas
 * presentes; parcial = PATCH. A checagem "este tipo exige animal" é feita
 * sobre o estado final, em validarEstadoFinal.
 */
export function validarAtividade(body = {}, { parcial = false } = {}) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw ApiError.badRequest("Corpo da requisição inválido.");
  }
  const dados = {};

  if (!parcial || presente(body, "tipo")) {
    const tipo = parseEnumOpcional(body.tipo, ATIVIDADE_TIPOS, "tipo");
    if (!tipo) throw ApiError.badRequest("tipo é obrigatório.");
    dados.tipo = tipo;
  }
  if (!parcial || presente(body, "data")) {
    const data = parseData(body.data, "data");
    if (!data) throw ApiError.badRequest("data é obrigatória (AAAA-MM-DD).");
    const ano = Number(data.slice(0, 4));
    if (ano < ANO_MINIMO || ano > ANO_MAXIMO) {
      throw ApiError.badRequest(`data deve estar entre ${ANO_MINIMO} e ${ANO_MAXIMO}.`);
    }
    dados.data = data;
  }
  if (presente(body, "hora")) dados.hora = parseHora(body.hora);
  if (presente(body, "animalId")) {
    dados.animal_id = body.animalId === null || body.animalId === "" ? null : parseId(body.animalId, "animalId");
  }
  if (presente(body, "observacao")) dados.observacao = parseTexto(body.observacao, "observacao", { max: 1000 });

  return dados;
}

/** Regras sobre o estado final: tipos de animal exigem animal; gestação só em fêmea. */
export function validarEstadoFinal(final, animal) {
  if (TIPOS_COM_ANIMAL.includes(final.tipo) && !final.animal_id) {
    throw ApiError.badRequest(`Escolha o animal: o tipo ${final.tipo} se refere a um animal específico.`);
  }
  if (final.animal_id && !animal) {
    throw ApiError.badRequest("Animal não encontrado nesta UEP.");
  }
  if (final.tipo === "GESTACAO" && animal && animal.sexo !== "FEMEA") {
    throw ApiError.badRequest("Gestação só pode ser registrada para uma fêmea.");
  }
}
