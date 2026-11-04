import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { MOTIVO_SKIP, iniciarApi, encerrarApi, api, criarCenario, login, sufixo } from "./apoio.js";

describe("Integração: calendário de atividades", { skip: MOTIVO_SKIP }, () => {
  let c;
  let base;
  let vaca;
  let touro;
  let tokenTecnico;
  let tecnicoId;

  before(async () => {
    await iniciarApi();
    c = await criarCenario("Ativ");
    base = `/ueps/${c.uep.id}/atividades`;
    vaca = (await api(`/ueps/${c.uep.id}/animais`, { metodo: "POST", token: c.tokenProf, body: { brinco: "A-V", categoria: "VACA", sexo: "FEMEA" } })).dados;
    touro = (await api(`/ueps/${c.uep.id}/animais`, { metodo: "POST", token: c.tokenProf, body: { brinco: "A-T", categoria: "TOURO", sexo: "MACHO" } })).dados;
    const email = `int.tec.${sufixo()}@teste.com`;
    tecnicoId = (await api("/users", { metodo: "POST", token: c.tokenProf, body: { nome: "Tec", email, senha: "senha123", role: "TECNICO" } })).dados.id;
    tokenTecnico = await login(email, "senha123");
  });
  after(async () => {
    if (c) {
      await api(`/users/${tecnicoId}`, { metodo: "DELETE", token: c.tokenProf });
      await c.limpar();
    }
    await encerrarApi();
  });

  it("qualquer perfil da UEP registra; regras de tipo, animal, data e hora", async () => {
    const criar = (body, token = c.tokenAluno) => api(base, { metodo: "POST", token, body });
    let r = await criar({ tipo: "GESTACAO", data: "2026-03-10", animalId: vaca.id, observacao: "confirmada" });
    assert.equal(r.status, 201);
    assert.equal(r.dados.animal_brinco, "A-V");
    assert.equal(r.dados.data, "2026-03-10");
    assert.equal(r.dados.criado_por, c.aluno.id);
    r = await criar({ tipo: "AULA_MANEJO", data: "2026-12-01", hora: "14:30", animalId: touro.id }, tokenTecnico);
    assert.equal(r.dados.hora, "14:30");
    await criar({ tipo: "OUTRO", data: "2027-01-05" }, c.tokenProf);

    assert.equal((await criar({ tipo: "VACINA", data: "2026-05-01" })).status, 400, "vacina exige animal");
    assert.equal((await criar({ tipo: "GESTACAO", data: "2026-05-01", animalId: touro.id })).status, 400, "gestacao so em femea");
    assert.equal((await criar({ tipo: "VERMIFUGO", data: "2026-05-01", animalId: 99999999 })).status, 400);
    assert.equal((await criar({ tipo: "XPTO", data: "2026-05-01" })).status, 400);
    assert.equal((await criar({ tipo: "OUTRO" })).status, 400);
    assert.equal((await criar({ tipo: "OUTRO", data: "1999-12-31" })).status, 400);
    assert.equal((await criar({ tipo: "OUTRO", data: "2026-05-01", hora: "25:00" })).status, 400);
    assert.equal((await criar({ tipo: "OUTRO", data: "2026-05-01", observacao: "x".repeat(1001) })).status, 400);
    assert.equal((await api(`/ueps/${c.outra.id}/atividades`, { metodo: "POST", token: c.tokenAluno, body: { tipo: "OUTRO", data: "2026-05-01" } })).status, 403);
  });

  it("lista por ano, com o ano atual como padrao", async () => {
    const de2026 = (await api(`${base}?ano=2026`, { token: c.tokenAluno })).dados;
    assert.deepEqual(de2026.map((a) => a.tipo), ["GESTACAO", "AULA_MANEJO"]);
    assert.equal((await api(`${base}?ano=2027`, { token: c.tokenAluno })).dados.length, 1);
    assert.equal((await api(`${base}?ano=abc`, { token: c.tokenAluno })).status, 400);
    assert.equal((await api(base, { token: c.tokenAluno })).status, 200);
  });

  it("editar/remover: Professor ou quem criou; outros recebem 403", async () => {
    const [gestacao, aula] = (await api(`${base}?ano=2026`, { token: c.tokenAluno })).dados;
    // aluno criou a gestacao: pode editar
    let r = await api(`${base}/${gestacao.id}`, { metodo: "PATCH", token: c.tokenAluno, body: { observacao: "revisada" } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.observacao, "revisada");
    // tecnico nao criou a gestacao
    assert.equal((await api(`${base}/${gestacao.id}`, { metodo: "PATCH", token: tokenTecnico, body: { observacao: "x" } })).status, 403);
    assert.equal((await api(`${base}/${gestacao.id}`, { metodo: "DELETE", token: tokenTecnico })).status, 403);
    // professor edita qualquer uma; estado final validado (tirar o animal de uma vacina)
    r = await api(`${base}/${aula.id}`, { metodo: "PATCH", token: c.tokenProf, body: { tipo: "VACINA", hora: null } });
    assert.equal(r.status, 200);
    assert.equal((await api(`${base}/${aula.id}`, { metodo: "PATCH", token: c.tokenProf, body: { animalId: null } })).status, 400);
    assert.equal((await api(`${base}/99999999`, { metodo: "PATCH", token: c.tokenProf, body: {} })).status, 404);
    assert.equal((await api(`/ueps/${c.outra.id}/atividades/${aula.id}`, { metodo: "DELETE", token: c.tokenAdmin })).status, 404);
    assert.equal((await api(`${base}/${aula.id}`, { metodo: "DELETE", token: c.tokenProf })).status, 204);
    assert.equal((await api(`${base}/${gestacao.id}`, { metodo: "DELETE", token: c.tokenAluno })).status, 204);
  });
});
