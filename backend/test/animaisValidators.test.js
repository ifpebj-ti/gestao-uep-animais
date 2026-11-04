import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarAnimal,
  validarFiltros,
  parseDataNascimento,
} from "../src/modules/animais/animais.validators.js";

const erro400 = (e) => e.statusCode === 400;

test("criacao exige categoria e sexo e usa NAO_APLICAVEL como status padrao", () => {
  assert.throws(() => validarAnimal({ categoria: "VACA" }), erro400);
  const dados = validarAnimal({ categoria: "VACA", sexo: "FEMEA", brinco: " B-1 " });
  assert.deepEqual(dados, { categoria: "VACA", sexo: "FEMEA", status_reprodutivo: "NAO_APLICAVEL", brinco: "B-1" });
});

test("enums invalidos viram 400", () => {
  assert.throws(() => validarAnimal({ categoria: "PEGASO", sexo: "FEMEA" }), erro400);
  assert.throws(() => validarAnimal({ categoria: "VACA", sexo: "X" }), erro400);
  assert.throws(() => validarAnimal({ statusReprodutivo: "VOANDO" }, { parcial: true }), erro400);
});

test("PATCH devolve so o que veio e null limpa campo opcional", () => {
  assert.deepEqual(validarAnimal({ observacoes: null }, { parcial: true }), { observacoes: null });
  assert.deepEqual(validarAnimal({ raca: "" }, { parcial: true }), { raca: null });
  assert.deepEqual(validarAnimal({}, { parcial: true }), {});
  // campo obrigatorio vazio no PATCH e ignorado (nao apaga a categoria)
  assert.deepEqual(validarAnimal({ categoria: "", statusReprodutivo: null }, { parcial: true }), {});
});

test("textos respeitam o tamanho das colunas", () => {
  assert.throws(() => validarAnimal({ sisbov: "1".repeat(16) }, { parcial: true }), erro400);
  assert.throws(() => validarAnimal({ brinco: 123 }, { parcial: true }), erro400);
});

test("dataNascimento: formato, data existente e nao futura", () => {
  assert.equal(parseDataNascimento("2024-02-29", "2026-01-01"), "2024-02-29");
  assert.equal(parseDataNascimento(null), null);
  assert.throws(() => parseDataNascimento("2023-02-29", "2026-01-01"), erro400);
  assert.throws(() => parseDataNascimento("15/03/2024", "2026-01-01"), erro400);
  assert.throws(() => parseDataNascimento("2026-01-02", "2026-01-01"), erro400);
});

test("disponivel aceita boolean ou texto true/false", () => {
  assert.equal(validarAnimal({ disponivel: false }, { parcial: true }).disponivel, false);
  assert.equal(validarAnimal({ disponivel: "true" }, { parcial: true }).disponivel, true);
  assert.throws(() => validarAnimal({ disponivel: "talvez" }, { parcial: true }), erro400);
});

test("corpo que nao e objeto vira 400", () => {
  assert.throws(() => validarAnimal(null), erro400);
  assert.throws(() => validarAnimal([1, 2]), erro400);
});

test("validarFiltros valida enums e booleano da query", () => {
  assert.deepEqual(validarFiltros({ categoria: "VACA", disponivel: "false" }), {
    categoria: "VACA", sexo: undefined, statusReprodutivo: undefined, disponivel: false, estagioVida: undefined, motivoIndisponibilidade: undefined, busca: undefined,
  });
  assert.throws(() => validarFiltros({ categoria: "PEGASO" }), erro400);
  assert.throws(() => validarFiltros({ disponivel: "talvez" }), erro400);
});

test("genealogia: paiId/maeId viram ids e null desfaz o vinculo", () => {
  assert.deepEqual(validarAnimal({ paiId: "4", maeId: null }, { parcial: true }), { pai_id: 4, mae_id: null });
  assert.throws(() => validarAnimal({ paiId: "abc" }, { parcial: true }), erro400);
  assert.deepEqual(validarAnimal({ grauSangue: " 1/2 Nelore " }, { parcial: true }), { grau_sangue: "1/2 Nelore" });
});
