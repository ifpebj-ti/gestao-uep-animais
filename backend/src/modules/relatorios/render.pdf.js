import PDFDocument from "pdfkit";

/*
 * Desenha um relatório (estrutura de relatorios.dados.js) em PDF A4.
 *
 * relatorio = {
 *   titulo, filtros: ["Setor: ...", "Período: ..."], geradoEm: Date,
 *   secoes: [{ titulo, colunas: [{ chave, rotulo, peso?, alinhar? }], linhas: [{...}], vazio? }]
 * }
 *
 * Usa as fontes padrão do PDF (Helvetica): cobrem acentos do português
 * (WinAnsi) e não precisam de arquivo de fonte na imagem Docker.
 */

const MARGEM = 40;
const COR_PRIMARIA = "#2f9e41"; // verde IFPE, o mesmo do front
const COR_TEXTO = "#1f2933";
const COR_SUAVE = "#5a6472";
const COR_LINHA_PAR = "#f2f7f3";
const ALTURA_LINHA = 18;

function formatarCelula(valor, destaque = false) {
  if (valor === null || valor === undefined || valor === "") return destaque ? "" : "—";
  if (typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }
  return String(valor);
}

function formatarDataHora(data) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function larguras(colunas, larguraUtil) {
  const pesoTotal = colunas.reduce((acc, c) => acc + (c.peso ?? 1), 0);
  return colunas.map((c) => ((c.peso ?? 1) / pesoTotal) * larguraUtil);
}

function cabecalhoTabela(doc, colunas, ws, y) {
  const larguraUtil = ws.reduce((a, b) => a + b, 0);
  doc.rect(MARGEM, y, larguraUtil, ALTURA_LINHA).fill(COR_PRIMARIA);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
  let x = MARGEM;
  colunas.forEach((c, i) => {
    doc.text(c.rotulo, x + 4, y + 5, {
      width: ws[i] - 8,
      height: ALTURA_LINHA - 6,
      align: c.alinhar ?? "left",
      lineBreak: false,
      ellipsis: true,
    });
    x += ws[i];
  });
  return y + ALTURA_LINHA;
}

function desenharSecao(doc, secao) {
  const larguraUtil = doc.page.width - MARGEM * 2;
  const limiteY = () => doc.page.height - MARGEM - 30;

  if (doc.y > limiteY() - ALTURA_LINHA * 3) doc.addPage();
  doc.moveDown(0.6);
  doc.fillColor(COR_TEXTO).font("Helvetica-Bold").fontSize(12).text(secao.titulo, MARGEM);
  doc.moveDown(0.3);

  if (!secao.linhas.length) {
    doc.fillColor(COR_SUAVE).font("Helvetica-Oblique").fontSize(9)
      .text(secao.vazio ?? "Nenhum registro encontrado.", MARGEM);
    return;
  }

  const ws = larguras(secao.colunas, larguraUtil);
  let y = cabecalhoTabela(doc, secao.colunas, ws, doc.y);

  secao.linhas.forEach((linha, idx) => {
    if (y + ALTURA_LINHA > limiteY()) {
      doc.addPage();
      y = cabecalhoTabela(doc, secao.colunas, ws, MARGEM);
    }
    if (idx % 2 === 1) doc.rect(MARGEM, y, larguraUtil, ALTURA_LINHA).fill(COR_LINHA_PAR);
    doc.fillColor(COR_TEXTO).font(linha.__destaque ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
    let x = MARGEM;
    secao.colunas.forEach((c, i) => {
      doc.text(formatarCelula(linha[c.chave], linha.__destaque), x + 4, y + 5, {
        width: ws[i] - 8,
        height: ALTURA_LINHA - 6, // com height + ellipsis, texto longo é cortado com reticências
        align: c.alinhar ?? "left",
        lineBreak: false,
        ellipsis: true,
      });
      x += ws[i];
    });
    y += ALTURA_LINHA;
  });
  doc.y = y + 4;
  doc.x = MARGEM;
}

function rodapes(doc, relatorio) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - MARGEM - 12;
    doc.fillColor(COR_SUAVE).font("Helvetica").fontSize(7.5);
    doc.text(`SISGEP — ${relatorio.titulo}`, MARGEM, y, { lineBreak: false });
    doc.text(`Página ${i - range.start + 1} de ${range.count}`, MARGEM, y, {
      width: doc.page.width - MARGEM * 2,
      align: "right",
      lineBreak: false,
    });
  }
}

/** Gera o PDF e devolve um Buffer. */
export function renderizarPdf(relatorio) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGEM,
      bufferPages: true,
      info: { Title: relatorio.titulo, Author: "SISGEP — IFPE", Creator: "gestao-uep-backend" },
    });
    const partes = [];
    doc.on("data", (p) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);

    doc.fillColor(COR_PRIMARIA).font("Helvetica-Bold").fontSize(18).text(relatorio.titulo, MARGEM, MARGEM);
    doc.fillColor(COR_SUAVE).font("Helvetica").fontSize(9);
    doc.text(`Instituto Federal de Pernambuco — SISGEP · Gerado em ${formatarDataHora(relatorio.geradoEm)}`);
    for (const filtro of relatorio.filtros ?? []) doc.text(filtro);
    doc.moveTo(MARGEM, doc.y + 6).lineTo(doc.page.width - MARGEM, doc.y + 6).strokeColor(COR_PRIMARIA).stroke();
    doc.moveDown(0.8);

    for (const secao of relatorio.secoes) desenharSecao(doc, secao);

    rodapes(doc, relatorio);
    doc.end();
  });
}
