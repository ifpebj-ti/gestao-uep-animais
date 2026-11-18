// API falsa do backend: os testes não precisam de banco nem de servidor no ar.
// Para testar outra tela, adicione aqui a rota que ela chama.
const USUARIOS = {
  'prof@ifpe.test':  { id: 5, nome: 'Profa Ana',  email: 'prof@ifpe.test',  role: 'PROFESSOR' },
  'aluno@ifpe.test': { id: 7, nome: 'Aluno Caio', email: 'aluno@ifpe.test', role: 'ALUNO' }
};
const UEPS = [{ id: 1, nome: 'Bovino', tipo: 'BOVINOCULTURA' }];
const ANIMAIS = [{ id: 11, brinco: 'B-011', categoria: 'Vaca' }];

// atividades: lista inicial do calendário
async function mockarApi(page, atividades) {
  var lista = (atividades || []).slice();

  // o config.js é gerado no container; aqui apontamos para a API falsa
  await page.route('**/js/config.js', function (rota) {
    rota.fulfill({ contentType: 'text/javascript', body: 'window.__APP_CONFIG__ = { API_BASE: "http://api.teste/api", GOOGLE_CLIENT_ID: "" };' });
  });

  await page.route('http://api.teste/api/**', async function (rota) {
    var req = rota.request();
    var caminho = new URL(req.url()).pathname.replace('/api', '');
    var json = function (status, corpo) { return rota.fulfill({ status: status, contentType: 'application/json', body: JSON.stringify(corpo) }); };
    var token = (req.headers().authorization || '').replace('Bearer ', '');
    var eu = USUARIOS[token];

    if (caminho === '/auth/login') {
      var usuario = USUARIOS[JSON.parse(req.postData()).email];
      if (!usuario) return json(401, { error: 'E-mail ou senha inválidos' });
      return json(200, { token: usuario.email, user: Object.assign({ ueps: UEPS }, usuario) });
    }
    if (caminho === '/users/me') return json(200, Object.assign({ ueps: UEPS }, eu));
    if (caminho === '/ueps') return json(200, UEPS);
    if (caminho === '/ueps/1/animais') return json(200, ANIMAIS);

    if (caminho === '/ueps/1/atividades') {
      if (req.method() === 'GET') return json(200, lista);
      if (req.method() === 'POST') {
        var corpo = JSON.parse(req.postData());
        var nova = { id: 100, tipo: corpo.tipo, data: corpo.data, hora: corpo.hora, animal_id: corpo.animalId, animal_brinco: 'B-011', observacao: corpo.observacao, criado_por: eu.id, criado_por_nome: eu.nome };
        lista.push(nova);
        return json(201, nova);
      }
    }
    return json(200, []); // qualquer outra rota: lista vazia
  });
}

// Faz login pela tela, como o usuário faria
async function entrar(page, email) {
  await page.goto('/');
  await page.fill('#loginEmail', email);
  await page.fill('#loginSenha', 'qualquer');
  await page.click('#loginForm button[type=submit]');
}

module.exports = { mockarApi, entrar };
