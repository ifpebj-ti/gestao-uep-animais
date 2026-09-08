export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Não autenticado") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Sem permissão para executar esta ação") {
    return new ApiError(403, message);
  }
  static notFound(message = "Recurso não encontrado") {
    return new ApiError(404, message);
  }
  static conflict(message) {
    return new ApiError(409, message);
  }
}
