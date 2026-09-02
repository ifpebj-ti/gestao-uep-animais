import { query } from "../../config/db.js";

const BASE_SELECT = `
  SELECT id, nome, email, role, ativo, created_at, updated_at
  FROM users
`;

export const usersRepository = {
  async findAll({ role, ativo } = {}) {
    const conditions = [];
    const params = [];

    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }
    if (ativo !== undefined) {
      params.push(ativo);
      conditions.push(`ativo = $${params.length}`);
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
      `SELECT id, nome, email, password_hash, role, ativo FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] ?? null;
  },

  async create({ nome, email, passwordHash, role }) {
    const { rows } = await query(
      `INSERT INTO users (nome, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, email, role, ativo, created_at, updated_at`,
      [nome, email, passwordHash, role]
    );
    return rows[0];
  },

  async update(id, { nome, role, ativo }) {
    const { rows } = await query(
      `UPDATE users
       SET nome = COALESCE($2, nome),
           role = COALESCE($3, role),
           ativo = COALESCE($4, ativo),
           updated_at = now()
       WHERE id = $1
       RETURNING id, nome, email, role, ativo, created_at, updated_at`,
      [id, nome ?? null, role ?? null, ativo ?? null]
    );
    return rows[0] ?? null;
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
