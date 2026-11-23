import { test } from "node:test";
import assert from "node:assert/strict";
import { validarNovaSenha } from "../src/db/redefinirSenha.js";

test("validarNovaSenha: exige e-mail e senha com o minimo de caracteres", () => {
  assert.throws(() => validarNovaSenha("", "s3nh4-f0rte"), /e-mail/);
  assert.throws(() => validarNovaSenha(undefined, "s3nh4-f0rte"), /e-mail/);
  assert.throws(() => validarNovaSenha("admin@ifpe.edu.br", "123"), /ao menos/);
  assert.throws(() => validarNovaSenha("admin@ifpe.edu.br", undefined), /ao menos/);
  assert.doesNotThrow(() => validarNovaSenha("admin@ifpe.edu.br", "s3nh4-f0rte"));
});
