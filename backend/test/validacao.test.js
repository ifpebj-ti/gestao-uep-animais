import { test } from "node:test";
import assert from "node:assert/strict";
import { parseId, parseEnumOpcional, parseBooleanoOpcional } from "../src/utils/validacao.js";

test("parseId aceita so inteiros positivos (numero ou texto de digitos)", () => {
  assert.equal(parseId("12"), 12);
  assert.equal(parseId(" 5 "), 5);
  assert.equal(parseId(9), 9);
  for (const ruim of ["abc", "1.5", "-3", "1e3", "0", 0, -1, 1.2, "", null, undefined, "99999999999"]) {
    assert.throws(() => parseId(ruim, "uepId"), (e) => e.statusCode === 400 && /uepId/.test(e.message));
  }
});

test("parseEnumOpcional: ausente vira undefined e fora da lista vira 400", () => {
  assert.equal(parseEnumOpcional(undefined, ["A"], "x"), undefined);
  assert.equal(parseEnumOpcional("", ["A"], "x"), undefined);
  assert.equal(parseEnumOpcional("A", ["A", "B"], "x"), "A");
  assert.throws(() => parseEnumOpcional("Z", ["A", "B"], "tipo"), (e) => e.statusCode === 400 && /A, B/.test(e.message));
});

test("parseBooleanoOpcional entende true/false e recusa o resto", () => {
  assert.equal(parseBooleanoOpcional(undefined, "ativo"), undefined);
  assert.equal(parseBooleanoOpcional("true", "ativo"), true);
  assert.equal(parseBooleanoOpcional("false", "ativo"), false);
  assert.throws(() => parseBooleanoOpcional("sim", "ativo"), (e) => e.statusCode === 400);
});
