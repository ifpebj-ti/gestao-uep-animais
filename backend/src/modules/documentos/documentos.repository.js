import { query } from "../../config/db.js";

// Colunas da listagem (nunca devolve o conteúdo do arquivo na lista).
const COLUNAS = `
  d.id, d.nome_original, d.tipo, d.descricao, d.tamanho_bytes,
  d.uep_id, ue.nome AS uep_nome, d.enviado_por, us.nome AS enviado_por_nome, d.created_at
`;
const FROM = `
  FROM documentos d
  LEFT JOIN ueps ue ON ue.id = d.uep_id
  LEFT JOIN users us ON us.id = d.enviado_por
`;

export const documentosRepository = {
  /** enviadoPor: só os documentos dessa pessoa; undefined = todos (Diretoria). */
  async findAll({ enviadoPor } = {}) {
    const params = [];
    let where = "";
    if (enviadoPor !== undefined) {
      params.push(enviadoPor);
      where = "WHERE d.enviado_por = $1";
    }
    const { rows } = await query(
      `SELECT ${COLUNAS} ${FROM} ${where} ORDER BY d.created_at DESC, d.id DESC`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`SELECT ${COLUNAS} ${FROM} WHERE d.id = $1`, [id]);
    return rows[0] ?? null;
  },

  /** Metadados + conteúdo (para download e união). */
  async findArquivo(id) {
    const { rows } = await query(
      `SELECT d.id, d.nome_original, d.enviado_por, d.conteudo FROM documentos d WHERE d.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async findArquivos(ids) {
    const { rows } = await query(
      `SELECT d.id, d.nome_original, d.conteudo FROM documentos d WHERE d.id = ANY($1::int[])`,
      [ids]
    );
    return rows;
  },

  async create({ nomeOriginal, tipo, descricao, tamanhoBytes, sha256, conteudo, uepId, enviadoPor }) {
    const { rows } = await query(
      `INSERT INTO documentos
         (nome_original, tipo, descricao, tamanho_bytes, sha256, conteudo, uep_id, enviado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [nomeOriginal, tipo, descricao, tamanhoBytes, sha256, conteudo, uepId, enviadoPor]
    );
    return this.findById(rows[0].id);
  },

  async remove(id) {
    const { rowCount } = await query(`DELETE FROM documentos WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};
