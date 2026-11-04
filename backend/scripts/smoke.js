/**
 * Smoke test dos entregaveis de backend das Sprints 3, 4, 5, 10 e 12.
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

async function postCru(caminho, corpoTexto) {
  const res = await fetch(BASE + caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: corpoTexto,
  });
  return { status: res.status, dados: await res.json().catch(() => null) };
}

(async () => {
  console.log(`\nSmoke test — Sprints 3, 4, 5, 10, 12 + hierarquia de acesso`);
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

  await checa(3, "Login aceita o e-mail com maiusculas/espacos (normalizado)", async () => {
    const { dados } = await api("/auth/login", {
      metodo: "POST",
      body: { email: `  ${ADMIN_EMAIL.toUpperCase()} `, senha: ADMIN_PASSWORD },
      esperado: 200,
    });
    assert(dados.user?.email === ADMIN_EMAIL, `email esperado ${ADMIN_EMAIL}, veio ${dados.user?.email}`);
  });

  await checa(3, "JSON malformado no corpo devolve 400 (e nao 500)", async () => {
    const { status, dados } = await postCru("/auth/login", "{email: sem aspas");
    assert(status === 400, `esperado 400, veio ${status}`);
    assert(dados && typeof dados.error === "string", "resposta sem { error }");
  });

  await checa(3, "GET /api/health responde sem token", async () => {
    const { dados } = await api("/health", { esperado: 200 });
    assert(dados.status === "ok", `status esperado ok, veio ${JSON.stringify(dados)}`);
  });

  await checa(3, "POST /auth/register exige senha com 6+ caracteres (400)", async () => {
    await api("/auth/register", {
      metodo: "POST",
      body: { nome: "Senha Curta", email: `curta.${Date.now()}@teste.com`, senha: "123", role: "ALUNO" },
      esperado: 400,
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

  await checa(4, "So a Diretoria cria/edita/exclui UEP: PROFESSOR recebe 403", async () => {
    // tokenProfUep e criado logo abaixo; aqui usa um professor descartavel
    const email = `smoke.profcrud.${Date.now()}@ifpe.edu.br`;
    const { dados: prof } = await api("/users", {
      metodo: "POST", token: tokenAdmin,
      body: { nome: "Prof CRUD", email, senha: "senha123", role: "PROFESSOR" },
      esperado: 201,
    });
    const { dados: login } = await api("/auth/login", { metodo: "POST", body: { email, senha: "senha123" }, esperado: 200 });
    await api("/ueps", { metodo: "POST", token: login.token, body: { nome: "Nao pode", tipo: "OUTRO" }, esperado: 403 });
    await api(`/ueps/${uepId}`, { metodo: "PATCH", token: login.token, body: { descricao: "x" }, esperado: 403 });
    await api(`/ueps/${uepId}`, { metodo: "DELETE", token: login.token, esperado: 403 });
    await api(`/users/${prof.id}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
  });

  await checa(4, "Id de UEP invalido devolve 400 (e nao 500)", async () => {
    await api("/ueps/abc", { token: tokenAdmin, esperado: 400 });
    await api("/ueps/1.5/animais", { token: tokenAdmin, esperado: 400 });
    await api("/ueps?tipo=DRAGAOCULTURA", { token: tokenAdmin, esperado: 400 });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 4 — Isolamento por UEP no backend");
  // ─────────────────────────────────────────────────────────────
  // Professor com acesso SO a UEP do smoke e um ALUNO da equipe dele nessa
  // UEP. As leituras de "perfil somente-leitura" dos blocos seguintes usam
  // esse aluno (tokenAlunoUep); o aluno do autocadastro (tokenAluno) nao
  // tem UEP nenhuma e passa a receber 403 nos dados de qualquer setor.
  let profUep = null;
  let tokenProfUep = null;
  let alunoUepId = null;
  let tokenAlunoUep = null;
  let outraUepId = null;

  await checa(4, "Prepara professor da UEP do smoke e um ALUNO da equipe dele", async () => {
    const sfx = Date.now();
    const { dados: prof } = await api("/users", {
      metodo: "POST", token: tokenAdmin,
      body: { nome: "Prof UEP Smoke", email: `smoke.profuep.${sfx}@ifpe.edu.br`, senha: "senha123", role: "PROFESSOR", uepIds: [uepId] },
      esperado: 201,
    });
    profUep = prof;
    tokenProfUep = (await api("/auth/login", { metodo: "POST", body: { email: prof.email, senha: "senha123" }, esperado: 200 })).dados.token;

    const emailAluno = `smoke.alunouep.${sfx}@teste.com`;
    const { dados: aluno } = await api("/users", {
      metodo: "POST", token: tokenProfUep,
      body: { nome: "Aluno UEP Smoke", email: emailAluno, senha: "senha123", role: "ALUNO" },
      esperado: 201,
    });
    alunoUepId = aluno.id;
    assert(aluno.uep_id === uepId, `aluno deveria estar na UEP ${uepId}, veio ${aluno.uep_id}`);
    tokenAlunoUep = (await api("/auth/login", { metodo: "POST", body: { email: emailAluno, senha: "senha123" }, esperado: 200 })).dados.token;

    const { dados: todas } = await api("/ueps", { token: tokenAdmin, esperado: 200 });
    outraUepId = todas.find((u) => u.id !== uepId).id;
  });

  await checa(4, "Equipe e Professor acessam a propria UEP (200)", async () => {
    await api(`/ueps/${uepId}/animais`, { token: tokenAlunoUep, esperado: 200 });
    await api(`/ueps/${uepId}/insumos`, { token: tokenProfUep, esperado: 200 });
  });

  await checa(4, "Ninguem le nem grava dados de UEP que nao e sua (403)", async () => {
    await api(`/ueps/${outraUepId}/animais`, { token: tokenAlunoUep, esperado: 403 });
    await api(`/ueps/${outraUepId}/insumos`, { token: tokenProfUep, esperado: 403 });
    await api(`/ueps/${outraUepId}/compras/necessidades`, { token: tokenProfUep, esperado: 403 });
    await api(`/ueps/${outraUepId}/animais`, {
      metodo: "POST", token: tokenProfUep,
      body: { brinco: "SMK-INVASAO", categoria: "VACA", sexo: "FEMEA" },
      esperado: 403,
    });
  });

  await checa(4, "Conta sem UEP (autocadastro) nao acessa dados de setor nenhum (403)", async () => {
    await api(`/ueps/${uepId}/animais`, { token: tokenAluno, esperado: 403 });
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
    await api(`/ueps/${uepId}/animais`, { token: tokenAlunoUep, esperado: 200 });
    await api(`/ueps/${uepId}/animais`, {
      metodo: "POST", token: tokenAlunoUep,
      body: { brinco: "SMK-BLOQ", categoria: "VACA", sexo: "FEMEA" },
      esperado: 403,
    });
  });

  await checa(5, "Rota aninhada nao alcanca animal de outra UEP (GET/PATCH/DELETE -> 404)", async () => {
    const { dados: deFora } = await api(`/ueps/${outraUepId}/animais`, { token: tokenAdmin, esperado: 200 });
    assert(deFora.length > 0, "a outra UEP precisa ter ao menos 1 animal semeado");
    const idFora = deFora[0].id;
    await api(`/ueps/${uepId}/animais/${idFora}`, { token: tokenAdmin, esperado: 404 });
    await api(`/ueps/${uepId}/animais/${idFora}`, { metodo: "PATCH", token: tokenAdmin, body: { observacoes: "x" }, esperado: 404 });
    await api(`/ueps/${uepId}/animais/${idFora}`, { metodo: "DELETE", token: tokenAdmin, esperado: 404 });
  });

  await checa(5, "Rotas da raiz (/animais) ficam limitadas as UEPs do usuario", async () => {
    const { dados } = await api("/animais", { token: tokenAlunoUep, esperado: 200 });
    assert(dados.length === 6 && dados.every((a) => a.uep_id === uepId), `aluno deveria ver so os 6 da UEP ${uepId}`);
    const { dados: censo } = await api("/animais/censo", { token: tokenAlunoUep, esperado: 200 });
    assert(censo.total === 6, `censo do aluno deveria contar 6, veio ${censo.total}`);
    await api(`/animais?uepId=${outraUepId}`, { token: tokenAlunoUep, esperado: 403 });
    const { dados: deFora } = await api(`/ueps/${outraUepId}/animais`, { token: tokenAdmin, esperado: 200 });
    await api(`/animais/${deFora[0].id}`, { token: tokenAlunoUep, esperado: 404 });
    const { dados: semUep } = await api("/animais", { token: tokenAluno, esperado: 200 });
    assert(Array.isArray(semUep) && semUep.length === 0, "conta sem UEP deveria receber lista vazia");
  });

  await checa(5, "Filtros e ids invalidos devolvem 400 (e nao 500)", async () => {
    await api(`/ueps/${uepId}/animais?categoria=PEGASO`, { token: tokenAdmin, esperado: 400 });
    await api(`/ueps/${uepId}/animais/censo?disponivel=talvez`, { token: tokenAdmin, esperado: 400 });
    await api(`/ueps/${uepId}/animais/abc`, { token: tokenAdmin, esperado: 400 });
    await api(`/animais?uepId=abc`, { token: tokenAdmin, esperado: 400 });
  });

  await checa(5, "PATCH com null limpa campo opcional (observacoes)", async () => {
    const id = animaisCriados[1];
    await api(`/ueps/${uepId}/animais/${id}`, { metodo: "PATCH", token: tokenAdmin, body: { observacoes: "temporaria" }, esperado: 200 });
    const { dados } = await api(`/ueps/${uepId}/animais/${id}`, { metodo: "PATCH", token: tokenAdmin, body: { observacoes: null }, esperado: 200 });
    assert(dados.observacoes === null, `observacoes deveria ter sido limpa, veio ${dados.observacoes}`);
    assert(dados.categoria === "VACA", "PATCH parcial nao pode mexer nos outros campos");
  });

  await checa(5, "Brinco repetido na UEP devolve 409 com mensagem clara; nascimento futuro 400", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais`, {
      metodo: "POST", token: tokenAdmin, body: { brinco: "SMK-001", categoria: "VACA", sexo: "FEMEA" }, esperado: 409,
    });
    assert(/brinco/i.test(dados.error), `mensagem deveria citar o brinco: ${dados.error}`);
    await api(`/ueps/${uepId}/animais`, {
      metodo: "POST", token: tokenAdmin, body: { brinco: "SMK-FUT", categoria: "VACA", sexo: "FEMEA", dataNascimento: "2999-01-01" }, esperado: 400,
    });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 6 — Raca, genetica e estagio de vida");
  // ─────────────────────────────────────────────────────────────
  let filhoId = null;

  await checa(6, "Cadastra cria com pai, mae e grau de sangue; devolve estagio e idade", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais`, {
      metodo: "POST", token: tokenAdmin,
      body: {
        brinco: "SMK-CRIA", categoria: "BEZERRA", sexo: "FEMEA", raca: "Nelore",
        grauSangue: "1/2 Nelore x Gir", dataNascimento: "2025-06-10",
        paiId: animaisCriados[2], maeId: animaisCriados[5],
      },
      esperado: 201,
    });
    filhoId = dados.id;
    animaisCriados.push(dados.id);
    assert(dados.grau_sangue === "1/2 Nelore x Gir", `grau_sangue: ${dados.grau_sangue}`);
    assert(dados.pai_brinco === "SMK-003" && dados.mae_brinco === "SMK-006", `pais: ${dados.pai_brinco}/${dados.mae_brinco}`);
    assert(dados.estagio_vida === "CRIA", `estagio_vida esperado CRIA, veio ${dados.estagio_vida}`);
    assert(Number.isInteger(dados.idade_meses) && dados.idade_meses >= 0, `idade_meses: ${dados.idade_meses}`);
    assert(dados.data_nascimento === "2025-06-10", `data_nascimento deveria vir como AAAA-MM-DD, veio ${dados.data_nascimento}`);
  });

  await checa(6, "GET genealogia traz pai, mae e filhos", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/${animaisCriados[5]}/genealogia`, { token: tokenAlunoUep, esperado: 200 });
    assert(dados.animal.id === animaisCriados[5], "animal errado");
    assert(dados.filhos.some((f) => f.id === filhoId), "a cria deveria aparecer nos filhos da mae");
    const { dados: g } = await api(`/ueps/${uepId}/animais/${filhoId}/genealogia`, { token: tokenAdmin, esperado: 200 });
    assert(g.pai?.brinco === "SMK-003" && g.mae?.brinco === "SMK-006", "pai/mae da cria errados");
  });

  await checa(6, "Genealogia invalida devolve 400 (mae no lugar do pai, pai de outra UEP)", async () => {
    await api(`/ueps/${uepId}/animais/${filhoId}`, { metodo: "PATCH", token: tokenAdmin, body: { paiId: animaisCriados[5] }, esperado: 400 });
    const { dados: deFora } = await api(`/ueps/${outraUepId}/animais?sexo=MACHO`, { token: tokenAdmin, esperado: 200 });
    if (deFora.length) {
      await api(`/ueps/${uepId}/animais/${filhoId}`, { metodo: "PATCH", token: tokenAdmin, body: { paiId: deFora[0].id }, esperado: 400 });
    }
    await api(`/ueps/${uepId}/animais/${filhoId}`, { metodo: "PATCH", token: tokenAdmin, body: { maeId: filhoId }, esperado: 400 });
  });

  await checa(6, "Categoria x sexo x fase reprodutiva coerentes (400 quando nao combinam)", async () => {
    await api(`/ueps/${uepId}/animais`, { metodo: "POST", token: tokenAdmin, body: { brinco: "SMK-ERR1", categoria: "VACA", sexo: "MACHO" }, esperado: 400 });
    await api(`/ueps/${uepId}/animais`, { metodo: "POST", token: tokenAdmin, body: { brinco: "SMK-ERR2", categoria: "OUTRO", sexo: "MACHO", statusReprodutivo: "PRENHE" }, esperado: 400 });
    // PATCH confere o estado final: o touro (macho) nao pode virar LACTANTE
    await api(`/ueps/${uepId}/animais/${animaisCriados[2]}`, { metodo: "PATCH", token: tokenAdmin, body: { statusReprodutivo: "LACTANTE" }, esperado: 400 });
  });

  await checa(6, "Censo por estagio de vida e filtro ?estagioVida=", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/censo`, { token: tokenAdmin, esperado: 200 });
    assert(Array.isArray(dados.porEstagioVida), "porEstagioVida ausente");
    const soma = dados.porEstagioVida.reduce((acc, l) => acc + l.total, 0);
    assert(soma === dados.total, `soma por estagio ${soma} diferente do total ${dados.total}`);
    const { dados: crias } = await api(`/ueps/${uepId}/animais?estagioVida=CRIA`, { token: tokenAdmin, esperado: 200 });
    assert(crias.length >= 2 && crias.every((a) => a.estagio_vida === "CRIA"), "filtro estagioVida=CRIA falhou");
    await api(`/ueps/${uepId}/animais?estagioVida=IDOSO`, { token: tokenAdmin, esperado: 400 });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 7 — Disponibilidade do animal no setor");
  // ─────────────────────────────────────────────────────────────
  await checa(7, "Animal em DESCARTE fica indisponivel com motivo DESCARTE (e nao volta por PATCH)", async () => {
    // animaisCriados[0] foi para DESCARTE no bloco do Sprint 5
    const { dados } = await api(`/ueps/${uepId}/animais/${animaisCriados[0]}`, { token: tokenAdmin, esperado: 200 });
    assert(dados.disponivel === false && dados.motivo_indisponibilidade === "DESCARTE",
      `esperado indisponivel/DESCARTE, veio ${dados.disponivel}/${dados.motivo_indisponibilidade}`);
    assert(dados.indisponivel_desde, "indisponivel_desde deveria estar preenchido");
    await api(`/ueps/${uepId}/animais/${animaisCriados[0]}`, { metodo: "PATCH", token: tokenAdmin, body: { disponivel: true }, esperado: 400 });
  });

  await checa(7, "Motivo deixa indisponivel; disponivel=false sem motivo vira OUTRO; disponivel=true limpa", async () => {
    const url = `/ueps/${uepId}/animais/${animaisCriados[3]}`;
    let r = await api(url, { metodo: "PATCH", token: tokenAdmin, body: { motivoIndisponibilidade: "QUARENTENA" }, esperado: 200 });
    assert(r.dados.disponivel === false && r.dados.motivo_indisponibilidade === "QUARENTENA", "QUARENTENA nao aplicou");
    r = await api(url, { metodo: "PATCH", token: tokenAdmin, body: { disponivel: true }, esperado: 200 });
    assert(r.dados.disponivel === true && r.dados.motivo_indisponibilidade === null && r.dados.indisponivel_desde === null, "disponivel=true nao limpou");
    r = await api(url, { metodo: "PATCH", token: tokenAdmin, body: { disponivel: false }, esperado: 200 });
    assert(r.dados.motivo_indisponibilidade === "OUTRO", `sem motivo deveria virar OUTRO, veio ${r.dados.motivo_indisponibilidade}`);
    await api(url, { metodo: "PATCH", token: tokenAdmin, body: { motivoIndisponibilidade: "SUMIU" }, esperado: 400 });
  });

  await checa(7, "GET disponibilidade resume o setor (totais, por motivo, por categoria)", async () => {
    const { dados } = await api(`/ueps/${uepId}/animais/disponibilidade`, { token: tokenAlunoUep, esperado: 200 });
    assert(dados.total === dados.disponiveis + dados.indisponiveis, "total != disponiveis + indisponiveis");
    assert(dados.indisponiveis >= 2, `esperado ao menos 2 indisponiveis, veio ${dados.indisponiveis}`);
    const somaMotivos = dados.por_motivo.reduce((acc, l) => acc + l.total, 0);
    assert(somaMotivos === dados.indisponiveis, "soma por motivo diferente dos indisponiveis");
    assert(dados.por_motivo.some((l) => l.motivo === "DESCARTE"), "motivo DESCARTE ausente");
    const somaCat = dados.por_categoria.reduce((acc, l) => acc + l.total, 0);
    assert(somaCat === dados.total, "soma por categoria diferente do total");
    const { dados: lista } = await api(`/ueps/${uepId}/animais?motivoIndisponibilidade=OUTRO`, { token: tokenAdmin, esperado: 200 });
    assert(lista.length === 1 && lista[0].id === animaisCriados[3], "filtro por motivo falhou");
    // devolve o bezerro para disponivel (nao interfere nos blocos seguintes)
    await api(`/ueps/${uepId}/animais/${animaisCriados[3]}`, { metodo: "PATCH", token: tokenAdmin, body: { disponivel: true }, esperado: 200 });
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
    await api(`${base}/insumos`, { token: tokenAlunoUep, esperado: 200 });
    await api(`${base}/estoque/movimentacoes`, { token: tokenAlunoUep, esperado: 200 });
    await api(`${base}/insumos`, { metodo: "POST", token: tokenAlunoUep, body: { nome: "Nao", unidade: "kg" }, esperado: 403 });
    await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST",
      token: tokenAlunoUep,
      body: { insumoId, tipo: "SAIDA", quantidade: 1 },
      esperado: 403,
    });
  });

  await checa(10, "PATCH /insumos/:id edita minimo/consumo; saldo so por movimentacao (400)", async () => {
    const { dados } = await api(`${base}/insumos/${insumoId}`, {
      metodo: "PATCH", token: tokenProfUep, body: { estoqueMinimo: 7.5, consumoMedioDiario: "1.25" }, esperado: 200,
    });
    assert(dados.estoque_minimo === 7.5 && dados.consumo_medio_diario === 1.25, `nao atualizou: ${JSON.stringify(dados)}`);
    const { dados: um } = await api(`${base}/insumos/${insumoId}`, { token: tokenAlunoUep, esperado: 200 });
    assert(um.id === insumoId && um.estoque_minimo === 7.5, "GET /insumos/:id nao trouxe o insumo atualizado");
    await api(`${base}/insumos/${insumoId}`, { metodo: "PATCH", token: tokenAdmin, body: { saldoAtual: 9999 }, esperado: 400 });
    await api(`${base}/insumos/${insumoId}`, { metodo: "PATCH", token: tokenAlunoUep, body: { estoqueMinimo: 1 }, esperado: 403 });
    await api(`/ueps/${outraUepId}/insumos/${insumoId}`, { token: tokenAdmin, esperado: 404 });
  });

  await checa(10, "Quantidade com mais de 3 casas e data futura devolvem 400", async () => {
    await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST", token: tokenAdmin, body: { insumoId, tipo: "ENTRADA", quantidade: 1.2345 }, esperado: 400,
    });
    await api(`${base}/estoque/movimentacoes`, {
      metodo: "POST", token: tokenAdmin, body: { insumoId, tipo: "ENTRADA", quantidade: 1, data: "2999-01-01" }, esperado: 400,
    });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nSPRINT 12 — Apoio as compras (necessidades consolidadas)");
  // ─────────────────────────────────────────────────────────────
  const necessidadesUrl = `/ueps/${uepId}/compras/necessidades`;

  await checa(12, "Prepara insumos (critico, atencao, ok, sem consumo) e um animal em DESCARTE", async () => {
    const insumos = [
      { nome: "Compras A critico", unidade: "kg", saldoInicial: 5, estoqueMinimo: 10, consumoMedioDiario: 2 },
      { nome: "Compras B atencao", unidade: "kg", saldoInicial: 20, estoqueMinimo: 5, consumoMedioDiario: 4 },
      { nome: "Compras C ok", unidade: "kg", saldoInicial: 500, estoqueMinimo: 10, consumoMedioDiario: 1 },
      { nome: "Compras D sem consumo", unidade: "kg", saldoInicial: 50, estoqueMinimo: 10, consumoMedioDiario: 0 },
    ];
    for (const body of insumos) {
      await api(`/ueps/${uepId}/insumos`, { metodo: "POST", token: tokenAdmin, body, esperado: 201 });
    }
    const { dados } = await api(`/ueps/${uepId}/animais`, {
      metodo: "POST",
      token: tokenAdmin,
      body: { brinco: "SMK-DESC", categoria: "VACA", sexo: "FEMEA", statusReprodutivo: "DESCARTE" },
      esperado: 201,
    });
    animaisCriados.push(dados.id);
  });

  const porNome = (dados, nome) => dados.insumos.find((i) => i.nome === nome);

  await checa(12, "GET necessidades (padrao 30 dias) devolve o contrato", async () => {
    const { dados } = await api(necessidadesUrl, { token: tokenAdmin, esperado: 200 });
    assert(dados.dias === 30, `dias esperado 30, veio ${dados.dias}`);
    assert(!Number.isNaN(Date.parse(dados.gerado_em)), `gerado_em invalido: ${dados.gerado_em}`);
    assert(Array.isArray(dados.insumos) && Array.isArray(dados.animais), "insumos/animais devem ser arrays");
    const a = porNome(dados, "Compras A critico");
    for (const campo of ["insumo_id", "nome", "unidade", "saldo_atual", "estoque_minimo", "consumo_medio_diario", "previsao_dias", "quantidade_sugerida", "urgencia"]) {
      assert(campo in a, `campo ausente no insumo: ${campo}`);
    }
  });

  await checa(12, "Urgencia e quantidade sugerida seguem a regra (30 dias)", async () => {
    const { dados } = await api(necessidadesUrl, { token: tokenAdmin, esperado: 200 });
    const a = porNome(dados, "Compras A critico");
    const b = porNome(dados, "Compras B atencao");
    const c = porNome(dados, "Compras C ok");
    const d = porNome(dados, "Compras D sem consumo");
    // A: 2*30 + 10 - 5 = 65, saldo 5 <= minimo 10
    assert(a.urgencia === "CRITICA" && a.quantidade_sugerida === 65 && a.previsao_dias === 2, `A errado: ${JSON.stringify(a)}`);
    // B: 4*30 + 5 - 20 = 105, previsao 5 dias (< 7)
    assert(b.urgencia === "ATENCAO" && b.quantidade_sugerida === 105 && b.previsao_dias === 5, `B errado: ${JSON.stringify(b)}`);
    // C: 1*30 + 10 - 500 < 0 -> 0
    assert(c.urgencia === "OK" && c.quantidade_sugerida === 0 && c.previsao_dias === 500, `C errado: ${JSON.stringify(c)}`);
    // D: sem consumo -> sem previsao; 0*30 + 10 - 50 < 0 -> 0
    assert(d.urgencia === "OK" && d.quantidade_sugerida === 0 && d.previsao_dias === null, `D errado: ${JSON.stringify(d)}`);
  });

  await checa(12, "Mais urgente primeiro na lista de insumos", async () => {
    const { dados } = await api(necessidadesUrl, { token: tokenAdmin, esperado: 200 });
    const pos = (nome) => dados.insumos.findIndex((i) => i.nome === nome);
    assert(pos("Compras A critico") < pos("Compras B atencao"), "CRITICA deveria vir antes de ATENCAO");
    assert(pos("Compras B atencao") < pos("Compras C ok"), "ATENCAO deveria vir antes de OK");
  });

  await checa(12, "?dias= muda o horizonte da quantidade sugerida", async () => {
    const { dados } = await api(`${necessidadesUrl}?dias=10`, { token: tokenAdmin, esperado: 200 });
    assert(dados.dias === 10, `dias esperado 10, veio ${dados.dias}`);
    // A: 2*10 + 10 - 5 = 25 ; B: 4*10 + 5 - 20 = 25
    assert(porNome(dados, "Compras A critico").quantidade_sugerida === 25, "A com 10 dias deveria sugerir 25");
    assert(porNome(dados, "Compras B atencao").quantidade_sugerida === 25, "B com 10 dias deveria sugerir 25");
  });

  await checa(12, "?dias= invalido devolve 400", async () => {
    for (const ruim of ["0", "-5", "abc", "1.5", "366"]) {
      await api(`${necessidadesUrl}?dias=${ruim}`, { token: tokenAdmin, esperado: 400 });
    }
  });

  await checa(12, "Animais: total por categoria, descarte e reposicao sugerida", async () => {
    const { dados } = await api(necessidadesUrl, { token: tokenAdmin, esperado: 200 });
    const lista = await api(`/ueps/${uepId}/animais`, { token: tokenAdmin, esperado: 200 });
    const soma = dados.animais.reduce((acc, l) => acc + l.total, 0);
    assert(soma === lista.dados.length, `soma por categoria ${soma} diferente do total de animais ${lista.dados.length}`);
    const descartes = lista.dados.filter((an) => an.status_reprodutivo === "DESCARTE").length;
    const somaDescarte = dados.animais.reduce((acc, l) => acc + l.em_descarte, 0);
    assert(descartes >= 1 && somaDescarte === descartes, `descartes esperados ${descartes}, veio ${somaDescarte}`);
    assert(dados.animais.every((l) => l.reposicao_sugerida === l.em_descarte), "reposicao_sugerida deveria ser igual a em_descarte");
    const vaca = dados.animais.find((l) => l.categoria === "VACA");
    assert(vaca && vaca.em_descarte >= 1, "categoria VACA deveria ter ao menos 1 em descarte");
  });

  await checa(12, "Acesso: ALUNO le (200), sem token 401, UEP inexistente 404", async () => {
    await api(necessidadesUrl, { token: tokenAlunoUep, esperado: 200 });
    await api(necessidadesUrl, { esperado: 401 });
    await api(`/ueps/99999999/compras/necessidades`, { token: tokenAdmin, esperado: 404 });
  });

  // ─────────────────────────────────────────────────────────────
  console.log("\nLimpeza");
  // ─────────────────────────────────────────────────────────────
  await checa(0, "Remove os dados criados pelo smoke test", async () => {
    for (const id of animaisCriados) {
      await api(`/animais/${id}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    }
    await api(`/ueps/${uepId}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    if (alunoUepId) {
      await api(`/users/${alunoUepId}`, { metodo: "DELETE", token: tokenProfUep, esperado: 204 });
    }
    if (profUep) await api(`/users/${profUep.id}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    if (alunoEquipeId) {
      await api(`/users/${alunoEquipeId}`, { metodo: "DELETE", token: tokenProfA, esperado: 204 });
    }
    if (alunoEquipeBId) {
      await api(`/users/${alunoEquipeBId}`, { metodo: "DELETE", token: tokenProfB, esperado: 204 });
    }
    for (const p of [profA, profB]) {
      if (p) await api(`/users/${p.id}`, { metodo: "DELETE", token: tokenAdmin, esperado: 204 });
    }
    // Token de uma conta removida deixa de valer na hora (nao espera expirar)
    if (tokenProfA) await api("/users/me", { token: tokenProfA, esperado: 401 });
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

  console.log("\n\x1b[32mEntregaveis de backend das Sprints 3, 4, 5, 10 e 12 verificados.\x1b[0m\n");
})();
