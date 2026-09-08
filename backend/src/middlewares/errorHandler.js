import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Rota não encontrada" });
}

// Trata violação de FK/UNIQUE do Postgres de forma amigável
function mapPgError(err) {
  if (err.code === "23505") {
    return ApiError.conflict("Já existe um registro com esse valor único (violação de UNIQUE).");
  }
  if (err.code === "23503") {
    return ApiError.badRequest("Referência inválida: FK aponta para um registro inexistente.");
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let error = err instanceof ApiError ? err : mapPgError(err);

  if (!error) {
    console.error("Erro não tratado:", err);
    error = new ApiError(500, "Erro interno do servidor");
  }

  res.status(error.statusCode).json({
    error: error.message,
    details: error.details ?? undefined,
  });
}
