import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MOTIVO_SKIP, iniciarApi, encerrarApi, api, criarCenario } from "./apoio.js";

describe("Integração: estoque, alertas e compras", { skip: MOTIVO_SKIP }, () => {
  let c;
  let base;
  const ids = {};

  before(async () => {
    await iniciarApi();
    c = await criarCenario("Estoque");
    base = `/ueps/${c.uep.id}`;
  });
  after(async () => {
    if (c) await c.limpar();
    await encerrarApi();
  });

  it("cadastro de insumo com saldo inicial, validacoes e duplicado", async () => {
    const criar = (body, token = c.tokenProf) => api(`${base}/insumos`, { metodo: "POST", token, body });
    const r = await criar({ nome: "Racao", unidade: "kg", saldoInicial: 5, estoqueMinimo: 10, consumoMedioDiario: 2 });
    assert.equal(r.status, 201);
    ids.racao = r.dados.id;
    ids.milho = (await criar({ nome: "Milho", unidade: "kg", saldoInicial: 20, estoqueMinimo: 5, consumoMedioDiario: 4 })).dados.id;
    ids.feno = (await criar({ nome: "Feno", unidade: "fardo", saldoInicial: 500, estoqueMinimo: 10, consumoMedioDiario: 1 })).dados.id;
    ids.sal = (await criar({ nome: "Sal", unidade: "kg" })).dados.id;
    assert.equal((await criar({ nome: "Racao", unidade: "kg" })).status, 400);
    assert.equal((await criar({ nome: "", unidade: "kg" })).status, 400);
    assert.equal((await criar({ nome: "X", unidade: "kg", saldoInicial: -1 })).status, 400);
    assert.equal((await criar({ nome: "X", unidade: "kg", saldoInicial: "abc" })).status, 400);
    assert.equal((await criar({ nome: "X", unidade: "kg" }, c.tokenAluno)).status, 403);
  });

  it("insumos saem com nivel de alerta e previsao; GET/PATCH individual", async () => {
    const lista = (await api(`${base}/insumos`, { token: c.tokenAluno })).dados;
    const racao = lista.find((i) => i.id === ids.racao);
    assert.equal(racao.nivel_alerta, "CRITICO");
    assert.equal(racao.previsao_dias, 2);
    assert.equal(lista.find((i) => i.id === ids.sal).previsao_dias, null);
    assert.equal((await api(`${base}/insumos/${ids.milho}`, { token: c.tokenAluno })).dados.nivel_alerta, "ATENCAO");
    const r = await api(`${base}/insumos/${ids.sal}`, { metodo: "PATCH", token: c.tokenProf, body: { nome: "Sal mineral", unidade: "saco", estoqueMinimo: 1, consumoMedioDiario: 0.5 } });
    assert.equal(r.dados.nome, "Sal mineral");
    assert.equal((await api(`${base}/insumos/${ids.sal}`, { metodo: "PATCH", token: c.tokenProf, body: {} })).status, 200);
    assert.equal((await api(`${base}/insumos/${ids.sal}`, { metodo: "PATCH", token: c.tokenProf, body: { saldoAtual: 1 } })).status, 400);
    assert.equal((await api(`${base}/insumos/${ids.sal}`, { metodo: "PATCH", token: c.tokenProf, body: { nome: "Racao" } })).status, 400);
    assert.equal((await api(`${base}/insumos/99999999`, { token: c.tokenProf })).status, 404);
    assert.equal((await api(`${base}/insumos/99999999`, { metodo: "PATCH", token: c.tokenProf, body: { nome: "x" } })).status, 404);
  });

  it("movimentacoes: entrada, saida, saldo insuficiente, filtros e isolamento", async () => {
    const mov = (body, token = c.tokenProf) => api(`${base}/estoque/movimentacoes`, { metodo: "POST", token, body });
    let r = await mov({ insumoId: ids.feno, tipo: "SAIDA", quantidade: 100, data: "2026-10-10", observacao: "trato", responsavel: "forjado" });
    assert.equal(r.status, 201);
    assert.equal(r.dados.responsavel, "Prof Estoque");
    r = await mov({ insumoId: ids.feno, tipo: "ENTRADA", quantidade: "50.5" });
    assert.equal(r.status, 201);
    assert.equal((await mov({ insumoId: ids.feno, tipo: "SAIDA", quantidade: 1e6 })).status, 400);
    assert.equal((await mov({ insumoId: ids.feno, tipo: "SAIDA", quantidade: 0 })).status, 400);
    assert.equal((await mov({ insumoId: ids.feno, tipo: "TROCA", quantidade: 1 })).status, 400);
    assert.equal((await mov({ insumoId: 99999999, tipo: "ENTRADA", quantidade: 1 })).status, 404);
    assert.equal((await mov({ insumoId: ids.feno, tipo: "ENTRADA", quantidade: 1, data: "2026-02-30" })).status, 400);
    assert.equal((await mov({ insumoId: ids.feno, tipo: "ENTRADA", quantidade: 1 }, c.tokenAluno)).status, 403);
    assert.equal((await api(`/ueps/${c.outra.id}/estoque/movimentacoes`, { metodo: "POST", token: c.tokenAdmin, body: { insumoId: ids.feno, tipo: "ENTRADA", quantidade: 1 } })).status, 404);

    const feno = (await api(`${base}/insumos/${ids.feno}`, { token: c.tokenAluno })).dados;
    assert.equal(feno.saldo_atual, 450.5);
    const lista = await api(`${base}/estoque/movimentacoes?tipo=SAIDA&insumoId=${ids.feno}`, { token: c.tokenAluno });
    assert.equal(lista.dados.length, 1);
    assert.equal((await api(`${base}/estoque/movimentacoes?tipo=X`, { token: c.tokenAluno })).status, 400);
    assert.equal((await api(`${base}/estoque/movimentacoes?insumoId=abc`, { token: c.tokenAluno })).status, 400);
  });

  it("alertas por UEP e painel geral respeitam o escopo", async () => {
    const daUep = (await api(`${base}/estoque/alertas`, { token: c.tokenAluno })).dados;
    // Racao (5 de 10) e Sal mineral (zerado, minimo 1) criticos; Milho em atencao
    assert.equal(daUep.criticos, 2);
    assert.equal(daUep.atencao, 1);
    assert.deepEqual(daUep.alertas.map((a) => a.insumo_id), [ids.sal, ids.racao, ids.milho]);
    assert.match(daUep.alertas[0].mensagem, /zerado/);
    const geral = (await api("/estoque/alertas", { token: c.tokenProf })).dados;
    assert.ok(geral.alertas.every((a) => a.uep_id === c.uep.id));
    assert.deepEqual(geral.por_uep.map((u) => u.uep_id), [c.uep.id]);
    const diretoria = (await api("/estoque/alertas", { token: c.tokenAdmin })).dados;
    assert.ok(diretoria.por_uep.some((u) => u.uep_id === c.uep.id));
  });

  it("necessidades de compra: regra, horizonte, validacao e animais em descarte", async () => {
    await api(`${base}/animais`, { metodo: "POST", token: c.tokenProf, body: { categoria: "VACA", sexo: "FEMEA", statusReprodutivo: "DESCARTE" } });
    const r = (await api(`${base}/compras/necessidades?dias=10`, { token: c.tokenAluno })).dados;
    assert.equal(r.dias, 10);
    const racao = r.insumos.find((i) => i.insumo_id === ids.racao);
    assert.equal(racao.urgencia, "CRITICA");
    assert.equal(racao.quantidade_sugerida, 25);
    assert.deepEqual(r.insumos.slice(0, 2).map((i) => i.insumo_id), [ids.sal, ids.racao]);
    assert.deepEqual(r.animais, [{ categoria: "VACA", total: 1, em_descarte: 1, reposicao_sugerida: 1 }]);
    assert.equal((await api(`${base}/compras/necessidades?dias=0`, { token: c.tokenAluno })).status, 400);
    assert.equal((await api(`${base}/compras/necessidades`, { token: c.tokenAluno })).dados.dias, 30);
  });
});
