import { query, withTransaction } from "../../config/db.js";
import { ApiError } from "../../utils/ApiError.js";
import { formatarQuantidade } from "./estoque.validators.js";

// NUMERIC volta do pg como string; ::float8 entrega numero JS ao frontend.
const INSUMO_COLUMNS = `
  i.id, i.uep_id, i.nome, i.unidade,
  i.saldo_atual::float8 AS saldo_atual,
  i.estoque_minimo::float8 AS estoque_minimo,
  i.consumo_medio_diario::float8 AS consumo_medio_diario,
  i.created_at, i.updated_at
`;

// "responsavel" vem do JOIN com users (created_by), nunca do cliente.
const MOVIMENTACAO_SELECT = `
  SELECT m.id, m.insumo_id, i.nome AS insumo_nome, m.tipo,
         m.quantidade::float8 AS quantidade, i.unidade,
         to_char(m.data, 'YYYY-MM-DD') AS data,
         u.nome AS responsavel, m.observacao, m.created_at
  FROM estoque_movimentacoes m
  JOIN insumos i ON i.id = m.insumo_id
  LEFT JOIN users u ON u.id = m.created_by
`;

async function findMovimentacaoById(client, id) {
  const { rows } = await client.query(`${MOVIMENTACAO_SELECT} WHERE m.id = $1`, [id]);
  return rows[0];
}

export const estoqueRepository = {
  async findInsumos(uepId) {
    const { rows } = await query(
      `SELECT ${INSUMO_COLUMNS} FROM insumos i WHERE i.uep_id = $1 ORDER BY i.nome, i.id`,
      [uepId]
    );
    return rows;
  },

  /**
   * Cria o insumo e, se saldoInicial > 0, a ENTRADA correspondente — tudo na
   * mesma transacao, para saldo e historico nunca divergirem.
   */
  async createInsumo({ uepId, nome, unidade, saldoInicial, estoqueMinimo, consumoMedioDiario, createdBy }) {
    try {
      return await withTransaction(async (client) => {
        const { rows } = await client.query(
          `INSERT INTO insumos
             (uep_id, nome, unidade, saldo_atual, estoque_minimo, consumo_medio_diario, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [uepId, nome, unidade, saldoInicial, estoqueMinimo, consumoMedioDiario, createdBy ?? null]
        );
        const insumoId = rows[0].id;

        if (saldoInicial > 0) {
          await client.query(
            `INSERT INTO estoque_movimentacoes (insumo_id, tipo, quantidade, observacao, created_by)
             VALUES ($1, 'ENTRADA', $2, 'Cadastro inicial do insumo', $3)`,
            [insumoId, saldoInicial, createdBy ?? null]
          );
        }

        const { rows: criado } = await client.query(
          `SELECT ${INSUMO_COLUMNS} FROM insumos i WHERE i.id = $1`,
          [insumoId]
        );
        return criado[0];
      });
    } catch (err) {
      if (err.code === "23505") {
        throw ApiError.badRequest("Já existe um insumo com esse nome nesta UEP.");
      }
      if (err.code === "22003") {
        throw ApiError.badRequest("Valor numérico fora do intervalo permitido.");
      }
      throw err;
    }
  },

  async findMovimentacoes(uepId, { tipo, insumoId } = {}) {
    const params = [uepId];
    const conditions = ["i.uep_id = $1"];

    if (tipo) {
      params.push(tipo);
      conditions.push(`m.tipo = $${params.length}`);
    }
    if (insumoId) {
      params.push(insumoId);
      conditions.push(`m.insumo_id = $${params.length}`);
    }

    const { rows } = await query(
      `${MOVIMENTACAO_SELECT}
       WHERE ${conditions.join(" AND ")}
       ORDER BY m.data DESC, m.created_at DESC, m.id DESC`,
      params
    );
    return rows;
  },

  /**
   * Registra a movimentacao e atualiza insumos.saldo_atual numa transacao.
   * A linha do insumo e travada (FOR UPDATE) para que duas SAIDAS
   * simultaneas nao passem pela checagem de saldo ao mesmo tempo.
   */
  async registrarMovimentacao({ uepId, insumoId, tipo, quantidade, data, observacao, createdBy }) {
    try {
      return await withTransaction(async (client) => {
        // Filtrar por uep_id garante o isolamento: um insumo de outra UEP e
        // tratado como inexistente.
        const { rows } = await client.query(
          `SELECT id, unidade, saldo_atual::float8 AS saldo, (saldo_atual >= $3) AS suficiente
           FROM insumos
           WHERE id = $1 AND uep_id = $2
           FOR UPDATE`,
          [insumoId, uepId, quantidade]
        );
        const insumo = rows[0];
        if (!insumo) throw ApiError.notFound("Insumo não encontrado nesta UEP.");

        if (tipo === "SAIDA" && !insumo.suficiente) {
          throw ApiError.badRequest(
            `Quantidade maior que o saldo disponível (${formatarQuantidade(insumo.saldo)} ${insumo.unidade}).`
          );
        }

        const sinal = tipo === "ENTRADA" ? "+" : "-";
        await client.query(
          `UPDATE insumos
           SET saldo_atual = saldo_atual ${sinal} $2, updated_at = now()
           WHERE id = $1`,
          [insumoId, quantidade]
        );

        const { rows: inseridas } = await client.query(
          `INSERT INTO estoque_movimentacoes (insumo_id, tipo, quantidade, data, observacao, created_by)
           VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6)
           RETURNING id`,
          [insumoId, tipo, quantidade, data, observacao, createdBy ?? null]
        );

        return findMovimentacaoById(client, inseridas[0].id);
      });
    } catch (err) {
      if (err.code === "22003") {
        throw ApiError.badRequest("Valor numérico fora do intervalo permitido.");
      }
      throw err;
    }
  },
};
