import { query } from "../../config/db.js";

const PUBLIC_COLUMNS = `id, nome, email, role, ativo, uep_id, professor_id, created_at, updated_at`;

const BASE_SELECT = `
  SELECT ${PUBLIC_COLUMNS}
  FROM users
`;

export const usersRepository = {
  /* roles: lista de papéis permitidos (vem já escopada do users.policy.js —
     lista vazia devolve nenhum usuário, nunca "todos"). */
  async findAll({ roles, ativo, professorId } = {}) {
    const conditions = [];
    const params = [];

    if (roles !== undefined) {
      params.push(roles);
      conditions.push(`role = ANY($${params.length}::user_role[])`);
    }
    if (ativo !== undefined) {
      params.push(ativo);
      conditions.push(`ativo = $${params.length}`);
    }
    if (professorId !== undefined) {
      params.push(professorId);
      conditions.push(`professor_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await query(`${BASE_SELECT} ${where} ORDER BY nome`, params);
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`${BASE_SELECT} WHERE id = $1`, [id]);
    return rows[0] ?? null;
  },

  async findByEmail(email) {
    const { rows } = await query(
      `SELECT id, nome, email, password_hash, google_id, role, ativo, uep_id, professor_id
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ?? null;
  },

  async create({ nome, email, passwordHash, role, ativo = true, uepId = null, professorId = null }) {
    const { rows } = await query(
      `INSERT INTO users (nome, email, password_hash, role, ativo, uep_id, professor_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${PUBLIC_COLUMNS}`,
      [nome, email, passwordHash, role, ativo, uepId, professorId]
    );
    return rows[0];
  },

  /* Cria uma conta a partir do primeiro login com Google — sem senha
     (password_hash fica NULL; ver migration 005_google_auth.sql, que
     torna essa coluna opcional). "ativo" já vem decidido pelo
     auth.service.js. */
  async createGoogleUser({ nome, email, googleId, role, ativo }) {
    const { rows } = await query(
      `INSERT INTO users (nome, email, password_hash, google_id, role, ativo)
       VALUES ($1, $2, NULL, $3, $4, $5)
       RETURNING ${PUBLIC_COLUMNS}, google_id`,
      [nome, email, googleId, role, ativo]
    );
    return rows[0];
  },

  /* Associa um google_id a uma conta já existente (criada por e-mail/senha
     ou por concessão de acesso) que ainda não tinha logado com Google. */
  async linkGoogleId(id, googleId) {
    await query(`UPDATE users SET google_id = $2, updated_at = now() WHERE id = $1`, [
      id,
      googleId,
    ]);
  },

  /* uepId segue a convenção: undefined = não mexe; null = desvincula. */
  async update(id, { nome, role, ativo, uepId }) {
    const mudaUep = uepId !== undefined;
    const { rows } = await query(
      `UPDATE users
       SET nome = COALESCE($2, nome),
           role = COALESCE($3, role),
           ativo = COALESCE($4, ativo),
           uep_id = CASE WHEN $5 THEN $6::int ELSE uep_id END,
           updated_at = now()
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, nome ?? null, role ?? null, ativo ?? null, mudaUep, mudaUep ? uepId : null]
    );
    return rows[0] ?? null;
  },

  /* Quando a Diretoria troca a UEP de um Professor, a equipe dele vai junto
     (a UEP de um integrante é sempre a do professor responsável). */
  async updateTeamUep(professorId, uepId) {
    await query(
      `UPDATE users SET uep_id = $2, updated_at = now() WHERE professor_id = $1`,
      [professorId, uepId]
    );
  },

  async updatePassword(id, passwordHash) {
    await query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [id, passwordHash]
    );
  },

  async remove(id) {
    const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
