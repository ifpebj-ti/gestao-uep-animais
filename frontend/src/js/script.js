/* =====================================================================
   0. API — configuração e helpers de comunicação com o backend
   ===================================================================== */
// API_BASE vem de js/config.js (gerado no container a partir de API_URL,
// ver frontend/.env.example); o valor fixo abaixo so e usado se, por
// algum motivo, config.js nao tiver carregado.
var API_BASE = (window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE) || 'http://localhost:3000/api';

/* Mapa frontend-role → backend-role e vice-versa */
var ROLE_MAP = {
  aluno:      'ALUNO',
  tecnico:    'TECNICO',
  estagiario: 'ESTAGIARIO',
  professor:  'PROFESSOR',
  diretoria:  'ADMIN'
};
var ROLE_MAP_REVERSE = {
  ALUNO:      'aluno',
  TECNICO:    'tecnico',
  ESTAGIARIO: 'estagiario',
  PROFESSOR:  'professor',
  ADMIN:      'diretoria'
};

/* Cores por tipo de UEP (fallback para UEPs sem cor cadastrada) */
var TIPO_CORES = {
  BOVINOCULTURA: '#2f9e41',
  SUINOCULTURA:  '#1f7a6c',
  AVICULTURA:    '#6b8f2f',
  CUNICULTURA:   '#2f7a9e',
  CAPRINOCULTURA:'#7a5c2f',
  OVINOCULTURA:  '#5c2f7a',
  LATICINIOS:    '#9e5c2f',
  OUTRO:         '#555'
};

