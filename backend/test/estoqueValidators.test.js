import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseId,
  parseNumero,
  parseTexto,
  parseData,
  formatarQuantidade,
} from "../src/modules/estoque/estoque.validators.js";

test("parseId aceita inteiro positivo (numero ou texto) e rejeita o resto", () => {
  assert.equal(parseId("7", "id"), 7);
  assert.equal(parseId(3, "id"), 3);
  for (const ruim of [0, -1, 1.5, "abc", "", null, undefined, "1e3x"]) {
    assert.throws(() => parseId(ruim, "id"), (e) => e.statusCode === 400);
  }
});

test("parseNumero usa padrao quando ausente e valida faixa", () => {
  assert.equal(parseNumero(undefined, "x", { padrao: 0 }), 0);
  assert.equal(parseNumero("12.5", "x"), 12.5);
  assert.equal(parseNumero(0, "x"), 0);
  assert.throws(() => parseNumero(undefined, "x"), (e) => e.statusCode === 400);
  assert.throws(() => parseNumero(-1, "x"), (e) => e.statusCode === 400);
  assert.throws(() => parseNumero("abc", "x"), (e) => e.statusCode === 400);
  assert.throws(() => parseNumero(NaN, "x"), (e) => e.statusCode === 400);
  assert.throws(() => parseNumero(Infinity, "x"), (e) => e.statusCode === 400);
  assert.throws(() => parseNumero(1e12, "x"), (e) => e.statusCode === 400);
  assert.throws(() => parseNumero(true, "x"), (e) => e.statusCode === 400);
});

test("parseNumero com minimoExclusivo rejeita zero (quantidade da movimentacao)", () => {
  assert.equal(parseNumero(0.001, "q", { minimoExclusivo: true }), 0.001);
  assert.throws(() => parseNumero(0, "q", { minimoExclusivo: true }), (e) => e.statusCode === 400);
});

test("parseTexto faz trim, limita tamanho e trata obrigatoriedade", () => {
  assert.equal(parseTexto("  Racao  ", "nome", { max: 100, obrigatorio: true }), "Racao");
  assert.equal(parseTexto(undefined, "obs", { max: 10 }), null);
  assert.equal(parseTexto("   ", "obs", { max: 10 }), null);
  assert.throws(() => parseTexto("   ", "nome", { obrigatorio: true }), (e) => e.statusCode === 400);
  assert.throws(() => parseTexto("x".repeat(11), "obs", { max: 10 }), (e) => e.statusCode === 400);
  assert.throws(() => parseTexto(123, "obs", { max: 10 }), (e) => e.statusCode === 400);
});

test("parseData aceita AAAA-MM-DD valido e rejeita datas impossiveis", () => {
  assert.equal(parseData("2026-02-28"), "2026-02-28");
  assert.equal(parseData(undefined), null);
  assert.equal(parseData(""), null);
  for (const ruim of ["2026-02-30", "31/01/2026", "2026-13-01", "2026-1-1", 20260101]) {
    assert.throws(() => parseData(ruim), (e) => e.statusCode === 400);
  }
});

test("formatarQuantidade usa pt-BR sem zeros sobrando", () => {
  assert.equal(formatarQuantidade(75.5), "75,5");
  assert.equal(formatarQuantidade(1000), "1.000");
  assert.equal(formatarQuantidade(0.12345), "0,123");
});
