import { PDFDocument } from "pdf-lib";
import { ApiError } from "../../utils/ApiError.js";

/*
 * Utilitários de PDF dos documentos (Sprint 13): conferir que o arquivo é
 * um PDF de verdade e juntar vários PDFs em um só, na ordem pedida.
 */

export const TAMANHO_MAXIMO = 10 * 1024 * 1024; // 10 MB, o mesmo limite do front

/** O arquivo começa com "%PDF-"? (a extensão e o Content-Type vêm do cliente) */
export function pareceSerPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Abre o PDF com o pdf-lib; devolve o número de páginas ou lança 400. */
export async function validarPdf(buffer, nome = "arquivo") {
  if (!pareceSerPdf(buffer)) {
    throw ApiError.badRequest(`${nome} não é um arquivo PDF.`);
  }
  try {
    const doc = await PDFDocument.load(buffer, { updateMetadata: false });
    return doc.getPageCount();
  } catch (err) {
    if (/encrypted/i.test(err.message)) {
      throw ApiError.badRequest(`${nome} está protegido por senha e não pode ser usado.`);
    }
    throw ApiError.badRequest(`${nome} não é um PDF legível.`);
  }
}

/**
 * Junta os PDFs na ordem do array. partes = [{ nome, buffer }].
 * Devolve o Buffer do PDF unido.
 */
export async function unirPdfs(partes, titulo = "União de documentos") {
  const final = await PDFDocument.create();
  final.setTitle(titulo);
  final.setProducer("SISGEP — IFPE");
  for (const parte of partes) {
    let origem;
    try {
      origem = await PDFDocument.load(parte.buffer, { updateMetadata: false });
    } catch (err) {
      throw ApiError.badRequest(`${parte.nome} não é um PDF legível.`);
    }
    const paginas = await final.copyPages(origem, origem.getPageIndices());
    paginas.forEach((p) => final.addPage(p));
  }
  return Buffer.from(await final.save());
}