/* LocalStorage helpers */
function getToken()  { return localStorage.getItem('sisgep_token'); }
function setToken(t) { localStorage.setItem('sisgep_token', t); }
function clearToken(){ localStorage.removeItem('sisgep_token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('sisgep_user')); } catch(e) { return null; } }
function setUser(u)  { localStorage.setItem('sisgep_user', JSON.stringify(u)); }
function clearUser() { localStorage.removeItem('sisgep_user'); }

/* Wrapper fetch com autenticação JWT e tratamento de erros */
function apiFetch(endpoint, options) {
  options = options || {};
  options.headers = options.headers || {};
  var token = getToken();
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
  return fetch(API_BASE + endpoint, options).then(function(res) {
    if (!res.ok) {
      return res.json().then(function(body) {
        // o backend manda o erro em { error: "..." } (ver errorHandler.js) —
        // "message" nunca existiu nessa resposta, por isso caía sempre no
        // fallback genérico "Erro 401" em vez de mostrar o motivo de verdade
        var msg = (body && body.error) ? body.error : mensagemGenericaPorStatus(res.status);
        throw new Error(msg);
      }).catch(function() {
        throw new Error(mensagemGenericaPorStatus(res.status));
      });
    }
    if (res.status === 204) return null;
    return res.json();
  });
}

// usado só quando a resposta de erro não veio com corpo JSON (raro — timeout,
// proxy no meio do caminho, etc). Pros erros normais da API, a mensagem real
// do backend (body.error) sempre tem prioridade sobre isso.
function mensagemGenericaPorStatus(status) {
  if (status === 401) return 'E-mail ou senha incorretos.';
  if (status === 403) return 'Você não tem permissão para fazer isso.';
  if (status === 404) return 'Não encontrado.';
  if (status >= 500) return 'Erro no servidor. Tenta de novo em instantes.';
  return 'Não foi possível completar a solicitação.';
}

/* =====================================================================
   SISGEP — script.js
   Frontend estático (protótipo). Sem chamadas reais de API ainda —
   os pontos onde o backend deve entrar estão marcados com "BACKEND:".
   ===================================================================== */


/* =====================================================================
   1. CONFIGURAÇÃO — PERFIS DE USUÁRIO (ROLES)
   Cada perfil define: rótulo exibido, descrição curta, se pode ser
   escolhido no formulário público de cadastro, e se o e-mail precisa
   ser institucional (@ifpe.edu.br). O perfil NÃO é mais escolhido na
   tela de login — a tela de login é única, e o perfil vem da conta
   correspondente ao e-mail digitado (ver USERS, mais abaixo).
   ===================================================================== */
var ROLES = {
  aluno: {
    label: 'Aluno',
    desc: 'Consulta de dados e atividades do setor',
    cadastro: true, // aparece no seletor de perfil do formulário de cadastro
    institucional: false
  },
  tecnico: {
    label: 'Técnico',
    desc: 'Apoio técnico e operacional ao rebanho',
    cadastro: true,
    institucional: false
  },
  estagiario: {
    label: 'Estagiário',
    desc: 'Atividades de campo e apoio ao setor',
    cadastro: true,
    institucional: false
  },
  professor: {
    label: 'Professor',
    desc: 'Orientação acadêmica e acompanhamento de projetos',
    cadastro: true,
    institucional: true // exige e-mail @ifpe.edu.br
  },
  diretoria: {
    label: 'Diretoria',
    desc: 'Gestão de notas fiscais, relatórios e controle de acesso',
    cadastro: false, // NÃO aparece no cadastro público — só é concedido via aba "Controle de Acesso"
    institucional: false
  }
};

/* Regras de visibilidade das abas por perfil (ver SEÇÃO 10 — toggleTabsByRole):
   - .op-only    → abas "operacionais" (Painel, Gestão do Rebanho, Estoque de Ração).
                   Visíveis para todos os perfis, EXCETO Diretoria.
   - .admin-only → abas "Relatórios (PDF)" e "Controle de Acesso". Visíveis SOMENTE para Diretoria.
   - Notas Fiscais não tem classe: fica visível para todo mundo, sempre.
   Resultado prático: a Diretoria só enxerga Notas Fiscais + Relatórios + Controle de Acesso. */


/* =====================================================================
   2. CONTAS DE DEMONSTRAÇÃO (USERS)
   Como não existe backend ainda, esta lista faz o papel de um banco de
   usuários em memória: é nela que handleLogin() procura o e-mail/senha
   digitados, e é nela que a Diretoria mexe através da aba "Controle de
   Acesso" (conceder/alterar/remover acesso).
   ATENÇÃO: isso é só para demonstração — some ao recarregar a página,
   e senha em texto puro aqui não tem NENHUM valor de segurança real.
   BACKEND: troque por GET /api/usuarios e valide login/senha no servidor,
   nunca no cliente.
   ===================================================================== */
var USERS = []; // cache local da ultima listagem GET /users, usado pela tela de Controle de Acesso


/* =====================================================================
   3. CONFIGURAÇÃO — SETORES / UEPs
   Cada setor tem: rótulo, sigla (2 letras, vira o "monograma" colorido
   na tela de seleção), cor do monograma, descrição curta, dados de
   censo (categorias e raças), insumo de ração e uma lista de animais
   de exemplo. Trocar de setor não recarrega a página: renderSetor()
   repinta a tela com os dados do setor escolhido.
   ===================================================================== */
// SETORES agora vem da API (GET /ueps) — ver buildSetorGrid()

/* Mapa de status reprodutivo (enum do backend) → [classe css, texto exibido] */
var STATUS_TAGS = {
  NAO_APLICAVEL:  ['status-nao-aplicavel', 'Disponível'],
  PRENHE:         ['status-prenhe',        'Prenhe'],
  VAZIA:          ['status-vazia',         'Vazia'],
  LACTANTE:       ['status-lactante',      'Lactante'],
  EM_CRESCIMENTO: ['status-crescimento',   'Em crescimento'],
  DESCARTE:       ['status-descarte',      'Descarte']
};

/* Estado da sessão atual */
var currentUser = null;      // objeto { id, nome, email, role } retornado pela API
var currentRole = '';        // role em minusculo (chave de ROLES), traduzida via ROLE_MAP_REVERSE
var currentSetor = '';       // id numerico da UEP selecionada
var currentSetorNome = '';
var currentPage = 1;
var PAGE_SIZE = 20;
// Guarda o id do animal em edição quando o modal é aberto via "ver" (clique
// na tabela). null = modal está no modo "Novo Animal" (cadastro).
var animalEditandoId = null;


/* =====================================================================
   4. HELPERS DE INTERFACE
   ===================================================================== */

/* Troca qual .auth-screen está visível (login / cadastro / seleção de setor) */
function showAuth(id) {
  document.querySelectorAll('.auth-screen').forEach(function (s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
}

/* Troca qual .screen (aba do app) está visível, e marca a aba clicada como ativa */
function go(id, e) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  if (e && e.currentTarget) e.currentTarget.classList.add('active');
}

/* Mostra um elemento (removendo .hidden) reiniciando a animação de entrada (.fade-in)
   mesmo que ele já tenha sido exibido antes na mesma sessão — usado ao alternar
   entre a tela de autenticação e o app (login, logout, trocar de setor). */
function reveal(el) {
  el.classList.remove('hidden');
  el.classList.remove('fade-in');
  void el.offsetWidth; // força o navegador a "esquecer" o estado anterior antes de reanimar
  el.classList.add('fade-in');
}

/* Mostra/esconde a caixinha de erro de um formulário (login, cadastro, controle de acesso) */
function showFormError(id, mensagem) {
  var el = document.getElementById(id);
  if (mensagem) el.textContent = mensagem;
  el.classList.remove('hidden');
}
function hideFormError(id) {
  document.getElementById(id).classList.add('hidden');
}

// pra erro a gente já usa alert() mesmo; isso aqui é só pra confirmar que
// uma ação deu certo (salvar, conceder acesso...), sem travar a tela com alert
function mostrarToast(mensagem) {
  var toast = document.createElement('div');
  toast.className = 'toast-sucesso';
  toast.textContent = mensagem;
  document.body.appendChild(toast);

  setTimeout(function() {
    toast.classList.add('toast-saindo');
    setTimeout(function() { toast.remove(); }, 300);
  }, 2500);
}


/* =====================================================================
   5. TELA DE SELEÇÃO DE SETOR
   Os tiles são gerados a partir das UEPs retornadas por GET /ueps.
   ===================================================================== */
function buildSetorGrid() {
  var grid = document.getElementById('setorGrid');
  grid.innerHTML = '<p style="padding:1rem;color:#888">Carregando UEPs…</p>';
  apiFetch('/ueps').then(function(ueps) {
    if (!ueps || ueps.length === 0) {
      grid.innerHTML = '<p style="padding:1rem;color:#888">Nenhuma UEP cadastrada.</p>';
      return;
    }
    var html = '';
    ueps.forEach(function(u) {
      var sigla = u.nome ? u.nome.slice(0, 2).toUpperCase() : '??';
      var cor   = TIPO_CORES[u.tipo] || '#555';
      var desc  = u.descricao || u.tipo || '';
      html += '<div class="setor-tile" onclick="selectSetor(' + u.id + ',\'' + u.nome + '\')">' +
                '<div class="setor-badge" style="background:' + cor + '">' + sigla + '</div>' +
                '<h3>' + u.nome + '</h3><p>' + desc + '</p>' +
                '<svg class="icon s-arrow" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>' +
              '</div>';
    });
    grid.innerHTML = html;
  }).catch(function(err) {
    grid.innerHTML = '<p style="padding:1rem;color:#c00">Erro ao carregar UEPs: ' + err.message + '</p>';
  });
}


/* =====================================================================
   6. FLUXO DE AUTENTICAÇÃO (login único / cadastro com perfil embutido)
   BACKEND: handleLogin/handleCadastro hoje validam tudo contra o array
   USERS, no próprio navegador. Troque o corpo dessas duas funções por
   chamadas fetch/axios para POST /api/auth/login e POST /api/auth/cadastro,
   mantendo a mesma sequência (em caso de sucesso → showAuth('auth-setor')).
   ===================================================================== */

/* Procura em USERS uma conta cujo e-mail e senha batam com o informado.
   Retorna o objeto do usuário, ou undefined se não achar. */
/* onsubmit do #loginForm — POST /api/auth/login */
function handleLogin(e) {
  e.preventDefault();
  hideFormError('loginError');

  var email = document.getElementById('loginEmail').value.trim();
  var senha = document.getElementById('loginSenha').value;

  apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: email, senha: senha })
  }).then(function(data) {
    setToken(data.token);
    setUser(data.user);
    currentUser = data.user;
    currentRole = ROLE_MAP_REVERSE[data.user.role] || 'aluno';
    showAuth('auth-setor');
    buildSetorGrid();
  }).catch(function(err) {
    showFormError('loginError', err.message);
  });
}

