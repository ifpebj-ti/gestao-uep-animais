import { test } from "node:test";
import assert from "node:assert/strict";
import { toApiError, errorHandler, notFoundHandler } from "../src/middlewares/errorHandler.js";
import { ApiError } from "../src/utils/ApiError.js";

function respostaFalsa() {
  return {
    statusCode: null,
    corpo: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.corpo = body; return this; },
  };
}

test("toApiError: JSON malformado vira 400 e corpo grande demais vira 413", () => {
  assert.equal(toApiError({ type: "entity.parse.failed" }).statusCode, 400);
  assert.equal(toApiError({ type: "entity.too.large" }).statusCode, 413);
});

test("toApiError: UNIQUE do Postgres vira 409 e FK vira 400", () => {
  assert.equal(toApiError({ code: "23505" }).statusCode, 409);
  assert.equal(toApiError({ code: "23503" }).statusCode, 400);
});

test("toApiError: ApiError passa direto e erro desconhecido devolve null", () => {
  const e = ApiError.forbidden("x");
  assert.equal(toApiError(e), e);
  assert.equal(toApiError(new Error("boom")), null);
});

test("errorHandler responde { error } com o status certo e 500 no desconhecido", () => {
  const res = respostaFalsa();
  errorHandler(ApiError.notFound("Nada aqui"), {}, res, () => {});
  assert.equal(res.statusCode, 404);
  assert.equal(res.corpo.error, "Nada aqui");

  const res500 = respostaFalsa();
  const original = console.error;
  console.error = () => {};
  try {
    errorHandler(new Error("falha interna"), {}, res500, () => {});
  } finally {
    console.error = original;
  }
  assert.equal(res500.statusCode, 500);
  assert.equal(res500.corpo.error, "Erro interno do servidor");
});

test("notFoundHandler devolve 404 com mensagem", () => {
  const res = respostaFalsa();
  notFoundHandler({}, res);
  assert.equal(res.statusCode, 404);
  assert.match(res.corpo.error, /Rota/);
});
