import { verifyToken } from "../utils/jwt.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { usersRepository } from "../modules/users/users.repository.js";

/**
 * Exige um Bearer token válido e uma conta que ainda exista e esteja ativa.
 * Popula req.user = { id, email, role, uepId }.
 *
 * O papel e o e-mail vêm do BANCO, não do token: assim, quando a Diretoria
 * desativa ou remove alguém, ou um Professor troca o papel de um integrante
 * da equipe, a mudança vale na próxima requisição — e não só quando o token
 * de 8h expirar.
 */
export const authenticate = asyncHandler(async (req, _res, next) => {
  // Routers aninhados (ex.: /ueps -> /:uepId/animais) aplicam authenticate
  // de novo; a conta já foi conferida nesta requisição, não consulta outra vez.
  if (req.authVerificado) return next();

  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Token de acesso ausente");
  }

  const token = header.slice("Bearer ".length).trim();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    throw ApiError.unauthorized("Token inválido ou expirado");
  }

  const id = Number(payload.sub);
  const conta = Number.isInteger(id) && id > 0 ? await usersRepository.findAuthById(id) : null;
  if (!conta || !conta.ativo) {
    throw ApiError.unauthorized("Sessão encerrada: a conta não existe mais ou foi desativada.");
  }

  req.user = { id: conta.id, email: conta.email, role: conta.role, uepId: conta.uep_id };
  req.authVerificado = true;
  next();
});
