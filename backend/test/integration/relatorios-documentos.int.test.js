import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { MOTIVO_SKIP, iniciarApi, encerrarApi, api, criarCenario } from "./apoio.js";

async function pdfDe(paginas) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([300, 300]);
  return Buffer.from(await doc.save());
}

function formulario(buffer, campos = {}, nome = "nota.pdf") {
  const form = new FormData();
  if (buffer) form.append("arquivo", new Blob([buffer], { type: "application/pdf" }), nome);
  for (const [k, v] of Object.entries(campos)) form.append(k, String(v));
  return form;
}

describe("Integração: relatórios e documentos", { skip: MOTIVO_SKIP }, () => {
  let c;
  let docId;

  before(async () => {
    await iniciarApi();
    c = await criarCenario("Relat");
    const base = `/ueps/${c.uep.id}`;
    await api(`${base}/animais`, { metodo: "POST", token: c.tokenProf, body: { brinco: "R-1", categoria: "VACA", sexo: "FEMEA", raca: "Gir", dataNascimento: "2022-01-01" } });
    await api(`${base}/animais`, { metodo: "POST", token: c.tokenProf, body: { brinco: "R-2", categoria: "OUTRO", sexo: "MACHO", statusReprodutivo: "DESCARTE" } });
    const ins = await api(`${base}/insumos`, { metodo: "POST", token: c.tokenProf, body: { nome: "Racao R", unidade: "kg", saldoInicial: 50, estoqueMinimo: 60, consumoMedioDiario: 5 } });
    await api(`${base}/estoque/movimentacoes`, { metodo: "POST", token: c.tokenProf, body: { insumoId: ins.dados.id, tipo: "SAIDA", quantidade: 5 } });
  });
  after(async () => {
    if (c) await c.limpar();
    await encerrarApi();
  });

  it("gera os quatro relatorios em PDF e Excel", async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    for (const tipo of ["censo-geral", "status-reprodutivo", "movimentacao-estoque", "necessidades-compras"]) {
      for (const formato of ["pdf", "xlsx"]) {
        const corpo = { formato, uepId: c.uep.id, dataInicio: "2026-01-01", dataFim: hoje, dias: 15 };
        const r = await api(`/relatorios/${tipo}/gerar`, { metodo: "POST", token: c.tokenAdmin, body: corpo });
        assert.equal(r.status, 200, `${tipo}/${formato}`);
        const assinatura = r.dados.subarray(0, formato === "pdf" ? 5 : 2).toString();
        assert.equal(assinatura, formato === "pdf" ? "%PDF-" : "PK", `${tipo}/${formato}`);
        assert.match(r.headers.get("content-disposition"), new RegExp(`relatorio-${tipo}-.+\\.${formato}`));
      }
    }
    // sem uepId = todas as UEPs
    assert.equal((await api("/relatorios/censo-geral/gerar", { metodo: "POST", token: c.tokenAdmin, body: {} })).status, 200);
  });

  it("relatorios: validacao e permissao", async () => {
    assert.equal((await api("/relatorios/movimentacao-estoque/gerar", { metodo: "POST", token: c.tokenAdmin, body: {} })).status, 400);
    assert.equal((await api("/relatorios/xpto/gerar", { metodo: "POST", token: c.tokenAdmin, body: {} })).status, 400);
    assert.equal((await api("/relatorios/censo-geral/gerar", { metodo: "POST", token: c.tokenAdmin, body: { uepId: 99999999 } })).status, 404);
    assert.equal((await api("/relatorios/censo-geral/gerar", { metodo: "POST", token: c.tokenProf, body: {} })).status, 403);
  });

  it("documentos: envio, validacao, listagem por perfil e download", async () => {
    const pdf = await pdfDe(2);
    let r = await api("/documentos", { metodo: "POST", token: c.tokenProf, body: formulario(pdf, { tipo: "NOTA_FISCAL", descricao: "NF 1", uepId: c.uep.id }) });
    assert.equal(r.status, 201);
    docId = r.dados.id;
    assert.equal(r.dados.tipo, "NOTA_FISCAL");

    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenProf, body: formulario(null, { tipo: "OUTRO" }) })).status, 400);
    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenProf, body: formulario(Buffer.from("texto")) })).status, 400);
    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenProf, body: formulario(pdf, { tipo: "XPTO" }) })).status, 400);
    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenProf, body: formulario(pdf, { uepId: c.outra.id }) })).status, 403);
    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenProf, body: formulario(pdf, { uepId: 99999999 }) })).status, 404);
    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenAluno, body: formulario(pdf) })).status, 403);
    const doisArquivos = formulario(pdf);
    doisArquivos.append("arquivo", new Blob([pdf], { type: "application/pdf" }), "b.pdf");
    assert.equal((await api("/documentos", { metodo: "POST", token: c.tokenProf, body: doisArquivos })).status, 400);

    const daDiretoria = await api("/documentos", { metodo: "POST", token: c.tokenAdmin, body: formulario(await pdfDe(1), {}, "extra.pdf") });
    assert.equal(daDiretoria.status, 201);

    const doProf = (await api("/documentos", { token: c.tokenProf })).dados;
    assert.deepEqual(doProf.map((d) => d.id), [docId]);
    const todos = (await api("/documentos", { token: c.tokenAdmin })).dados;
    assert.ok(todos.some((d) => d.id === docId) && todos.some((d) => d.id === daDiretoria.dados.id));

    r = await api(`/documentos/${docId}/arquivo`, { token: c.tokenProf });
    assert.equal(r.status, 200);
    assert.ok(r.dados.equals(pdf));
    assert.match(r.headers.get("content-disposition"), /^inline;/);
    assert.equal((await api(`/documentos/${daDiretoria.dados.id}/arquivo`, { token: c.tokenProf })).status, 404);
    assert.equal((await api("/documentos/abc/arquivo", { token: c.tokenAdmin })).status, 400);

    // unir: documento + relatorio + documento, na ordem
    r = await api("/documentos/unir", {
      metodo: "POST", token: c.tokenAdmin,
      body: { itens: [
        { origem: "documento", id: docId },
        { origem: "relatorio", relatorio: "censo-geral", uepId: c.uep.id },
        { origem: "documento", id: daDiretoria.dados.id },
      ] },
    });
    assert.equal(r.status, 200);
    const unido = await PDFDocument.load(r.dados);
    assert.ok(unido.getPageCount() >= 4, `paginas: ${unido.getPageCount()}`);

    for (const itens of [undefined, [{ origem: "documento", id: docId }], [{ origem: "x" }, { origem: "documento", id: docId }],
      [{ origem: "relatorio" }, { origem: "documento", id: docId }], [null, { origem: "documento", id: docId }],
      Array.from({ length: 31 }, () => ({ origem: "documento", id: docId }))]) {
      assert.equal((await api("/documentos/unir", { metodo: "POST", token: c.tokenAdmin, body: { itens } })).status, 400);
    }
    assert.equal((await api("/documentos/unir", { metodo: "POST", token: c.tokenAdmin, body: { itens: [{ origem: "documento", id: docId }, { origem: "relatorio", relatorio: "censo-geral", formato: "xlsx" }] } })).status, 200);

    assert.equal((await api(`/documentos/${daDiretoria.dados.id}`, { metodo: "DELETE", token: c.tokenProf })).status, 404);
    assert.equal((await api(`/documentos/${daDiretoria.dados.id}`, { metodo: "DELETE", token: c.tokenAdmin })).status, 204);
    assert.equal((await api(`/documentos/${docId}`, { metodo: "DELETE", token: c.tokenProf })).status, 204);
  });
});
