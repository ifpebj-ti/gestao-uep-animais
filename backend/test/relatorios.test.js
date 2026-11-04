import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { validarPedido, rotulo, comTotal } from "../src/modules/relatorios/relatorios.service.js";
import { renderizarXlsx, nomeColuna, nomeAba } from "../src/modules/relatorios/render.xlsx.js";
import { renderizarPdf } from "../src/modules/relatorios/render.pdf.js";
import { contentDisposition } from "../src/utils/download.js";

const erro400 = (e) => e.statusCode === 400;
const HOJE = { hoje: "2026-11-03" };

test("validarPedido: tipo e formato", () => {
  assert.equal(validarPedido("censo-geral", {}, HOJE).formato, "pdf");
  assert.equal(validarPedido("censo-geral", { formato: "xlsx" }, HOJE).formato, "xlsx");
  assert.throws(() => validarPedido("inexistente", {}, HOJE), erro400);
  assert.throws(() => validarPedido("censo-geral", { formato: "docx" }, HOJE), erro400);
  assert.throws(() => validarPedido("censo-geral", { formato: "xlsx" }, { ...HOJE, formatosAceitos: ["pdf"] }), erro400);
});

test("validarPedido: uepId opcional e validado", () => {
  assert.equal(validarPedido("censo-geral", {}, HOJE).uepId, null);
  assert.equal(validarPedido("censo-geral", { uepId: "3" }, HOJE).uepId, 3);
  assert.throws(() => validarPedido("censo-geral", { uepId: "x" }, HOJE), erro400);
});

test("validarPedido: periodo obrigatorio, em ordem, nao futuro e de ate 366 dias", () => {
  const ok = validarPedido("movimentacao-estoque", { dataInicio: "2026-10-01", dataFim: "2026-10-31" }, HOJE);
  assert.equal(ok.dataInicio, "2026-10-01");
  assert.throws(() => validarPedido("movimentacao-estoque", {}, HOJE), erro400);
  assert.throws(() => validarPedido("movimentacao-estoque", { dataInicio: "2026-10-31", dataFim: "2026-10-01" }, HOJE), erro400);
  assert.throws(() => validarPedido("movimentacao-estoque", { dataInicio: "2026-12-01", dataFim: "2026-12-31" }, HOJE), erro400);
  assert.throws(() => validarPedido("movimentacao-estoque", { dataInicio: "2025-01-01", dataFim: "2026-10-31" }, HOJE), erro400);
  // relatorio sem periodo ignora as datas
  assert.equal(validarPedido("censo-geral", { dataInicio: "lixo" }, HOJE).dataInicio, null);
});

test("validarPedido: dias das necessidades de compra", () => {
  assert.equal(validarPedido("necessidades-compras", {}, HOJE).dias, 30);
  assert.equal(validarPedido("necessidades-compras", { dias: 15 }, HOJE).dias, 15);
  assert.throws(() => validarPedido("necessidades-compras", { dias: 0 }, HOJE), erro400);
});

test("rotulo deixa os enums legiveis e comTotal soma as colunas", () => {
  assert.equal(rotulo("NAO_APLICAVEL"), "Não aplicável");
  assert.equal(rotulo("EM_CRESCIMENTO"), "Em crescimento");
  assert.equal(rotulo("VACA"), "Vaca");
  assert.equal(rotulo(null), null);
  const linhas = comTotal([{ n: "a", t: 2 }, { n: "b", t: 3 }], "n", ["t"]);
  assert.deepEqual(linhas[2], { __destaque: true, n: "Total", t: 5 });
  assert.deepEqual(comTotal([], "n", ["t"]), []);
});

const RELATORIO = {
  titulo: "Teste <&>",
  filtros: ["Setor: Todas"],
  geradoEm: new Date("2026-11-03T12:00:00Z"),
  secoes: [
    { titulo: "Seção: um/dois", colunas: [{ chave: "a", rotulo: "A" }, { chave: "b", rotulo: "B", alinhar: "right" }], linhas: [{ a: "x & y", b: 1.5 }, { a: null, b: 2 }] },
    { titulo: "Vazia", colunas: [{ chave: "a", rotulo: "A" }], linhas: [], vazio: "Nada aqui." },
  ],
};

test("renderizarXlsx gera um zip valido com uma aba por secao e XML escapado", () => {
  const arquivos = unzipSync(new Uint8Array(renderizarXlsx(RELATORIO)));
  assert.ok(arquivos["xl/workbook.xml"] && arquivos["xl/worksheets/sheet2.xml"]);
  const workbook = strFromU8(arquivos["xl/workbook.xml"]);
  assert.match(workbook, /name="Seção  um dois"/);
  const aba1 = strFromU8(arquivos["xl/worksheets/sheet1.xml"]);
  assert.match(aba1, /x &amp; y/);
  assert.match(aba1, /<v>1.5<\/v>/);
  assert.match(strFromU8(arquivos["xl/worksheets/sheet2.xml"]), /Nada aqui\./);
});

test("nomeColuna e nomeAba seguem as regras do Excel", () => {
  assert.equal(nomeColuna(0), "A");
  assert.equal(nomeColuna(25), "Z");
  assert.equal(nomeColuna(26), "AA");
  const usados = new Set();
  assert.equal(nomeAba("Resumo", usados), "Resumo");
  assert.equal(nomeAba("Resumo", usados), "Resumo (2)");
  assert.ok(nomeAba("x".repeat(40), usados).length <= 31);
});

test("renderizarPdf devolve um PDF", async () => {
  const pdf = await renderizarPdf(RELATORIO);
  assert.equal(pdf.subarray(0, 5).toString("latin1"), "%PDF-");
  assert.ok(pdf.length > 1000);
});

test("contentDisposition manda nome ASCII e UTF-8", () => {
  const h = contentDisposition("relatório ção.pdf");
  assert.match(h, /^attachment; filename="relatorio cao.pdf"; filename\*=UTF-8''relat%C3%B3rio%20%C3%A7%C3%A3o\.pdf$/);
  assert.match(contentDisposition("a.pdf", "inline"), /^inline;/);
});
