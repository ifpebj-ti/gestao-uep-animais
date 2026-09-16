import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import { usersRepository } from "../users/users.repository.js";
import { usersService } from "../users/users.service.js";
import { signToken } from "../../utils/jwt.js";
import { ApiError } from "../../utils/ApiError.js";

// Papéis que permitem autocadastro (sem intervenção de ADMIN)
const SELF_REGISTER_ROLES = ["ALUNO", "TECNICO", "ESTAGIARIO", "PROFESSOR"];

// E-mails deste domínio são tratados como institucionais: uma conta criada
// via Google com esse domínio já nasce como Professor e ativa. Qualquer
// outro domínio vira Aluno, mas fica pendente (ativo=false) até a
// Diretoria aprovar em Controle de Acesso.
const DOMINIO_INSTITUCIONAL = "@ifpe.edu.br";

// Só é instanciado se GOOGLE_CLIENT_ID estiver configurado — em ambientes
// sem essa env (ex.: alguém rodando só com login por e-mail/senha),
// loginWithGoogle() abaixo já falha com uma mensagem clara em vez de
// quebrar a inicialização do servidor.
const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

export const authService = {
  async login({ email, senha }) {
    if (!email || !senha) {
      throw ApiError.badRequest("email e senha são obrigatórios");
    }

    const user = await usersRepository.findByEmail(email);
    if (!user || !user.ativo) {
      throw ApiError.unauthorized("Credenciais inválidas");
    }

    if (!user.password_hash) {
      // conta criada via login com Google — nunca teve senha
      throw ApiError.unauthorized(
        'Esta conta usa login com Google. Clique em "Continuar com Google" para entrar.'
      );
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

  /* POST /auth/google — recebe o ID token (credential) emitido pelo Google
     Identity Services no front, valida a assinatura/audience com o
     GOOGLE_CLIENT_ID do backend, e então:
     - se já existe usuário com esse e-mail, associa o google_id (se ainda
       não tinha) e faz login normalmente;
     - se não existe, cria a conta: e-mail @ifpe.edu.br entra direto como
       Professor ativo; qualquer outro e-mail entra como Aluno, mas
       pendente (ativo=false) até a Diretoria aprovar.
     Quando a conta está pendente, devolve { pendente: true, message } em
     vez de token — o controller usa isso pra responder 202 em vez de 200. */
  async loginWithGoogle(credential) {
    if (!credential) {
      throw ApiError.badRequest("credential (token do Google) é obrigatório");
    }
    if (!googleClient) {
      throw ApiError.badRequest(
        "Login com Google não está configurado neste ambiente (falta GOOGLE_CLIENT_ID)."
      );
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      throw ApiError.unauthorized("Token do Google inválido ou expirado");
    }

    if (!payload || !payload.email_verified) {
      throw ApiError.unauthorized("E-mail do Google não verificado");
    }

    const email = payload.email.toLowerCase();
    let user = await usersRepository.findByEmail(email);

    if (!user) {
      const institucional = email.endsWith(DOMINIO_INSTITUCIONAL);
      user = await usersRepository.createGoogleUser({
        nome: payload.name || email,
        email,
        googleId: payload.sub,
        role: institucional ? "PROFESSOR" : "ALUNO",
        ativo: institucional,
      });
    } else if (!user.google_id) {
      await usersRepository.linkGoogleId(user.id, payload.sub);
    }

    if (!user.ativo) {
      return {
        pendente: true,
        message:
          "Sua conta foi criada e está aguardando aprovação da Diretoria. " +
          "Você recebe acesso assim que ela liberar seu perfil.",
      };
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
        `Autocadastro não permitido para o perfil '${role}'. ` +
        `Perfis aceitos: ${SELF_REGISTER_ROLES.join(", ")}`
      );
    }

    // usersService.create já valida campos obrigatórios, e-mail duplicado e hash da senha
    const user = await usersService.create({ nome, email, senha, role });
    const token = signToken({ sub: user.id, email: user.email, role: user.role });

    return {
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
    };
  },
};
