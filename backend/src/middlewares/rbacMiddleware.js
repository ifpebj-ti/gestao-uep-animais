import { ApiError } from "../utils/ApiError.js";
import { WRITE_ROLES } from "../config/roles.js";

/**
 * authorize("ADMIN", "PROFESSOR") -> só libera para esses papéis.
 * Deve ser usado sempre depois de `authenticate`.
 */
export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Papel '${req.user.role}' não autorizado para esta ação`));
    }
    next();
  };
}

/**
 * Atalho: qualquer usuário autenticado pode ler (GET),
 * mas somente papéis de escrita (ADMIN/PROFESSOR/TECNICO) podem
 * criar/atualizar/excluir. ALUNO e ESTAGIARIO ficam restritos à leitura.
 */
export function allowWriteOrReadOnly(req, _res, next) {
  if (!req.user) {
    return next(ApiError.unauthorized());
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return next();
  }
  if (!WRITE_ROLES.includes(req.user.role)) {
    return next(
      ApiError.forbidden(
        "Seu perfil tem acesso apenas de leitura/consulta neste recurso."
      )
    );
  }
  next();
}
