import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoErroSql } from "../src/config/db.js";

test("resumoErroSql: nao expoe os valores dos parametros", () => {
  const hash = "$2a$10$hashDeSenhaQueNaoPodeIrParaOLog";
  const pdf = Buffer.from("%PDF-1.7 conteudo do documento");
  const erro = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });

  const resumo = resumoErroSql("INSERT INTO users (email, password_hash) VALUES ($1, $2)", ["a@b.com", hash, pdf], erro);

  assert.deepEqual(resumo, {
    text: "INSERT INTO users (email, password_hash) VALUES ($1, $2)",
    params: 3,
    code: "23505",
    message: "duplicate key value violates unique constraint",
  });
  const serializado = JSON.stringify(resumo);
  assert.ok(!serializado.includes(hash));
  assert.ok(!serializado.includes("a@b.com"));
  assert.ok(!serializado.includes("PDF"));
});

test("resumoErroSql: query sem parametros", () => {
  assert.equal(resumoErroSql("SELECT 1", undefined, new Error("x")).params, 0);
});
