import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarAtividade,
  validarEstadoFinal,
  parseHora,
  parseAno,
} from "../src/modules/atividades/atividades.validators.js";
import { podeAlterar } from "../src/modules/atividades/atividades.service.js";

const erro400 = (e) => e.statusCode === 400;

test("validarAtividade: criacao exige tipo e data; converte para colunas", () => {
  assert.deepEqual(validarAtividade({ tipo: "VACINA", data: "2026-05-01", animalId: "3", hora: "08:00", observacao: " x " }), {
    tipo: "VACINA", data: "2026-05-01", hora: "08:00", animal_id: 3, observacao: "x",
  });
  assert.throws(() => validarAtividade({ data: "2026-05-01" }), erro400);
  assert.throws(() => validarAtividade({ tipo: "OUTRO" }), erro400);
  assert.throws(() => validarAtividade({ tipo: "OUTRO", data: "2101-01-01" }), erro400);
  assert.throws(() => validarAtividade(null), erro400);
  assert.deepEqual(validarAtividade({ animalId: null }, { parcial: true }), { animal_id: null });
});

test("parseHora aceita HH:MM (e HH:MM:SS do banco) e recusa o resto", () => {
  assert.equal(parseHora("07:05"), "07:05");
  assert.equal(parseHora("23:59:00"), "23:59");
  assert.equal(parseHora(""), null);
  for (const ruim of ["24:00", "7:5", "abc", 730]) assert.throws(() => parseHora(ruim), erro400);
});

test("parseAno usa o ano atual como padrao e limita a faixa", () => {
  assert.equal(parseAno(undefined, 2026), 2026);
  assert.equal(parseAno("2030", 2026), 2030);
  assert.throws(() => parseAno("1999", 2026), erro400);
  assert.throws(() => parseAno("20x6", 2026), erro400);
});

test("validarEstadoFinal: tipos de animal exigem animal; gestacao so em femea", () => {
  assert.throws(() => validarEstadoFinal({ tipo: "VERMIFUGO", animal_id: null }, null), erro400);
  assert.throws(() => validarEstadoFinal({ tipo: "OUTRO", animal_id: 5 }, null), erro400);
  assert.throws(() => validarEstadoFinal({ tipo: "GESTACAO", animal_id: 5 }, { sexo: "MACHO" }), erro400);
  assert.doesNotThrow(() => validarEstadoFinal({ tipo: "GESTACAO", animal_id: 5 }, { sexo: "FEMEA" }));
  assert.doesNotThrow(() => validarEstadoFinal({ tipo: "AULA_MANEJO", animal_id: null }, null));
});

test("podeAlterar: Diretoria, Professor ou o autor", () => {
  const atividade = { criado_por: 7 };
  assert.equal(podeAlterar({ role: "ADMIN", id: 1 }, atividade), true);
  assert.equal(podeAlterar({ role: "PROFESSOR", id: 2 }, atividade), true);
  assert.equal(podeAlterar({ role: "ALUNO", id: 7 }, atividade), true);
  assert.equal(podeAlterar({ role: "TECNICO", id: 8 }, atividade), false);
  assert.equal(podeAlterar({ role: "ALUNO", id: 7 }, { criado_por: null }), false);
});
