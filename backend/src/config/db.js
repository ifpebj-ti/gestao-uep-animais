import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "gestao_uep",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "changeme",
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool do Postgres:", err);
});

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
    console.error("Erro SQL:", { text, params, message: err.message });
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
