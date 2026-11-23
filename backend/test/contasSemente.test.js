import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_USERS, resolverContaSemente } from "../src/db/contasSemente.js";

const admin = DEMO_USERS.find((c) => c.role === "ADMIN");

test("resolverContaSemente: sem variavel de ambiente usa e-mail e senha padrao", () => {
  assert.deepEqual(resolverContaSemente(admin, {}), {
    email: "admin@ifpe.edu.br",
    senha: "admin123",
    usaSenhaPadrao: true,
  });
});

test("resolverContaSemente: senha da variavel de ambiente deixa de ser a padrao", () => {
  const conta = resolverContaSemente(admin, { SEED_ADMIN_EMAIL: "diretoria@ifpe.edu.br", SEED_ADMIN_PASSWORD: "f0rte-e-l0nga" });
  assert.deepEqual(conta, { email: "diretoria@ifpe.edu.br", senha: "f0rte-e-l0nga", usaSenhaPadrao: false });
});

test("resolverContaSemente: definir a senha igual a padrao continua contando como padrao", () => {
  assert.equal(resolverContaSemente(admin, { SEED_ADMIN_PASSWORD: "admin123" }).usaSenhaPadrao, true);
});

test("DEMO_USERS: uma conta por perfil", () => {
  assert.deepEqual(DEMO_USERS.map((c) => c.role).sort(), ["ADMIN", "ALUNO", "ESTAGIARIO", "PROFESSOR", "TECNICO"]);
});