/* =====================================================================
   6.1 LOGIN COM GOOGLE (Google Identity Services)
   #googleButtonContainer (index.html) começa vazio e é preenchido aqui com
   o BOTÃO NATIVO do Google (renderButton), não com um botão nosso chamando
   prompt(). Motivo: prompt() só mostra alguma coisa quando já existe uma
   sessão do Google aberta no navegador — em aba anônima/InPrivate, ou pra
   quem não tá logado no Google, ele simplesmente não aparece (nenhum erro,
   nenhum evento, "clica e não acontece nada"). O botão nativo abre o
   seletor de conta numa janela de verdade e funciona em qualquer situação.

   onGoogleScriptLoaded() é chamado pelo atributo onload do <script src=
   "accounts.google.com/gsi/client"> no <head> do index.html, assim que o
   SDK termina de carregar — não dá pra esperar o clique do usuário pra
   isso, porque o botão já precisa estar desenhado na tela pra ser clicável.
   window.__APP_CONFIG__.GOOGLE_CLIENT_ID vem do js/config.js (gerado no
   container a partir da env GOOGLE_CLIENT_ID — ver frontend/.env.example).
   ===================================================================== */
var googleInitialized = false;

function onGoogleScriptLoaded() {
  ensureGoogleInit();
}

function ensureGoogleInit() {
  if (googleInitialized) return true;
  if (!window.google || !window.google.accounts || !window.google.accounts.id) return false;

  var clientId = window.__APP_CONFIG__ && window.__APP_CONFIG__.GOOGLE_CLIENT_ID;
  var container = document.getElementById('googleButtonContainer');

  if (!clientId) {
    // ambiente sem GOOGLE_CLIENT_ID configurado (ver frontend/.env.example) —
    // não tem o que desenhar, então avisa no lugar do botão em vez de
    // deixar o espaço vazio sem explicação.
    if (container) {
      container.innerHTML = '<p class="google-btn-indisponivel">Login com Google indisponível no momento. Use e-mail e senha.</p>';
    }
    return false;
  }

  google.accounts.id.initialize({
    client_id: clientId,
    callback: handleGoogleCredentialResponse
  });

  if (container) {
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      shape: 'pill',
      size: 'large',
      text: 'continue_with',
      logo_alignment: 'left',
      locale: 'pt-BR',
      width: 320
    });
  }

  googleInitialized = true;
  return true;
}

/* Callback da GSI — recebe o ID token do Google e troca por um token da
   nossa API (POST /auth/google). O backend decide o perfil pelo domínio
   do e-mail: @ifpe.edu.br entra direto como Professor; qualquer outro
   domínio vira Aluno, mas pendente de aprovação da Diretoria (ativo=false)
   até alguém liberar em Controle de Acesso — daí o status 202 abaixo. */
function handleGoogleCredentialResponse(response) {
  apiFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential: response.credential })
  }).then(function(data) {
    if (data && data.pendente) {
      showFormError('loginError', data.message || 'Conta criada, aguardando aprovação da Diretoria.');
      return;
    }
    setToken(data.token);
    setUser(data.user);
    currentUser = data.user;
    currentRole = ROLE_MAP_REVERSE[data.user.role] || 'aluno';
    showAuth('auth-setor');
    buildSetorGrid();
  }).catch(function(err) {
    showFormError('loginError', err.message);
  });
}

/* Preenche o <select> de perfil do formulário de cadastro — só com os
   perfis que têm ROLES[x].cadastro = true (Diretoria fica de fora). */
function buildCadastroRoleOptions() {
  var html = '';
  for (var key in ROLES) {
    if (ROLES[key].cadastro) html += '<option value="' + key + '">' + ROLES[key].label + '</option>';
  }
  document.getElementById('cadRole').innerHTML = html;
  updateCadastroEmailField(document.getElementById('cadRole').value);
}

/* Chamado quando o campo "Perfil" do cadastro muda — alterna o rótulo/
   placeholder/validação do e-mail conforme o perfil exigir e-mail
   institucional (hoje, só Professor). */
function updateCadastroEmailField(role) {
  var institucional = ROLES[role] && ROLES[role].institucional;
  document.getElementById('cadEmailLabel').textContent = institucional ? 'E-mail institucional' : 'E-mail';
  document.getElementById('cadEmail').placeholder = institucional ? 'nome.sobrenome@ifpe.edu.br' : 'seuemail@exemplo.com';
  // pattern="" (string vazia) bloqueia qualquer valor em alguns browsers — remove o atributo
  // por completo quando o perfil nao exige e-mail institucional, em vez de zera-lo.
  var cadEmailEl = document.getElementById('cadEmail');
  if (institucional) {
    cadEmailEl.setAttribute('pattern', '.+@ifpe\\.edu\\.br$');
  } else {
    cadEmailEl.removeAttribute('pattern');
  }
  document.getElementById('cadHint').style.display = institucional ? 'block' : 'none';
}

/* onsubmit do #cadastroForm */
function handleCadastro(e) {
  e.preventDefault();
  hideFormError('cadError');

  var nome = document.getElementById('cadNome').value.trim();
  var role = document.getElementById('cadRole').value; // chave frontend: aluno/tecnico/estagiario/professor
  var email = document.getElementById('cadEmail').value.trim().toLowerCase();
  var senha = document.getElementById('cadSenha').value;
  var senha2 = document.getElementById('cadSenha2').value;

  if (senha !== senha2) {
    showFormError('cadError', 'As senhas digitadas não conferem.');
    return;
  }

  var backendRole = ROLE_MAP[role] || 'ALUNO';
  apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nome: nome, email: email, senha: senha, role: backendRole })
  }).then(function(data) {
    setToken(data.token);
    setUser(data.user);
    currentUser = data.user;
    currentRole = ROLE_MAP_REVERSE[data.user.role] || role;
    showAuth('auth-setor');
    buildSetorGrid();
  }).catch(function(err) {
    showFormError('cadError', err.message);
  });
}

