import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { SENHA_MINIMA } from "../modules/users/users.service.js";

const SALT_ROUNDS = 10;

export function validarNovaSenha(email, senha) {
  if (typeof email !== "string" || !email.trim()) {
    throw new Error("Informe o e-mail da conta.");
  }
  if (typeof senha !== "string" || senha.length < SENHA_MINIMA) {
    throw new Error(`A nova senha deve ter ao menos ${SENHA_MINIMA} caracteres.`);
  }
}

/**
 * Troca a senha de qualquer conta direto no banco. Existe porque a API não
 * deixa a Diretoria trocar a própria senha nem a de outra conta da
 * Diretoria (ela só gerencia Professores), e as contas semente precisam sair
 * da senha padrão antes de o ambiente ir para os auditores.
 */
export async function redefinirSenha(email, senha) {
  validarNovaSenha(email, senha);
  const hash = await bcrypt.hash(senha, SALT_ROUNDS);
  const { rows } = await query(
    `UPDATE users SET password_hash = $2, updated_at = now()
     WHERE email = $1
     RETURNING email, role`,
    [email.trim().toLowerCase(), hash]
  );
  if (!rows.length) throw new Error(`Nenhuma conta com o e-mail ${email}.`);
  return rows[0];
}
