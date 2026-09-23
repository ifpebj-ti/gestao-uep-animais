import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES, ALL_ROLES, WRITE_ROLES, READ_ONLY_ROLES } from "../src/config/roles.js";

test("ALL_ROLES contem exatamente os papeis definidos em ROLES", () => {
  assert.deepEqual(new Set(ALL_ROLES), new Set(Object.values(ROLES)));
});

test("WRITE_ROLES e READ_ONLY_ROLES nao se sobrepoem", () => {
  const intersecao = WRITE_ROLES.filter((r) => READ_ONLY_ROLES.includes(r));
  assert.deepEqual(intersecao, []);
});

test("ADMIN sempre tem permissao de escrita", () => {
  assert.ok(WRITE_ROLES.includes(ROLES.ADMIN));
});
