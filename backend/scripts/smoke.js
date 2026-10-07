/**
 * Smoke test dos entregaveis de backend das Sprints 3, 4, 5 e 10.
 *
 *   node backend/scripts/smoke.js
 *
 * Requer a API no ar (docker compose up). Cria e remove os proprios dados.
 * Sai com codigo 1 se qualquer verificacao falhar (usavel no CI).
 */

const BASE = process.env.API_BASE || "http://localhost:3000/api";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@ifpe.edu.br";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";

let passou = 0;
let falhou = 0;
const falhas = [];

function ok(sprint, nome) {
  passou++;
  console.log(`  \x1b[32mOK\x1b[0m   ${nome}`);
}

function erro(sprint, nome, detalhe) {
  falhou++;
  falhas.push({ sprint, nome, detalhe });
  console.log(`  \x1b[31mFALHA\x1b[0m ${nome}`);
  console.log(`        ${detalhe}`);
}

async function checa(sprint, nome, fn) {
  try {
    await fn();
    ok(sprint, nome);
  } catch (e) {
    erro(sprint, nome, e.message);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(caminho, { metodo = "GET", token, body, esperado } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await res.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }

  if (esperado !== undefined && res.status !== esperado) {
    throw new Error(
      `${metodo} ${caminho} devolveu ${res.status}, esperado ${esperado}. Corpo: ${texto.slice(0, 200)}`
    );
  }
  return { status: res.status, dados };
}

(async () => {
  console.log(`\nSmoke test — Sprints 3, 4, 5, 10 + hierarquia de acesso`);
  console.log(`API: ${BASE}\n`);

  // Sanidade: a API responde?
  try {
    const res = await fetch(BASE.replace(/\/api$/, "") + "/health");
    assert(res.ok, `/health devolveu ${res.status}`);
  } catch (e) {
    console.error(`\n\x1b[31mAPI inacessivel em ${BASE}\x1b[0m`);
    console.error(`${e.message}\n\nSuba a stack com: docker compose up\n`);
    process.exit(1);
  }

  // ─────────────────────────────────────────────────────────────
  console.log("SPRINT 3 — Autenticacao, usuarios e perfis");
  // ─────────────────────────────────────────────────────────────
  let tokenAdmin = null;
  let tokenAluno = null;
  let alunoId = null;
  const emailAluno = `smoke.aluno.${Date.now()}@teste.com`;

  await checa(3, "POST /auth/login com o admin semente", async () => {
    const { dados } = await api("/auth/login", {
      metodo: "POST",
      body: { email: ADMIN_EMAIL, senha: ADMIN_PASSWORD },
      esperado: 200,
    });
    assert(dados.token, "resposta sem token");
    assert(dados.user?.role === "ADMIN", `role esperado ADMIN, veio ${dados.user?.role}`);
    tokenAdmin = dados.token;
  });

  await checa(3, "POST /auth/login rejeita senha errada", async () => {
    await api("/auth/login", {
      metodo: "POST",
      body: { email: ADMIN_EMAIL, senha: "senha-errada" },
      esperado: 401,
    });
  });

  await checa(3, "POST /auth/register cria um ALUNO", async () => {
    const { dados } = await api("/auth/register", {
      metodo: "POST",
      body: { nome: "Aluno Smoke", email: emailAluno, senha: "senha123", role: "ALUNO" },
      esperado: 201,
    });
    assert(dados.token, "resposta sem token");
    assert(dados.user?.role === "ALUNO", `role esperado ALUNO, veio ${dados.user?.role}`);
    tokenAluno = dados.token;
    alunoId = dados.user.id;
  });

  await checa(3, "POST /auth/register barra autocadastro como ADMIN", async () => {
    await api("/auth/register", {
      metodo: "POST",
      body: { nome: "Invasor", email: `x.${Date.now()}@teste.com`, senha: "senha123", role: "ADMIN" },
      esperado: 400,
    });
  });

  await checa(3, "POST /auth/register barra e-mail duplicado", async () => {
    await api("/auth/register", {
      metodo: "POST",
      body: { nome: "Duplicado", email: emailAluno, senha: "senha123", role: "ALUNO" },
      esperado: 409,
    });
  });

  await checa(3, "GET /users/me devolve o proprio perfil", async () => {
    const { dados } = await api("/users/me", { token: tokenAdmin, esperado: 200 });
    assert(dados.email === ADMIN_EMAIL, `email esperado ${ADMIN_EMAIL}, veio ${dados.email}`);
  });

  await checa(3, "Rota protegida exige token (401 sem Authorization)", async () => {
    await api("/users/me", { esperado: 401 });
  });

  await checa(3, "RBAC: ALUNO nao lista usuarios (403)", async () => {
    await api("/users", { token: tokenAluno, esperado: 403 });
  });

  await checa(3, "RBAC: ADMIN lista usuarios (200)", async () => {
    const { dados } = await api("/users", { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados), "resposta nao e um array");
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 4 — CRUD de setores/UEPs");
  // ─────────────────────────────────────────────────────────────
  let uepId = null;

  await checa(4, "GET /ueps lista as UEPs semeadas", async () => {
    const { dados } = await api("/ueps", { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados), "resposta nao e um array");
    assert(dados.length > 0, "nenhuma UEP retornada (migration 003 rodou?)");
  });

  await checa(4, "POST /ueps cria uma UEP", async () => {
    const { dados } = await api("/ueps", {
      metodo: "POST",
      token: tokenAdmin,
      body: { nome: `Smoke UEP ${Date.now()}`, tipo: "CAPRINOCULTURA", descricao: "criada pelo smoke test" },
      esperado: 201,
    });
    assert(dados.id, "resposta sem id");
    uepId = dados.id;
  });

  await checa(4, "POST /ueps rejeita tipo invalido (400)", async () => {
    await api("/ueps", {
      metodo: "POST",
      token: tokenAdmin,
      body: { nome: "UEP Invalida", tipo: "DRAGAOCULTURA" },
      esperado: 400,
    });
  });

  await checa(4, "GET /ueps/:id devolve a UEP criada", async () => {
    const { dados } = await api(`/ueps/${uepId}`, { token: tokenAdmin, esperado: 200 });
    assert(dados.id === uepId, `id esperado ${uepId}, veio ${dados.id}`);
  });

  await checa(4, "PATCH /ueps/:id atualiza a descricao", async () => {
    const { dados } = await api(`/ueps/${uepId}`, {
      metodo: "PATCH",
      token: tokenAdmin,
      body: { descricao: "descricao atualizada" },
      esperado: 200,
    });
    assert(dados.descricao === "descricao atualizada", `descricao nao atualizou: ${dados.descricao}`);
  });

  await checa(4, "RBAC: ALUNO le UEPs mas nao cria (403)", async () => {
    await api("/ueps", { token: tokenAluno, esperado: 200 });
    await api("/ueps", {
      metodo: "POST",
      token: tokenAluno,
      body: { nome: "Nao deveria existir", tipo: "OVINOCULTURA" },
      esperado: 403,
    });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 5 — Censo e contagem de animais");
  // ─────────────────────────────────────────────────────────────
  const animaisCriados = [];

  await checa(5, "POST /ueps/:id/animais cria 5 animais", async () => {
    const lote = [
      { brinco: "SMK-001", categoria: "VACA",   sexo: "FEMEA", raca: "Nelore",    statusReprodutivo: "LACTANTE" },
      { brinco: "SMK-002", categoria: "VACA",   sexo: "FEMEA", raca: "Nelore",    statusReprodutivo: "PRENHE" },
      { brinco: "SMK-003", categoria: "TOURO",  sexo: "MACHO", raca: "Girolando", statusReprodutivo: "NAO_APLICAVEL" },
      { brinco: "SMK-004", categoria: "BEZERRO",sexo: "MACHO", raca: "Girolando", statusReprodutivo: "EM_CRESCIMENTO" },
      { brinco: "SMK-005", categoria: "NOVILHA",sexo: "FEMEA", raca: "Holandes",  statusReprodutivo: "VAZIA" },
    ];
    for (const a of lote) {
      const { dados } = await api(`/ueps/${uepId}/animais`, {
        metodo: "POST", token: tokenAdmin, body: a, esperado: 201,
      });
      assert(dados.id, `animal ${a.brinco} sem id`);
      animaisCriados.push(dados.id);
    }
  });

  await checa(5, "POST animal persiste dataNascimento e statusReprodutivo", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais`, {
      metodo: "POST",
      token: tokenAdmin,
      body: {
        brinco: "SMK-006", categoria: "VACA", sexo: "FEMEA", raca: "Nelore",
        dataNascimento: "2024-03-15", statusReprodutivo: "LACTANTE",
      },
      esperado: 201,
    });
    animaisCriados.push(dados.id);
    assert(dados.status_reprodutivo === "LACTANTE",
      `statusReprodutivo nao persistiu: ${dados.status_reprodutivo}`);
    assert(dados.data_nascimento, "dataNascimento nao persistiu (veio null)");
  });

  await checa(5, "POST animal rejeita categoria invalida (400)", async () => {
    await api(`/ueps/${uepId}/animais`, {
      metodo: "POST", token: tokenAdmin,
      body: { brinco: "SMK-X", categoria: "PEGASO", sexo: "FEMEA" },
      esperado: 400,
    });
  });

  await checa(5, "GET censo agrupa por categoria", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/censo`, { token: tokenAdmin, esperado: 200 });
    assert(dados.total === 6, `total esperado 6, veio ${dados.total}`);
    assert(Array.isArray(dados.porCategoria), "porCategoria nao e um array");
    const vacas = dados.porCategoria
      .filter((r) => r.categoria === "VACA")
      .reduce((s, r) => s + r.total, 0);
    assert(vacas === 3, `esperado 3 VACA, veio ${vacas}`);
  });

  await checa(5, "GET censo agrupa por raca", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/censo`, { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados.porRaca), "porRaca ausente ou nao e um array");
    const nelore = dados.porRaca.find((r) => r.raca === "Nelore");
    assert(nelore, "raca Nelore nao apareceu no censo");
    assert(nelore.total === 3, `esperado 3 Nelore, veio ${nelore.total}`);
  });

  await checa(5, "GET animais sem limit devolve array simples", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais`, { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados), "sem limit a resposta deveria ser um array");
    assert(dados.length === 6, `esperado 6 animais, veio ${dados.length}`);
  });

  await checa(5, "GET animais paginado devolve metadados corretos", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais?page=1&limit=4`, { token: tokenAdmin, esperado: 200 });
    assert(!Array.isArray(dados), "com limit a resposta deveria ser um objeto");
    assert(dados.data.length === 4, `pagina 1 deveria ter 4 itens, veio ${dados.data.length}`);
    assert(dados.total === 6, `total esperado 6, veio ${dados.total}`);
    assert(dados.totalPages === 2, `totalPages esperado 2, veio ${dados.totalPages}`);
    assert(dados.page === 1, `page esperado 1, veio ${dados.page}`);
  });

  await checa(5, "Paginacao: pagina 2 traz o resto sem repetir", async () => {
    const p1 = await api(`/ueps/${uepId}/animais?page=1&limit=4`, { token: tokenAdmin, esperado: 200 });
    const p2 = await api(`/ueps/${uepId}/animais?page=2&limit=4`, { token: tokenAdmin, esperado: 200 });
    assert(p2.dados.data.length === 2, `pagina 2 deveria ter 2 itens, veio ${p2.dados.data.length}`);
    const ids1 = new Set(p1.dados.data.map((a) => a.id));
    const repetidos = p2.dados.data.filter((a) => ids1.has(a.id));
    assert(repetidos.length === 0, `${repetidos.length} animal(is) repetido(s) entre as paginas`);
  });

  await checa(5, "Filtro por categoria restringe o censo", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/censo?categoria=VACA`, { token: tokenAdmin, esperado: 200 });
    assert(dados.total === 3, `censo filtrado por VACA deveria dar 3, veio ${dados.total}`);
  });

  await checa(5, "GET /animais/buscar acha pelo brinco", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/buscar?brinco=SMK-003`, { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados), "resposta nao e um array");
    // Exatamente 1: se o escopo da UEP entrar no OR, a busca devolve o setor inteiro
    assert(dados.length === 1, `esperado exatamente 1 resultado, veio ${dados.length}`);
    assert(dados[0].brinco === "SMK-003", `brinco esperado SMK-003, veio ${dados[0].brinco}`);
  });

  await checa(5, "Busca por brinco inexistente devolve vazio", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/buscar?brinco=NAO-EXISTE`, { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados) && dados.length === 0,
      `esperado nenhum resultado, veio ${dados.length}`);
  });

  await checa(5, "PATCH animal atualiza o status reprodutivo", async () => {
    const { dados } = await api(`/animais/${animaisCriados[0]}`, {
      metodo: "PATCH", token: tokenAdmin,
      body: { statusReprodutivo: "DESCARTE" },
      esperado: 200,
    });
    assert(dados.status_reprodutivo === "DESCARTE", `status nao atualizou: ${dados.status_reprodutivo}`);
  });

  await checa(5, "RBAC: ALUNO le animais mas nao cadastra (403)", async () => {
    await api(`/ueps/${uepId}/animais`, { token: tokenAluno, esperado: 200 });
    await api(`/ueps/${uepId}/animais`, {
      metodo: "POST", token: tokenAluno,
      body: { brinco: "SMK-BLOQ", categoria: "VACA", sexo: "FEMEA" },
      esperado: 403,
    });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nHIERARQUIA — Diretoria -> Professor -> Equipe");
  // ─────────────────────────────────────────────────────────────
  const sufixo = Date.now();
  const senhaProf = "senha123";
  let uepsSemente = [];
  let profA = null; // vai ter DUAS UEPs
  let profB = null; // vai ter UMA UEP só
  let tokenProfA = null;
  let tokenProfB = null;
  let alunoEquipeId = null;
  let alunoEquipeBId = null;

  await checa(6, "UEPs semeadas disponiveis para vincular professores", async () => {
    const { dados } = await api("/ueps", { token: tokenAdmin, esperado: 200 });
    uepsSemente = dados.filter((u) => u.id !== uepId).map((u) => u.id);
    assert(uepsSemente.length >= 2, "precisa de ao menos 2 UEPs semeadas");
  });

  await checa(6, "ADMIN concede acesso de PROFESSOR com uepIds (POST /users)", async () => {
    const { dados: a } = await api("/users", {
      metodo: "POST",
      token: tokenAdmin,
      body: {
        nome: "ProfA",
        email: `smoke.profa.${sufixo}@ifpe.edu.br`,
        senha: senhaProf,
        role: "PROFESSOR",
        uepIds: [uepsSemente[0], uepsSemente[1]], // duas UEPs
      },
      esperado: 201,
    });
    profA = a;
    assert(Array.isArray(profA.ueps) && profA.ueps.length === 2, `ProfA deveria ter 2 ueps, veio ${JSON.stringify(profA.ueps)}`);

    const { dados: b } = await api("/users", {
      metodo: "POST",
      token: tokenAdmin,
      body: {
        nome: "ProfB",
        email: `smoke.profb.${sufixo}@ifpe.edu.br`,
        senha: senhaProf,
        role: "PROFESSOR",
        uepIds: [uepsSemente[0]], // uma UEP só
      },
      esperado: 201,
    });
    profB = b;
    assert(Array.isArray(profB.ueps) && profB.ueps.length === 1, `ProfB deveria ter 1 uep, veio ${JSON.stringify(profB.ueps)}`);
  });

  await checa(6, "ADMIN nao cria ALUNO direto (403)", async () => {
    await api("/users", {
      metodo: "POST",
      token: tokenAdmin,
      body: { nome: "X", email: `smoke.x.${sufixo}@teste.com`, senha: "senha123", role: "ALUNO" },
      esperado: 403,
    });
  });

  await checa(6, "Professores fazem login", async () => {
    const login = async (email) =>
      (await api("/auth/login", { metodo: "POST", body: { email, senha: senhaProf }, esperado: 200 }))
        .dados.token;
    tokenProfA = await login(profA.email);
    tokenProfB = await login(profB.email);
  });

  await checa(6, "GET /users/me devolve as UEPs certas (multipla x unica) — base do pular-tela-de-selecao", async () => {
    const { dados: meA } = await api("/users/me", { token: tokenProfA, esperado: 200 });
    assert(meA.ueps.length === 2, `ProfA deveria ver 2 ueps em /users/me, veio ${JSON.stringify(meA.ueps)}`);

    const { dados: meB } = await api("/users/me", { token: tokenProfB, esperado: 200 });
    assert(meB.ueps.length === 1, `ProfB deveria ver 1 uep em /users/me, veio ${JSON.stringify(meB.ueps)}`);
  });

  await checa(6, "PROFESSOR: Minha Equipe comeca vazia", async () => {
    const { dados } = await api(`/users?professorId=${profA.id}`, { token: tokenProfA, esperado: 200 });
    assert(Array.isArray(dados) && dados.length === 0, `esperado [], veio ${JSON.stringify(dados)}`);
  });

  await checa(6, "PROFESSOR cria ALUNO escolhendo uma das SUAS UEPs; professor_id vem do token, nao do corpo", async () => {
    const { dados } = await api("/users", {
      metodo: "POST",
      token: tokenProfA,
      body: {
        nome: "Aluno da Equipe",
        email: `smoke.equipe.${sufixo}@teste.com`,
        senha: "senha123",
        role: "ALUNO",
        professorId: profB.id, // tentativa de forjar — deve ser ignorada
        uepId: uepsSemente[1], // uma das DUAS UEPs de ProfA — valido
      },
      esperado: 201,
    });
    alunoEquipeId = dados.id;
    assert(dados.professor_id === profA.id, `professor_id esperado ${profA.id}, veio ${dados.professor_id}`);
    assert(dados.uep_id === uepsSemente[1], `uep_id esperado ${uepsSemente[1]}, veio ${dados.uep_id}`);
  });

  await checa(6, "PROFESSOR nao consegue colocar equipe numa UEP que nao e dele (403)", async () => {
    // uepId aqui e uma UEP que existe (uepId, da secao de UEPs no topo do
    // arquivo) mas nao esta entre as duas de ProfA nem a de ProfB.
    await api("/users", {
      metodo: "POST",
      token: tokenProfA,
      body: {
        nome: "Tentativa Forjada",
        email: `smoke.forjado.${sufixo}@teste.com`,
        senha: "senha123",
        role: "ALUNO",
        uepId: uepId,
      },
      esperado: 403,
    });
  });

  await checa(6, "PROFESSOR com UMA UEP so nao precisa escolher: cai nela sozinho", async () => {
    const { dados } = await api("/users", {
      metodo: "POST",
      token: tokenProfB,
      body: {
        nome: "Aluno da Equipe B",
        email: `smoke.equipeb.${sufixo}@teste.com`,
        senha: "senha123",
        role: "ALUNO",
      },
      esperado: 201,
    });
    alunoEquipeBId = dados.id;
    assert(dados.professor_id === profB.id, `professor_id esperado ${profB.id}, veio ${dados.professor_id}`);
    assert(dados.uep_id === uepsSemente[0], `uep_id esperado ${uepsSemente[0]}, veio ${dados.uep_id}`);
  });

  await checa(6, "PROFESSOR nao cria outro PROFESSOR (403)", async () => {
    await api("/users", {
      metodo: "POST",
      token: tokenProfA,
      body: { nome: "Y", email: `smoke.y.${sufixo}@ifpe.edu.br`, senha: "senha123", role: "PROFESSOR" },
      esperado: 403,
    });
  });

  await checa(6, "GET /users sem filtro como PROFESSOR devolve so a propria equipe", async () => {
    const { dados } = await api("/users", { token: tokenProfA, esperado: 200 });
    assert(dados.length === 1 && dados[0].id === alunoEquipeId, `veio ${JSON.stringify(dados.map((u) => u.id))}`);
  });

  await checa(6, "Outro PROFESSOR nao ve nem mexe na equipe do colega", async () => {
    const { dados } = await api("/users", { token: tokenProfB, esperado: 200 });
    assert(!dados.some((u) => u.id === alunoEquipeId), "professor B enxergou o aluno do A");
    await api(`/users?professorId=${profA.id}`, { token: tokenProfB, esperado: 403 });
    await api(`/users/${alunoEquipeId}`, {
      metodo: "PATCH",
      token: tokenProfB,
      body: { role: "TECNICO" },
      esperado: 404,
    });
    await api(`/users/${alunoEquipeId}`, { metodo: "DELETE", token: tokenProfB, esperado: 404 });
  });

  await checa(6, "PROFESSOR troca o perfil de alguem da equipe (so papeis de equipe)", async () => {
    const { dados } = await api(`/users/${alunoEquipeId}`, {
      metodo: "PATCH",
      token: tokenProfA,
      body: { role: "TECNICO" },
      esperado: 200,
    });
    assert(dados.role === "TECNICO", `role esperado TECNICO, veio ${dados.role}`);
    await api(`/users/${alunoEquipeId}`, {
      metodo: "PATCH",
      token: tokenProfA,
      body: { role: "PROFESSOR" },
      esperado: 403,
    });
  });

  await checa(6, "ADMIN so lista e edita Professores", async () => {
    const { dados } = await api("/users", { token: tokenAdmin, esperado: 200 });
    assert(dados.every((u) => u.role === "PROFESSOR"), "ADMIN recebeu quem nao e Professor");
    await api("/users?role=ALUNO", { token: tokenAdmin, esperado: 403 });
    await api(`/users/${alunoEquipeId}`, {
      metodo: "PATCH",
      token: tokenAdmin,
      body: { nome: "Hack" },
      esperado: 404,
    });
  });

  await checa(6, "ADMIN substitui o conjunto de UEPs do Professor (uepIds) e quem ficou fora perde a UEP", async () => {
    // alunoEquipeId esta em uepsSemente[1] (ver criacao acima). Tirando essa
    // UEP do conjunto de ProfA, ele deveria ficar "solto" (uep_id = NULL).
    const { dados } = await api(`/users/${profA.id}`, {
      metodo: "PATCH",
      token: tokenAdmin,
      body: { uepIds: [uepsSemente[0]] },
      esperado: 200,
    });
    assert(dados.ueps.length === 1 && dados.ueps[0].id === uepsSemente[0], `ueps esperado so [${uepsSemente[0]}], veio ${JSON.stringify(dados.ueps)}`);

    const membro = await api(`/users/${alunoEquipeId}`, { token: tokenProfA, esperado: 200 });
    assert(membro.dados.uep_id === null, `equipe deveria ter ficado sem UEP, veio ${membro.dados.uep_id}`);
  });

  await checa(6, "PROFESSOR nao muda UEP da equipe, nem por uepId nem por uepIds (403)", async () => {
    await api(`/users/${alunoEquipeId}`, {
      metodo: "PATCH",
      token: tokenProfA,
      body: { uepId: uepsSemente[0] },
      esperado: 403,
    });
    await api(`/users/${alunoEquipeId}`, {
      metodo: "PATCH",
      token: tokenProfA,
      body: { uepIds: [uepsSemente[0]] },
      esperado: 403,
    });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 10 — Estoque de insumos (entradas, saidas e saldos por UEP)");
  // ─────────────────────────────────────────────────────────────
  let insumoId = null;
  const base = `/ueps/${uepId}`;

  await checa(10, "POST /ueps/:id/insumos cria insumo com saldo inicial", async () => {
    const { dados } = await api(`${base}/insumos`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { nome: "Racao Smoke", unidade: "kg", saldoInicial: 100, estoqueMinimo: 20, consumoMedioDiario: 10 },
      esperado: 201,
    });
    assert(dados.id, "resposta sem id");
    assert(dados.uep_id === uepId, `uep_id esperado ${uepId}, veio ${dados.uep_id}`);
    assert(dados.saldo_atual === 100, `saldo_atual esperado 100, veio ${dados.saldo_atual}`);
    assert(dados.estoque_minimo === 20 && dados.consumo_medio_diario === 10, "estoque_minimo/consumo_medio_diario errados");
    insumoId = dados.id;
  });

  await checa(10, "POST /insumos com nome repetido na mesma UEP devolve 400", async () => {
    await api(`${base}/insumos`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { nome: "Racao Smoke", unidade: "kg" },
      esperado: 400,
    });
  });

  await checa(10, "POST /insumos valida campos (nome vazio, saldo negativo, saldo texto)", async () => {
    await api(`${base}/insumos`, { metodo: "POST", token: tokenAdmin, body: { nome: "  ", unidade: "kg" }, esperado: 400 });
    await api(`${base}/insumos`, { metodo: "POST", token: tokenAdmin, body: { nome: "X", unidade: "kg", saldoInicial: -1 }, esperado: 400 });
    await api(`${base}/insumos`, { metodo: "POST", token: tokenAdmin, body: { nome: "X", unidade: "kg", saldoInicial: "abc" }, esperado: 400 });
  });

  await checa(10, "GET /insumos lista o insumo criado", async () => {
    const { dados } = await api(`${base}/insumos`, { token: tokenAdmin, esperado: 200 });
    const item = dados.find((i) => i.id === insumoId);
    assert(item, "insumo criado nao apareceu na listagem");
    assert(item.nome === "Racao Smoke" && item.unidade === "kg", "nome/unidade errados na listagem");
  });

  await checa(10, "Saldo inicial gera a ENTRADA 'Cadastro inicial do insumo' com responsavel", async () => {
    const { dados } = await api(`${base}/estoque/movimentacoes?insumoId=${insumoId}`, { token: tokenAdmin, esperado: 200 });
    assert(dados.length === 1, `esperado 1 movimentacao, veio ${dados.length}`);
    const m = dados[0];
    assert(m.tipo === "ENTRADA" && m.quantidade === 100, `ENTRADA de 100 esperada, veio ${m.tipo} ${m.quantidade}`);
    assert(m.observacao === "Cadastro inicial do insumo", `observacao errada: ${m.observacao}`);
    assert(m.insumo_nome === "Racao Smoke" && m.unidade === "kg", "insumo_nome/unidade errados");
    assert(m.responsavel, "responsavel vazio (deveria vir do JOIN com users)");
    assert(/^\d{4}-\d{2}-\d{2}$/.test(m.data), `data fora do formato AAAA-MM-DD: ${m.data}`);
  });

  await checa(10, "POST /estoque/movimentacoes SAIDA baixa o saldo e ignora 'responsavel' do body", async () => {
    const { dados } = await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { insumoId, tipo: "SAIDA", quantidade: 30, data: "2026-01-15", observacao: "Trato manha", responsavel: "Impostor" },
      esperado: 201,
    });
    assert(dados.tipo === "SAIDA" && dados.quantidade === 30, "movimentacao devolvida errada");
    assert(dados.data === "2026-01-15", `data esperada 2026-01-15, veio ${dados.data}`);
    assert(dados.responsavel && dados.responsavel !== "Impostor", `responsavel veio do cliente: ${dados.responsavel}`);

    const lista = await api(`${base}/insumos`, { token: tokenAdmin, esperado: 200 });
    const saldo = lista.dados.find((i) => i.id === insumoId).saldo_atual;
    assert(saldo === 70, `saldo esperado 70, veio ${saldo}`);
  });

  await checa(10, "ENTRADA soma ao saldo", async () => {
    await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { insumoId, tipo: "ENTRADA", quantidade: 5.5 },
      esperado: 201,
    });
    const lista = await api(`${base}/insumos`, { token: tokenAdmin, esperado: 200 });
    const saldo = lista.dados.find((i) => i.id === insumoId).saldo_atual;
    assert(saldo === 75.5, `saldo esperado 75.5, veio ${saldo}`);
  });

  await checa(10, "SAIDA maior que o saldo devolve 400 com mensagem e nao altera o saldo", async () => {
    const { dados } = await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { insumoId, tipo: "SAIDA", quantidade: 500 },
      esperado: 400,
    });
    assert(/Quantidade maior que o saldo dispon/.test(dados.error), `mensagem inesperada: ${dados.error}`);
    assert(/75,5 kg/.test(dados.error), `mensagem deveria citar o saldo (75,5 kg): ${dados.error}`);
    const lista = await api(`${base}/insumos`, { token: tokenAdmin, esperado: 200 });
    assert(lista.dados.find((i) => i.id === insumoId).saldo_atual === 75.5, "saldo mudou apos SAIDA rejeitada");
  });

  await checa(10, "Movimentacao rejeita quantidade 0/negativa, tipo e insumo invalidos", async () => {
    await api(`${base}/estoque/movimentacoes`, { metodo: "POST", token: tokenAdmin, body: { insumoId, tipo: "ENTRADA", quantidade: 0 }, esperado: 400 });
    await api(`${base}/estoque/movimentacoes`, { metodo: "POST", token: tokenAdmin, body: { insumoId, tipo: "ENTRADA", quantidade: -3 }, esperado: 400 });
    await api(`${base}/estoque/movimentacoes`, { metodo: "POST", token: tokenAdmin, body: { insumoId, tipo: "TRANSFERENCIA", quantidade: 1 }, esperado: 400 });
    await api(`${base}/estoque/movimentacoes`, { metodo: "POST", token: tokenAdmin, body: { insumoId, tipo: "ENTRADA", quantidade: 1, data: "31/02/2026" }, esperado: 400 });
    await api(`${base}/estoque/movimentacoes`, { metodo: "POST", token: tokenAdmin, body: { insumoId: 99999999, tipo: "ENTRADA", quantidade: 1 }, esperado: 404 });
  });

  await checa(10, "GET movimentacoes filtra por tipo, vem do mais recente e rejeita tipo invalido", async () => {
    const saidas = await api(`${base}/estoque/movimentacoes?tipo=SAIDA&insumoId=${insumoId}`, { token: tokenAdmin, esperado: 200 });
    assert(saidas.dados.length === 1 && saidas.dados.every((m) => m.tipo === "SAIDA"), "filtro tipo=SAIDA errado");

    const todas = await api(`${base}/estoque/movimentacoes?insumoId=${insumoId}`, { token: tokenAdmin, esperado: 200 });
    assert(todas.dados.length === 3, `esperado 3 movimentacoes, veio ${todas.dados.length}`);
    const datas = todas.dados.map((m) => m.data);
    assert(datas.every((d, i) => i === 0 || datas[i - 1] >= d), `ordem nao e mais recente primeiro: ${datas.join(", ")}`);

    await api(`${base}/estoque/movimentacoes?tipo=XYZ`, { token: tokenAdmin, esperado: 400 });
  });

  await checa(10, "Insumo de uma UEP nao aceita movimentacao por outra UEP (isolamento)", async () => {
    const outraUep = uepsSemente.find((id) => id !== uepId);
    assert(outraUep, "nenhuma outra UEP disponivel para o teste");
    await api(`/ueps/${outraUep}/estoque/movimentacoes`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { insumoId, tipo: "ENTRADA", quantidade: 1 },
      esperado: 404,
    });
    const lista = await api(`/ueps/${outraUep}/insumos`, { token: tokenAdmin, esperado: 200 });
    assert(!lista.dados.some((i) => i.id === insumoId), "insumo vazou para a listagem de outra UEP");
  });

  await checa(10, "UEP inexistente devolve 404 e sem token devolve 401", async () => {
    await api(`/ueps/99999999/insumos`, { token: tokenAdmin, esperado: 404 });
    await api(`${base}/insumos`, { esperado: 401 });
    await api(`${base}/estoque/movimentacoes`, { esperado: 401 });
  });

  await checa(10, "RBAC: ALUNO le o estoque, mas nao cria insumo nem movimentacao (403)", async () => {
    await api(`${base}/insumos`, { token: tokenAluno, esperado: 200 });
    await api(`${base}/estoque/movimentacoes`, { token: tokenAluno, esperado: 200 });
    await api(`${base}/insumos`, { metodo: "POST", token: tokenAluno, body: { nome: "Nao", unidade: "kg" }, esperado: 403 });
    await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST",
      token: tokenAluno,
      body: { insumoId, tipo: "SAIDA", quantidade: 1 },
      esperado: 403,
    });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nLimpeza");
  // ─────────────────────────────────────────────────────────────
  await checa(0, "Remove os dados criados pelo smoke test", async () => {
    for (const id of animaisCriados) {
      await api(`/animais/${id}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    }
    await api(`/ueps/${uepId}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    if (alunoEquipeId) {
      await api(`/users/${alunoEquipeId}`, { metodo: "DELETE", token: tokenProfA, esperado: 204 });
    }
    if (alunoEquipeBId) {
      await api(`/users/${alunoEquipeBId}`, { metodo: "DELETE", token: tokenProfB, esperado: 204 });
    }
    for (const p of [profA, profB]) {
      if (p) await api(`/users/${p.id}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    }
    // O ALUNO do autocadastro (alunoId) fica no banco: pela hierarquia nova a
    // Diretoria so remove Professores e ele nao tem professor responsavel.
    // Cada execucao usa um e-mail unico, entao isso nao quebra rodadas seguintes.
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(58));
  console.log(`  ${passou} passaram, ${falhou} falharam`);
  console.log("─".repeat(58));

  if (falhou > 0) {
    console.log("\nFalhas:\n");
    for (const f of falhas) {
      console.log(`  [Sprint ${f.sprint}] ${f.nome}`);
      console.log(`     ${f.detalhe}\n`);
    }
    process.exit(1);
  }

  console.log("\n\x1b[32mEntregaveis de backend das Sprints 3, 4, 5 e 10 verificados.\x1b[0m\n");
})();
