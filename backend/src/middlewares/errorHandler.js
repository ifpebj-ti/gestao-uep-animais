import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Rota não encontrada" });
}

// Erros do próprio body-parser do Express (express.json()).
function mapBodyParserError(err) {
  if (err.type === "entity.parse.failed") {
    return ApiError.badRequest("Corpo da requisição não é um JSON válido.");
  }
  if (err.type === "entity.too.large") {
    return new ApiError(413, "Corpo da requisição grande demais.");
  }
  return null;
}

// Trata violação de FK/UNIQUE do Postgres de forma amigável
export function mapPgError(err) {
  if (err.code === "23505") {
    return ApiError.conflict("Já existe um registro com esse valor único (violação de UNIQUE).");
  }
  if (err.code === "23503") {
    return ApiError.badRequest("Referência inválida: FK aponta para um registro inexistente.");
  }
  return null;
}

/* Converte qualquer erro em ApiError (o que não é reconhecido vira 500). */
export function toApiError(err) {
  if (err instanceof ApiError) return err;
  return mapBodyParserError(err) ?? mapPgError(err);
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = toApiError(err);

  if (!error) {
    console.error("Erro não tratado:", err);
    error = new ApiError(500, "Erro interno do servidor");
  }

  res.status(error.statusCode).json({
    error: error.message,
    details: error.details ?? undefined,
  });
}
