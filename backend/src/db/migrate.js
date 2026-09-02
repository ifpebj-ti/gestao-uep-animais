import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  return new Set(rows.map((r) => r.filename));
}

async function seedAdmin(client) {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@ifpe.edu.br";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const { rows } = await client.query("SELECT id FROM users WHERE email = $1", [email]);
  if (rows.length > 0) return;

  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO users (nome, email, password_hash, role)
     VALUES ($1, $2, $3, 'ADMIN')`,
    ["Administrador", email, hash]
  );
  console.log(`Usuário admin semente criado: ${email}`);
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Já aplicada: ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`Aplicando: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    await seedAdmin(client);
    console.log("Migrações concluídas com sucesso.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Falha ao rodar migrações:", err);
  process.exit(1);
});
