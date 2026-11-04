import { ApiError } from "./ApiError.js";

/**
 * Valida um id numérico vindo da URL, query ou corpo. Aceita número ou
 * string só com dígitos; qualquer outra coisa ("abc", "1.5", "-3", "1e3")
 * vira 400 — antes esses valores chegavam ao Postgres e voltavam como 500.
 */
export function parseId(value, label = "id") {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : NaN;
  if (!Number.isSafeInteger(n) || n <= 0 || n > 2147483647) {
    throw ApiError.badRequest(`${label} inválido.`);
  }
  return n;
}

/**
 * Valida um valor opcional contra uma lista fechada (enum). Ausente/vazio
 * devolve undefined; valor fora da lista vira 400 com os valores aceitos.
 */
export function parseEnumOpcional(value, permitidos, label) {
  if (value === undefined || value === null || value === "") return undefined;
  if (!permitidos.includes(value)) {
    throw ApiError.badRequest(
      `${label} inválido: ${value}. Valores aceitos: ${permitidos.join(", ")}`
    );
  }
  return value;
}

/** Converte "true"/"false" de query string; ausente devolve undefined; outro valor, 400. */
export function parseBooleanoOpcional(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  throw ApiError.badRequest(`${label} deve ser true ou false.`);
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
export function parseData(value, label = "data") {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest(`${label} inválida. Use o formato AAAA-MM-DD.`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw ApiError.badRequest(`${label} inválida. Use uma data de calendário existente.`);
  }
  return value;
}

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília, para comparar com datas do usuário. */
export function hojeISO(agora = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(agora);
}
