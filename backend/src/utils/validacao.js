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
