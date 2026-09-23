import bcrypt from "bcryptjs";
import { usersRepository } from "./users.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ALL_ROLES, ROLES } from "../../config/roles.js";
import {
  assertCanManage,
  assertCanAssignRole,
  scopeListFilters,
} from "./users.policy.js";

const SALT_ROUNDS = 10;

function assertValidRole(role) {
  if (!ALL_ROLES.includes(role)) {
    throw ApiError.badRequest(
      `Papel inválido: ${role}. Valores aceitos: ${ALL_ROLES.join(", ")}`
    );
  }
}

/* uepId vindo do corpo: undefined = não informado; null/"" = sem UEP. */
function normalizarUepId(uepId) {
  if (uepId === undefined) return undefined;
  if (uepId === null || uepId === "") return null;
  const n = Number(uepId);
  if (!Number.isInteger(n) || n <= 0) {
    throw ApiError.badRequest("uepId inválido");
  }
  return n;
}

async function carregarNoEscopo(actor, id) {
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw ApiError.notFound("Usuário não encontrado");
  }
  const target = await usersRepository.findById(Number(id));
  assertCanManage(actor, target);
  return target;
}

export const usersService = {
  /* Criação "crua", sem regra de hierarquia — usada só internamente pelo
     autocadastro (auth.service.js -> register), que tem as próprias regras. */
  async createAccount({ nome, email, senha, role, ativo = true, uepId = null, professorId = null }) {
    if (!nome || !email || !senha) {
      throw ApiError.badRequest("nome, email e senha são obrigatórios");
    }
    assertValidRole(role);

    const emailNormalizado = String(email).trim().toLowerCase();
    const existing = await usersRepository.findByEmail(emailNormalizado);
    if (existing) throw ApiError.conflict("Já existe um usuário com esse e-mail");

    const passwordHash = await bcrypt.hash(senha, SALT_ROUNDS);
    return usersRepository.create({
      nome,
      email: emailNormalizado,
      passwordHash,
      role,
      ativo,
      uepId,
      professorId,
    });
  },

  async list(actor, query) {
    return usersRepository.findAll(scopeListFilters(actor, query));
  },

  /* GET /users/me — o próprio perfil, sem regra de hierarquia. */
  async getSelf(id) {
    const user = await usersRepository.findById(id);
    if (!user) throw ApiError.notFound("Usuário não encontrado");
    return user;
  },

  async getById(actor, id) {
    return carregarNoEscopo(actor, id);
  },

  /* POST /users
     - ADMIN cria PROFESSOR, com uepId opcional vindo do corpo.
     - PROFESSOR cria ALUNO/TECNICO/ESTAGIARIO na própria equipe. Nesse caso
       professor_id e uep_id NUNCA vêm do corpo: professor_id é o id do
       token, e uep_id é a UEP atual desse professor lida do banco (não do
       token, pra continuar certa mesmo se a Diretoria trocar a UEP dele
       depois do login). Qualquer professorId/uepId no corpo é ignorado. */
  async create(actor, { nome, email, senha, role, uepId }) {
    assertValidRole(role);
    assertCanAssignRole(actor, role);

    if (actor.role === ROLES.PROFESSOR) {
      const professor = await usersRepository.findById(actor.id);
      if (!professor) throw ApiError.unauthorized("Usuário do token não existe mais");
      return this.createAccount({
        nome,
        email,
        senha,
        role,
        uepId: professor.uep_id,
        professorId: professor.id,
      });
    }

    return this.createAccount({
      nome,
      email,
      senha,
      role,
      uepId: normalizarUepId(uepId) ?? null,
      professorId: null,
    });
  },

  /* PATCH /users/:id
     - ADMIN: edita Professores (nome, ativo, uepId). Trocar a UEP do
       Professor leva a equipe dele junto.
     - PROFESSOR: edita a própria equipe (nome, role entre os papéis de
       equipe, ativo). Não pode mexer em uepId: a UEP da equipe é sempre a
       dele. */
  async update(actor, id, { nome, role, ativo, uepId }) {
    const target = await carregarNoEscopo(actor, id);

    if (role !== undefined) {
      assertValidRole(role);
      assertCanAssignRole(actor, role);
    }

    let novoUep;
    if (uepId !== undefined) {
      if (actor.role !== ROLES.ADMIN) {
        throw ApiError.forbidden(
          "A UEP de um integrante da equipe é sempre a do professor responsável."
        );
      }
      novoUep = normalizarUepId(uepId);
    }

    const updated = await usersRepository.update(target.id, {
      nome,
      role,
      ativo,
      uepId: novoUep,
    });

    if (novoUep !== undefined && updated.role === ROLES.PROFESSOR) {
      await usersRepository.updateTeamUep(updated.id, novoUep);
    }

    return updated;
  },

  async changePassword(actor, id, novaSenha) {
    const target = await carregarNoEscopo(actor, id);
    if (!novaSenha || novaSenha.length < 6) {
      throw ApiError.badRequest("A nova senha deve ter ao menos 6 caracteres");
    }
    const passwordHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await usersRepository.updatePassword(target.id, passwordHash);
  },

  async remove(actor, id) {
    const target = await carregarNoEscopo(actor, id);
    await usersRepository.remove(target.id);
  },
};
