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

// Uma conta de demonstracao por perfil, para todo mundo da equipe ter os
// mesmos logins de teste ao rodar as migrations pela primeira vez (cada
// maquina tem seu proprio banco local — ver docs/BACKLOG.md). O e-mail e a
// senha de cada uma podem ser sobrescritos por variavel de ambiente
// (SEED_<PERFIL>_EMAIL / SEED_<PERFIL>_PASSWORD, ver backend/.env.example).
// Em um ambiente de producao de verdade, desative com SEED_DEMO_USERS=false
// e troque a senha do admin logo no primeiro login.
const DEMO_USERS = [
  { envPrefix: "ADMIN", nome: "Administrador", role: "ADMIN", defaultEmail: "admin@ifpe.edu.br", defaultPassword: "admin123" },
  { envPrefix: "PROFESSOR", nome: "Professor Demo", role: "PROFESSOR", defaultEmail: "professor@ifpe.edu.br", defaultPassword: "professor123" },
  { envPrefix: "TECNICO", nome: "Tecnico Demo", role: "TECNICO", defaultEmail: "tecnico@ifpe.edu.br", defaultPassword: "tecnico123" },
  { envPrefix: "ESTAGIARIO", nome: "Estagiario Demo", role: "ESTAGIARIO", defaultEmail: "estagiario@ifpe.edu.br", defaultPassword: "estagiario123" },
  { envPrefix: "ALUNO", nome: "Aluno Demo", role: "ALUNO", defaultEmail: "aluno@ifpe.edu.br", defaultPassword: "aluno123" },
];

async function seedDemoUsers(client) {
  const habilitado = (process.env.SEED_DEMO_USERS ?? "true") !== "false";
  if (!habilitado) {
    console.log("SEED_DEMO_USERS=false — pulando criação dos usuários de demonstração.");
    return;
  }

  for (const u of DEMO_USERS) {
    const email = process.env[`SEED_${u.envPrefix}_EMAIL`] || u.defaultEmail;
    const password = process.env[`SEED_${u.envPrefix}_PASSWORD`] || u.defaultPassword;

    const { rows } = await client.query("SELECT id FROM users WHERE email = $1", [email]);
    if (rows.length > 0) continue;

    const hash = await bcrypt.hash(password, 10);
    await client.query(
      `INSERT INTO users (nome, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [u.nome, email, hash, u.role]
    );
    console.log(`Usuário semente criado: ${email} (${u.role})`);
  }
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

    await seedDemoUsers(client);
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
