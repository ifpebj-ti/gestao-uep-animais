// Servidor estático mínimo para os testes: serve a pasta src/ na porta 4173.
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', 'src');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(function (req, res) {
  var caminho = new URL(req.url, 'http://x').pathname;
  var arquivo = path.normalize(path.join(RAIZ, caminho === '/' ? 'index.html' : caminho));
  if (arquivo.indexOf(RAIZ) !== 0) { res.writeHead(403); return res.end(); }
  fs.readFile(arquivo, function (erro, dados) {
    if (erro) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    res.end(dados);
  });
}).listen(4173);
