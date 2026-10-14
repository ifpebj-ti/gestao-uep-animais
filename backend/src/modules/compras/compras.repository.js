import { query } from "../../config/db.js";

export const comprasRepository = {
  // Rebanho da UEP agrupado por categoria, com quantos estao marcados para descarte.
  async countAnimaisPorCategoria(uepId) {
    const { rows } = await query(
      `SELECT a.categoria,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.status_reprodutivo = 'DESCARTE')::int AS em_descarte
       FROM animais a
       WHERE a.uep_id = $1
       GROUP BY a.categoria
       ORDER BY a.categoria`,
      [uepId]
    );
    return rows;
  },
};
