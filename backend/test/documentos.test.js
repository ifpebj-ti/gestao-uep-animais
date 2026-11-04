import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { pareceSerPdf, validarPdf, unirPdfs } from "../src/modules/documentos/documentos.pdf.js";
import { normalizarNomeArquivo } from "../src/modules/documentos/documentos.service.js";

const erro400 = (e) => e.statusCode === 400;

async function pdfComPaginas(n) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

test("pareceSerPdf confere a assinatura %PDF-", async () => {
  assert.equal(pareceSerPdf(await pdfComPaginas(1)), true);
  assert.equal(pareceSerPdf(Buffer.from("GIF89a")), false);
  assert.equal(pareceSerPdf("texto"), false);
});

test("validarPdf devolve paginas e recusa o que nao abre", async () => {
  assert.equal(await validarPdf(await pdfComPaginas(2)), 2);
  await assert.rejects(() => validarPdf(Buffer.from("nao sou pdf")), erro400);
  await assert.rejects(() => validarPdf(Buffer.from("%PDF-1.7 lixo sem estrutura")), erro400);
});

test("unirPdfs junta na ordem pedida", async () => {
  const unido = await unirPdfs([
    { nome: "a.pdf", buffer: await pdfComPaginas(2) },
    { nome: "b.pdf", buffer: await pdfComPaginas(3) },
  ]);
  const doc = await PDFDocument.load(unido);
  assert.equal(doc.getPageCount(), 5);
  await assert.rejects(() => unirPdfs([{ nome: "x.pdf", buffer: Buffer.from("x") }]), erro400);
});

test("normalizarNomeArquivo: UTF-8, sem pasta, termina em .pdf", () => {
  assert.equal(normalizarNomeArquivo(Buffer.from("Relatório.pdf", "utf8").toString("latin1")), "Relatório.pdf");
  assert.equal(normalizarNomeArquivo("C:\\\\Users\\\\x\\\\nota.pdf"), "nota.pdf");
  assert.equal(normalizarNomeArquivo("../../etc/passwd"), "passwd.pdf");
  assert.equal(normalizarNomeArquivo(""), "documento.pdf");
  assert.ok(normalizarNomeArquivo("a".repeat(300) + ".pdf").length <= 255);
});
