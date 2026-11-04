import { query } from "../../config/db.js";

/*
 * Consultas próprias dos relatórios (as contagens de censo reaproveitam o
 * animais.repository). uepIds: null = todas as UEPs; [id] = uma só.
 */

function filtroUep(uepIds, coluna, params) {
  if (!Array.isArray(uepIds)) return "";
  params.push(uepIds);
  return `${coluna} = ANY($${params.length}::int[])`;
}

export const relatoriosRepository = {
  // Total de animais por UEP (UEPs sem animal aparecem com zero).
  async censoPorUep(uepIds) {
    const params = [];
    const f = filtroUep(uepIds, "u.id", params);
    const { rows } = await query(
      `SELECT u.nome AS uep,
              COUNT(a.id)::int AS total,
              COUNT(a.id) FILTER (WHERE a.disponivel)::int AS disponiveis,
              COUNT(a.id) FILTER (WHERE NOT a.disponivel)::int AS indisponiveis
       FROM ueps u
       LEFT JOIN animais a ON a.uep_id = u.id
       ${f ? `WHERE ${f}` : ""}
       GROUP BY u.id, u.nome
       ORDER BY u.nome`,
      params
    );
    return rows;
  },

  // Matriz categoria x fase reprodutiva.
  async statusPorCategoria(uepIds) {
    const params = [];
    const f = filtroUep(uepIds, "a.uep_id", params);
    const { rows } = await query(
      `SELECT a.categoria, a.status_reprodutivo, COUNT(*)::int AS total
       FROM animais a
       ${f ? `WHERE ${f}` : ""}
       GROUP BY a.categoria, a.status_reprodutivo
       ORDER BY a.categoria, a.status_reprodutivo`,
      params
    );
    return rows;
  },

  // Movimentações de estoque no período (datas inclusivas).
  async movimentacoes(uepIds, dataInicio, dataFim) {
    const params = [dataInicio, dataFim];
    const f = filtroUep(uepIds, "i.uep_id", params);
    const { rows } = await query(
      `SELECT to_char(m.data, 'DD/MM/YYYY') AS data, u.nome AS uep, i.nome AS insumo,
              m.tipo, m.quantidade::float8 AS quantidade, i.unidade,
              us.nome AS responsavel, m.observacao
       FROM estoque_movimentacoes m
       JOIN insumos i ON i.id = m.insumo_id
       JOIN ueps u ON u.id = i.uep_id
       LEFT JOIN users us ON us.id = m.created_by
       WHERE m.data BETWEEN $1 AND $2 ${f ? `AND ${f}` : ""}
       ORDER BY m.data, m.created_at, m.id`,
      params
    );
    return rows;
  },

  // Entradas e saídas do período por insumo, com o saldo atual.
  async resumoMovimentacoes(uepIds, dataInicio, dataFim) {
    const params = [dataInicio, dataFim];
    const f = filtroUep(uepIds, "i.uep_id", params);
    const { rows } = await query(
      `SELECT u.nome AS uep, i.nome AS insumo, i.unidade,
              COALESCE(SUM(m.quantidade) FILTER (WHERE m.tipo = 'ENTRADA'), 0)::float8 AS entradas,
              COALESCE(SUM(m.quantidade) FILTER (WHERE m.tipo = 'SAIDA'), 0)::float8 AS saidas,
              i.saldo_atual::float8 AS saldo_atual
       FROM insumos i
       JOIN ueps u ON u.id = i.uep_id
       LEFT JOIN estoque_movimentacoes m ON m.insumo_id = i.id AND m.data BETWEEN $1 AND $2
       ${f ? `WHERE ${f}` : ""}
       GROUP BY u.nome, i.id, i.nome, i.unidade, i.saldo_atual
       ORDER BY u.nome, i.nome`,
      params
    );
    return rows;
  },
};
