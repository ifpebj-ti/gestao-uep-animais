import { zipSync, strToU8 } from "fflate";

/*
 * Gera uma planilha .xlsx (Office Open XML) a partir da mesma estrutura de
 * relatório usada no PDF: uma aba por seção, com título, filtros e a tabela.
 *
 * O .xlsx é só um ZIP com alguns XML dentro; montamos esses XML aqui e
 * compactamos com o fflate (sem dependências). Foi escolhido no lugar do
 * exceljs porque este puxa pacotes com vulnerabilidades conhecidas (archiver,
 * glob, uuid) — e a esteira barra imagem com CVE crítica.
 */

function escaparXml(texto) {
  return String(texto)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A1, B1 ... Z1, AA1 ...
export function nomeColuna(indice) {
  let n = indice + 1;
  let nome = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    nome = String.fromCharCode(65 + resto) + nome;
    n = Math.floor((n - 1) / 26);
  }
  return nome;
}

// Nome de aba: até 31 caracteres, sem []:*?/\ e sem repetir.
export function nomeAba(titulo, usados) {
  const base = String(titulo).replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Planilha";
  let nome = base;
  let n = 2;
  while (usados.has(nome.toLowerCase())) {
    const sufixo = ` (${n++})`;
    nome = base.slice(0, 31 - sufixo.length) + sufixo;
  }
  usados.add(nome.toLowerCase());
  return nome;
}

// estilo 0 = normal, 1 = negrito (cabeçalho), 2 = título
function celula(ref, valor, estilo = 0) {
  const s = estilo ? ` s="${estilo}"` : "";
  if (valor === null || valor === undefined || valor === "") return `<c r="${ref}"${s}/>`;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`;
}

function linhaXml(numero, valores, estilo = 0) {
  const celulas = valores.map((v, i) => celula(`${nomeColuna(i)}${numero}`, v, estilo)).join("");
  return `<row r="${numero}">${celulas}</row>`;
}

function planilhaXml(relatorio, secao) {
  const linhas = [];
  let n = 1;
  linhas.push(linhaXml(n++, [secao.titulo], 2));
  linhas.push(linhaXml(n++, [relatorio.titulo]));
  for (const filtro of relatorio.filtros ?? []) linhas.push(linhaXml(n++, [filtro]));
  n++; // linha em branco
  const linhaCabecalho = n;
  linhas.push(linhaXml(n++, secao.colunas.map((c) => c.rotulo), 1));
  if (!secao.linhas.length) {
    linhas.push(linhaXml(n++, [secao.vazio ?? "Nenhum registro encontrado."]));
  }
  for (const l of secao.linhas) {
    linhas.push(linhaXml(n++, secao.colunas.map((c) => l[c.chave] ?? null), l.__destaque ? 1 : 0));
  }
  const cols = secao.colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.max(10, Math.min(60, (c.peso ?? 1) * 14))}" customWidth="1"/>`)
    .join("");
  // congela o cabeçalho da tabela ao rolar
  const pane = `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${linhaCabecalho}" topLeftCell="A${linhaCabecalho + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`;
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `${pane}<cols>${cols}</cols><sheetData>${linhas.join("")}</sheetData></worksheet>`
  );
}

const ESTILOS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="14"/><color rgb="FF2F9E41"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Gera o .xlsx e devolve um Buffer. */
export function renderizarXlsx(relatorio) {
  const usados = new Set();
  const abas = relatorio.secoes.map((s) => ({ nome: nomeAba(s.titulo, usados), xml: planilhaXml(relatorio, s) }));

  const arquivos = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `</Types>`
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${abas.map((a, i) => `<sheet name="${escaparXml(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>` +
        `</workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${abas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`
    ),
    "xl/styles.xml": strToU8(ESTILOS),
  };
  abas.forEach((a, i) => {
    arquivos[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(a.xml);
  });

  return Buffer.from(zipSync(arquivos, { level: 6 }));
}
