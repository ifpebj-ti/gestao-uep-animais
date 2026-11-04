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

  await vincularDemoAUeps(client);
}

/* Com o isolamento por UEP no backend (Sprint 4), uma conta sem UEP não vê
   dado de setor nenhum. Para as contas de demonstração continuarem úteis:
   - o Professor demo recebe todas as UEPs, se ainda não tiver nenhuma;
   - Técnico/Estagiário/Aluno demo entram na equipe do Professor demo, na
     primeira UEP (por nome), se ainda estiverem sem UEP e sem professor.
   Só mexe em conta "solta": o que a Diretoria/Professor já configurou fica. */
async function vincularDemoAUeps(client) {
  const emailDe = (prefixo) =>
    process.env[`SEED_${prefixo}_EMAIL`] || DEMO_USERS.find((u) => u.envPrefix === prefixo).defaultEmail;

  const { rows: prof } = await client.query(
    "SELECT id FROM users WHERE email = $1 AND role = 'PROFESSOR'",
    [emailDe("PROFESSOR")]
  );
  if (prof.length === 0) return;
  const professorId = prof[0].id;

  const { rowCount: concedidas } = await client.query(
    `INSERT INTO professor_ueps (professor_id, uep_id)
     SELECT $1, u.id FROM ueps u
     WHERE NOT EXISTS (SELECT 1 FROM professor_ueps WHERE professor_id = $1)
     ON CONFLICT DO NOTHING`,
    [professorId]
  );
  if (concedidas > 0) console.log(`Professor demo: ${concedidas} UEP(s) concedida(s).`);

  const { rows: primeira } = await client.query(
    `SELECT pu.uep_id FROM professor_ueps pu JOIN ueps u ON u.id = pu.uep_id
     WHERE pu.professor_id = $1 ORDER BY u.nome LIMIT 1`,
    [professorId]
  );
  if (primeira.length === 0) return;

  const emailsEquipe = ["TECNICO", "ESTAGIARIO", "ALUNO"].map(emailDe);
  const { rowCount: vinculados } = await client.query(
    `UPDATE users SET professor_id = $1, uep_id = $2, updated_at = now()
     WHERE email = ANY($3::text[]) AND uep_id IS NULL AND professor_id IS NULL
       AND role IN ('TECNICO', 'ESTAGIARIO', 'ALUNO')`,
    [professorId, primeira[0].uep_id, emailsEquipe]
  );
  if (vinculados > 0) console.log(`Equipe demo: ${vinculados} conta(s) vinculada(s) ao Professor demo.`);
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
