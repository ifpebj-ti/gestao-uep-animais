import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPrevisaoDias,
  classificarNivel,
  avaliarNivel,
  montarAlertas,
  resumirNiveis,
  mensagemAlerta,
  LIMITE_ATENCAO_DIAS,
} from "../src/modules/estoque/estoque.alertas.js";
import { classificarUrgencia } from "../src/modules/compras/compras.algoritmo.js";

const insumo = (id, nome, saldo, minimo, consumo) => ({
  id, uep_id: 1, nome, unidade: "kg", saldo_atual: saldo, estoque_minimo: minimo, consumo_medio_diario: consumo,
});

test("previsao em dias inteiros e null sem consumo", () => {
  assert.equal(calcularPrevisaoDias(20, 4), 5);
  assert.equal(calcularPrevisaoDias(21, 4), 5);
  assert.equal(calcularPrevisaoDias(50, 0), null);
});

test("nivel: CRITICO no minimo ou abaixo, ATENCAO abaixo do limite de dias, NORMAL no resto", () => {
  assert.equal(classificarNivel({ saldoAtual: 10, estoqueMinimo: 10, previsaoDias: 100 }), "CRITICO");
  assert.equal(classificarNivel({ saldoAtual: 0, estoqueMinimo: 0, previsaoDias: null }), "CRITICO");
  assert.equal(classificarNivel({ saldoAtual: 20, estoqueMinimo: 5, previsaoDias: LIMITE_ATENCAO_DIAS - 1 }), "ATENCAO");
  assert.equal(classificarNivel({ saldoAtual: 20, estoqueMinimo: 5, previsaoDias: LIMITE_ATENCAO_DIAS }), "NORMAL");
  assert.equal(classificarNivel({ saldoAtual: 20, estoqueMinimo: 5, previsaoDias: null }), "NORMAL");
});

test("compras usa a mesma regra (CRITICO->CRITICA, NORMAL->OK)", () => {
  assert.equal(classificarUrgencia({ saldoAtual: 5, estoqueMinimo: 10, previsaoDias: 2 }), "CRITICA");
  assert.equal(classificarUrgencia({ saldoAtual: 20, estoqueMinimo: 5, previsaoDias: 5 }), "ATENCAO");
  assert.equal(classificarUrgencia({ saldoAtual: 500, estoqueMinimo: 10, previsaoDias: 500 }), "OK");
});

test("montarAlertas: so CRITICO/ATENCAO, mais grave e quem acaba antes primeiro, com mensagem", () => {
  const avaliados = [
    insumo(1, "Feno", 500, 10, 1),     // NORMAL
    insumo(2, "Milho", 30, 5, 6),      // ATENCAO (5 dias)
    insumo(3, "Racao", 5, 10, 2),      // CRITICO
    insumo(4, "Sal", 12, 5, 4),        // ATENCAO (3 dias)
    insumo(5, "Soja", 0, 0, 0),        // CRITICO zerado
  ].map(avaliarNivel);
  const alertas = montarAlertas(avaliados);
  assert.deepEqual(alertas.map((a) => a.nome), ["Soja", "Racao", "Sal", "Milho"]);
  assert.match(alertas[1].mensagem, /nível mínimo ou abaixo \(5 kg de 10 kg\)/);
  assert.match(alertas[0].mensagem, /zerado/);
  assert.match(alertas[2].mensagem, /acaba em 3 dia/);
  assert.deepEqual(resumirNiveis(avaliados), { total_insumos: 5, criticos: 2, atencao: 2 });
});

test("mensagemAlerta devolve null para NORMAL", () => {
  assert.equal(mensagemAlerta({ nome: "X", unidade: "kg", nivel: "NORMAL" }), null);
});
