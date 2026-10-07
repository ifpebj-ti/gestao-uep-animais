import { ApiError } from "../../utils/ApiError.js";

// Maior valor aceito em saldo/quantidade (NUMERIC(14,3) comporta ate 11
// digitos inteiros; 1e10 deixa folga para somar entradas sem estourar).
export const MAX_VALOR = 1e10;

export function parseId(value, label) {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(n) || n <= 0) {
    throw ApiError.badRequest(`${label} inválido.`);
  }
  return n;
}

/**
 * Converte para numero finito. `padrao` e usado quando o campo vem ausente
 * (undefined/null/""); sem padrao, o campo e obrigatorio.
 */
export function parseNumero(value, label, { padrao, minimoExclusivo = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (padrao !== undefined) return padrao;
    throw ApiError.badRequest(`${label} é obrigatório.`);
  }
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) {
    throw ApiError.badRequest(`${label} deve ser um número.`);
  }
  if (minimoExclusivo ? n <= 0 : n < 0) {
    throw ApiError.badRequest(
      minimoExclusivo ? `${label} deve ser maior que zero.` : `${label} não pode ser negativo.`
    );
  }
  if (n > MAX_VALOR) {
    throw ApiError.badRequest(`${label} excede o valor máximo permitido.`);
  }
  return n;
}

export function parseTexto(value, label, { max, obrigatorio = false } = {}) {
  if (value === undefined || value === null) {
    if (obrigatorio) throw ApiError.badRequest(`${label} é obrigatório.`);
    return null;
  }
  if (typeof value !== "string") {
    throw ApiError.badRequest(`${label} deve ser um texto.`);
  }
  const texto = value.trim();
  if (!texto) {
    if (obrigatorio) throw ApiError.badRequest(`${label} é obrigatório.`);
    return null;
  }
  if (max && texto.length > max) {
    throw ApiError.badRequest(`${label} deve ter no máximo ${max} caracteres.`);
  }
  return texto;
}

/** Aceita "AAAA-MM-DD" (data de calendario valida). Ausente -> null (banco usa hoje). */
export function parseData(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest("data inválida. Use o formato AAAA-MM-DD.");
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw ApiError.badRequest("data inválida. Use uma data de calendário existente.");
  }
  return value;
}

/** Formata numero para mensagem ao usuario (pt-BR, ate 3 casas, sem zeros sobrando). */
export function formatarQuantidade(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
