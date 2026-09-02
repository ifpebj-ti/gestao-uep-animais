import bcrypt from "bcryptjs";
import { usersRepository } from "../users/users.repository.js";
import { usersService } from "../users/users.service.js";
import { signToken } from "../../utils/jwt.js";
import { ApiError } from "../../utils/ApiError.js";

const SELF_REGISTER_ROLES = ["ALUNO", "TECNICO", "ESTAGIARIO", "PROFESSOR"];

export const authService = {
  async login({ email, senha }) {
    if (!email || !senha) {
      throw ApiError.badRequest("email e senha são obrigatórios");
    }

    const user = await usersRepository.findByEmail(email);
    if (!user || !user.ativo) {
      throw ApiError.unauthorized("Credenciais inválidas");
    }

    const senhaOk = await bcrypt.compare(senha, user.password_hash);
    if (!senhaOk) {
      throw ApiError.unauthorized("Credenciais inválidas");
    }

    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return {
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    };
  },

  async register({ nome, email, senha, role }) {
    if (!role || !SELF_REGISTER_ROLES.includes(role)) {
      throw ApiError.badRequest(
        `Autocadastro não permitido para o perfil '${role}'. Perfis permitidos: ${SELF_REGISTER_ROLES.join(", ")}`
      );
    }

    const user = await usersService.create({ nome, email, senha, role });
    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return {
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    };
  },
};