/* Chamada pelos onchange/Enter da barra de filtros — volta pra página 1
   e busca de novo com os filtros atuais. */
function aplicarFiltros() {
  currentPage = 1;
  renderSetor();
}

/* Botão "Limpar" da barra de filtros */
function limparFiltros() {
  document.getElementById('filtroBusca').value = '';
  document.getElementById('filtroCategoria').value = '';
  document.getElementById('filtroRaca').value = '';
  document.getElementById('filtroFase').value = '';
  document.getElementById('filtroDisponivel').value = '';
  aplicarFiltros();
}

/* Chamado ao clicar num tile de setor/UEP — encerra o fluxo de autenticação e entra no app */
function selectSetor(setorId, setorNome) {
  currentSetor = setorId;
  currentSetorNome = setorNome;
  currentPage = 1;
  enterApp();
}

/* Botão "trocar" no cabeçalho do app — volta pra tela de seleção de setor sem deslogar */
function trocarSetor() {
  document.getElementById('userMenu').classList.remove('show');
  document.getElementById('app').classList.add('hidden');
  reveal(document.getElementById('authFlow'));
  showAuth('auth-setor');
  buildSetorGrid();
}


/* =====================================================================
   7. MENU DO USUÁRIO (cabeçalho do app)
   ===================================================================== */

function toggleUserMenu(e) {
  e.stopPropagation(); // evita que o clique no botão já feche o menu pelo listener abaixo
  document.getElementById('userMenu').classList.toggle('show');
}

// Fecha o menu do usuário ao clicar em qualquer outro lugar da página
document.addEventListener('click', function () {
  document.getElementById('userMenu').classList.remove('show');
});


/* =====================================================================
   8. RENDERIZAÇÃO DOS DADOS DO SETOR ATUAL
   Preenche Painel, Gestão do Rebanho e Estoque com dados vindos da API
   (GET /ueps/:id/animais e /ueps/:id/animais/censo). Chamada sempre
   que o setor muda ou a página da tabela é trocada.
   ===================================================================== */
function renderSetor() {
  var uepId = currentSetor;
  var uepNome = currentSetorNome || 'UEP';

  document.getElementById('setorAtual').textContent = uepNome;
  document.getElementById('heroSetor').textContent = uepNome;
  document.getElementById('rebanhoTitulo').textContent = 'Gestão do Rebanho — ' + uepNome;

  // Filtros: a maioria vai direto pra query string da API. RAÇA é a
  // exceção — o backend (animais.repository.js -> buildFilters) ainda não
  // aceita filtro por raça, então aplicamos esse filtro aqui no cliente,
  // em cima da página já recebida. BACKEND: adicionar `raca` em buildFilters
  // pra isso funcionar de verdade em todas as páginas, não só na atual.
  var fBusca      = (document.getElementById('filtroBusca').value || '').trim();
  var fCategoria  = document.getElementById('filtroCategoria').value;
  var fRaca       = document.getElementById('filtroRaca').value;
  var fFase       = document.getElementById('filtroFase').value;
  var fDisponivel = document.getElementById('filtroDisponivel').value;

  var qs = '?page=' + currentPage + '&limit=' + PAGE_SIZE;
  if (fBusca)      qs += '&busca=' + encodeURIComponent(fBusca);
  if (fCategoria)  qs += '&categoria=' + encodeURIComponent(fCategoria);
  if (fFase)       qs += '&statusReprodutivo=' + encodeURIComponent(fFase);
  if (fDisponivel) qs += '&disponivel=' + fDisponivel;

  document.getElementById('tabelaAnimais').innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';

  Promise.all([
    apiFetch('/ueps/' + uepId + '/animais' + qs),
    apiFetch('/ueps/' + uepId + '/animais/censo')
  ]).then(function(results) {
    var resp    = results[0] || {};
    var animais = Array.isArray(resp) ? resp : (resp.data || []);
    var pagina  = Array.isArray(resp)
      ? { page: 1, totalPages: 1, total: animais.length, offset: 0 }
      : resp;
    var censo   = results[1] || {};

    // Filtro de raça (client-side, só na página atual — ver nota acima)
    var filtradoPorRaca = false;
    if (fRaca) {
      animais = animais.filter(function(a) { return (a.raca || '') === fRaca; });
      filtradoPorRaca = true;
    }

    var total = censo.total || pagina.total || animais.length;
    var emQuarentena = animais.filter(function(a) { return a.status_reprodutivo === 'DESCARTE'; }).length;

    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiQuarentena').textContent = emQuarentena;

    if (animais.length > 0) {
      document.getElementById('feed1').innerHTML = '<b>' + (animais[0].brinco || animais[0].id) + '</b> está cadastrado(a)';
    }
    document.getElementById('feed2').innerHTML = 'Dados carregados da API';

    // censo.porCategoria e censo.porRaca vem como array [{categoria|raca, total}]
    var censoPorCat = {};
    var censoPorRaca = {};
    (censo.porCategoria || []).forEach(function(row) {
      var cat = row.categoria || '?';
      censoPorCat[cat] = (censoPorCat[cat] || 0) + (row.total || 0);
    });
    (censo.porRaca || []).forEach(function(row) {
      var r = row.raca || 'Não informada';
      censoPorRaca[r] = (censoPorRaca[r] || 0) + (row.total || 0);
    });

    var censoCategoriaHtml = '<div class="counter"><div class="n">' + total + '</div><div class="l">Total</div></div>';
    Object.keys(censoPorCat).forEach(function(cat) {
      censoCategoriaHtml += '<div class="counter sub"><div class="n">' + censoPorCat[cat] + '</div><div class="l">' + cat + '</div></div>';
    });
    document.getElementById('censoCategoria').innerHTML = censoCategoriaHtml;

    var censoRacaHtml = '';
    Object.keys(censoPorRaca).forEach(function(raca) {
      censoRacaHtml += '<div class="counter sub"><div class="n">' + censoPorRaca[raca] + '</div><div class="l">' + raca + '</div></div>';
    });
    document.getElementById('censoRaca').innerHTML = censoRacaHtml || '<div class="counter sub"><div class="l">—</div></div>';

    var opcoesCategoria = '<option value="">Categoria</option>';
    Object.keys(censoPorCat).forEach(function(c) { opcoesCategoria += '<option>' + c + '</option>'; });
    document.getElementById('filtroCategoria').innerHTML = opcoesCategoria;

    var opcoesRaca = '<option value="">Raça</option>';
    Object.keys(censoPorRaca).forEach(function(r) { opcoesRaca += '<option>' + r + '</option>'; });
    document.getElementById('filtroRaca').innerHTML = opcoesRaca;

    var linhasTabela = '';
    animais.forEach(function(animal) {
      var statusKey = animal.status_reprodutivo || 'NAO_APLICAVEL';
      var tag = STATUS_TAGS[statusKey] || ['disp', statusKey];
      linhasTabela +=
        '<tr>' +
          '<td class="brinco">' + (animal.brinco || animal.id) + '</td>' +
          '<td>' + (animal.raca || '—') + '</td>' +
          '<td>' + (animal.categoria || '—') + '</td>' +
          '<td>' + (animal.sexo || '—') + '</td>' +
          '<td><span class="tag ' + tag[0] + '">' + tag[1] + '</span></td>' +
          '<td><span class="link-ver" onclick="verAnimal(\'' + animal.id + '\')">ver</span></td>' +
        '</tr>';
    });
    document.getElementById('tabelaAnimais').innerHTML = linhasTabela || '<tr><td colspan="6">Nenhum animal cadastrado.</td></tr>';

    var de = animais.length ? (pagina.offset || 0) + 1 : 0;
    var ate = (pagina.offset || 0) + animais.length;
    document.getElementById('paginacaoInfo').textContent = filtradoPorRaca
      ? 'Mostrando ' + animais.length + ' animais da raça "' + fRaca + '" nesta página'
      : 'Mostrando ' + de + '–' + ate + ' de ' + (pagina.total || total) + ' animais';
    renderPaginacao(pagina.page || 1, pagina.totalPages || 1);

    // Estoque (placeholder — modulo de estoque sera integrado futuramente)
    document.getElementById('estoqueInsumo').textContent = 'Estoque — ' + uepNome;
    document.getElementById('estoqueNivel').textContent = '—';
    document.getElementById('estoqueLabel').textContent = 'Nível atual';
    document.getElementById('estoqueConsumo').textContent = '—';
    document.getElementById('tabelaEstoque').innerHTML = '<tr><td colspan="5">Módulo de estoque em breve.</td></tr>';

  }).catch(function(err) {
    document.getElementById('tabelaAnimais').innerHTML =
      '<tr><td colspan="6" style="color:#c00">Erro ao carregar dados: ' + err.message + '</td></tr>';
  });
}


