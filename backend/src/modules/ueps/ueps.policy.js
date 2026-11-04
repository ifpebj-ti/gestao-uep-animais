import { ROLES } from "../../config/roles.js";

/*
 * Quem pode acessar os dados de uma UEP (animais, estoque, compras e o que
 * mais for aninhado em /ueps/:uepId). Função pura para dar pra testar sem
 * banco (ver test/uepsPolicy.test.js).
 *
 *   ADMIN (Diretoria)            -> todas as UEPs
 *   PROFESSOR                    -> as UEPs que a Diretoria concedeu (professor_ueps)
 *   ALUNO / TECNICO / ESTAGIARIO -> só a própria UEP (users.uep_id)
 *
 * professorUepIds só é consultado para PROFESSOR.
 */
export function podeAcessarUep(user, uepId, professorUepIds = []) {
  if (!user) return false;
  const alvo = Number(uepId);
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.PROFESSOR) return professorUepIds.map(Number).includes(alvo);
  return user.uepId != null && Number(user.uepId) === alvo;
}
