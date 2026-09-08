import { query } from "../../config/db.js";

const BASE_SELECT = `
  SELECT u.id, u.nome, u.tipo, u.descricao, u.responsavel_id, u.ativo,
         u.created_at, u.updated_at,
         (SELECT COUNT(*) FROM animais a WHERE a.uep_id = u.id) AS total_animais
  FROM ueps u
`;

export const uepsRepository = {
  async findAll({ tipo, ativo } = {}) {
    const conditions = [];
    const params = [];

    if (tipo) {
      params.push(tipo);
      conditions.push(`u.tipo = $${params.length}`);
    }
    if (ativo !== undefined) {
      params.push(ativo);
      conditions.push(`u.ativo = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await query(`${BASE_SELECT} ${where} ORDER BY u.nome`, params);
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`${BASE_SELECT} WHERE u.id = $1`, [id]);
    return rows[0] ?? null;
  },

  async create({ nome, tipo, descricao, responsavelId }) {
    const { rows } = await query(
      `INSERT INTO ueps (nome, tipo, descricao, responsavel_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nome, tipo, descricao, responsavel_id, ativo, created_at, updated_at`,
      [nome, tipo, descricao ?? null, responsavelId ?? null]
    );
    return rows[0];
  },

  async update(id, { nome, tipo, descricao, responsavelId, ativo }) {
    const { rows } = await query(
      `UPDATE ueps
       SET nome = COALESCE($2, nome),
           tipo = COALESCE($3, tipo),
           descricao = COALESCE($4, descricao),
           responsavel_id = COALESCE($5, responsavel_id),
           ativo = COALESCE($6, ativo),
           updated_at = now()
       WHERE id = $1
       RETURNING id, nome, tipo, descricao, responsavel_id, ativo, created_at, updated_at`,
      [id, nome ?? null, tipo ?? null, descricao ?? null, responsavelId ?? null, ativo ?? null]
    );
    return rows[0] ?? null;
  },

  async remove(id) {
    const { rowCount } = await query(`DELETE FROM ueps WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