/* =====================================================================
   9. CONTROLE DE ACESSO (aba exclusiva da Diretoria)
   Gerencia o array USERS: lista quem tem conta, permite trocar o perfil
   de cada um, remover acesso, e conceder acesso novo (inclusive o
   perfil Diretoria, que não existe no cadastro público).
   BACKEND: troque USERS por dados de GET /api/usuarios, e cada ação
   abaixo (alterar/remover/conceder) por PATCH/DELETE/POST correspondentes.
   ===================================================================== */

/* Monta a etiqueta colorida de perfil usada na tabela (ver .tag.role-* no CSS) */
function roleBadge(role) {
  var r = ROLES[role];
  return '<span class="tag role-' + role + '">' + (r ? r.label : role) + '</span>';
}

/* Gera as <option> de um <select> de perfil. Se "todos" for true, inclui
   também Diretoria — usado no formulário de "conceder novo acesso",
   que é o único lugar onde faz sentido atribuir esse perfil. */
function buildRoleOptions(selecionado, todos) {
  var html = '';
  for (var key in ROLES) {
    if (!todos && !ROLES[key].cadastro) continue; // esconde Diretoria fora do formulário de concessão
    html += '<option value="' + key + '"' + (key === selecionado ? ' selected' : '') + '>' + ROLES[key].label + '</option>';
  }
  return html;
}

/* Monta as <option> de um <select> de UEP a partir da lista já carregada,
   marcando a UEP atual do usuário como selected (se ele já tiver uma). */
function montarOpcoesSetor(ueps, uepIdAtual) {
  var html = '<option value="">Sem UEP definida</option>';
  ueps.forEach(function(u) {
    var sel = (uepIdAtual != null && String(uepIdAtual) === String(u.id)) ? ' selected' : '';
    html += '<option value="' + u.id + '"' + sel + '>' + u.nome + '</option>';
  });
  return html;
}

/* Repinta a tabela de contas com acesso — GET /users + GET /ueps (somente ADMIN).
   Busca as duas coisas juntas porque cada linha da tabela precisa de um
   <select> de UEP, e o formulário de "conceder novo acesso" também usa essa
   mesma lista. */
