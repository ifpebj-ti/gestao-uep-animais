import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseId } from "../utils/validacao.js";
import { ROLES } from "../config/roles.js";
import { uepsRepository } from "../modules/ueps/ueps.repository.js";
import { temAcessoAUep } from "../modules/ueps/ueps.acesso.js";

/**
 * Isolamento por UEP no BACKEND: o front já escondia as UEPs de fora, mas
 * a API aceitava qualquer :uepId de qualquer usuário logado.
 *
 * Deve vir depois de `authenticate`. Responde:
 *   400 -> :uepId não é um id válido
 *   404 -> UEP não existe (só a Diretoria vê essa distinção)
 *   403 -> a UEP existe, mas não é uma das UEPs do usuário
 * Em caso de sucesso deixa req.uepId (número) para os handlers seguintes.
 */
export const requireUepAccess = asyncHandler(async (req, _res, next) => {
  const uepId = parseId(req.params.uepId, "uepId");
  const user = req.user;

  if (user.role === ROLES.ADMIN) {
    const uep = await uepsRepository.findById(uepId);
    if (!uep) throw ApiError.notFound(`UEP ${uepId} não encontrada`);
  } else if (!(await temAcessoAUep(user, uepId))) {
    throw ApiError.forbidden("Você não tem acesso a esta UEP.");
  }

  req.uepId = uepId;
  next();
});
