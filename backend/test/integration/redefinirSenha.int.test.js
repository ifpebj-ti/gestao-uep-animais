import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MOTIVO_SKIP, iniciarApi, encerrarApi, api, login, criarCenario } from "./apoio.js";

describe("Integração: comando de redefinir senha", { skip: MOTIVO_SKIP }, () => {
  let c;
  let redefinirSenha;
  before(async () => {
    await iniciarApi();
    c = await criarCenario("Senha");
    ({ redefinirSenha } = await import("../../src/db/redefinirSenha.js"));
  });
  after(async () => {
    if (c) await c.limpar();
    await encerrarApi();
  });

  it("troca a senha de qualquer conta pelo e-mail (maiusculas ignoradas)", async () => {
    const conta = await redefinirSenha(c.aluno.email.toUpperCase(), "N0va-senha-aluno");
    assert.equal(conta.email, c.aluno.email);
    assert.ok(await login(c.aluno.email, "N0va-senha-aluno"));
    const antiga = await api("/auth/login", { metodo: "POST", body: { email: c.aluno.email, senha: "senha123" } });
    assert.equal(antiga.status, 401);
  });

  it("recusa e-mail inexistente e senha curta", async () => {
    await assert.rejects(() => redefinirSenha("ninguem@ifpe.edu.br", "N0va-senha"), /Nenhuma conta/);
    await assert.rejects(() => redefinirSenha(c.aluno.email, "123"), /ao menos/);
  });
});
