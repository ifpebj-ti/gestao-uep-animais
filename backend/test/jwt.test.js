import { test } from "node:test";
import assert from "node:assert/strict";
import { signToken, verifyToken } from "../src/utils/jwt.js";

test("signToken gera um token que verifyToken consegue decodificar", () => {
  const payload = { sub: "user-1", role: "ADMIN" };
  const token = signToken(payload);

  assert.equal(typeof token, "string");
  assert.ok(token.split(".").length === 3, "deve ter formato JWT (header.payload.signature)");

  const decoded = verifyToken(token);
  assert.equal(decoded.sub, payload.sub);
  assert.equal(decoded.role, payload.role);
});

test("verifyToken rejeita token invalido", () => {
  assert.throws(() => verifyToken("token.invalido.aqui"));
});

test("resolverSegredo: em producao exige JWT_SECRET e recusa o valor de exemplo", async () => {
  const { resolverSegredo, SEGREDO_PADRAO } = await import("../src/utils/jwt.js");
  assert.throws(() => resolverSegredo({ NODE_ENV: "production" }), /JWT_SECRET/);
  assert.throws(
    () => resolverSegredo({ NODE_ENV: "production", JWT_SECRET: SEGREDO_PADRAO }),
    /JWT_SECRET/
  );
  assert.equal(resolverSegredo({ NODE_ENV: "production", JWT_SECRET: "abc123forte" }), "abc123forte");
});

test("resolverSegredo: fora de producao usa o padrao quando nao ha JWT_SECRET", async () => {
  const { resolverSegredo, SEGREDO_PADRAO } = await import("../src/utils/jwt.js");
  assert.equal(resolverSegredo({}), SEGREDO_PADRAO);
  assert.equal(resolverSegredo({ NODE_ENV: "development", JWT_SECRET: "x" }), "x");
});