function renderControleAcesso() {
  var tbody = document.getElementById('tabelaAcessos');
  tbody.innerHTML = '<tr><td colspan="7">Carregando…</td></tr>';

  Promise.all([
    apiFetch('/users'),
    apiFetch('/ueps')
  ]).then(function(results) {
    var usuarios = results[0] || [];
    var ueps = results[1] || [];
    USERS = usuarios; // cache local para os handlers de alterar/remover

    // o formulário de conceder acesso usa a mesma lista de UEPs, sem nenhuma pré-selecionada
    document.getElementById('naSetor').innerHTML = montarOpcoesSetor(ueps, null);

    var linhas = '';
    usuarios.forEach(function (u) {
      var roleFrontend = ROLE_MAP_REVERSE[u.role] || 'aluno';
      // BACKEND: users ainda não tem coluna de UEP — quando o campo existir
      // na resposta de GET /users (ex.: uep_id, igual o resto da API devolve
      // em snake_case cru do banco), essa linha já pega o valor certo sozinha.
      var uepIdAtual = u.uep_id != null ? u.uep_id : u.uepId;

      linhas +=
        '<tr>' +
          '<td>' + u.nome + '</td>' +
          '<td>' + u.email + '</td>' +
          '<td>' + roleBadge(roleFrontend) + '</td>' +
          '<td><select class="fake-select" style="min-width:150px;" onchange="alterarAcesso(' + u.id + ', this.value)">' +
                buildRoleOptions(roleFrontend, true) +
              '</select></td>' +
          '<td><select class="fake-select" style="min-width:170px;" onchange="alterarSetorUsuario(' + u.id + ', this.value)">' +
                montarOpcoesSetor(ueps, uepIdAtual) +
              '</select></td>' +
          '<td>' + statusAcessoBadge(u) + '</td>' +
          '<td><span class="link-ver" style="color:var(--if-red);" onclick="removerAcesso(' + u.id + ')">remover</span></td>' +
        '</tr>';
    });
    tbody.innerHTML = linhas || '<tr><td colspan="7">Nenhum usuário cadastrado.</td></tr>';
  }).catch(function(err) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#c00">Erro ao carregar dados: ' + err.message + '</td></tr>';
  });
}

/* Coluna "Status" da tabela de acessos. A maioria dos usuários (cadastro
   manual / concedido pela Diretoria) já nasce com ativo=true. Contas
   criadas via login com Google com e-mail não-institucional nascem com
   ativo=false ("pendente") — ver auth.service.js -> loginWithGoogle — e
   só passam a existir de fato, pro resto do sistema, quando alguém aqui
   clica em "aprovar" (PATCH /users/:id { ativo: true }). */
function statusAcessoBadge(u) {
  if (u.ativo === false) {
    return '<span class="tag" style="background:#b58900;color:#fff;">Pendente</span> ' +
           '<span class="link-ver" onclick="aprovarAcesso(' + u.id + ')">aprovar</span>';
  }
  return '<span class="tag" style="background:#2f9e41;color:#fff;">Ativo</span>';
}

/* Chamado ao clicar em "aprovar" na coluna Status — libera o acesso de uma
   conta criada via Google que ainda está pendente (ativo=false). */
function aprovarAcesso(userId) {
  apiFetch('/users/' + userId, {
    method: 'PATCH',
    body: JSON.stringify({ ativo: true })
  }).then(function() {
    renderControleAcesso();
    mostrarToast('Acesso aprovado.');
  }).catch(function(err) {
    alert('Erro ao aprovar acesso: ' + err.message);
  });
}

/* Chamado ao trocar o <select> de UEP de uma linha.
   BACKEND: hoje isso só funciona de verdade quando o backend tiver:
   1) uma coluna uep_id em users (migration: ALTER TABLE users ADD COLUMN
      uep_id INTEGER REFERENCES ueps(id) ON DELETE SET NULL);
   2) PATCH /users/:id aceitando { uepId } no corpo e gravando essa coluna;
   3) GET /users devolvendo esse campo em cada usuário (pra tabela já abrir
      com o setor certo pré-selecionado, sem precisar clicar em nada).
   Até isso existir, essa chamada vai falhar com erro do backend — o que é
   esperado, é só a parte do front pronta esperando a API. */
function alterarSetorUsuario(userId, novoUepId) {
  apiFetch('/users/' + userId, {
    method: 'PATCH',
    body: JSON.stringify({ uepId: novoUepId ? Number(novoUepId) : null })
  }).then(function() {
    renderControleAcesso();
    mostrarToast('UEP do usuário atualizada.');
  }).catch(function(err) {
    alert('Erro ao alterar UEP: ' + err.message);
    renderControleAcesso(); // desfaz visualmente a troca no <select>
  });
}

/* Chamado ao trocar o <select> de perfil de uma linha — PATCH /users/:id */
function alterarAcesso(userId, novoRoleFrontend) {
  var backendRole = ROLE_MAP[novoRoleFrontend] || 'ALUNO';
  apiFetch('/users/' + userId, {
    method: 'PATCH',
    // ativo:true junto com o role: na pratica, quem troca o perfil de
    // alguem aqui esta decidindo dar acesso a essa pessoa com esse perfil —
    // inclusive contas pendentes (criadas via Google com dominio nao-
    // institucional, ver auth.service.js -> loginWithGoogle). Sem isso, dava
    // pra trocar o perfil de uma conta pendente pra Professor e ela continuar
    // bloqueada no login, porque "Alterar perfil" e "aprovar" eram acoes
    // separadas — confuso, e foi exatamente o que aconteceu num teste real.
    // Pra quem ja estava ativo, mandar ativo:true de novo e inofensivo.
    body: JSON.stringify({ role: backendRole, ativo: true })
  }).then(function() {
    renderControleAcesso();
    mostrarToast('Perfil atualizado.');
  }).catch(function(err) {
    alert('Erro ao alterar acesso: ' + err.message);
    renderControleAcesso(); // desfaz visualmente a troca no <select>
  });
}

/* Chamado ao clicar em "remover" — pede confirmação antes (é irreversível),
   igual a gente já faz pra remover animal, e só então dá o DELETE /users/:id */
function removerAcesso(userId) {
  var usuario = USERS.find(function(u) { return u.id === userId; });
  var quem = usuario ? (usuario.nome + ' (' + usuario.email + ')') : 'este usuário';

  var confirmado = window.confirm(
    'Tem certeza que deseja remover o acesso de ' + quem + '?\n\nEssa ação não pode ser desfeita.'
  );
  if (!confirmado) return;

  apiFetch('/users/' + userId, { method: 'DELETE' }).then(function() {
    renderControleAcesso();
    mostrarToast('Acesso removido.');
  }).catch(function(err) {
    alert('Erro ao remover acesso: ' + err.message);
  });
}

