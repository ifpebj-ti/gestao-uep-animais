import { ROLES, MANAGEABLE_ROLES_BY } from "../../config/roles.js";
import { ApiError } from "../../utils/ApiError.js";

/*
 * Regras de autorização da gestão de usuários (hierarquia
 * Diretoria -> Professor -> Equipe). Funções puras, sem banco, para dar
 * pra testar isoladamente (ver test/usersPolicy.test.js).
 *
 * "actor"  = quem está logado ({ id, role }, vindo do JWT via authenticate)
 * "target" = o usuário que ele quer ver/editar/remover (linha do banco)
 */

export function manageableRoles(actor) {
  return MANAGEABLE_ROLES_BY[actor?.role] ?? [];
}

function isProfessor(actor) {
  return actor?.role === ROLES.PROFESSOR;
}

/* Alvo fora do escopo de quem está logado responde 404 (e não 403) de
   propósito: um Professor não deve nem conseguir descobrir se existe um
   usuário com aquele id na equipe de outro colega. */
export function assertCanManage(actor, target) {
  const foraDoEscopo =
    !target ||
    !manageableRoles(actor).includes(target.role) ||
    (isProfessor(actor) && Number(target.professor_id) !== Number(actor.id));

  if (foraDoEscopo) {
    throw ApiError.notFound("Usuário não encontrado");
  }
}

/* Papel que o actor está tentando atribuir (na criação ou num PATCH). */
export function assertCanAssignRole(actor, role) {
  const permitidos = manageableRoles(actor);
  if (!permitidos.includes(role)) {
    throw ApiError.forbidden(
      `Seu perfil só pode atribuir: ${permitidos.join(", ") || "nenhum perfil"}.`
    );
  }
}

/* Filtros de GET /users. Nunca devolve "todo mundo":
   - ADMIN: sempre role = PROFESSOR (pedir outro role é 403)
   - PROFESSOR: sempre professorId = ele mesmo, vindo do token. Um
     ?professorId= de outra pessoa é 403; sem o parâmetro, filtra sozinho. */
export function scopeListFilters(actor, { role, ativo, professorId } = {}) {
  const permitidos = manageableRoles(actor);

  if (role && !permitidos.includes(role)) {
    throw ApiError.forbidden(`Seu perfil só pode listar: ${permitidos.join(", ")}.`);
  }

  if (isProfessor(actor)) {
    if (professorId !== undefined && Number(professorId) !== Number(actor.id)) {
      throw ApiError.forbidden("Você só pode listar a sua própria equipe.");
    }
    return { roles: role ? [role] : permitidos, ativo, professorId: Number(actor.id) };
  }

  return { roles: role ? [role] : permitidos, ativo };
}
