import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularPrevisaoDias,
  calcularQuantidadeSugerida,
  classificarUrgencia,
  avaliarInsumo,
  consolidarInsumos,
  consolidarAnimais,
} from "../src/modules/compras/compras.algoritmo.js";

const insumo = (extra) => ({
  id: 1,
  nome: "Racao",
  unidade: "kg",
  saldo_atual: 100,
  estoque_minimo: 10,
  consumo_medio_diario: 5,
  ...extra,
});

test("previsao de dias arredonda para baixo e e null sem consumo", () => {
  assert.equal(calcularPrevisaoDias(100, 30), 3);
  assert.equal(calcularPrevisaoDias(60, 30), 2);
  assert.equal(calcularPrevisaoDias(0, 10), 0);
  assert.equal(calcularPrevisaoDias(50, 0), null);
  assert.equal(calcularPrevisaoDias(50, null), null);
});

test("quantidade sugerida = consumo*dias + minimo - saldo, nunca negativa", () => {
  const base = { estoqueMinimo: 10, consumoMedioDiario: 5, dias: 30 };
  assert.equal(calcularQuantidadeSugerida({ ...base, saldoAtual: 20 }), 140); // 150 + 10 - 20
  assert.equal(calcularQuantidadeSugerida({ ...base, saldoAtual: 160 }), 0); // exatamente o necessario
  assert.equal(calcularQuantidadeSugerida({ ...base, saldoAtual: 5000 }), 0); // sobra
  assert.equal(calcularQuantidadeSugerida({ ...base, saldoAtual: 0, dias: 7 }), 45);
});

test("quantidade sugerida nao carrega ruido de ponto flutuante", () => {
  assert.equal(
    calcularQuantidadeSugerida({ saldoAtual: 0, estoqueMinimo: 0, consumoMedioDiario: 0.1, dias: 3 }),
    0.3
  );
});

test("urgencia: CRITICA no minimo ou abaixo (limite inclusivo)", () => {
  assert.equal(classificarUrgencia({ saldoAtual: 10, estoqueMinimo: 10, previsaoDias: 100 }), "CRITICA");
  assert.equal(classificarUrgencia({ saldoAtual: 3, estoqueMinimo: 10, previsaoDias: 100 }), "CRITICA");
  assert.equal(classificarUrgencia({ saldoAtual: 0, estoqueMinimo: 0, previsaoDias: null }), "CRITICA");
});

test("urgencia: ATENCAO abaixo de 7 dias, OK a partir de 7 (limite exclusivo)", () => {
  assert.equal(classificarUrgencia({ saldoAtual: 50, estoqueMinimo: 10, previsaoDias: 6 }), "ATENCAO");
  assert.equal(classificarUrgencia({ saldoAtual: 70, estoqueMinimo: 10, previsaoDias: 7 }), "OK");
  assert.equal(classificarUrgencia({ saldoAtual: 50, estoqueMinimo: 10, previsaoDias: null }), "OK");
});

test("avaliarInsumo devolve o contrato em snake_case, com numeros", () => {
  const r = avaliarInsumo(insumo({ saldo_atual: "20", id: 7 }), 30);
  assert.deepEqual(r, {
    insumo_id: 7,
    nome: "Racao",
    unidade: "kg",
    saldo_atual: 20,
    estoque_minimo: 10,
    consumo_medio_diario: 5,
    previsao_dias: 4,
    quantidade_sugerida: 140,
    urgencia: "ATENCAO",
  });
});

test("consolidarInsumos ordena por urgencia, depois previsao (null por ultimo), depois nome", () => {
  const lista = consolidarInsumos(
    [
      insumo({ id: 1, nome: "Zeta ok", saldo_atual: 1000 }),
      insumo({ id: 2, nome: "Sem consumo", saldo_atual: 500, consumo_medio_diario: 0 }),
      insumo({ id: 3, nome: "Atencao 3d", saldo_atual: 15 }),
      insumo({ id: 4, nome: "Critico", saldo_atual: 10 }),
      insumo({ id: 5, nome: "Atencao 5d", saldo_atual: 25 }),
      insumo({ id: 6, nome: "Alfa ok", saldo_atual: 1000 }),
    ],
    30
  );
  assert.deepEqual(
    lista.map((i) => i.nome),
    ["Critico", "Atencao 3d", "Atencao 5d", "Alfa ok", "Zeta ok", "Sem consumo"]
  );
});

test("consolidarAnimais repoe 1 para 1 os animais em descarte", () => {
  const r = consolidarAnimais([
    { categoria: "VACA", total: "12", em_descarte: "2" },
    { categoria: "TOURO", total: 3, em_descarte: 0 },
  ]);
  assert.deepEqual(r, [
    { categoria: "VACA", total: 12, em_descarte: 2, reposicao_sugerida: 2 },
    { categoria: "TOURO", total: 3, em_descarte: 0, reposicao_sugerida: 0 },
  ]);
});
