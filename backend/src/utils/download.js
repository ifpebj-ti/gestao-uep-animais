/*
 * Cabeçalhos de download de arquivo. O nome vai em duas formas: `filename`
 * só com ASCII (navegadores antigos) e `filename*` em UTF-8 (RFC 5987).
 * O front lê esse header (CORS expõe Content-Disposition em app.js).
 */
export function contentDisposition(nome, tipo = "attachment") {
  const ascii = String(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\- ]+/g, "_");
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export function enviarArquivo(res, { buffer, contentType, nome, inline = false }) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", buffer.length);
  res.setHeader("Content-Disposition", contentDisposition(nome, inline ? "inline" : "attachment"));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  res.end(buffer);
}
