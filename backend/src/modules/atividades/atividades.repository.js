import { query } from "../../config/db.js";

const SELECT = `
  SELECT at.id, at.uep_id, at.tipo, at.data, to_char(at.hora, 'HH24:MI') AS hora,
         at.animal_id, an.brinco AS animal_brinco, an.categoria AS animal_categoria,
         at.observacao, at.criado_por, us.nome AS criado_por_nome,
         at.created_at, at.updated_at
  FROM atividades at
  LEFT JOIN animais an ON an.id = at.animal_id
  LEFT JOIN users us ON us.id = at.criado_por
`;

const COLUNAS_GRAVAVEIS = new Set(["tipo", "data", "hora", "animal_id", "observacao"]);

export const atividadesRepository = {
  async findDoAno(uepId, ano) {
    const { rows } = await query(
      `${SELECT}
       WHERE at.uep_id = $1 AND at.data >= make_date($2, 1, 1) AND at.data < make_date($2 + 1, 1, 1)
       ORDER BY at.data, at.hora NULLS FIRST, at.id`,
      [uepId, ano]
    );
    return rows;
  },

  async findById(uepId, id) {
    const { rows } = await query(`${SELECT} WHERE at.id = $1 AND at.uep_id = $2`, [id, uepId]);
    return rows[0] ?? null;
  },

  async create(uepId, dados, criadoPor) {
    const colunas = Object.keys(dados).filter((c) => COLUNAS_GRAVAVEIS.has(c));
    const valores = colunas.map((c) => dados[c]);
    const { rows } = await query(
      `INSERT INTO atividades (uep_id, criado_por${colunas.map((c) => `, ${c}`).join("")})
       VALUES ($1, $2${colunas.map((_, i) => `, $${i + 3}`).join("")})
       RETURNING id`,
      [uepId, criadoPor ?? null, ...valores]
    );
    return this.findById(uepId, rows[0].id);
  },

  async update(uepId, id, dados) {
    const colunas = Object.keys(dados).filter((c) => COLUNAS_GRAVAVEIS.has(c));
    if (colunas.length) {
      await query(
        `UPDATE atividades SET ${colunas.map((c, i) => `${c} = $${i + 3}`).join(", ")}, updated_at = now()
         WHERE id = $1 AND uep_id = $2`,
        [id, uepId, ...colunas.map((c) => dados[c])]
      );
    }
    return this.findById(uepId, id);
  },

  async remove(uepId, id) {
    const { rowCount } = await query(`DELETE FROM atividades WHERE id = $1 AND uep_id = $2`, [id, uepId]);
    return rowCount > 0;
  },
};
