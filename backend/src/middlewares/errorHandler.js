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

// Erros do multer (upload de arquivo, Sprint 13).
function mapMulterError(err) {
  // multipart quebrado (corpo cortado, sem boundary) vem do busboy, sem MulterError
  if (err.name !== "MulterError") {
    return /multipart|end of form|boundary/i.test(err.message ?? "")
      ? ApiError.badRequest("Envio de arquivo inválido (multipart malformado).")
      : null;
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return ApiError.badRequest("Arquivo grande demais: o limite é de 10 MB por arquivo.");
  }
  if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
    return ApiError.badRequest("Envie um único PDF no campo 'arquivo'.");
  }
  return ApiError.badRequest("Envio de arquivo inválido.");
}

// Trata violação de FK/UNIQUE do Postgres de forma amigável
export function mapPgError(err) {
  if (err.code === "23505") {
    return ApiError.conflict("Já existe um registro com esse valor único (violação de UNIQUE).");
  }
  if (err.code === "23503") {
    return ApiError.badRequest("Referência inválida: FK aponta para um registro inexistente.");
  }
  // Rede de segurança: valores que o Postgres não aceita (texto num campo
  // numérico, valor fora de um enum, data inexistente, CHECK violado,
  // número grande demais) são erro de quem chamou (400), não do servidor.
  if (["22P02", "22007", "22008", "23514", "22003"].includes(err.code)) {
    return ApiError.badRequest("Valor inválido em um dos campos enviados.");
  }
  return null;
}

/* Converte qualquer erro em ApiError (o que não é reconhecido vira 500). */
export function toApiError(err) {
  if (err instanceof ApiError) return err;
  return mapBodyParserError(err) ?? mapMulterError(err) ?? mapPgError(err);
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