/* onsubmit do formulário "Conceder novo acesso" — POST /users
   BACKEND: uepId só vai ser persistido de verdade quando o backend aceitar
   esse campo em POST /users (mesma dependência do alterarSetorUsuario acima). */
function concederAcesso() {
  hideFormError('acessoError');

  var nome = document.getElementById('naNome').value.trim();
  var email = document.getElementById('naEmail').value.trim().toLowerCase();
  var roleFrontend = document.getElementById('naRole').value;
  var uepId = document.getElementById('naSetor').value;
  var senha = document.getElementById('naSenha').value;
  var backendRole = ROLE_MAP[roleFrontend] || 'ALUNO';

  apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      nome: nome,
      email: email,
      senha: senha,
      role: backendRole,
      uepId: uepId ? Number(uepId) : null
    })
  }).then(function() {
    document.getElementById('novoAcessoForm').reset();
    renderControleAcesso();
    mostrarToast('Acesso concedido a ' + nome + '.');
  }).catch(function(err) {
    showFormError('acessoError', err.message);
  });
}


/* =====================================================================
   10. SESSÃO — entrar no app / sair
   ===================================================================== */

/* Aplica as regras de visibilidade de aba descritas lá na SEÇÃO 1 (junto de ROLES.diretoria):
   - Diretoria: esconde .op-only (Painel / Rebanho / Estoque), mostra .admin-only
     (Relatórios + Controle de Acesso)
   - Demais perfis: mostra .op-only, esconde .admin-only
   - Notas Fiscais nunca é escondida (não tem nenhuma dessas duas classes) */
function toggleTabsByRole() {
  var isDiretoria = currentRole === 'diretoria';
  document.querySelectorAll('.op-only').forEach(function (el) {
    el.classList.toggle('hidden', isDiretoria);
  });
  document.querySelectorAll('.admin-only').forEach(function (el) {
    el.classList.toggle('hidden', !isDiretoria);
  });
}

/* Chamada ao final do login/cadastro + seleção de setor.
   BACKEND: hoje o nome/perfil exibidos vêm do objeto currentUser (que foi
   preenchido em handleLogin/handleCadastro a partir do array USERS local).
   Troque por dados retornados pela API de autenticação. */
function enterApp() {
  currentUser = currentUser || getUser();
  var displayName = currentUser && currentUser.nome ? currentUser.nome.split(' ')[0] : 'Usuário';
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  document.getElementById('headerUserName').textContent = displayName;
  document.getElementById('menuUserName').textContent = displayName;
  document.getElementById('menuUserRole').textContent = ROLES[currentRole] ? ROLES[currentRole].label : currentRole;
  document.getElementById('heroGreeting').textContent = 'Bem-vindo(a) de volta, ' + displayName;

  toggleTabsByRole();
  renderSetor();
  if (currentRole === 'diretoria') renderControleAcesso();

  document.getElementById('authFlow').classList.add('hidden');
  reveal(document.getElementById('app'));

  // Diretoria não tem aba "Painel" — abre direto em Notas Fiscais.
  // Os demais perfis abrem normalmente no Painel.
  var telaInicial = (currentRole === 'diretoria') ? 'notas' : 'painel';
  go(telaInicial, { currentTarget: document.getElementById('tab-' + telaInicial) });
}

/* Botão "Sair da conta" no menu do usuário */
function logout() {
  clearToken();
  clearUser();

  document.getElementById('userMenu').classList.remove('show');
  document.getElementById('app').classList.add('hidden');
  reveal(document.getElementById('authFlow'));

  currentUser = null;
  currentRole = '';
  currentSetor = '';
  currentSetorNome = '';
  currentPage = 1;

  showAuth('auth-login');
  document.getElementById('loginForm').reset();
  document.getElementById('cadastroForm').reset();
  hideFormError('loginError');
  hideFormError('cadError');
}


/* =====================================================================
   11. INICIALIZAÇÃO
   ===================================================================== */
// buildSetorGrid() NAO e chamado aqui: ele bate em GET /ueps, que exige token.
// E chamado dentro de handleLogin/handleCadastro, apos a autenticacao.
buildCadastroRoleOptions();
document.getElementById('naRole').innerHTML = buildRoleOptions(null, true); // formulário de concessão inclui Diretoria

// Rede corporativa/escolar bloqueando accounts.google.com, adblock, etc. —
// nesses casos o <script> do Google nunca dispara o onload, e o
// onGoogleScriptLoaded() de SEÇÃO 6.1 nunca roda. Sem esse fallback, o
// espaço do botão ficaria vazio pra sempre, sem nenhuma explicação. 4s é
// tempo de sobra pro SDK carregar numa conexão normal.
setTimeout(function() {
  if (!googleInitialized) ensureGoogleInit();
}, 4000);


/* =====================================================================
   12. MODAL DE ANIMAL (cadastro, visualização e edição)
   O mesmo modal serve para os dois fluxos:
   - abrirModalAnimal(): modo "Novo Animal" (formulário vazio, POST ao salvar)
   - verAnimal(id): modo "Detalhes do Animal" (busca na API, PATCH ao salvar)
   ===================================================================== */

// guarda o que estava com foco antes de abrir o modal, pra devolver o foco
// pra lá quando fechar (importante pra quem navega só com teclado)
var elementoAntesDoModal = null;

function focarPrimeiroCampoModal() {
  var campo = document.getElementById('anBrinco');
  if (campo) campo.focus();
}

function abrirModalAnimal() {
  animalEditandoId = null;
  elementoAntesDoModal = document.activeElement;
  document.getElementById('formAnimal').reset();
  document.getElementById('modalAnimalTitulo').textContent = 'Novo Animal';
  document.getElementById('btnSalvarAnimal').textContent = 'Salvar';
  document.getElementById('btnRemoverAnimal').style.display = 'none';
  document.getElementById('modalAnimal').style.display = 'flex';
  focarPrimeiroCampoModal();
}

/* Chamada ao clicar em "ver" numa linha da tabela — GET /ueps/:uep/animais/:id
   e preenche o mesmo formulário do cadastro, só que em modo edição. */
