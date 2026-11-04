import { ROLES } from "../../config/roles.js";
import { ApiError } from "../../utils/ApiError.js";
import { parseId } from "../../utils/validacao.js";
import { usersRepository } from "../users/users.repository.js";
import { podeAcessarUep } from "./ueps.policy.js";

/**
 * UEPs que o usuário pode ver. `null` significa "todas" (Diretoria); para os
 * demais devolve a lista de ids (pode ser vazia).
 */
export async function uepsAcessiveis(user) {
  if (!user) return [];
  if (user.role === ROLES.ADMIN) return null;
  if (user.role === ROLES.PROFESSOR) {
    return (await usersRepository.findProfessorUeps(user.id)).map((u) => u.id);
  }
  return user.uepId ? [Number(user.uepId)] : [];
}

/** true se o usuário pode acessar a UEP (regra de ueps.policy.js com os dados do banco). */
export async function temAcessoAUep(user, uepId) {
  if (user?.role === ROLES.ADMIN) return true;
  const professorUepIds =
    user?.role === ROLES.PROFESSOR
      ? (await usersRepository.findProfessorUeps(user.id)).map((u) => u.id)
      : [];
  return podeAcessarUep(user, uepId, professorUepIds);
}

/**
 * Escopo de UEPs de uma consulta "entre setores" (rotas na raiz, ex.
 * GET /api/animais). Se veio um uepId explícito, ele precisa ser uma das UEPs
 * do usuário (senão 403) e vira o único escopo. Sem uepId: Diretoria -> null
 * (todas), demais -> só as próprias UEPs.
 */
export async function resolverEscopo(user, uepIdPedido) {
  const acessiveis = await uepsAcessiveis(user);
  if (uepIdPedido === undefined || uepIdPedido === null || uepIdPedido === "") {
    return acessiveis;
  }
  const uepId = parseId(uepIdPedido, "uepId");
  if (acessiveis !== null && !acessiveis.includes(uepId)) {
    throw ApiError.forbidden("Você não tem acesso a esta UEP.");
  }
  return [uepId];
}
