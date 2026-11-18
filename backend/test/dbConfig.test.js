import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverSenhaDb, SENHA_DB_PADRAO } from "../src/config/db.js";

test("resolverSenhaDb: em producao exige DB_PASSWORD e recusa o valor de exemplo", () => {
  assert.throws(() => resolverSenhaDb({ NODE_ENV: "production" }), /DB_PASSWORD/);
  assert.throws(() => resolverSenhaDb({ NODE_ENV: "production", DB_PASSWORD: "" }), /DB_PASSWORD/);
  assert.throws(() => resolverSenhaDb({ NODE_ENV: "production", DB_PASSWORD: SENHA_DB_PADRAO }), /DB_PASSWORD/);
  assert.equal(resolverSenhaDb({ NODE_ENV: "production", DB_PASSWORD: "s3nh4-f0rte" }), "s3nh4-f0rte");
});

test("resolverSenhaDb: fora de producao usa o padrao de desenvolvimento", () => {
  assert.equal(resolverSenhaDb({}), SENHA_DB_PADRAO);
  assert.equal(resolverSenhaDb({ NODE_ENV: "development", DB_PASSWORD: "postgres" }), "postgres");
});
