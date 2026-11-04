import jwt from "jsonwebtoken";
import "dotenv/config";

export const SEGREDO_PADRAO = "troque-este-segredo-em-producao";

/*
 * Em produção o segredo do JWT é obrigatório e não pode ser o valor de
 * exemplo: com ele qualquer pessoa que leu o .env.example consegue assinar
 * um token de ADMIN. Fora de produção o padrão continua valendo para ninguém
 * precisar configurar nada ao rodar localmente.
 */
export function resolverSegredo(env = process.env) {
  const segredo = env.JWT_SECRET;
  if (env.NODE_ENV === "production" && (!segredo || segredo === SEGREDO_PADRAO)) {
    throw new Error(
      "JWT_SECRET ausente ou com o valor de exemplo em produção. " +
        "Gere um segredo forte (ex.: openssl rand -hex 32) e defina no .env."
    );
  }
  return segredo || SEGREDO_PADRAO;
}

const SECRET = resolverSegredo();
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
