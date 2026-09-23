import { test } from "node:test";
import assert from "node:assert/strict";
import { isEmailInstitucional } from "../src/utils/emailInstitucional.js";

test("aceita @ifpe.edu.br e subdominios", () => {
  assert.ok(isEmailInstitucional("fulano@ifpe.edu.br"));
  assert.ok(isEmailInstitucional("Fulano@IFPE.edu.br"));
  assert.ok(isEmailInstitucional("aluno@discente.ifpe.edu.br"));
  assert.ok(isEmailInstitucional("x@belojardim.ifpe.edu.br"));
});

test("recusa outros dominios e imitacoes", () => {
  assert.ok(!isEmailInstitucional("fulano@gmail.com"));
  assert.ok(!isEmailInstitucional("fulano@naoifpe.edu.br"));
  assert.ok(!isEmailInstitucional("fulano@ifpe.edu.br.golpe.com"));
  assert.ok(!isEmailInstitucional(""));
  assert.ok(!isEmailInstitucional(undefined));
});
