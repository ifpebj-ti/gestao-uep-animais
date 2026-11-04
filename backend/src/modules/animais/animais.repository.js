import { query } from "../../config/db.js";
import { ApiError } from "../../utils/ApiError.js";

const BASE_SELECT = `
  SELECT a.id, a.uep_id, a.categoria, a.sexo, a.raca, a.data_nascimento,
         a.status_reprodutivo, a.brinco, a.corte_australiano, a.sisbov,
         a.disponivel, a.observacoes, a.created_by, a.created_at, a.updated_at,
         u.nome AS uep_nome
  FROM animais a
  JOIN ueps u ON u.id = a.uep_id
`;

// Colunas que o service pode gravar (vêm de animais.validators.js).
const COLUNAS_GRAVAVEIS = new Set([
  "categoria",
  "sexo",
  "raca",
  "data_nascimento",
  "status_reprodutivo",
  "brinco",
  "corte_australiano",
  "sisbov",
  "disponivel",
  "observacoes",
]);

// Escapa % e _ para a busca livre não virar curinga sem querer.
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Monta cláusulas WHERE dinâmicas a partir dos filtros de busca/censo.
 * Reaproveitado tanto na listagem quanto na contagem por categoria.
 *
 * uepIds: escopo de UEPs do usuário. null/undefined = todas (Diretoria);
 * [] = nenhuma (a consulta não devolve nada).
 */
function buildFilters(filters = {}) {
  const { uepIds, categoria, sexo, statusReprodutivo, disponivel, busca } = filters;
  const conditions = [];
  const params = [];

  if (Array.isArray(uepIds)) {
    params.push(uepIds);
    conditions.push(`a.uep_id = ANY($${params.length}::int[])`);
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
    params.push(`%${escaparLike(busca)}%`);
    const idx = params.length;
    conditions.push(
      `(a.brinco ILIKE $${idx} OR a.corte_australiano ILIKE $${idx} OR a.sisbov ILIKE $${idx})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

// Mensagens específicas para os UNIQUE da tabela (o genérico do
// errorHandler não diz qual campo repetiu).
function traduzirErro(err) {
  if (err.code === "23505" && err.constraint === "uq_animais_brinco_uep") {
    return ApiError.conflict("Já existe um animal com esse brinco nesta UEP.");
  }
  if (err.code === "23505" && err.constraint === "uq_animais_sisbov") {
    return ApiError.conflict("Já existe um animal com esse SISBOV.");
  }
  return err;
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
      `${BASE_SELECT} ${where} ORDER BY a.created_at DESC, a.id DESC${pagination}`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`${BASE_SELECT} WHERE a.id = $1`, [id]);
    return rows[0] ?? null;
  },

  // Identificadores são únicos: usados para localizar um animal específico
  async findByIdentifier({ brinco, corteAustraliano, sisbov, uepIds }) {
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

    if (Array.isArray(uepIds)) {
      params.push(uepIds);
      conditions.push(`a.uep_id = ANY($${params.length}::int[])`);
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
    const { rows } = await query(
      `SELECT COALESCE(a.raca, 'Nao informada') AS raca, COUNT(*)::int AS total
       FROM animais a
       ${where}
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

  /** dados: colunas já validadas (animais.validators.js) + uep_id e created_by. */
  async create(dados) {
    const colunas = ["uep_id", "created_by", ...Object.keys(dados).filter((c) => COLUNAS_GRAVAVEIS.has(c))];
    const valores = colunas.map((c) => dados[c] ?? null);
    const marcadores = colunas.map((_, i) => `$${i + 1}`);
    try {
      const { rows } = await query(
        `INSERT INTO animais (${colunas.join(", ")})
         VALUES (${marcadores.join(", ")})
         RETURNING id`,
        valores
      );
      return this.findById(rows[0].id);
    } catch (err) {
      throw traduzirErro(err);
    }
  },

  /** Atualiza só as colunas presentes em `dados` (null limpa o campo). */
  async update(id, dados) {
    const colunas = Object.keys(dados).filter((c) => COLUNAS_GRAVAVEIS.has(c));
    if (colunas.length > 0) {
      const sets = colunas.map((c, i) => `${c} = $${i + 2}`);
      try {
        await query(
          `UPDATE animais SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`,
          [id, ...colunas.map((c) => dados[c])]
        );
      } catch (err) {
        throw traduzirErro(err);
      }
    }
    return this.findById(id);
  },

  async remove(id) {
    const { rowCount } = await query(`DELETE FROM animais WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
