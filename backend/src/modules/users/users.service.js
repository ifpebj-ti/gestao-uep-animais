import bcrypt from "bcryptjs";
import { usersRepository } from "./users.repository.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
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

/* Normaliza uepId/uepIds vindos do corpo pra uma lista de inteiros únicos.
   Aceita tanto um array (uepIds: [1,2]) quanto um valor único (uepId: 1),
   null/"" /[] viram lista vazia ("nenhuma UEP"). */
function normalizarUepIds(valor) {
  const bruta = Array.isArray(valor) ? valor : valor === undefined || valor === null || valor === "" ? [] : [valor];
  const ids = bruta
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => Number(v));

  ids.forEach((n) => {
    if (!Number.isInteger(n) || n <= 0) {
      throw ApiError.badRequest("uepIds inválido: cada UEP precisa ser um id numérico válido.");
    }
  });

  return Array.from(new Set(ids));
}

/* Escolhe em qual UEP um novo integrante de equipe entra, validando que a
   UEP pedida (se veio alguma no corpo) está mesmo entre as que o Professor
   tem acesso — nunca confia cegamente no que o cliente manda. */
function escolherUepDaEquipe(idsPermitidos, uepIdEnviado) {
  if (idsPermitidos.length === 0) {
    throw ApiError.badRequest(
      "Você ainda não tem nenhuma UEP liberada pela Diretoria — peça a ela para te conceder acesso a pelo menos uma antes de cadastrar sua equipe."
    );
  }
  if (uepIdEnviado === undefined || uepIdEnviado === null || uepIdEnviado === "") {
    if (idsPermitidos.length === 1) return idsPermitidos[0];
    throw ApiError.badRequest("Selecione em qual das suas UEPs essa pessoa vai entrar.");
  }
  const escolhida = Number(uepIdEnviado);
  if (!Number.isInteger(escolhida) || !idsPermitidos.includes(escolhida)) {
    throw ApiError.forbidden("Você só pode cadastrar equipe em uma UEP que você mesmo tem acesso.");
  }
  return escolhida;
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

  /* GET /users/me — o próprio perfil, sem regra de hierarquia, com a lista
     de UEPs que esse usuário enxerga (ver accessibleUeps) — é o que o
     front usa pra decidir se pula a tela de seleção de setor. */
  async getSelf(id) {
    const user = await usersRepository.findById(id);
    if (!user) throw ApiError.notFound("Usuário não encontrado");
    const ueps = await this.accessibleUeps(user);
    return { ...user, ueps };
  },

  /* UEPs que um usuário pode acessar, pra tela de seleção de setor:
     - ADMIN (Diretoria): todas (ela supervisiona tudo).
     - PROFESSOR: as que a Diretoria concedeu (professor_ueps).
     - Equipe (Aluno/Técnico/Estagiário): só a própria (uep_id), 0 ou 1. */
  async accessibleUeps(user) {
    if (user.role === ROLES.ADMIN) {
      return uepsRepository.findAll({});
    }
    if (user.role === ROLES.PROFESSOR) {
      return user.ueps || usersRepository.findProfessorUeps(user.id);
    }
    if (user.uep_id) {
      const uep = await uepsRepository.findById(user.uep_id).catch(() => null);
      return uep ? [uep] : [];
    }
    return [];
  },

  async getById(actor, id) {
    return carregarNoEscopo(actor, id);
  },

  /* POST /users
     - ADMIN cria PROFESSOR, com uepIds opcional (lista de UEPs já
       concedidas na criação — pode vir vazio e a Diretoria concede depois).
     - PROFESSOR cria ALUNO/TECNICO/ESTAGIARIO na própria equipe. Nesse caso
       professor_id NUNCA vem do corpo: é sempre o id do token. uep_id
       também não vem cego do corpo — o cliente manda uepId só pra indicar
       qual das UEPs do PRÓPRIO professor aquela pessoa deve ocupar, e o
       backend valida que essa UEP está mesmo entre as dele (nunca aceita
       um id fora desse conjunto, senão um Professor mal-intencionado
       poderia colocar alguém numa UEP que não é dele). */
  async create(actor, { nome, email, senha, role, uepId, uepIds }) {
    assertValidRole(role);
    assertCanAssignRole(actor, role);

    if (actor.role === ROLES.PROFESSOR) {
      const professor = await usersRepository.findById(actor.id);
      if (!professor) throw ApiError.unauthorized("Usuário do token não existe mais");

      const idsPermitidos = (professor.ueps || []).map((u) => u.id);
      const uepEscolhida = escolherUepDaEquipe(idsPermitidos, uepId);

      return this.createAccount({
        nome,
        email,
        senha,
        role,
        uepId: uepEscolhida,
        professorId: professor.id,
      });
    }

    const criado = await this.createAccount({
      nome,
      email,
      senha,
      role,
      uepId: null,
      professorId: null,
    });

    if (role === ROLES.PROFESSOR) {
      const ids = normalizarUepIds(uepIds);
      if (ids.length) await usersRepository.setProfessorUeps(criado.id, ids);
      criado.ueps = ids.length ? await usersRepository.findProfessorUeps(criado.id) : [];
    }

    return criado;
  },

  /* PATCH /users/:id
     - ADMIN: edita Professores (nome, ativo, uepIds — substitui o conjunto
       inteiro de UEPs concedidas). Quando uma UEP sai do conjunto, quem da
       equipe daquele professor estava nela fica sem UEP (ver
       clearEquipeUepsForaDoEscopo).
     - PROFESSOR: edita a própria equipe (nome, role entre os papéis de
       equipe, ativo). Não pode mexer em uepId/uepIds — a UEP de um
       integrante é escolhida só na criação. */
  async update(actor, id, { nome, role, ativo, uepId, uepIds }) {
    const target = await carregarNoEscopo(actor, id);

    if (role !== undefined) {
      assertValidRole(role);
      assertCanAssignRole(actor, role);
    }

    const mudaUeps = uepIds !== undefined || uepId !== undefined;
    if (mudaUeps) {
      if (actor.role !== ROLES.ADMIN) {
        throw ApiError.forbidden(
          "A UEP de um integrante da equipe é definida na criação, pelo próprio Professor."
        );
      }
      if (target.role !== ROLES.PROFESSOR) {
        throw ApiError.badRequest("Só é possível definir UEPs para contas de Professor.");
      }
    }

    const updated = await usersRepository.update(target.id, { nome, role, ativo });

    if (mudaUeps) {
      const novasUepIds = normalizarUepIds(uepIds !== undefined ? uepIds : [uepId]);
      await usersRepository.setProfessorUeps(updated.id, novasUepIds);
      await usersRepository.clearEquipeUepsForaDoEscopo(updated.id, novasUepIds);
      updated.ueps = await usersRepository.findProfessorUeps(updated.id);
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
