import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularIdadeMeses,
  calcularEstagioVida,
  validarCoerencia,
  validarGenealogia,
  paraISO,
  SQL_ESTAGIO_VIDA,
} from "../src/modules/animais/animais.genetica.js";

const erro400 = (e) => e.statusCode === 400;

test("idade em meses completos (nao arredonda para cima)", () => {
  assert.equal(calcularIdadeMeses("2025-01-15", "2026-01-15"), 12);
  assert.equal(calcularIdadeMeses("2025-01-15", "2026-01-14"), 11);
  assert.equal(calcularIdadeMeses("2026-01-01", "2026-01-01"), 0);
  assert.equal(calcularIdadeMeses(null, "2026-01-01"), null);
  assert.equal(calcularIdadeMeses("2026-02-01T00:00:00.000Z", "2026-05-01"), 3);
});

test("estagio de vida pela categoria e, em OUTRO, pela idade", () => {
  assert.equal(calcularEstagioVida("BEZERRO", 30), "CRIA");
  assert.equal(calcularEstagioVida("NOVILHA", null), "RECRIA");
  assert.equal(calcularEstagioVida("VACA", 2), "ADULTO");
  assert.equal(calcularEstagioVida("OUTRO", 2), "CRIA");
  assert.equal(calcularEstagioVida("OUTRO", 3), "RECRIA");
  assert.equal(calcularEstagioVida("OUTRO", 12), "ADULTO");
  assert.equal(calcularEstagioVida("OUTRO", null), null);
});

test("o SQL do estagio usa as mesmas categorias da funcao JS", () => {
  assert.match(SQL_ESTAGIO_VIDA, /'BEZERRO'.*THEN 'CRIA'/s);
  assert.match(SQL_ESTAGIO_VIDA, /'NOVILHA'.*THEN 'RECRIA'/s);
  assert.match(SQL_ESTAGIO_VIDA, /'VACA'.*THEN 'ADULTO'/s);
});

test("coerencia: categoria exige sexo e macho nao fica prenhe/lactante", () => {
  assert.doesNotThrow(() => validarCoerencia({ categoria: "VACA", sexo: "FEMEA", status_reprodutivo: "PRENHE" }));
  assert.doesNotThrow(() => validarCoerencia({ categoria: "DESMAMADO", sexo: "MACHO", status_reprodutivo: "EM_CRESCIMENTO" }));
  assert.throws(() => validarCoerencia({ categoria: "VACA", sexo: "MACHO" }), erro400);
  assert.throws(() => validarCoerencia({ categoria: "TOURO", sexo: "FEMEA" }), erro400);
  assert.throws(() => validarCoerencia({ categoria: "OUTRO", sexo: "MACHO", status_reprodutivo: "LACTANTE" }), erro400);
});

test("genealogia: pai macho, mae femea, existentes, mais velhos e nao o proprio animal", () => {
  const filho = { id: 10, data_nascimento: "2025-05-01" };
  const pai = { id: 1, sexo: "MACHO", data_nascimento: "2020-01-01" };
  const mae = { id: 2, sexo: "FEMEA", data_nascimento: "2021-01-01" };
  assert.doesNotThrow(() => validarGenealogia(filho, { pai, mae, paiId: 1, maeId: 2 }));
  assert.throws(() => validarGenealogia(filho, { pai: null, paiId: 99 }), erro400);
  assert.throws(() => validarGenealogia(filho, { pai: mae, paiId: 2 }), erro400);
  assert.throws(() => validarGenealogia(filho, { mae: pai, maeId: 1 }), erro400);
  assert.throws(() => validarGenealogia(filho, { pai: { ...pai, id: 10 }, paiId: 10 }), erro400);
  assert.throws(
    () => validarGenealogia(filho, { pai: { ...pai, data_nascimento: "2025-06-01" }, paiId: 1 }),
    erro400
  );
  assert.doesNotThrow(() => validarGenealogia({ id: 10 }, { pai: { ...pai, data_nascimento: null }, paiId: 1 }));
});

test("paraISO aceita texto e Date", () => {
  assert.equal(paraISO("2024-03-15T00:00:00.000Z"), "2024-03-15");
  assert.equal(paraISO(new Date(Date.UTC(2024, 2, 15))), "2024-03-15");
});
