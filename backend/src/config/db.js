import pg from "pg";
import "dotenv/config";

const { Pool, types } = pg;

// Colunas DATE (ex.: data_nascimento, data de movimentação) voltam como texto
// "AAAA-MM-DD". Sem isso o pg cria um Date na meia-noite do fuso do processo,
// e num servidor com fuso diferente do de Brasília a data "voltava" um dia.
types.setTypeParser(1082, (valor) => valor);

export const SENHA_DB_PADRAO = "changeme";

/*
 * Em produção a senha do banco é obrigatória e não pode ser o valor de
 * exemplo do .env.example ("changeme"): antes, sem DB_PASSWORD, a API subia
 * silenciosamente com essa senha. Fora de produção o padrão continua valendo
 * (é o mesmo do docker-compose.yml de desenvolvimento).
 */
export function resolverSenhaDb(env = process.env) {
  const senha = env.DB_PASSWORD;
  if (env.NODE_ENV === "production" && (!senha || senha === SENHA_DB_PADRAO)) {
    throw new Error(
      "DB_PASSWORD ausente ou com o valor de exemplo em produção. " +
        "Defina uma senha forte para o Postgres no .env (a mesma de POSTGRES_PASSWORD)."
    );
  }
  return senha || SENHA_DB_PADRAO;
}

export const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "gestao_uep",
  user: process.env.DB_USER || "postgres",
  password: resolverSenhaDb(),
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool do Postgres:", err);
});

/**
 * O que vai para o log quando uma query falha. Os VALORES dos parâmetros
 * ficam de fora: eles incluem hash de senha (users), e-mails e o conteúdo
 * inteiro dos PDFs enviados (documentos, BYTEA de até 10 MB). Basta saber a
 * query, o código do Postgres e quantos parâmetros havia.
 */
export function resumoErroSql(text, params, err) {
  return {
    text,
    params: Array.isArray(params) ? params.length : 0,
    code: err?.code,
    message: err?.message,
  };
}

/**
 * Helper padrão de query. Mantém o código dos repositories limpo
 * e centraliza log de erros de SQL.
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    if (process.env.NODE_ENV === "development") {
      console.log("SQL", { text, duration: Date.now() - start, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    console.error("Erro SQL:", resumoErroSql(text, params, err));
    throw err;
  }
}

/**
 * Executa um bloco de queries dentro de uma transação.
 * Uso: await withTransaction(async (client) => { ... });
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
