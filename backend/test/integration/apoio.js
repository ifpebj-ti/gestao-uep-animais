/*
 * Apoio aos testes de integração (Sprint 14).
 *
 * Os testes de integração sobem a API de verdade (app.js) numa porta livre
 * e falam com um Postgres real, já migrado. Só rodam quando DB_HOST está
 * definido — no CI isso acontece no job "migrate", depois de `npm run
 * migrate`. Sem banco (ex.: job "test", ou `npm test` sem Postgres) eles são
 * pulados e os testes unitários continuam rodando normalmente.
 *
 * Este arquivo não tem testes; o `node --test` o executa e não acha nenhum.
 */

process.env.NODE_ENV = process.env.NODE_ENV || "test";

export const temBanco = Boolean(process.env.DB_HOST);
export const MOTIVO_SKIP = temBanco ? false : "sem DB_HOST: integração só roda com Postgres migrado";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@ifpe.edu.br";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "admin123";

let servidor = null;
let base = null;

export async function iniciarApi() {
  const { default: app } = await import("../../src/app.js");
  await new Promise((resolve) => {
    servidor = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${servidor.address().port}/api`;
  return base;
}

export async function encerrarApi() {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  const { pool } = await import("../../src/config/db.js");
  await pool.end();
}

/** Chamada JSON. Devolve { status, dados, headers }. */
export async function api(caminho, { metodo = "GET", token, body, cru } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let corpo;
  if (cru !== undefined) {
    headers["Content-Type"] = "application/json";
    corpo = cru;
  } else if (body instanceof FormData) {
    corpo = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    corpo = JSON.stringify(body);
  }
  const res = await fetch(base + caminho, { method: metodo, headers, body: corpo });
  const tipo = res.headers.get("content-type") || "";
  let dados = null;
  if (tipo.includes("application/json")) dados = await res.json();
  else if (res.status !== 204) dados = Buffer.from(await res.arrayBuffer());
  return { status: res.status, dados, headers: res.headers };
}

export async function login(email, senha) {
  const r = await api("/auth/login", { metodo: "POST", body: { email, senha } });
  if (r.status !== 200) throw new Error(`login de ${email} falhou: ${r.status} ${JSON.stringify(r.dados)}`);
  return r.dados.token;
}

export const sufixo = () => `${Date.now()}${Math.floor(Math.random() * 1e4)}`;

/**
 * Cenário padrão: uma UEP nova, um Professor com acesso a ela e um Aluno
 * da equipe dele nessa UEP. limpar() remove tudo (a UEP leva junto, em
 * cascata, animais, estoque e atividades).
 */
export async function criarCenario(nome = "Int") {
  const sfx = sufixo();
  const tokenAdmin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  const uep = (await api("/ueps", { metodo: "POST", token: tokenAdmin, body: { nome: `${nome} UEP ${sfx}`, tipo: "OUTRO" } })).dados;
  const outra = (await api("/ueps", { metodo: "POST", token: tokenAdmin, body: { nome: `${nome} Outra ${sfx}`, tipo: "OUTRO" } })).dados;

  const emailProf = `int.prof.${sfx}@ifpe.edu.br`;
  const prof = (await api("/users", {
    metodo: "POST", token: tokenAdmin,
    body: { nome: `Prof ${nome}`, email: emailProf, senha: "senha123", role: "PROFESSOR", uepIds: [uep.id] },
  })).dados;
  const tokenProf = await login(emailProf, "senha123");

  const emailAluno = `int.aluno.${sfx}@teste.com`;
  const aluno = (await api("/users", {
    metodo: "POST", token: tokenProf,
    body: { nome: `Aluno ${nome}`, email: emailAluno, senha: "senha123", role: "ALUNO" },
  })).dados;
  const tokenAluno = await login(emailAluno, "senha123");

  async function limpar() {
    await api(`/users/${aluno.id}`, { metodo: "DELETE", token: tokenProf });
    await api(`/ueps/${uep.id}`, { metodo: "DELETE", token: tokenAdmin });
    await api(`/ueps/${outra.id}`, { metodo: "DELETE", token: tokenAdmin });
    await api(`/users/${prof.id}`, { metodo: "DELETE", token: tokenAdmin });
  }

  return { sfx, tokenAdmin, uep, outra, prof, tokenProf, aluno, tokenAluno, limpar };
}
