/*
 * Uso (no servidor, dentro do container do backend):
 *   docker compose exec -it backend node src/db/redefinir-senha.js admin@ifpe.edu.br
 *
 * A nova senha é pedida no terminal (ou lida de NOVA_SENHA, para automação),
 * para não ficar no histórico do shell nem na lista de processos.
 */
import "dotenv/config";
import readline from "node:readline";
import { pool } from "../config/db.js";
import { redefinirSenha } from "./redefinirSenha.js";

async function lerSenha() {
  if (process.env.NOVA_SENHA) return process.env.NOVA_SENHA;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
  const linhas = [];
  process.stdout.write("Nova senha e confirmação (uma por linha): ");
  for await (const linha of rl) {
    linhas.push(linha);
    if (linhas.length === 2) break;
  }
  rl.close();
  if (linhas.length < 2) throw new Error("Digite a nova senha e repita na linha seguinte.");
  if (linhas[0] !== linhas[1]) throw new Error("As senhas não conferem.");
  return linhas[0];
}

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Uso: node src/db/redefinir-senha.js <email>");
  const conta = await redefinirSenha(email, await lerSenha());
  console.log(`Senha de ${conta.email} (${conta.role}) redefinida.`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
