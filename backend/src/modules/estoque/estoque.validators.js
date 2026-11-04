import { ApiError } from "../../utils/ApiError.js";

// parseId/parseTexto/parseData ficam em utils/validacao.js (usados por todos
// os modulos); reexportados
// aqui para nao quebrar quem ja importa daqui.
export { parseId, parseTexto, parseData } from "../../utils/validacao.js";

// Maior valor aceito em saldo/quantidade (NUMERIC(14,3) comporta ate 11
// digitos inteiros; 1e10 deixa folga para somar entradas sem estourar).
export const MAX_VALOR = 1e10;

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

/** Formata numero para mensagem ao usuario (pt-BR, ate 3 casas, sem zeros sobrando). */
export function formatarQuantidade(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
