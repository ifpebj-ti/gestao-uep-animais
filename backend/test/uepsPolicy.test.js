import { test } from "node:test";
import assert from "node:assert/strict";
import { podeAcessarUep } from "../src/modules/ueps/ueps.policy.js";

test("ADMIN acessa qualquer UEP", () => {
  assert.equal(podeAcessarUep({ role: "ADMIN" }, 7), true);
});

test("PROFESSOR acessa so as UEPs concedidas pela Diretoria", () => {
  const prof = { role: "PROFESSOR", uepId: null };
  assert.equal(podeAcessarUep(prof, 2, [1, 2]), true);
  assert.equal(podeAcessarUep(prof, "2", [1, 2]), true);
  assert.equal(podeAcessarUep(prof, 3, [1, 2]), false);
  assert.equal(podeAcessarUep(prof, 1, []), false);
});

test("Equipe (ALUNO/TECNICO/ESTAGIARIO) acessa so a propria UEP", () => {
  for (const role of ["ALUNO", "TECNICO", "ESTAGIARIO"]) {
    assert.equal(podeAcessarUep({ role, uepId: 4 }, 4), true);
    assert.equal(podeAcessarUep({ role, uepId: 4 }, 5), false);
    assert.equal(podeAcessarUep({ role, uepId: null }, 4), false, `${role} sem UEP nao acessa nada`);
  }
});

test("Sem usuario nao acessa nada", () => {
  assert.equal(podeAcessarUep(null, 1), false);
});
