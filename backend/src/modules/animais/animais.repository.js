import { query } from "../../config/db.js";

const BASE_SELECT = `
  SELECT a.id, a.uep_id, a.categoria, a.sexo, a.raca, a.data_nascimento,
         a.status_reprodutivo, a.brinco, a.corte_australiano, a.sisbov,
         a.disponivel, a.observacoes, a.created_by, a.created_at, a.updated_at,
         u.nome AS uep_nome
  FROM animais a
  JOIN ueps u ON u.id = a.uep_id
`;

/**
 * Monta cláusulas WHERE dinâmicas a partir dos filtros de busca/censo.
 * Reaproveitado tanto na listagem quanto na contagem por categoria.
 */
function buildFilters(filters = {}) {
  const { uepId, categoria, sexo, statusReprodutivo, disponivel, busca } = filters;
  const conditions = [];
  const params = [];

  if (uepId) {
    params.push(uepId);
    conditions.push(`a.uep_id = $${params.length}`);
  }
  if (categoria) {
    params.push(categoria);
    conditions.push(`a.categoria = $${params.length}`);
  }
  if (sexo) {
    params.push(sexo);
    conditions.push(`a.sexo = $${params.length}`);
  }
  if (statusReprodutivo) {
    params.push(statusReprodutivo);
    conditions.push(`a.status_reprodutivo = $${params.length}`);
  }
  if (disponivel !== undefined) {
    params.push(disponivel);
    conditions.push(`a.disponivel = $${params.length}`);
  }
  // Busca livre por identificador: brinco, corte australiano ou SISBOV
  if (busca) {
    params.push(`%${busca}%`);
    const idx = params.length;
    conditions.push(
      `(a.brinco ILIKE $${idx} OR a.corte_australiano ILIKE $${idx} OR a.sisbov ILIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

export const animaisRepository = {
  async findAll(filters = {}) {
    const { where, params } = buildFilters(filters);

    // Paginacao opcional: sem limit, devolve tudo (compatibilidade)
    let pagination = "";
    if (filters.limit !== undefined && filters.limit !== null) {
      params.push(filters.limit);
      pagination += ` LIMIT $${params.length}`;
      params.push(filters.offset ?? 0);
      pagination += ` OFFSET $${params.length}`;
    }

    const { rows } = await query(
      `${BASE_SELECT} ${where} ORDER BY a.created_at DESC${pagination}`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`${BASE_SELECT} WHERE a.id = $1`, [id]);
    return rows[0] ?? null;
  },

  // Identificadores são únicos: usados para localizar um animal específico
  async findByIdentifier({ brinco, corteAustraliano, sisbov, uepId }) {
    // Os identificadores sao alternativos entre si (OR), mas o escopo da UEP
    // e restritivo (AND) — sem o parenteses o uep_id entrava no OR e a busca
    // devolvia a UEP inteira, furando o isolamento por setor.
    const identificadores = [];
    const params = [];

    if (brinco) {
      params.push(brinco);
      identificadores.push(`a.brinco = $${params.length}`);
    }
    if (corteAustraliano) {
      params.push(corteAustraliano);
      identificadores.push(`a.corte_australiano = $${params.length}`);
    }
    if (sisbov) {
      params.push(sisbov);
      identificadores.push(`a.sisbov = $${params.length}`);
    }
    if (!identificadores.length) return [];

    const conditions = [`(${identificadores.join(" OR ")})`];

    if (uepId) {
      params.push(uepId);
      conditions.push(`a.uep_id = $${params.length}`);
    }

    const { rows } = await query(
      `${BASE_SELECT} WHERE ${conditions.join(" AND ")} ORDER BY a.created_at DESC`,
      params
    );
    return rows;
  },

  // Censo: contagem de animais agrupada por categoria (e opcionalmente sexo)
  async countByCategoria(filters) {
    const { where, params } = buildFilters(filters);
    const { rows } = await query(
      `SELECT a.categoria, a.sexo, COUNT(*)::int AS total
       FROM animais a
       ${where}
       GROUP BY a.categoria, a.sexo
       ORDER BY a.categoria, a.sexo`,
      params
    );
    return rows;
  },

  // Censo: contagem de animais agrupada por raca (Sprint 5)
  async countByRaca(filters) {
    const { where, params } = buildFilters(filters);
    const sep = where ? `${where} AND` : "WHERE";
    const { rows } = await query(
      `SELECT COALESCE(a.raca, 'Nao informada') AS raca, COUNT(*)::int AS total
       FROM animais a
       ${sep} TRUE
       GROUP BY COALESCE(a.raca, 'Nao informada')
       ORDER BY total DESC, raca`,
      params
    );
    return rows;
  },

  async countTotal(filters) {
    const { where, params } = buildFilters(filters);
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM animais a ${where}`,
      params
    );
    return rows[0].total;
  },

  async create({
    uepId,
    categoria,
    sexo,
    raca,
    dataNascimento,
    statusReprodutivo,
    brinco,
    corteAustraliano,
    sisbov,
    disponivel,
    observacoes,
    createdBy,
  }) {
    const { rows } = await query(
      `INSERT INTO animais (
         uep_id, categoria, sexo, raca, data_nascimento, status_reprodutivo,
         brinco, corte_australiano, sisbov, disponivel, observacoes, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        uepId,
        categoria,
        sexo,
        raca ?? null,
        dataNascimento ?? null,
        statusReprodutivo ?? "NAO_APLICAVEL",
        brinco ?? null,
        corteAustraliano ?? null,
        sisbov ?? null,
        disponivel ?? true,
        observacoes ?? null,
        createdBy ?? null,
      ]
    );
    return rows[0];
  },

  async update(id, data) {
    const {
      categoria,
      sexo,
      raca,
      dataNascimento,
      statusReprodutivo,
      brinco,
      corteAustraliano,
      sisbov,
      disponivel,
      observacoes,
    } = data;

    const { rows } = await query(
      `UPDATE animais SET
         categoria = COALESCE($2, categoria),
         sexo = COALESCE($3, sexo),
         raca = COALESCE($4, raca),
         data_nascimento = COALESCE($5, data_nascimento),
         status_reprodutivo = COALESCE($6, status_reprodutivo),
         brinco = COALESCE($7, brinco),
         corte_australiano = COALESCE($8, corte_australiano),
         sisbov = COALESCE($9, sisbov),
         disponivel = COALESCE($10, disponivel),
         observacoes = COALESCE($11, observacoes),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        categoria ?? null,
        sexo ?? null,
        raca ?? null,
        dataNascimento ?? null,
        statusReprodutivo ?? null,
        brinco ?? null,
        corteAustraliano ?? null,
        sisbov ?? null,
        disponivel ?? null,
        observacoes ?? null,
      ]
    );
    return rows[0] ?? null;
  },

  async remove(id) {
    const { rowCount } = await query(`DELETE FROM animais WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
