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