function verAnimal(id) {
  elementoAntesDoModal = document.activeElement;

  apiFetch('/ueps/' + currentSetor + '/animais/' + id).then(function(animal) {
    animalEditandoId = animal.id;

    document.getElementById('anBrinco').value   = animal.brinco || '';
    document.getElementById('anCategoria').value = animal.categoria || '';
    document.getElementById('anSexo').value      = animal.sexo || '';
    document.getElementById('anRaca').value      = animal.raca || '';
    // input[type=date] só aceita "AAAA-MM-DD" — corta o restante do timestamp, se vier
    document.getElementById('anNasc').value      = animal.data_nascimento ? animal.data_nascimento.slice(0, 10) : '';
    document.getElementById('anStatus').value    = animal.status_reprodutivo || 'NAO_APLICAVEL';
    document.getElementById('anObs').value       = animal.observacoes || '';

    document.getElementById('modalAnimalTitulo').textContent = 'Detalhes do Animal — ' + (animal.brinco || animal.id);
    document.getElementById('btnSalvarAnimal').textContent = 'Salvar alterações';
    document.getElementById('btnRemoverAnimal').style.display = 'inline-block';
    document.getElementById('modalAnimal').style.display = 'flex';
    focarPrimeiroCampoModal();
  }).catch(function(err) {
    alert('Erro ao carregar animal: ' + err.message);
  });
}

function fecharModalAnimal() {
  document.getElementById('modalAnimal').style.display = 'none';
  animalEditandoId = null;

  // devolve o foco pra quem abriu o modal (botão "Novo Cadastro" ou "ver" da linha)
  if (elementoAntesDoModal && typeof elementoAntesDoModal.focus === 'function') {
    elementoAntesDoModal.focus();
  }
  elementoAntesDoModal = null;
}

document.addEventListener('click', function(e) {
  var modal = document.getElementById('modalAnimal');
  if (modal && e.target === modal) fecharModalAnimal();
});

// Esc fecha o modal, e Tab/Shift+Tab ficam presos dentro dele enquanto tiver
// aberto (senão o teclado continua navegando pro resto da página por trás)
document.addEventListener('keydown', function(e) {
  var modal = document.getElementById('modalAnimal');
  if (!modal || modal.style.display !== 'flex') return;

  if (e.key === 'Escape') {
    fecharModalAnimal();
    return;
  }

  if (e.key === 'Tab') {
    var focaveis = modal.querySelectorAll('input, select, textarea, button');
    if (!focaveis.length) return;
    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];

    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }
});

function salvarAnimal() {
  var btn = document.getElementById('btnSalvarAnimal');
  var editando = !!animalEditandoId;
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  var payload = {
    brinco:             document.getElementById('anBrinco').value.trim(),
    categoria:          document.getElementById('anCategoria').value,
    sexo:               document.getElementById('anSexo').value,
    raca:               document.getElementById('anRaca').value.trim() || null,
    dataNascimento:     document.getElementById('anNasc').value || null,
    statusReprodutivo:  document.getElementById('anStatus').value,
    observacoes:        document.getElementById('anObs').value.trim() || null
  };

  var url = editando
    ? '/ueps/' + currentSetor + '/animais/' + animalEditandoId
    : '/ueps/' + currentSetor + '/animais';

  apiFetch(url, {
    method: editando ? 'PATCH' : 'POST',
    body: JSON.stringify(payload)
  }).then(function() {
    fecharModalAnimal();
    if (!editando) currentPage = 1; // animal novo entra no topo (ordem: created_at DESC)
    renderSetor();
    mostrarToast(editando ? 'Animal atualizado com sucesso.' : 'Animal cadastrado com sucesso.');
  }).catch(function(err) {
    alert('Erro ao salvar: ' + err.message);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = editando ? 'Salvar alterações' : 'Salvar';
  });
}

/* Chamada ao clicar em "Remover animal" dentro do modal (só existe no modo
   de visualização/edição — ver verAnimal()). Pede confirmação antes de
   mandar o DELETE, já que é uma ação que não pode ser desfeita. */
function confirmarRemoverAnimal() {
  if (!animalEditandoId) return;

  var brinco = document.getElementById('anBrinco').value || animalEditandoId;
  var confirmado = window.confirm(
    'Tem certeza que deseja remover o animal ' + brinco + '?\n\nEssa ação não pode ser desfeita.'
  );
  if (!confirmado) return;

  var btnRemover = document.getElementById('btnRemoverAnimal');
  btnRemover.disabled = true;
  btnRemover.textContent = 'Removendo…';

  apiFetch('/ueps/' + currentSetor + '/animais/' + animalEditandoId, {
    method: 'DELETE'
  }).then(function() {
    fecharModalAnimal();
    renderSetor();
    mostrarToast('Animal removido.');
  }).catch(function(err) {
    alert('Erro ao remover: ' + err.message);
  }).finally(function() {
    btnRemover.disabled = false;
    btnRemover.textContent = 'Remover animal';
  });
}


/* =====================================================================
   13. PAGINAÇÃO DA TABELA DE ANIMAIS
   ===================================================================== */
function renderPaginacao(page, totalPages) {
  var box = document.getElementById('paginacaoBotoes');
  if (!box) return;

  if (totalPages <= 1) { box.innerHTML = ''; return; }

  var html = '<button onclick="irParaPagina(' + (page - 1) + ')"' +
             (page <= 1 ? ' disabled' : '') + '>\u2039</button>';

  var inicio = Math.max(1, page - 2);
  var fim    = Math.min(totalPages, inicio + 4);
  inicio     = Math.max(1, fim - 4);

  for (var i = inicio; i <= fim; i++) {
    html += '<button onclick="irParaPagina(' + i + ')"' +
            (i === page ? ' class="current"' : '') + '>' + i + '</button>';
  }

  html += '<button onclick="irParaPagina(' + (page + 1) + ')"' +
          (page >= totalPages ? ' disabled' : '') + '>\u203A</button>';

  box.innerHTML = html;
}

function irParaPagina(page) {
  if (page < 1) return;
  currentPage = page;
  renderSetor();
}