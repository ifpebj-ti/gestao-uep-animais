import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/utils/ApiError.js";

test("ApiError.notFound gera erro com status 404", () => {
  const err = ApiError.notFound();
  assert.equal(err.statusCode, 404);
  assert.ok(err instanceof Error);
});

test("ApiError.forbidden aceita mensagem customizada", () => {
  const err = ApiError.forbidden("Sem acesso a esta UEP");
  assert.equal(err.statusCode, 403);
  assert.equal(err.message, "Sem acesso a esta UEP");
});

test("ApiError.badRequest carrega detalhes de validacao", () => {
  const detalhes = { campo: "peso", motivo: "deve ser positivo" };
  const err = ApiError.badRequest("Entrada invalida", detalhes);
  assert.equal(err.statusCode, 400);
  assert.deepEqual(err.details, detalhes);
});
