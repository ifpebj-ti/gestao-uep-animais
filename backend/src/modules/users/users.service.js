import bcrypt from "bcryptjs";
import { usersRepository } from "./users.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { ALL_ROLES } from "../../config/roles.js";

const SALT_ROUNDS = 10;

function assertValidRole(role) {
  if (!ALL_ROLES.includes(role)) {
    throw ApiError.badRequest(
      `Papel inválido: ${role}. Valores aceitos: ${ALL_ROLES.join(", ")}`
    );
  }
}

export const usersService = {
  async list(filters) {
    return usersRepository.findAll(filters);
  },

  async getById(id) {
    const user = await usersRepository.findById(id);
    if (!user) throw ApiError.notFound("Usuário não encontrado");
    return user;
  },

  async create({ nome, email, senha, role }) {
    if (!nome || !email || !senha) {
      throw ApiError.badRequest("nome, email e senha são obrigatórios");
    }
    assertValidRole(role);

    const existing = await usersRepository.findByEmail(email);
    if (existing) throw ApiError.conflict("Já existe um usuário com esse e-mail");

    const passwordHash = await bcrypt.hash(senha, SALT_ROUNDS);
    return usersRepository.create({ nome, email, passwordHash, role });
  },

  async update(id, { nome, role, ativo }) {
    if (role) assertValidRole(role);
    const updated = await usersRepository.update(id, { nome, role, ativo });
    if (!updated) throw ApiError.notFound("Usuário não encontrado");
    return updated;
  },

  async changePassword(id, novaSenha) {
    if (!novaSenha || novaSenha.length < 6) {
      throw ApiError.badRequest("A nova senha deve ter ao menos 6 caracteres");
    }
    const passwordHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);
    await usersRepository.updatePassword(id, passwordHash);
  },

  async remove(id) {
    const removed = await usersRepository.remove(id);
    if (!removed) throw ApiError.notFound("Usuário não encontrado");
  },
};
