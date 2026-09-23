import { query } from "../../config/db.js";
import { ROLES } from "../../config/roles.js";

const PUBLIC_COLUMNS = `id, nome, email, role, ativo, uep_id, professor_id, created_at, updated_at`;

const BASE_SELECT = `
  SELECT ${PUBLIC_COLUMNS}
  FROM users
`;

/* Anexa, em cada linha de Professor, a lista de UEPs que ele tem acesso
   (tabela professor_ueps — ver migration 007). Não Professor não recebe
   o campo "ueps" (não faz sentido pra Aluno/Técnico/Estagiário, que já
   têm uep_id direto na própria linha, nem pra ADMIN). */
async function anexarUepsDosProfessores(rows) {
  const professorIds = rows.filter((r) => r.role === ROLES.PROFESSOR).map((r) => r.id);
  if (professorIds.length === 0) return rows;

  const { rows: uepRows } = await query(
    `SELECT pu.professor_id, ue.id, ue.nome, ue.tipo
     FROM professor_ueps pu
     JOIN ueps ue ON ue.id = pu.uep_id
     WHERE pu.professor_id = ANY($1::int[])
     ORDER BY ue.nome`,
    [professorIds]
  );

  const porProfessor = {};
  uepRows.forEach((r) => {
    const lista = porProfessor[r.professor_id] || (porProfessor[r.professor_id] = []);
    lista.push({ id: r.id, nome: r.nome, tipo: r.tipo });
  });

  rows.forEach((r) => {
    if (r.role === ROLES.PROFESSOR) r.ueps = porProfessor[r.id] || [];
  });
  return rows;
}

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
    return anexarUepsDosProfessores(rows);
  },

  async findById(id) {
    const { rows } = await query(`${BASE_SELECT} WHERE id = $1`, [id]);
    if (!rows[0]) return null;
    const [comUeps] = await anexarUepsDosProfessores(rows);
    return comUeps;
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

  /* Atualiza só nome/role/ativo. UEP não entra mais aqui: pra Professor é
     professor_ueps (setProfessorUeps abaixo); pra equipe é decidida na
     criação e só muda via clearEquipeUepsForaDoEscopo. */
  async update(id, { nome, role, ativo }) {
    const { rows } = await query(
      `UPDATE users
       SET nome = COALESCE($2, nome),
           role = COALESCE($3, role),
           ativo = COALESCE($4, ativo),
           updated_at = now()
       WHERE id = $1
       RETURNING ${PUBLIC_COLUMNS}`,
      [id, nome ?? null, role ?? null, ativo ?? null]
    );
    return rows[0] ?? null;
  },

  /* Lista de UEPs que um Professor tem acesso (professor_ueps + join). */
  async findProfessorUeps(professorId) {
    const { rows } = await query(
      `SELECT ue.id, ue.nome, ue.tipo, ue.descricao
       FROM professor_ueps pu
       JOIN ueps ue ON ue.id = pu.uep_id
       WHERE pu.professor_id = $1
       ORDER BY ue.nome`,
      [professorId]
    );
    return rows;
  },

  /* Substitui por completo o conjunto de UEPs de um Professor (é assim que
     a Diretoria "marca/desmarca" UEPs em Controle de Acesso — sempre manda
     a lista final, não um delta). */
  async setProfessorUeps(professorId, uepIds) {
    await query(`DELETE FROM professor_ueps WHERE professor_id = $1`, [professorId]);
    if (uepIds.length === 0) return;
    const values = uepIds.map((_, i) => `($1, $${i + 2})`).join(", ");
    await query(
      `INSERT INTO professor_ueps (professor_id, uep_id) VALUES ${values}`,
      [professorId, ...uepIds]
    );
  },

  /* Quando a Diretoria tira uma UEP de um Professor, quem da equipe dele
     estava justamente nessa UEP fica "solto" (uep_id = NULL) em vez de
     continuar com acesso a uma UEP que o professor não gerencia mais. */
  async clearEquipeUepsForaDoEscopo(professorId, keepUepIds) {
    if (keepUepIds.length === 0) {
      await query(
        `UPDATE users SET uep_id = NULL, updated_at = now()
         WHERE professor_id = $1 AND uep_id IS NOT NULL`,
        [professorId]
      );
      return;
    }
    await query(
      `UPDATE users SET uep_id = NULL, updated_at = now()
       WHERE professor_id = $1 AND uep_id IS NOT NULL AND uep_id <> ALL($2::int[])`,
      [professorId, keepUepIds]
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
