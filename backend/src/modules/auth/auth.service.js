import bcrypt from "bcryptjs";
import { usersRepository } from "../users/users.repository.js";
import { signToken } from "../../utils/jwt.js";
import { ApiError } from "../../utils/ApiError.js";

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
};
