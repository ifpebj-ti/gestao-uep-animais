import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MOTIVO_SKIP, iniciarApi, encerrarApi, api, login, criarCenario, sufixo } from "./apoio.js";

describe("Integração: autenticação, sessão e usuários", { skip: MOTIVO_SKIP }, () => {
  let c;
  before(async () => {
    await iniciarApi();
    c = await criarCenario("Auth");
  });
  after(async () => {
    if (c) await c.limpar();
    await encerrarApi();
  });

  it("health responde nas duas rotas", async () => {
    assert.equal((await api("/health")).dados.status, "ok");
  });

  it("login: e-mail normalizado, senha errada 401, campos faltando 400, JSON malformado 400", async () => {
    const r = await api("/auth/login", { metodo: "POST", body: { email: ` ${c.prof.email.toUpperCase()} `, senha: "senha123" } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.user.role, "PROFESSOR");
    assert.equal((await api("/auth/login", { metodo: "POST", body: { email: c.prof.email, senha: "errada" } })).status, 401);
    assert.equal((await api("/auth/login", { metodo: "POST", body: { email: c.prof.email } })).status, 400);
    assert.equal((await api("/auth/login", { metodo: "POST", cru: "{nao e json" })).status, 400);
    assert.equal((await api("/auth/login", { metodo: "POST", body: { email: "ninguem@x.com", senha: "123456" } })).status, 401);
  });

  it("register: perfis permitidos, senha minima, duplicado 409", async () => {
    const email = `int.reg.${sufixo()}@teste.com`;
    const r = await api("/auth/register", { metodo: "POST", body: { nome: "Reg", email, senha: "senha123", role: "ESTAGIARIO" } });
    assert.equal(r.status, 201);
    assert.ok(r.dados.token);
    assert.equal((await api("/auth/register", { metodo: "POST", body: { nome: "Reg", email, senha: "senha123", role: "ESTAGIARIO" } })).status, 409);
    assert.equal((await api("/auth/register", { metodo: "POST", body: { nome: "X", email: `x${email}`, senha: "123", role: "ALUNO" } })).status, 400);
    assert.equal((await api("/auth/register", { metodo: "POST", body: { nome: "X", email: `y${email}`, senha: "senha123", role: "PROFESSOR" } })).status, 400);
    assert.equal((await api("/auth/register", { metodo: "POST", body: { nome: "X", email: `z${email}`, senha: "senha123" } })).status, 400);
  });

  it("login com Google sem configuracao responde 400 claro", async () => {
    assert.equal((await api("/auth/google", { metodo: "POST", body: {} })).status, 400);
    const r = await api("/auth/google", { metodo: "POST", body: { credential: "abc" } });
    assert.ok([400, 401].includes(r.status));
  });

  it("token: ausente 401, invalido 401, de conta desativada 401", async () => {
    assert.equal((await api("/users/me")).status, 401);
    assert.equal((await api("/users/me", { token: "abc.def.ghi" })).status, 401);
    const email = `int.desat.${sufixo()}@teste.com`;
    const criado = await api("/users", { metodo: "POST", token: c.tokenProf, body: { nome: "Temp", email, senha: "senha123", role: "TECNICO" } });
    assert.equal(criado.status, 201);
    const tokenTemp = await login(email, "senha123");
    assert.equal((await api("/users/me", { token: tokenTemp })).status, 200);
    assert.equal((await api(`/users/${criado.dados.id}`, { metodo: "PATCH", token: c.tokenProf, body: { ativo: false } })).status, 200);
    assert.equal((await api("/users/me", { token: tokenTemp })).status, 401);
    assert.equal((await api(`/users/${criado.dados.id}`, { metodo: "DELETE", token: c.tokenProf })).status, 204);
  });

  it("/users/me traz as UEPs que cada perfil enxerga", async () => {
    const admin = (await api("/users/me", { token: c.tokenAdmin })).dados;
    assert.ok(admin.ueps.length >= 2);
    const prof = (await api("/users/me", { token: c.tokenProf })).dados;
    assert.deepEqual(prof.ueps.map((u) => u.id), [c.uep.id]);
    const aluno = (await api("/users/me", { token: c.tokenAluno })).dados;
    assert.deepEqual(aluno.ueps.map((u) => u.id), [c.uep.id]);
  });

  it("hierarquia de usuarios: Diretoria gerencia Professores, Professor a propria equipe", async () => {
    assert.equal((await api("/users", { token: c.tokenAluno })).status, 403);
    const lista = await api("/users", { token: c.tokenAdmin });
    assert.ok(lista.dados.every((u) => u.role === "PROFESSOR"));
    assert.equal((await api("/users?role=ALUNO", { token: c.tokenAdmin })).status, 403);
    assert.equal((await api("/users?ativo=true", { token: c.tokenAdmin })).status, 200);

    const equipe = await api("/users", { token: c.tokenProf });
    assert.deepEqual(equipe.dados.map((u) => u.id), [c.aluno.id]);
    assert.equal((await api(`/users?professorId=${c.prof.id + 100000}`, { token: c.tokenProf })).status, 403);
    assert.equal((await api(`/users/${c.aluno.id}`, { token: c.tokenProf })).dados.id, c.aluno.id);
    assert.equal((await api("/users/abc", { token: c.tokenProf })).status, 404);

    // Professor troca papel e senha da equipe; nao atribui PROFESSOR nem muda UEP
    assert.equal((await api(`/users/${c.aluno.id}`, { metodo: "PATCH", token: c.tokenProf, body: { role: "PROFESSOR" } })).status, 403);
    assert.equal((await api(`/users/${c.aluno.id}`, { metodo: "PATCH", token: c.tokenProf, body: { uepId: c.uep.id } })).status, 403);
    assert.equal((await api(`/users/${c.aluno.id}`, { metodo: "PATCH", token: c.tokenProf, body: { role: "XPTO" } })).status, 400);
    assert.equal((await api(`/users/${c.aluno.id}/senha`, { metodo: "PATCH", token: c.tokenProf, body: { novaSenha: "123" } })).status, 400);
    assert.equal((await api(`/users/${c.aluno.id}/senha`, { metodo: "PATCH", token: c.tokenProf, body: { novaSenha: "senha123" } })).status, 204);

    // Professor nao cadastra equipe fora das proprias UEPs
    const fora = await api("/users", {
      metodo: "POST", token: c.tokenProf,
      body: { nome: "Fora", email: `int.fora.${sufixo()}@teste.com`, senha: "senha123", role: "ALUNO", uepId: c.outra.id },
    });
    assert.equal(fora.status, 403);

    // Diretoria muda as UEPs do Professor (uepIds); UEP de quem nao e Professor e 400/404
    const r = await api(`/users/${c.prof.id}`, { metodo: "PATCH", token: c.tokenAdmin, body: { uepIds: [c.uep.id, c.outra.id] } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.ueps.length, 2);
    assert.equal((await api(`/users/${c.prof.id}`, { metodo: "PATCH", token: c.tokenAdmin, body: { uepIds: ["x"] } })).status, 400);
    await api(`/users/${c.prof.id}`, { metodo: "PATCH", token: c.tokenAdmin, body: { uepIds: [c.uep.id] } });
    assert.equal((await api(`/users/${c.aluno.id}`, { metodo: "PATCH", token: c.tokenAdmin, body: { nome: "x" } })).status, 404);
  });
});
