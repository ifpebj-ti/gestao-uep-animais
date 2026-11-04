import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MOTIVO_SKIP, iniciarApi, encerrarApi, api, criarCenario } from "./apoio.js";

describe("Integração: UEPs, isolamento por setor e animais", { skip: MOTIVO_SKIP }, () => {
  let c;
  let base;
  const ids = {};

  before(async () => {
    await iniciarApi();
    c = await criarCenario("Animais");
    base = `/ueps/${c.uep.id}/animais`;
  });
  after(async () => {
    if (c) await c.limpar();
    await encerrarApi();
  });

  it("CRUD de UEP: so a Diretoria escreve; filtros e ids validados", async () => {
    assert.equal((await api("/ueps?tipo=OUTRO&ativo=true", { token: c.tokenAluno })).status, 200);
    assert.equal((await api("/ueps?tipo=XPTO", { token: c.tokenAdmin })).status, 400);
    assert.equal((await api("/ueps?ativo=talvez", { token: c.tokenAdmin })).status, 400);
    assert.equal((await api(`/ueps/${c.uep.id}`, { token: c.tokenAluno })).dados.id, c.uep.id);
    assert.equal((await api("/ueps/0", { token: c.tokenAdmin })).status, 400);
    assert.equal((await api("/ueps/99999999", { token: c.tokenAdmin })).status, 404);
    assert.equal((await api("/ueps", { metodo: "POST", token: c.tokenAdmin, body: { nome: "Sem tipo" } })).status, 400);
    assert.equal((await api("/ueps", { metodo: "POST", token: c.tokenProf, body: { nome: "X", tipo: "OUTRO" } })).status, 403);
    const r = await api(`/ueps/${c.uep.id}`, { metodo: "PATCH", token: c.tokenAdmin, body: { descricao: "editada", tipo: "OVINOCULTURA" } });
    assert.equal(r.dados.tipo, "OVINOCULTURA");
    assert.equal((await api(`/ueps/${c.uep.id}`, { metodo: "PATCH", token: c.tokenAdmin, body: { tipo: "XPTO" } })).status, 400);
    assert.equal((await api("/ueps/99999999", { metodo: "PATCH", token: c.tokenAdmin, body: { nome: "x" } })).status, 404);
    assert.equal((await api("/ueps/99999999", { metodo: "DELETE", token: c.tokenAdmin })).status, 404);
    assert.equal((await api("/ueps", { metodo: "POST", token: c.tokenAdmin, body: { nome: c.uep.nome, tipo: "OUTRO" } })).status, 409);
  });

  it("isolamento: 400 id invalido, 403 UEP alheia, 404 UEP inexistente (Diretoria)", async () => {
    assert.equal((await api("/ueps/abc/animais", { token: c.tokenAdmin })).status, 400);
    assert.equal((await api(`/ueps/${c.outra.id}/animais`, { token: c.tokenAluno })).status, 403);
    assert.equal((await api(`/ueps/${c.outra.id}/animais`, { token: c.tokenProf })).status, 403);
    assert.equal((await api("/ueps/99999999/animais", { token: c.tokenAdmin })).status, 404);
  });

  it("cadastro: validacoes, coerencia, genealogia e brinco repetido", async () => {
    const criar = (body, token = c.tokenProf) => api(base, { metodo: "POST", token, body });
    const touro = await criar({ brinco: "T1", categoria: "TOURO", sexo: "MACHO", raca: "Nelore", dataNascimento: "2020-01-10" });
    assert.equal(touro.status, 201);
    ids.touro = touro.dados.id;
    const vaca = await criar({ brinco: "V1", categoria: "VACA", sexo: "FEMEA", raca: "Gir", statusReprodutivo: "PRENHE", dataNascimento: "2021-03-01" });
    ids.vaca = vaca.dados.id;
    const cria = await criar({ brinco: "C1", categoria: "BEZERRO", sexo: "MACHO", dataNascimento: "2025-01-05", paiId: ids.touro, maeId: ids.vaca, grauSangue: "1/2" });
    assert.equal(cria.status, 201);
    ids.cria = cria.dados.id;
    assert.equal(cria.dados.estagio_vida, "CRIA");
    assert.equal(cria.dados.pai_brinco, "T1");
    const outro = await criar({ brinco: "O1", categoria: "OUTRO", sexo: "FEMEA", dataNascimento: "2026-01-01" });
    ids.outro = outro.dados.id;

    assert.equal((await criar({ brinco: "T1", categoria: "TOURO", sexo: "MACHO" })).status, 409);
    assert.equal((await criar({ categoria: "VACA" })).status, 400);
    assert.equal((await criar({ categoria: "VACA", sexo: "MACHO" })).status, 400);
    assert.equal((await criar({ categoria: "OUTRO", sexo: "MACHO", statusReprodutivo: "LACTANTE" })).status, 400);
    assert.equal((await criar({ categoria: "BEZERRA", sexo: "FEMEA", paiId: ids.vaca })).status, 400);
    assert.equal((await criar({ categoria: "BEZERRA", sexo: "FEMEA", dataNascimento: "2019-01-01", maeId: ids.vaca })).status, 400);
    assert.equal((await criar({ categoria: "BEZERRA", sexo: "FEMEA", maeId: 99999999 })).status, 400);
    assert.equal((await criar({ categoria: "VACA", sexo: "FEMEA" }, c.tokenAluno)).status, 403);
    // rota da raiz com uepId no corpo
    assert.equal((await api("/animais", { metodo: "POST", token: c.tokenProf, body: { uepId: c.outra.id, categoria: "VACA", sexo: "FEMEA" } })).status, 403);
    assert.equal((await api("/animais", { metodo: "POST", token: c.tokenProf, body: { categoria: "VACA", sexo: "FEMEA" } })).status, 400);
    const raiz = await api("/animais", { metodo: "POST", token: c.tokenAdmin, body: { uepId: c.uep.id, brinco: "R1", categoria: "VACA", sexo: "FEMEA" } });
    assert.equal(raiz.status, 201);
    ids.raiz = raiz.dados.id;
    assert.equal((await api("/animais", { metodo: "POST", token: c.tokenAdmin, body: { uepId: 99999999, categoria: "VACA", sexo: "FEMEA" } })).status, 404);
  });

  it("listagem, paginacao, filtros, busca e censo", async () => {
    const todos = await api(base, { token: c.tokenAluno });
    assert.equal(todos.dados.length, 5);
    const pag = await api(`${base}?page=2&limit=2`, { token: c.tokenAluno });
    assert.equal(pag.dados.total, 5);
    assert.equal(pag.dados.totalPages, 3);
    assert.equal(pag.dados.page, 2);
    assert.equal((await api(`${base}?categoria=VACA&sexo=FEMEA&statusReprodutivo=PRENHE&disponivel=true`, { token: c.tokenAluno })).dados.length, 1);
    assert.equal((await api(`${base}?busca=T`, { token: c.tokenAluno })).dados.length, 1);
    assert.equal((await api(`${base}?busca=%25`, { token: c.tokenAluno })).dados.length, 0, "curinga % escapado");
    assert.equal((await api(`${base}/buscar?brinco=V1`, { token: c.tokenAluno })).dados[0].id, ids.vaca);
    assert.equal((await api(`${base}/buscar`, { token: c.tokenAluno })).status, 400);
    const censo = (await api(`${base}/censo`, { token: c.tokenAluno })).dados;
    assert.equal(censo.total, 5);
    assert.ok(censo.porRaca.some((r) => r.raca === "Nao informada"));
    assert.equal(censo.porEstagioVida.reduce((a, l) => a + l.total, 0), 5);
    // raiz respeita o escopo
    const raiz = await api("/animais", { token: c.tokenAluno });
    assert.ok(raiz.dados.every((a) => a.uep_id === c.uep.id));
    assert.equal((await api(`/animais?uepId=${c.uep.id}`, { token: c.tokenAluno })).dados.length, 5);
    assert.equal((await api(`/animais/censo?uepId=${c.uep.id}`, { token: c.tokenAdmin })).dados.total, 5);
    assert.equal((await api(`/animais/buscar?brinco=V1&uepId=${c.uep.id}`, { token: c.tokenAdmin })).dados.length, 1);
  });

  it("detalhe, edicao parcial, genealogia e disponibilidade", async () => {
    assert.equal((await api(`${base}/${ids.vaca}`, { token: c.tokenAluno })).dados.brinco, "V1");
    assert.equal((await api(`/ueps/${c.outra.id}/animais/${ids.vaca}`, { token: c.tokenAdmin })).status, 404);
    assert.equal((await api(`/animais/${ids.vaca}`, { token: c.tokenAdmin })).status, 200);

    let r = await api(`${base}/${ids.vaca}`, { metodo: "PATCH", token: c.tokenProf, body: { observacoes: "ok", raca: null } });
    assert.equal(r.dados.observacoes, "ok");
    assert.equal(r.dados.raca, null);
    assert.equal((await api(`${base}/${ids.touro}`, { metodo: "PATCH", token: c.tokenProf, body: { statusReprodutivo: "PRENHE" } })).status, 400);
    assert.equal((await api(`${base}/${ids.cria}`, { metodo: "PATCH", token: c.tokenProf, body: { maeId: ids.touro } })).status, 400);
    assert.equal((await api(`${base}/${ids.cria}`, { metodo: "PATCH", token: c.tokenProf, body: { brinco: "T1" } })).status, 409);
    assert.equal((await api(`${base}/${ids.cria}`, { metodo: "PATCH", token: c.tokenProf, body: {} })).status, 200);

    const gen = (await api(`${base}/${ids.vaca}/genealogia`, { token: c.tokenAluno })).dados;
    assert.deepEqual(gen.filhos.map((f) => f.id), [ids.cria]);
    assert.equal((await api(`${base}/${ids.cria}/genealogia`, { token: c.tokenAluno })).dados.pai.id, ids.touro);

    r = await api(`${base}/${ids.vaca}`, { metodo: "PATCH", token: c.tokenProf, body: { statusReprodutivo: "DESCARTE" } });
    assert.equal(r.dados.disponivel, false);
    assert.equal(r.dados.motivo_indisponibilidade, "DESCARTE");
    r = await api(`${base}/${ids.outro}`, { metodo: "PATCH", token: c.tokenProf, body: { motivoIndisponibilidade: "VENDIDO", indisponivelDesde: "2026-01-02" } });
    assert.equal(r.dados.indisponivel_desde, "2026-01-02");
    assert.equal((await api(`${base}/${ids.outro}`, { metodo: "PATCH", token: c.tokenProf, body: { indisponivelDesde: "2999-01-01" } })).status, 400);
    const disp = (await api(`${base}/disponibilidade`, { token: c.tokenAluno })).dados;
    assert.equal(disp.indisponiveis, 2);
    assert.equal((await api(`${base}?motivoIndisponibilidade=VENDIDO`, { token: c.tokenAluno })).dados.length, 1);
    assert.equal((await api(`/animais/disponibilidade?uepId=${c.uep.id}`, { token: c.tokenAdmin })).dados.total, 5);
    r = await api(`${base}/${ids.vaca}`, { metodo: "PATCH", token: c.tokenProf, body: { statusReprodutivo: "VAZIA" } });
    assert.equal(r.dados.disponivel, true, "saiu do descarte volta a ficar disponivel");
  });

  it("remocao respeita o escopo", async () => {
    assert.equal((await api(`/ueps/${c.outra.id}/animais/${ids.raiz}`, { metodo: "DELETE", token: c.tokenAdmin })).status, 404);
    assert.equal((await api(`${base}/${ids.raiz}`, { metodo: "DELETE", token: c.tokenAluno })).status, 403);
    assert.equal((await api(`/animais/${ids.raiz}`, { metodo: "DELETE", token: c.tokenProf })).status, 204);
    assert.equal((await api(`/animais/${ids.raiz}`, { token: c.tokenProf })).status, 404);
  });
});
