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
      // res.json() só pode falhar quando o corpo não é um JSON válido (timeout,
      // proxy no meio do caminho, etc.) — esse .catch() cobre só esse caso,
      // devolvendo null. Antes ele vinha encadeado DEPOIS do .then() de baixo,
      // então também capturava o "throw new Error(msg)" do caminho normal (com
      // a mensagem de verdade do backend) e substituía tudo pela genérica —
      // por isso toda mensagem de erro específica (ex.: "Quantidade maior que
      // o saldo disponível") nunca chegava a aparecer pro usuário.
      return res.json().catch(function() { return null; }).then(function(body) {
        // o backend manda o erro em { error: "..." } (ver errorHandler.js) —
        // "message" nunca existiu nessa resposta, por isso caía sempre no
        // fallback genérico "Erro 401" em vez de mostrar o motivo de verdade
        var msg = (body && body.error) ? body.error : mensagemGenericaPorStatus(res.status);
        throw new Error(msg);
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
    cadastro: false, // Professor não se autocadastra: a Diretoria concede o acesso (ou entra com Google e fica pendente)
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
   - .op-only         → abas "operacionais" (Painel, Gestão do Rebanho, Estoque de Ração).
                        Visíveis para todos os perfis, EXCETO Diretoria.
   - .admin-only      → abas "Relatórios" e "Controle de Acesso". Visíveis SOMENTE para Diretoria.
   - .professor-only  → aba "Minha Equipe". Visível SOMENTE para Professor.
   - Notas Fiscais não tem classe: fica visível para todo mundo, sempre.
   Resultado prático: a Diretoria só enxerga Notas Fiscais + Relatórios + Controle de Acesso
   (e lá só mexe em contas de Professor); o Professor ganha a aba extra "Minha Equipe",
   de onde ele cadastra e gerencia os próprios Alunos/Técnicos/Estagiários. */


/* =====================================================================
   2. CACHE LOCAL DE USUÁRIOS
   USERS guarda a última listagem de GET /users?role=PROFESSOR (tela
   Controle de Acesso, só Diretoria). EQUIPE guarda a última listagem de
   GET /users?professorId=... (tela Minha Equipe, só Professor). Os dois
   servem só pra achar o nome/e-mail de alguém na hora de montar a
   confirmação de "remover" — não são fonte de verdade de nada.
   ===================================================================== */
var USERS = [];
var EQUIPE = [];
var MINHA_UEPS = []; // UEPs que o Professor logado tem acesso (Minha Equipe)


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
/* uepsPreCarregadas (opcional): quando quem chamou já sabe quais UEPs
   mostrar (ver entrarNaSelecaoDeSetor), a grade é pintada direto com essa
   lista, sem bater em GET /ueps de novo — é assim que a tela só mostra as
   UEPs que o usuário logado (Professor) realmente tem acesso, em vez de
   todas as UEPs do sistema. Sem esse argumento, busca todas (uso da
   Diretoria, que enxerga tudo mesmo). */
function buildSetorGrid(uepsPreCarregadas) {
  var grid = document.getElementById('setorGrid');

  if (uepsPreCarregadas) {
    pintarGradeDeSetores(uepsPreCarregadas);
    return;
  }

  grid.innerHTML = '<p style="padding:1rem;color:#888">Carregando UEPs…</p>';
  apiFetch('/ueps').then(function(ueps) {
    pintarGradeDeSetores(ueps);
  }).catch(function(err) {
    grid.innerHTML = '<p style="padding:1rem;color:#c00">Erro ao carregar UEPs: ' + err.message + '</p>';
  });
}

function pintarGradeDeSetores(ueps) {
  var grid = document.getElementById('setorGrid');
  if (!ueps || ueps.length === 0) {
    grid.innerHTML = '<p style="padding:1rem;color:#888">Nenhuma UEP disponível pra você ainda. Fale com seu professor ou com a Diretoria.</p>';
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
}

/* Chamada logo depois de autenticar (login por senha, Google ou cadastro),
   em vez de "showAuth('auth-setor'); buildSetorGrid();" direto. Decide se
   pula a tela de seleção de setor:
   - Diretoria (ADMIN) sempre vê a tela cheia, com todas as UEPs — ela
     supervisiona tudo, então não faz sentido restringir.
   - Professor/equipe: busca em GET /users/me só as UEPs que essa pessoa
     tem acesso. Se for exatamente uma, entra direto nela sem mostrar
     seleção nenhuma. Se for mais de uma, mostra a tela só com essas.
     Se for zero, mostra a tela vazia (com aviso) — ainda não tem UEP. */
function entrarNaSelecaoDeSetor() {
  if (currentRole === 'diretoria') {
    showAuth('auth-setor');
    buildSetorGrid();
    return;
  }

  apiFetch('/users/me').then(function(me) {
    var ueps = me.ueps || [];
    if (ueps.length === 1) {
      selectSetor(ueps[0].id, ueps[0].nome);
      return;
    }
    showAuth('auth-setor');
    buildSetorGrid(ueps);
  }).catch(function() {
    // se /users/me falhar por algum motivo, cai no comportamento antigo
    // (mostra a tela de seleção com todas as UEPs) em vez de travar o login
    showAuth('auth-setor');
    buildSetorGrid();
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
    entrarNaSelecaoDeSetor();
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
    entrarNaSelecaoDeSetor();
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
    entrarNaSelecaoDeSetor();
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

/* Botão "trocar" no cabeçalho do app — volta pra tela de seleção de setor
   sem deslogar. Diferente do login, aqui é uma ação explícita da pessoa
   ("quero ver outra UEP"), então sempre mostra a tela — só restringe a
   lista às UEPs que ela realmente tem acesso (Diretoria continua vendo
   todas). */
function trocarSetor() {
  document.getElementById('userMenu').classList.remove('show');
  document.getElementById('app').classList.add('hidden');
  reveal(document.getElementById('authFlow'));
  showAuth('auth-setor');
  if (currentRole === 'diretoria') {
    buildSetorGrid();
  } else {
    apiFetch('/users/me').then(function(me) {
      buildSetorGrid(me.ueps || []);
    }).catch(function() {
      buildSetorGrid();
    });
  }
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
   Preenche Painel e Gestão do Rebanho com dados vindos da API
   (GET /ueps/:id/animais e /ueps/:id/animais/censo). Chamada sempre
   que o setor muda ou a página da tabela é trocada.
   A aba Estoque de Insumos tem sua própria função (renderEstoque, seção
   8B) porque ela não depende de paginação/filtro de animal — repintá-la
   a cada mudança de página da tabela de animais seria refetch à toa.
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

  }).catch(function(err) {
    document.getElementById('tabelaAnimais').innerHTML =
      '<tr><td colspan="6" style="color:#c00">Erro ao carregar dados: ' + err.message + '</td></tr>';
  });
}


/* =====================================================================
   8B. ESTOQUE DE INSUMOS E RAÇÃO (Sprint 10)
   Contrato esperado do backend (ver também o comentário acima da tela
   #estoque no index.html):

     GET    /ueps/:uepId/insumos
       -> [{ id, uep_id, nome, unidade, saldo_atual, estoque_minimo,
              consumo_medio_diario, created_at, updated_at }]

     POST   /ueps/:uepId/insumos
       body: { nome, unidade, saldoInicial, estoqueMinimo, consumoMedioDiario }
       -> 201 com o insumo criado (mesmo shape do GET). 400 se já existir
          insumo com esse nome nessa UEP. Se saldoInicial > 0, o backend
          também deve criar a movimentação ENTRADA correspondente (ver
          POST .../movimentacoes), pra não ter saldo sem histórico.

     GET    /ueps/:uepId/estoque/movimentacoes?tipo=ENTRADA|SAIDA&insumoId=#
       -> [{ id, insumo_id, insumo_nome, tipo, quantidade, unidade, data,
              responsavel, observacao, created_at }], mais recente primeiro.
          "responsavel" é o nome de quem registrou (join com users pelo
          created_by), nunca um texto livre vindo do cliente.

     POST   /ueps/:uepId/estoque/movimentacoes
       body: { insumoId, tipo (ENTRADA|SAIDA), quantidade (>0), data,
               observacao }
       -> 201 com a movimentação criada. O backend (numa transação) soma
          ou subtrai "quantidade" de insumos.saldo_atual, e rejeita com 400
          uma SAIDA maior que o saldo disponível. "responsavel" vem de
          req.user (igual created_by em animais), nunca do body.

   Todas as rotas exigem autenticação (authenticate) e a leitura é liberada
   a qualquer perfil com acesso à UEP; a escrita (POST) segue a mesma regra
   de permissão já usada em animais (allowWriteOrReadOnly — Aluno só lê).
   ===================================================================== */

/* Cache da última lista de insumos carregada pro setor atual — usada pra
   popular o <select> do modal de movimentação sem precisar buscar nada de
   novo ao abrir o modal (e pra achar o insumo clicado em "movimentar"). */
var INSUMOS_CACHE = [];

/* Um insumo está em alerta quando o saldo já está no mínimo cadastrado ou abaixo */
function insumoEmAlerta(insumo) {
  return Number(insumo.saldo_atual) <= Number(insumo.estoque_minimo);
}

/* Indicador "Comprar?" (Sprint 12): precisa comprar quando o saldo já está no
   mínimo ou abaixo, ou quando dura menos de 7 dias no ritmo de consumo atual.
   Calculado aqui mesmo, a partir dos dados que o estoque já carrega. */
var DIAS_ALERTA_COMPRA = 7;
function insumoPrecisaComprar(insumo) {
  if (insumoEmAlerta(insumo)) return true;
  var consumo = Number(insumo.consumo_medio_diario);
  return consumo > 0 && Number(insumo.saldo_atual) / consumo < DIAS_ALERTA_COMPRA;
}

/* Escapa texto vindo da API antes de colocar em innerHTML */
function escaparHtml(texto) {
  return String(texto == null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Previsão de duração do saldo atual, em dias inteiros, dado o consumo médio diário */
function previsaoDias(insumo) {
  var consumo = Number(insumo.consumo_medio_diario);
  if (!consumo || consumo <= 0) return '—';
  return Math.floor(Number(insumo.saldo_atual) / consumo) + ' dias';
}

/* dd/mm/aaaa a partir de uma data em formato ISO (yyyy-mm-dd ou timestamp) */
function formatarDataBR(data) {
  if (!data) return '—';
  var soData = String(data).slice(0, 10); // corta o resto do timestamp, se vier
  var partes = soData.split('-');
  if (partes.length !== 3) return soData;
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

/* yyyy-mm-dd de hoje, usado como valor padrão do campo de data do modal */
function hojeISO() {
  var d = new Date();
  var mes = String(d.getMonth() + 1).padStart(2, '0');
  var dia = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mes + '-' + dia;
}

/* Repinta KPIs, banner de alerta e a tabela "Saldo por insumo" da UEP
   atual — chamada por enterApp() (uma vez por troca de setor) e sempre
   que uma movimentação ou um novo insumo é confirmado. Também dispara
   renderMovimentacoes() ao final, pra manter as duas tabelas em sincronia. */
function renderEstoque() {
  var uepId = currentSetor;
  var tbody = document.getElementById('tabelaInsumos');
  tbody.innerHTML = '<tr><td colspan="8">Carregando…</td></tr>';

  apiFetch('/ueps/' + uepId + '/insumos').then(function(insumos) {
    INSUMOS_CACHE = insumos || [];
    var emAlerta = INSUMOS_CACHE.filter(insumoEmAlerta);

    document.getElementById('kpiInsumosTotal').textContent = INSUMOS_CACHE.length;
    document.getElementById('kpiInsumosAlerta').textContent = emAlerta.length;
    document.getElementById('kpiStatusGeral').textContent = emAlerta.length > 0 ? 'Alerta' : 'Normal';
    document.getElementById('kpiStatusIcon').classList.toggle('warn', emAlerta.length > 0);

    var banner = document.getElementById('estoqueAlertBanner');
    if (emAlerta.length > 0) {
      var nomes = emAlerta.map(function(i) { return i.nome; }).join(', ');
      document.getElementById('estoqueAlertTexto').textContent =
        ' ' + nomes + (emAlerta.length > 1 ? ' estão' : ' está') + ' no nível mínimo ou abaixo. Recomenda-se registrar entrada.';
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    var linhas = INSUMOS_CACHE.map(function(insumo) {
      var alerta = insumoEmAlerta(insumo);
      return '<tr>' +
          '<td class="brinco">' + escaparHtml(insumo.nome) + '</td>' +
          '<td>' + insumo.saldo_atual + ' ' + insumo.unidade + '</td>' +
          '<td>' + insumo.estoque_minimo + ' ' + insumo.unidade + '</td>' +
          '<td>' + insumo.consumo_medio_diario + ' ' + insumo.unidade + '/dia</td>' +
          '<td>' + previsaoDias(insumo) + '</td>' +
          '<td><span class="tag ' + (alerta ? 'critico' : 'ok') + '">' + (alerta ? 'Crítico' : 'Normal') + '</span></td>' +
          '<td>' + (insumoPrecisaComprar(insumo)
            ? '<span class="tag critico">Comprar</span>'
            : '<span class="tag ok">Não precisa</span>') + '</td>' +
          '<td><span class="link-ver" onclick="abrirModalMovimentacao(' + insumo.id + ')">movimentar</span></td>' +
        '</tr>';
    }).join('');
    tbody.innerHTML = linhas || '<tr><td colspan="8">Nenhum insumo cadastrado nesta UEP ainda.</td></tr>';

    var filtroAtual = document.getElementById('filtroInsumoMov').value;
    var opcoesInsumo = '<option value="">Insumo</option>';
    INSUMOS_CACHE.forEach(function(insumo) {
      opcoesInsumo += '<option value="' + insumo.id + '"' + (String(insumo.id) === filtroAtual ? ' selected' : '') + '>' + escaparHtml(insumo.nome) + '</option>';
    });
    document.getElementById('filtroInsumoMov').innerHTML = opcoesInsumo;

    renderMovimentacoes();
  }).catch(function(err) {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#c00">Erro ao carregar insumos: ' + escaparHtml(err.message) + '</td></tr>';
  });
}

/* Repinta só a tabela de histórico, com os filtros de tipo/insumo
   aplicados via query string — GET /ueps/:uepId/estoque/movimentacoes */
function renderMovimentacoes() {
  var uepId = currentSetor;
  var tbody = document.getElementById('tabelaEstoque');
  var filtroTipo = document.getElementById('filtroTipoMov').value;
  var filtroInsumo = document.getElementById('filtroInsumoMov').value;

  var qs = '';
  if (filtroTipo)   qs += (qs ? '&' : '?') + 'tipo=' + filtroTipo;
  if (filtroInsumo) qs += (qs ? '&' : '?') + 'insumoId=' + filtroInsumo;

  tbody.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';

  apiFetch('/ueps/' + uepId + '/estoque/movimentacoes' + qs).then(function(movimentacoes) {
    document.getElementById('kpiMovimentacoes').textContent = (movimentacoes || []).length;

    var linhas = (movimentacoes || []).map(function(m) {
      var tipoClasse = m.tipo === 'ENTRADA' ? 'entrada' : 'saida';
      var tipoLabel  = m.tipo === 'ENTRADA' ? 'Entrada' : 'Saída';
      return '<tr>' +
          '<td>' + formatarDataBR(m.data) + '</td>' +
          '<td><span class="tag ' + tipoClasse + '">' + tipoLabel + '</span></td>' +
          '<td>' + (m.insumo_nome || '—') + '</td>' +
          '<td>' + m.quantidade + ' ' + (m.unidade || '') + '</td>' +
          '<td>' + (m.responsavel || '—') + '</td>' +
          '<td>' + (m.observacao || '—') + '</td>' +
        '</tr>';
    }).join('');
    tbody.innerHTML = linhas || '<tr><td colspan="6">Nenhuma movimentação encontrada.</td></tr>';
  }).catch(function(err) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#c00">Erro ao carregar histórico: ' + err.message + '</td></tr>';
  });
}

/* ---------- Modal: Registrar Entrada/Saída ---------- */

/* Guarda o que estava com foco antes de abrir um dos dois modais desta
   seção, pra devolver o foco pra lá quando fechar (mesmo padrão do
   elementoAntesDoModal usado pelo modalAnimal, seção 12). */
var elementoAntesDoModalEstoque = null;

/* Abre o modal de movimentação. Se insumoId for informado (clique em
   "movimentar" na tabela de saldo), esse insumo já vem pré-selecionado. */
function abrirModalMovimentacao(insumoId) {
  if (!INSUMOS_CACHE.length) {
    alert('Cadastre um insumo antes de registrar uma movimentação.');
    return;
  }

  elementoAntesDoModalEstoque = document.activeElement;
  hideFormError('movError');
  document.getElementById('formMovimentacao').reset();

  var opcoes = INSUMOS_CACHE.map(function(insumo) {
    return '<option value="' + insumo.id + '">' + insumo.nome + '</option>';
  }).join('');
  document.getElementById('movInsumo').innerHTML = opcoes;
  if (insumoId != null) document.getElementById('movInsumo').value = insumoId;

  document.getElementById('movData').value = hojeISO();
  atualizarUnidadeMovimentacao();

  document.getElementById('modalMovimentacao').style.display = 'flex';
  document.getElementById('movTipo').focus();
}

/* Atualiza o rótulo "QUANTIDADE (kg)" / "(L)" / etc. conforme o insumo
   selecionado — chamado pelo onchange do próprio <select> de insumo. */
function atualizarUnidadeMovimentacao() {
  var insumo = INSUMOS_CACHE.find(function(i) { return String(i.id) === document.getElementById('movInsumo').value; });
  document.getElementById('movUnidadeLabel').textContent = insumo ? '(' + insumo.unidade + ')' : '';
}

function fecharModalMovimentacao() {
  document.getElementById('modalMovimentacao').style.display = 'none';
  if (elementoAntesDoModalEstoque && typeof elementoAntesDoModalEstoque.focus === 'function') {
    elementoAntesDoModalEstoque.focus();
  }
  elementoAntesDoModalEstoque = null;
}

/* onsubmit do #formMovimentacao — POST /ueps/:uepId/estoque/movimentacoes.
   "responsavel" não é enviado: quem registrou vem do token no backend,
   igual createdBy em animais (ver comentário da seção 8B). */
function confirmarMovimentacao() {
  var btn = document.getElementById('btnSalvarMovimentacao');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  var payload = {
    insumoId: Number(document.getElementById('movInsumo').value),
    tipo: document.getElementById('movTipo').value,
    quantidade: parseFloat(document.getElementById('movQuantidade').value),
    data: document.getElementById('movData').value,
    observacao: document.getElementById('movObs').value.trim() || null
  };

  apiFetch('/ueps/' + currentSetor + '/estoque/movimentacoes', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(function() {
    fecharModalMovimentacao();
    renderEstoque();
    mostrarToast('Movimentação registrada com sucesso.');
  }).catch(function(err) {
    showFormError('movError', err.message);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = 'Confirmar movimentação';
  });
}

/* ---------- Modal: Cadastrar novo insumo ---------- */

function abrirModalInsumo() {
  elementoAntesDoModalEstoque = document.activeElement;
  hideFormError('insumoError');
  document.getElementById('formInsumo').reset();
  document.getElementById('modalInsumo').style.display = 'flex';
  document.getElementById('insNome').focus();
}

function fecharModalInsumo() {
  document.getElementById('modalInsumo').style.display = 'none';
  if (elementoAntesDoModalEstoque && typeof elementoAntesDoModalEstoque.focus === 'function') {
    elementoAntesDoModalEstoque.focus();
  }
  elementoAntesDoModalEstoque = null;
}

/* onsubmit do #formInsumo — POST /ueps/:uepId/insumos */
function confirmarInsumo() {
  var btn = document.getElementById('btnSalvarInsumo');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  var payload = {
    nome: document.getElementById('insNome').value.trim(),
    unidade: document.getElementById('insUnidade').value,
    saldoInicial: parseFloat(document.getElementById('insSaldoInicial').value) || 0,
    estoqueMinimo: parseFloat(document.getElementById('insMinimo').value) || 0,
    consumoMedioDiario: parseFloat(document.getElementById('insConsumo').value) || 0
  };

  apiFetch('/ueps/' + currentSetor + '/insumos', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(function() {
    fecharModalInsumo();
    renderEstoque();
    mostrarToast('Insumo cadastrado com sucesso.');
  }).catch(function(err) {
    showFormError('insumoError', err.message);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = 'Cadastrar insumo';
  });
}

/* Fecha ao clicar fora (no overlay escuro) e com Esc — mesmo padrão do
   modalAnimal (seção 12), só que cobrindo os dois modais desta seção. */
document.addEventListener('click', function(e) {
  if (e.target === document.getElementById('modalMovimentacao')) fecharModalMovimentacao();
  if (e.target === document.getElementById('modalInsumo')) fecharModalInsumo();
});

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('modalMovimentacao').style.display === 'flex') fecharModalMovimentacao();
  if (document.getElementById('modalInsumo').style.display === 'flex') fecharModalInsumo();
});


/* =====================================================================
   8D. RELATÓRIOS DO GESTOR (Sprint 13) — aba exclusiva da Diretoria
   Painel com um cartão por relatório e um botão de exportação em PDF. O
   frontend só pede o arquivo e entrega o download; quem monta o PDF é o
   backend. Contrato esperado:

     POST /relatorios/:tipo/gerar          (JWT; somente perfil ADMIN)
       :tipo  = 'censo-geral' | 'status-reprodutivo' | 'movimentacao-estoque'
       corpo  = {
                  formato:    'pdf',                   // sempre enviado (hoje só existe PDF)
                  uepId:      number,                  // opcional: sem ele = todas as UEPs
                  dataInicio: 'yyyy-mm-dd',            // só em relatórios que usam período
                  dataFim:    'yyyy-mm-dd'             //   (movimentacao-estoque)
                }
       200    = o ARQUIVO PDF (corpo binário), com
                  Content-Type: application/pdf
                  Content-Disposition: attachment; filename="relatorio-censo-geral-2026-10-20.pdf"
                (como o front roda em outra origem, o backend precisa expor esse header:
                 Access-Control-Expose-Headers: Content-Disposition. Sem ele o front
                 ainda funciona e usa um nome de arquivo padrão.)
       erros  = JSON { error: "mensagem" } com 400 (tipo/formato/datas inválidos),
                401/403 (sem permissão) ou 404 (UEP não encontrada).

   Para criar um relatório novo, basta incluir um item em RELATORIOS_TIPOS.
   (Para voltar a oferecer Excel: acrescente 'xlsx' em RELATORIO_FORMATOS.)
   ===================================================================== */

/* tipo (vai na URL) · usaPeriodo: se o backend deve receber dataInicio/dataFim */
var RELATORIOS_TIPOS = [
  { tipo: 'censo-geral',          titulo: 'Censo geral',             usaPeriodo: false, icone: 'doc',
    descricao: 'Distribuição por categoria, raça e disponibilidade.' },
  { tipo: 'status-reprodutivo',   titulo: 'Status reprodutivo',      usaPeriodo: false, icone: 'doc',
    descricao: 'Fase reprodutiva de cada animal, agrupado por categoria.' },
  { tipo: 'movimentacao-estoque', titulo: 'Movimentação de estoque', usaPeriodo: true,  icone: 'estoque',
    descricao: 'Entradas e saídas de ração e insumos no período.' }
];

var RELATORIO_FORMATOS = {
  pdf: { rotulo: 'PDF', ext: 'pdf' }
};

/* ícone de "baixar" que vai dentro dos botões PDF / Excel */
var RELATORIO_ICONE_DOWNLOAD = '<svg class="icon" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';

var RELATORIO_ICONES = {
  doc:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  estoque: '<path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/>'
};

/* Desenha os cartões e preenche o filtro de setor. Chamada em enterApp() (Diretoria). */
function renderRelatorios() {
  document.getElementById('relatoriosGrid').innerHTML = RELATORIOS_TIPOS.map(function(r) {
    var botoes = Object.keys(RELATORIO_FORMATOS).map(function(formato, i) {
      return '<button type="button" class="btn' + (i === 0 ? '' : ' outline') + '" ' +
             'onclick="baixarRelatorio(\'' + r.tipo + '\', \'' + formato + '\', this)">' +
             RELATORIO_ICONE_DOWNLOAD + 'Baixar ' + RELATORIO_FORMATOS[formato].rotulo + '</button>';
    }).join('');
    return '<div class="report-card">' +
        '<div class="r-icon"><svg class="icon" viewBox="0 0 24 24">' + RELATORIO_ICONES[r.icone] + '</svg></div>' +
        '<h3>' + r.titulo + '</h3>' +
        '<p>' + r.descricao + '</p>' +
        '<p class="r-nota">' + (r.usaPeriodo ? 'Respeita o período selecionado.' : 'Retrato atual (não depende do período).') + '</p>' +
        '<div class="report-actions">' + botoes + '</div>' +
      '</div>';
  }).join('');

  // botões "+ relatório" da seção Unir PDFs (mesma lista de relatórios dos cartões)
  document.getElementById('uniaoRelatorios').innerHTML = RELATORIOS_TIPOS.map(function(r) {
    return '<button type="button" class="btn outline" style="padding:8px 16px;font-size:13px;" onclick="adicionarRelatorioNaUniao(\'' + r.tipo + '\')">+ ' + r.titulo + '</button>';
  }).join('');

  apiFetch('/ueps').then(function(ueps) {
    var select = document.getElementById('relSetor');
    var atual = select.value;
    select.innerHTML = '<option value="">Todos os setores</option>' + (ueps || []).map(function(u) {
      return '<option value="' + u.id + '"' + (String(u.id) === atual ? ' selected' : '') + '>' + escaparHtml(u.nome) + '</option>';
    }).join('');
  }).catch(function() { /* sem a lista, o filtro fica só em "Todos os setores" */ });
}

/* yyyy-mm-dd no horário local (toISOString usaria UTC e podia "virar o dia") */
function dataLocalISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* Mostra os dois campos de data só no período "Personalizado" (já preenchidos com os últimos 30 dias) */
function atualizarPeriodoPersonalizado() {
  var personalizado = document.getElementById('relPeriodo').value === 'personalizado';
  document.getElementById('relPeriodoPersonalizado').style.display = personalizado ? 'inline-flex' : 'none';
  if (personalizado && !document.getElementById('relDataFim').value) {
    var hoje = new Date();
    var inicio = new Date(); inicio.setDate(inicio.getDate() - 30);
    document.getElementById('relDataInicio').value = dataLocalISO(inicio);
    document.getElementById('relDataFim').value = dataLocalISO(hoje);
  }
}

/* { dataInicio, dataFim } do filtro de período, ou { erro } se estiver inválido */
function periodoSelecionado() {
  var valor = document.getElementById('relPeriodo').value;
  if (valor === 'personalizado') {
    var ini = document.getElementById('relDataInicio').value;
    var fim = document.getElementById('relDataFim').value;
    if (!ini || !fim) return { erro: 'Informe a data inicial e a data final do período.' };
    if (ini > fim) return { erro: 'A data inicial não pode ser depois da data final.' };
    return { dataInicio: ini, dataFim: fim };
  }
  var hoje = new Date();
  var inicio = new Date(); inicio.setDate(inicio.getDate() - Number(valor));
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
}

function mostrarErroRelatorio(mensagem) {
  document.getElementById('relatoriosErroTexto').textContent = ' ' + mensagem;
  document.getElementById('relatoriosErro').classList.remove('hidden');
}
function esconderErroRelatorio() {
  document.getElementById('relatoriosErro').classList.add('hidden');
}

/* Extrai o nome do arquivo do header Content-Disposition (ou null) */
function nomeArquivoDoHeader(header) {
  if (!header) return null;
  var m = /filename\*=UTF-8''([^;]+)/i.exec(header) || /filename="?([^";]+)"?/i.exec(header);
  if (!m) return null;
  var nome = m[1];
  try { nome = decodeURIComponent(nome); } catch (e) { /* mantém como veio */ }
  return nome.replace(/[\\\/:*?"<>|]/g, '_'); // nunca deixa o servidor escolher uma pasta
}

/* Dispara o download de um Blob no navegador */
function salvarArquivo(blob, nome) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

/* Botões PDF / Excel de cada cartão — pede o arquivo ao backend e baixa */
function baixarRelatorio(tipo, formato, botao) {
  var def = RELATORIOS_TIPOS.filter(function(r) { return r.tipo === tipo; })[0];
  var fmt = RELATORIO_FORMATOS[formato];
  if (!def || !fmt) return;

  esconderErroRelatorio();
  var corpo = { formato: formato };
  var uepId = document.getElementById('relSetor').value;
  if (uepId) corpo.uepId = Number(uepId);
  if (def.usaPeriodo) {
    var periodo = periodoSelecionado();
    if (periodo.erro) { mostrarErroRelatorio(periodo.erro); return; }
    corpo.dataInicio = periodo.dataInicio;
    corpo.dataFim = periodo.dataFim;
  }

  var rotulo = botao.innerHTML; // innerHTML: preserva o ícone do botão
  botao.disabled = true;
  botao.textContent = 'Gerando…';

  var headers = { 'Content-Type': 'application/json' };
  if (getToken()) headers['Authorization'] = 'Bearer ' + getToken();

  // fetch direto (e não apiFetch): a resposta aqui é um arquivo, não JSON
  fetch(API_BASE + '/relatorios/' + tipo + '/gerar', { method: 'POST', headers: headers, body: JSON.stringify(corpo) })
    .then(function(res) {
      if (!res.ok) {
        return res.json().catch(function() { return null; }).then(function(body) {
          throw new Error((body && body.error) ? body.error : mensagemGenericaPorStatus(res.status));
        });
      }
      return res.blob().then(function(blob) {
        if (!blob.size) throw new Error('O servidor devolveu um arquivo vazio.');
        var nome = nomeArquivoDoHeader(res.headers.get('Content-Disposition')) ||
                   ('relatorio-' + tipo + '-' + dataLocalISO(new Date()) + '.' + fmt.ext);
        salvarArquivo(blob, nome);
        mostrarToast('Relatório gerado: ' + nome);
      });
    })
    .catch(function(err) {
      // TypeError = o fetch nem chegou no servidor (API fora do ar, sem rede, CORS)
      mostrarErroRelatorio(err instanceof TypeError ? 'Não foi possível falar com o servidor. Tente de novo em instantes.' : err.message);
    })
    .then(function() {
      botao.disabled = false;
      botao.innerHTML = rotulo;
    });
}


/* =====================================================================
   8E. DOCUMENTOS DOS PROFESSORES + UNIÃO DE PDFs (Sprint 13)
   - Professor e Diretoria (aba Notas Fiscais): enviam PDFs (notas fiscais e
     outros) e veem / removem os próprios envios. Os PDFs que a Diretoria
     adiciona ficam no mesmo repositório dos enviados pelos professores.
   - Diretoria: vê tudo o que foi enviado (aba Notas Fiscais) e, na aba
     Relatórios, escolhe quais PDFs juntar, define a ordem e baixa o PDF
     unido. Entram na junção: documentos já enviados, PDFs que a Diretoria
     adiciona do computador (sobem como documentos) e relatórios gerados na
     hora. A junção é feita pelo BACKEND: o front só manda a lista de itens
     na ordem escolhida e baixa o PDF unido.

   Contrato esperado do backend (todas as rotas com JWT):

     POST   /documentos            multipart/form-data  (PROFESSOR e ADMIN)
              arquivo   = o PDF (campo de arquivo; só application/pdf, até 10 MB)
              tipo      = 'NOTA_FISCAL' | 'OUTRO'
              descricao = texto opcional (até 120 caracteres)
              uepId     = opcional: UEP em que o professor estava ao enviar
            201 -> o documento criado (formato abaixo)

     GET    /documentos            ADMIN: todos | PROFESSOR: só os próprios
            200 -> [ documento, ... ]   (mais recentes primeiro; também aceito { data: [...] })
              documento = { id, nome_original, tipo, descricao, tamanho_bytes,
                            uep_id, uep_nome, enviado_por, enviado_por_nome, created_at }

     GET    /documentos/:id/arquivo   ADMIN: qualquer um | PROFESSOR: só o próprio
            200 -> o PDF (binário, Content-Type: application/pdf)

     DELETE /documentos/:id        PROFESSOR: só o próprio | ADMIN: qualquer um
            204 sem corpo

     POST   /documentos/unir       somente ADMIN — junta vários PDFs em um
            corpo = { itens: [                       // a ORDEM do array é a ordem das páginas; mínimo 2
                      { origem: 'documento', id: 3 },                    // PDF já guardado no sistema
                      { origem: 'relatorio', relatorio: 'censo-geral',   // relatório gerado na hora, com os
                        uepId: 1, dataInicio: 'yyyy-mm-dd', dataFim: 'yyyy-mm-dd' }  // mesmos parâmetros de POST /relatorios/:tipo/gerar
                    ] }                              // (uepId/dataInicio/dataFim são opcionais, como lá)
            200 -> o PDF unido (binário, Content-Type: application/pdf,
                   Content-Disposition: attachment; filename="uniao-documentos-2026-10-20.pdf";
                   precisa de Access-Control-Expose-Headers: Content-Disposition)
            400 -> menos de 2 itens / item inválido / algum arquivo não é um PDF legível
            404 -> algum documento (id) não existe

     Erros: JSON { error: "mensagem" } — 400 (arquivo ausente / não é PDF / grande demais),
            401/403 (sem permissão), 404 (documento não encontrado).
   ===================================================================== */

var DOCUMENTOS_CACHE = [];
var DOCUMENTO_MAX_MB = 10;
var DOCUMENTO_TIPOS = { NOTA_FISCAL: 'Nota fiscal', OUTRO: 'Outro PDF' };
var documentosRequisicaoAtual = 0;

/* PDFs escolhidos para a junção, NA ORDEM em que vão aparecer no arquivo final.
   item = { origem: 'documento', id, nome }
        | { origem: 'relatorio', relatorio, nome, detalhe, uepId?, dataInicio?, dataFim? } */
var UNIR_SELECAO = [];

/* ---------- helpers ---------- */

function cabecalhoAuth() {
  var h = {};
  if (getToken()) h['Authorization'] = 'Bearer ' + getToken();
  return h;
}

/* Para respostas de erro de rotas que não passam pelo apiFetch (upload e download de arquivo) */
function rejeitarComErroDaResposta(res) {
  return res.json().catch(function() { return null; }).then(function(body) {
    throw new Error((body && body.error) ? body.error : mensagemGenericaPorStatus(res.status));
  });
}

/* TypeError = o fetch nem chegou no servidor (API fora do ar, sem rede, CORS) */
function mensagemDeErro(err) {
  return err instanceof TypeError ? 'Não foi possível falar com o servidor. Tente de novo em instantes.' : err.message;
}

function ehArquivoPdf(arquivo) {
  return arquivo.type === 'application/pdf' || /\.pdf$/i.test(arquivo.name);
}

function formatarTamanho(bytes) {
  var n = Number(bytes);
  if (!n) return '';
  if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
  return (n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
}

/* Cada pessoa só remove o que ela mesma enviou (o backend também confere isso) */
function souDonoDoDocumento(d) {
  return !!(currentUser && d.enviado_por != null && Number(d.enviado_por) === Number(currentUser.id));
}

function tituloDocumento(d) {
  return d.descricao || d.nome_original || ('Documento ' + d.id);
}

function mostrarErroDocumentos(titulo, mensagem) {
  document.getElementById('documentosErroTitulo').textContent = titulo;
  document.getElementById('documentosErroTexto').textContent = ' ' + mensagem;
  document.getElementById('documentosErro').classList.remove('hidden');
}
function esconderErroDocumentos() { document.getElementById('documentosErro').classList.add('hidden'); }

function mostrarErroUniao(mensagem) {
  document.getElementById('uniaoErroTexto').textContent = ' ' + mensagem;
  document.getElementById('uniaoErro').classList.remove('hidden');
}
function esconderErroUniao() { document.getElementById('uniaoErro').classList.add('hidden'); }

/* ---------- lista de documentos (aba Notas Fiscais) ---------- */

/* Busca os documentos e repinta tudo que depende deles. Chamada ao entrar no app,
   ao abrir as abas Notas Fiscais / Relatórios e depois de enviar ou remover. */
function renderDocumentos() {
  var ehDiretoria = currentRole === 'diretoria';
  var ehProfessor = currentRole === 'professor';
  var lista = document.getElementById('listaDocumentos');

  document.getElementById('notasSubtitulo').textContent = ehDiretoria
    ? 'Notas fiscais e PDFs enviados pelos professores e por você'
    : (ehProfessor ? 'Envie notas fiscais e outros PDFs para a Diretoria' : 'Documentos enviados à Diretoria');
  document.getElementById('documentosTitulo').textContent = ehDiretoria ? 'Todos os documentos' : 'Meus envios';
  document.getElementById('envioTitulo').textContent = ehDiretoria ? 'Adicionar nota fiscal ou PDF' : 'Enviar para a Diretoria';
  document.getElementById('blocoEnvioDoc').classList.toggle('hidden', !ehDiretoria && !ehProfessor);

  if (!ehDiretoria && !ehProfessor) {
    lista.innerHTML = '<div class="nf-row"><span style="color:var(--gray-text);">Somente professores enviam documentos à Diretoria.</span></div>';
    return;
  }

  var requisicao = ++documentosRequisicaoAtual;
  apiFetch('/documentos').then(function(resp) {
    if (requisicao !== documentosRequisicaoAtual) return; // resposta atrasada, já tem uma mais nova
    DOCUMENTOS_CACHE = Array.isArray(resp) ? resp : ((resp && resp.data) || []);
    // se um professor removeu um documento que estava marcado, tira da seleção
    UNIR_SELECAO = UNIR_SELECAO.filter(function(item) {
      return item.origem === 'relatorio' || DOCUMENTOS_CACHE.some(function(d) { return Number(d.id) === item.id; });
    });
    renderListaDocumentos();
    if (ehDiretoria) { renderTabelaUniao(); renderOrdemUniao(); }
  }).catch(function(err) {
    if (requisicao !== documentosRequisicaoAtual) return;
    var linha = '<div class="nf-row"><span style="color:#c00">Erro ao carregar documentos: ' + escaparHtml(err.message) + '</span></div>';
    lista.innerHTML = linha;
    if (ehDiretoria) document.getElementById('tabelaUniao').innerHTML =
      '<tr><td colspan="6" style="color:#c00">Erro ao carregar documentos: ' + escaparHtml(err.message) + '</td></tr>';
  });
}

function renderListaDocumentos() {
  var ehDiretoria = currentRole === 'diretoria';
  var lista = document.getElementById('listaDocumentos');
  if (!DOCUMENTOS_CACHE.length) {
    lista.innerHTML = '<div class="nf-row"><span style="color:var(--gray-text);">' +
      (ehDiretoria ? 'Nenhum documento por aqui ainda.' : 'Você ainda não enviou nenhum documento.') + '</span></div>';
    return;
  }
  lista.innerHTML = DOCUMENTOS_CACHE.map(function(d) {
    var id = Number(d.id);
    var partes = [DOCUMENTO_TIPOS[d.tipo] || 'PDF'];
    if (ehDiretoria && d.enviado_por_nome) partes.push(souDonoDoDocumento(d) ? 'enviado por você' : 'enviado por ' + d.enviado_por_nome);
    if (d.uep_nome) partes.push(d.uep_nome);
    partes.push(formatarDataBR(d.created_at));
    if (d.tamanho_bytes) partes.push(formatarTamanho(d.tamanho_bytes));
    return '<div class="nf-row">' +
        '<span><b>' + escaparHtml(tituloDocumento(d)) + '</b><br><span class="meta">' + escaparHtml(partes.join(' · ')) + '</span></span>' +
        '<span style="display:flex;gap:16px;align-items:center;flex:none;">' +
          '<span class="link-ver" onclick="abrirDocumento(' + id + ')">Abrir</span>' +
          (souDonoDoDocumento(d) ? '<span class="link-ver" style="color:var(--if-red);" onclick="removerDocumento(' + id + ')">Remover</span>' : '') +
        '</span>' +
      '</div>';
  }).join('');
}

/* ---------- envio (Professor) ---------- */

/* onsubmit do formulário "Enviar à Diretoria" — POST /documentos (multipart) */
function enviarDocumento(e) {
  e.preventDefault();
  esconderErroDocumentos();
  var arquivo = document.getElementById('docArquivo').files[0];
  if (!arquivo) { mostrarErroDocumentos('Escolha um arquivo', 'Selecione o PDF que você quer enviar.'); return; }
  if (!ehArquivoPdf(arquivo)) { mostrarErroDocumentos('Arquivo inválido', 'Só é possível enviar arquivos PDF.'); return; }
  if (arquivo.size > DOCUMENTO_MAX_MB * 1048576) {
    mostrarErroDocumentos('Arquivo grande demais', 'O limite é de ' + DOCUMENTO_MAX_MB + ' MB por arquivo.');
    return;
  }

  var dados = new FormData();
  dados.append('arquivo', arquivo);
  dados.append('tipo', document.getElementById('docTipo').value);
  var descricao = document.getElementById('docDescricao').value.trim();
  if (descricao) dados.append('descricao', descricao);
  if (currentSetor) dados.append('uepId', currentSetor);

  var botao = document.getElementById('btnEnviarDoc');
  var rotulo = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Enviando…';

  // fetch direto (e não apiFetch): o corpo é multipart, e o navegador precisa
  // definir o Content-Type sozinho (com o "boundary") — não podemos forçar JSON
  fetch(API_BASE + '/documentos', { method: 'POST', headers: cabecalhoAuth(), body: dados })
    .then(function(res) {
      if (!res.ok) return rejeitarComErroDaResposta(res);
      document.getElementById('docArquivo').value = '';
      document.getElementById('docDescricao').value = '';
      mostrarToast(currentRole === 'diretoria' ? 'Documento adicionado' : 'Documento enviado à Diretoria');
      renderDocumentos();
    })
    .catch(function(err) { mostrarErroDocumentos('Não foi possível enviar', mensagemDeErro(err)); })
    .then(function() { botao.disabled = false; botao.textContent = rotulo; });
}

/* "Remover" na lista do Professor — DELETE /documentos/:id */
function removerDocumento(id) {
  var doc = DOCUMENTOS_CACHE.filter(function(d) { return Number(d.id) === id; })[0];
  if (!doc || !window.confirm('Remover "' + tituloDocumento(doc) + '"? A Diretoria não verá mais este documento.')) return;
  esconderErroDocumentos();
  apiFetch('/documentos/' + id, { method: 'DELETE' }).then(function() {
    mostrarToast('Documento removido');
    renderDocumentos();
  }).catch(function(err) { mostrarErroDocumentos('Não foi possível remover', mensagemDeErro(err)); });
}

/* "Abrir": baixa o PDF com o token (um link direto não levaria o JWT) e abre numa aba nova */
function abrirDocumento(id) {
  var doc = DOCUMENTOS_CACHE.filter(function(d) { return Number(d.id) === id; })[0];
  var aba = window.open('', '_blank'); // abre já, no clique, para o bloqueador de pop-up não barrar
  fetch(API_BASE + '/documentos/' + id + '/arquivo', { headers: cabecalhoAuth() })
    .then(function(res) { return res.ok ? res.blob() : rejeitarComErroDaResposta(res); })
    .then(function(blob) {
      var pdf = new Blob([blob], { type: 'application/pdf' });
      var url = URL.createObjectURL(pdf);
      if (aba) aba.location = url; else salvarArquivo(pdf, (doc && doc.nome_original) || ('documento-' + id + '.pdf'));
      setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
    })
    .catch(function(err) {
      if (aba) aba.close();
      var msg = mensagemDeErro(err);
      if (currentRole === 'diretoria' && document.getElementById('relatorios').classList.contains('active')) mostrarErroUniao(msg);
      else mostrarErroDocumentos('Não foi possível abrir o documento', msg);
    });
}

/* ---------- união de PDFs (Diretoria, aba Relatórios) ---------- */

function renderTabelaUniao() {
  var tipo = document.getElementById('uniaoFiltroTipo').value;
  var docs = DOCUMENTOS_CACHE.filter(function(d) { return !tipo || d.tipo === tipo; });
  var tbody = document.getElementById('tabelaUniao');
  if (!docs.length) {
    tbody.innerHTML = '<tr><td colspan="6">' + (DOCUMENTOS_CACHE.length ? 'Nenhum documento deste tipo.' : 'Nenhum documento por aqui ainda.') + '</td></tr>';
    return;
  }
  tbody.innerHTML = docs.map(function(d) {
    var id = Number(d.id);
    var marcado = UNIR_SELECAO.some(function(i) { return i.origem === 'documento' && i.id === id; });
    var detalhe = [DOCUMENTO_TIPOS[d.tipo] || 'PDF'];
    if (d.tamanho_bytes) detalhe.push(formatarTamanho(d.tamanho_bytes));
    return '<tr>' +
        '<td><input type="checkbox" ' + (marcado ? 'checked ' : '') + 'onchange="alternarSelecaoUniao(' + id + ', this.checked)" aria-label="Selecionar para unir" style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer;"></td>' +
        '<td class="brinco">' + escaparHtml(tituloDocumento(d)) + '<br><span style="font-weight:400;font-size:12px;color:var(--gray-text);">' + escaparHtml(detalhe.join(' · ')) + '</span></td>' +
        '<td>' + escaparHtml(souDonoDoDocumento(d) ? 'Você' : (d.enviado_por_nome || '—')) + '</td>' +
        '<td>' + escaparHtml(d.uep_nome || '—') + '</td>' +
        '<td>' + formatarDataBR(d.created_at) + '</td>' +
        '<td><span class="link-ver" onclick="abrirDocumento(' + id + ')">Abrir</span></td>' +
      '</tr>';
  }).join('');
}

/* Marcar / desmarcar um documento recebido: entra no fim da fila (ou sai dela) */
function alternarSelecaoUniao(id, marcado) {
  esconderErroUniao();
  UNIR_SELECAO = UNIR_SELECAO.filter(function(i) { return !(i.origem === 'documento' && i.id === id); });
  if (marcado) {
    var doc = DOCUMENTOS_CACHE.filter(function(d) { return Number(d.id) === id; })[0];
    if (doc) UNIR_SELECAO.push({ origem: 'documento', id: id, nome: tituloDocumento(doc) });
  }
  renderOrdemUniao();
}

/* Botões "+ Censo geral", "+ Status reprodutivo"...: entram na fila como um relatório que o
   backend gera na hora (com o setor e o período escolhidos nos filtros do topo da tela) */
function adicionarRelatorioNaUniao(tipo) {
  esconderErroUniao();
  var def = RELATORIOS_TIPOS.filter(function(r) { return r.tipo === tipo; })[0];
  if (!def) return;
  var select = document.getElementById('relSetor');
  var item = { origem: 'relatorio', relatorio: tipo, nome: 'Relatório: ' + def.titulo };
  var detalhe = [select.value ? select.options[select.selectedIndex].text : 'todos os setores'];
  if (select.value) item.uepId = Number(select.value);
  if (def.usaPeriodo) {
    var periodo = periodoSelecionado();
    if (periodo.erro) { mostrarErroUniao(periodo.erro); return; }
    item.dataInicio = periodo.dataInicio;
    item.dataFim = periodo.dataFim;
    detalhe.push(formatarDataBR(periodo.dataInicio) + ' a ' + formatarDataBR(periodo.dataFim));
  }
  item.detalhe = detalhe.join(' · ');
  UNIR_SELECAO.push(item);
  renderOrdemUniao();
}

/* "+ Adicionar PDF do computador": cada PDF sobe para o sistema (POST /documentos, como "Outro PDF")
   e já entra na fila da junção — assim o backend consegue juntá-lo e ele fica guardado para depois */
function adicionarPdfsLocais(input) {
  esconderErroUniao();
  var arquivos = Array.prototype.slice.call(input.files);
  input.value = ''; // permite escolher o mesmo arquivo de novo depois
  if (!arquivos.length) return;

  var problemas = [];
  var validos = arquivos.filter(function(a) {
    if (!ehArquivoPdf(a)) { problemas.push(a.name + ' (não é PDF)'); return false; }
    if (a.size > DOCUMENTO_MAX_MB * 1048576) { problemas.push(a.name + ' (maior que ' + DOCUMENTO_MAX_MB + ' MB)'); return false; }
    return true;
  });

  var botao = document.getElementById('btnAddPdfLocal');
  var rotulo = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Enviando…';

  // um por vez, em fila
  validos.reduce(function(fila, arquivo) {
    return fila.then(function() {
      var dados = new FormData();
      dados.append('arquivo', arquivo);
      dados.append('tipo', 'OUTRO');
      if (currentSetor) dados.append('uepId', currentSetor);
      return fetch(API_BASE + '/documentos', { method: 'POST', headers: cabecalhoAuth(), body: dados })
        .then(function(res) { return res.ok ? res.json() : rejeitarComErroDaResposta(res); })
        .then(function(doc) { UNIR_SELECAO.push({ origem: 'documento', id: Number(doc.id), nome: arquivo.name }); })
        .catch(function(err) { problemas.push(arquivo.name + ' (' + mensagemDeErro(err) + ')'); });
    });
  }, Promise.resolve()).then(function() {
    if (problemas.length) mostrarErroUniao('Não consegui adicionar: ' + problemas.join('; '));
    renderOrdemUniao();
    renderDocumentos(); // atualiza a lista (e marca os novos documentos na tabela)
  }).then(function() {
    botao.disabled = false;
    botao.textContent = rotulo;
  });
}

function renderOrdemUniao() {
  var lista = document.getElementById('uniaoOrdem');
  var botao = document.getElementById('btnUnirPdfs');
  if (!UNIR_SELECAO.length) {
    lista.innerHTML = '<div class="nf-row"><span style="color:var(--gray-text);">Nenhum documento selecionado.</span></div>';
  } else {
    lista.innerHTML = UNIR_SELECAO.map(function(item, i) {
      var ultimo = i === UNIR_SELECAO.length - 1;
      var setaOff = 'style="opacity:.3;pointer-events:none;"';
      return '<div class="nf-row">' +
          '<span><b>' + (i + 1) + '.</b> ' + escaparHtml(item.nome) + (item.detalhe ? ' <span class="meta">(' + escaparHtml(item.detalhe) + ')</span>' : '') + '</span>' +
          '<span style="display:flex;gap:16px;align-items:center;flex:none;">' +
            '<span class="link-ver" ' + (i === 0 ? setaOff : '') + ' onclick="moverNaUniao(' + i + ', -1)" title="Subir">↑</span>' +
            '<span class="link-ver" ' + (ultimo ? setaOff : '') + ' onclick="moverNaUniao(' + i + ', 1)" title="Descer">↓</span>' +
            '<span class="link-ver" style="color:var(--if-red);" onclick="removerDaUniao(' + i + ')" title="Tirar da junção">✕</span>' +
          '</span>' +
        '</div>';
    }).join('');
  }
  botao.disabled = UNIR_SELECAO.length < 2;
  botao.textContent = UNIR_SELECAO.length >= 2 ? 'Unir e baixar PDF (' + UNIR_SELECAO.length + ' arquivos)' : 'Unir e baixar PDF';
}

function moverNaUniao(i, delta) {
  var j = i + delta;
  if (j < 0 || j >= UNIR_SELECAO.length) return;
  var tmp = UNIR_SELECAO[i]; UNIR_SELECAO[i] = UNIR_SELECAO[j]; UNIR_SELECAO[j] = tmp;
  renderOrdemUniao();
}

function removerDaUniao(i) {
  UNIR_SELECAO.splice(i, 1);
  renderOrdemUniao();
  renderTabelaUniao(); // desmarca o checkbox correspondente
}

/* Botão "Unir e baixar PDF": manda os ids na ordem escolhida e baixa o PDF unido pelo backend */
function unirPdfsSelecionados() {
  esconderErroUniao();
  if (UNIR_SELECAO.length < 2) { mostrarErroUniao('Selecione pelo menos 2 PDFs para unir.'); return; }

  var botao = document.getElementById('btnUnirPdfs');
  botao.disabled = true;
  botao.textContent = 'Unindo…';

  var headers = cabecalhoAuth();
  headers['Content-Type'] = 'application/json';
  var itens = UNIR_SELECAO.map(function(item) {
    if (item.origem === 'documento') return { origem: 'documento', id: item.id };
    var r = { origem: 'relatorio', relatorio: item.relatorio };
    if (item.uepId) r.uepId = item.uepId;
    if (item.dataInicio) { r.dataInicio = item.dataInicio; r.dataFim = item.dataFim; }
    return r;
  });

  // fetch direto (e não apiFetch): a resposta é um arquivo, não JSON
  fetch(API_BASE + '/documentos/unir', { method: 'POST', headers: headers, body: JSON.stringify({ itens: itens }) })
    .then(function(res) {
      if (!res.ok) return rejeitarComErroDaResposta(res);
      return res.blob().then(function(blob) {
        if (!blob.size) throw new Error('O servidor devolveu um arquivo vazio.');
        var nome = nomeArquivoDoHeader(res.headers.get('Content-Disposition')) ||
                   ('uniao-documentos-' + dataLocalISO(new Date()) + '.pdf');
        salvarArquivo(blob, nome);
        mostrarToast('PDF unido gerado: ' + nome);
      });
    })
    .catch(function(err) { mostrarErroUniao(mensagemDeErro(err)); })
    .then(function() { renderOrdemUniao(); }); // restaura o texto e o estado do botão
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

/* Monta as <option> de um <select multiple> de UEPs a partir da lista já
   carregada, marcando como "selected" as UEPs que o usuário já tem (um
   Professor pode ter acesso a mais de uma UEP ao mesmo tempo — ver
   professor_ueps no backend). */
/* Monta as <option> de um <select> comum (uma UEP só) — usado no
   formulário "Adicionar integrante" da aba Minha Equipe, pro Professor
   escolher em qual das SUAS UEPs a pessoa entra. */
function montarOpcoesSetor(ueps, uepIdAtual) {
  var html = '';
  ueps.forEach(function(u) {
    var sel = (uepIdAtual != null && String(uepIdAtual) === String(u.id)) ? ' selected' : '';
    html += '<option value="' + u.id + '"' + sel + '>' + u.nome + '</option>';
  });
  return html;
}

/* Cache local da última lista de UEPs carregada em Controle de Acesso —
   usada pelos chips (linha de cada professor e formulário "Conceder novo
   acesso") pra saber quais UEPs ainda faltam adicionar. */
var UEPS_CACHE = [];

/* UEPs escolhidas no formulário "Conceder novo acesso" — esse professor
   ainda nem existe, então não tem como PATCHar nada: fica só em memória
   até o submit (concederAcesso), que manda tudo junto em uepIds. */
var novoAcessoUepIds = [];

/* Monta o "chips" de UEPs: uma pilulazinha por UEP já concedida (com um
   "x" pra tirar) + um <select> pequeno, só com as UEPs que AINDA faltam,
   pra adicionar uma nova — é a interação que a Diretoria pediu ("abrir uma
   opção com as UEPs que o professor ainda não tem, e as que ele já tem
   aparecem com um x pra poder tirar").
   removeAttr/addAttr são o texto pronto de um atributo onclick="..."/
   onchange="..." (ver os dois usos abaixo: linha de um professor já salvo
   chama removerUepDoUsuario/adicionarUepAoUsuario com o id dele; o
   formulário "Conceder novo acesso" — sem id nenhum ainda — chama
   removerUepNovoAcesso/adicionarUepNovoAcesso). */
function montarChipsUeps(uepsAtuais, todasUeps, montarRemoveAttr, montarAddAttr) {
  var idsAtuais = uepsAtuais.map(function(u) { return u.id; });

  var chips = uepsAtuais.map(function(u) {
    return '<span class="uep-chip">' + u.nome +
      '<span class="chip-remove" title="Remover ' + u.nome + '" ' + montarRemoveAttr(u.id) + '>&times;</span></span>';
  }).join('');

  var disponiveis = todasUeps.filter(function(u) { return idsAtuais.indexOf(u.id) === -1; });
  var selectHtml = disponiveis.length
    ? '<select class="uep-add-select" ' + montarAddAttr() + '>' +
        '<option value="">+ adicionar UEP</option>' +
        disponiveis.map(function(u) { return '<option value="' + u.id + '">' + u.nome + '</option>'; }).join('') +
      '</select>'
    : '';

  return (chips + selectHtml) || '<span class="uep-empty-hint">Nenhuma UEP disponível</span>';
}

/* Repinta a tabela de professores com acesso — GET /users?role=PROFESSOR + GET /ueps
   (somente Diretoria). Essa tela não mexe mais em perfil nenhum além de Professor:
   quem administra Aluno/Técnico/Estagiário é o próprio Professor, na aba "Minha Equipe".
   A coluna UEP é o "chips" acima: cada Professor pode ter acesso a mais de
   uma UEP, e a Diretoria adiciona/remove uma de cada vez. */
function renderControleAcesso() {
  var tbody = document.getElementById('tabelaAcessos');
  tbody.innerHTML = '<tr><td colspan="5">Carregando…</td></tr>';

  Promise.all([
    apiFetch('/users?role=PROFESSOR'),
    apiFetch('/ueps')
  ]).then(function(results) {
    var usuarios = results[0] || [];
    var ueps = results[1] || [];
    USERS = usuarios; // cache local pro handler de remover
    UEPS_CACHE = ueps;

    renderizarChipsNovoAcesso();

    var linhas = '';
    usuarios.forEach(function (u) {
      var chipsHtml = montarChipsUeps(
        u.ueps || [],
        ueps,
        function(uepId) { return 'onclick="removerUepDoUsuario(' + u.id + ',' + uepId + ')"'; },
        function() { return 'onchange="adicionarUepAoUsuario(' + u.id + ', this)"'; }
      );

      linhas +=
        '<tr>' +
          '<td>' + u.nome + '</td>' +
          '<td>' + u.email + '</td>' +
          '<td><div class="uep-chips">' + chipsHtml + '</div></td>' +
          '<td>' + statusAcessoBadge(u) + '</td>' +
          '<td><span class="link-ver" style="color:var(--if-red);" onclick="removerAcesso(' + u.id + ')">remover</span></td>' +
        '</tr>';
    });
    tbody.innerHTML = linhas || '<tr><td colspan="5">Nenhum professor cadastrado.</td></tr>';
  }).catch(function(err) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#c00">Erro ao carregar dados: ' + err.message + '</td></tr>';
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

/* Clique no "x" de um chip de UEP na linha de um professor — tira aquela
   UEP e manda o conjunto resultante inteiro (PATCH /users/:id { uepIds }),
   já que a API sempre substitui a lista completa, nunca um item de cada vez. */
function removerUepDoUsuario(userId, uepId) {
  var usuario = USERS.find(function(u) { return u.id === userId; });
  var atuais = (usuario && usuario.ueps) ? usuario.ueps.map(function(u) { return u.id; }) : [];
  var novasUeps = atuais.filter(function(id) { return id !== uepId; });
  salvarUepsDoUsuario(userId, novasUeps);
}

/* Escolha no <select> "+ adicionar UEP" de uma linha — acrescenta essa UEP
   ao conjunto que o professor já tinha. */
function adicionarUepAoUsuario(userId, selectEl) {
  var novoId = Number(selectEl.value);
  if (!novoId) return;
  var usuario = USERS.find(function(u) { return u.id === userId; });
  var atuais = (usuario && usuario.ueps) ? usuario.ueps.map(function(u) { return u.id; }) : [];
  if (atuais.indexOf(novoId) === -1) atuais.push(novoId);
  salvarUepsDoUsuario(userId, atuais);
}

function salvarUepsDoUsuario(userId, uepIds) {
  apiFetch('/users/' + userId, {
    method: 'PATCH',
    body: JSON.stringify({ uepIds: uepIds })
  }).then(function() {
    renderControleAcesso();
    mostrarToast('UEPs do usuário atualizadas.');
  }).catch(function(err) {
    alert('Erro ao alterar UEPs: ' + err.message);
    renderControleAcesso(); // desfaz visualmente a troca nos chips
  });
}

/* Chips de UEPs do formulário "Conceder novo acesso" — esse professor
   ainda não existe (sem id), então só mantém a escolha em novoAcessoUepIds
   até o submit; adicionar/remover aqui só repinta esse pedacinho, não a
   tabela inteira. */
function renderizarChipsNovoAcesso() {
  var container = document.getElementById('naSetorChips');
  if (!container) return;
  var uepsEscolhidas = UEPS_CACHE.filter(function(u) { return novoAcessoUepIds.indexOf(u.id) !== -1; });
  container.innerHTML = montarChipsUeps(
    uepsEscolhidas,
    UEPS_CACHE,
    function(uepId) { return 'onclick="removerUepNovoAcesso(' + uepId + ')"'; },
    function() { return 'onchange="adicionarUepNovoAcesso(this)"'; }
  );
}

function removerUepNovoAcesso(uepId) {
  novoAcessoUepIds = novoAcessoUepIds.filter(function(id) { return id !== uepId; });
  renderizarChipsNovoAcesso();
}

function adicionarUepNovoAcesso(selectEl) {
  var novoId = Number(selectEl.value);
  if (!novoId) return;
  if (novoAcessoUepIds.indexOf(novoId) === -1) novoAcessoUepIds.push(novoId);
  renderizarChipsNovoAcesso();
}

/* Chamado ao trocar o <select> de perfil de um integrante da equipe —
   PATCH /users/:id. Só existe aqui dentro (tela "Minha Equipe"), então o
   <select> já vem restrito a Aluno/Técnico/Estagiário (ver
   buildEquipeRoleOptions) — não dá pra promover ninguém a Professor ou
   Diretoria por essa tela. */
function alterarPerfilEquipe(userId, novoRoleFrontend) {
  var backendRole = ROLE_MAP[novoRoleFrontend] || 'ALUNO';
  apiFetch('/users/' + userId, {
    method: 'PATCH',
    // ativo:true junto com o role: mesmo raciocínio do Controle de Acesso —
    // trocar o perfil de alguém aqui já é o Professor decidindo dar acesso
    // com aquele perfil, então libera na mesma tacada (ver histórico dessa
    // decisão no Controle de Acesso, seção 9).
    body: JSON.stringify({ role: backendRole, ativo: true })
  }).then(function() {
    renderMinhaEquipe();
    mostrarToast('Perfil atualizado.');
  }).catch(function(err) {
    alert('Erro ao alterar perfil: ' + err.message);
    renderMinhaEquipe(); // desfaz visualmente a troca no <select>
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

/* onsubmit do formulário "Conceder novo acesso" (Diretoria) — POST /users.
   Perfil é sempre PROFESSOR aqui: a Diretoria não cadastra Aluno/Técnico/
   Estagiário diretamente, quem faz isso é o próprio Professor na aba
   "Minha Equipe" (ver concederAcessoEquipe, seção 13). uepIds é opcional:
   dá pra conceder o acesso sem marcar nenhuma UEP ainda e fazer isso
   depois, direto na tabela (ver removerUepDoUsuario/adicionarUepAoUsuario). */
function concederAcesso() {
  hideFormError('acessoError');

  var nome = document.getElementById('naNome').value.trim();
  var email = document.getElementById('naEmail').value.trim().toLowerCase();
  var senha = document.getElementById('naSenha').value;

  apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({
      nome: nome,
      email: email,
      senha: senha,
      role: 'PROFESSOR',
      uepIds: novoAcessoUepIds
    })
  }).then(function() {
    document.getElementById('novoAcessoForm').reset();
    novoAcessoUepIds = [];
    renderControleAcesso();
    mostrarToast('Acesso de Professor concedido a ' + nome + '.');
  }).catch(function(err) {
    showFormError('acessoError', err.message);
  });
}


/* =====================================================================
   13. MINHA EQUIPE (aba exclusiva do Professor)
   O Professor cadastra e gerencia só os próprios Aluno/Técnico/Estagiário.
   professor_id é sempre implícito (vem do token, nunca do corpo). uep_id
   também não é livre: o Professor escolhe, no formulário, em QUAL das
   SUAS UEPs (professor_ueps) a pessoa entra — o backend valida que essa
   UEP está mesmo no conjunto dele antes de aceitar (users.policy.js +
   users.service.js -> escolherUepDaEquipe). Ver também users.routes.js
   (GET/POST/PATCH/DELETE /users liberado pra PROFESSOR, escopado à
   própria equipe) e migrations 006/007.
   ===================================================================== */

/* Perfis que um Professor pode atribuir a alguém da própria equipe —
   só esses três, nunca Professor nem Diretoria. */
var PAPEIS_EQUIPE = ['aluno', 'tecnico', 'estagiario'];

function buildEquipeRoleOptions(selecionado) {
  var html = '';
  PAPEIS_EQUIPE.forEach(function(key) {
    html += '<option value="' + key + '"' + (key === selecionado ? ' selected' : '') + '>' + ROLES[key].label + '</option>';
  });
  return html;
}

/* Repinta a tabela "Minha Equipe" — GET /users?professorId=<eu mesmo> —
   e, junto, recarrega as UEPs do próprio Professor (GET /users/me) pra
   popular o <select> de UEP do formulário "Adicionar integrante": um
   Professor com mais de uma UEP escolhe em qual delas a pessoa entra; com
   só uma, o <select> já fica com essa única opção. */
function renderMinhaEquipe() {
  var tbody = document.getElementById('tabelaEquipe');
  tbody.innerHTML = '<tr><td colspan="6">Carregando…</td></tr>';

  Promise.all([
    apiFetch('/users?professorId=' + currentUser.id),
    apiFetch('/users/me')
  ]).then(function(results) {
    var usuarios = results[0] || [];
    var me = results[1] || {};
    EQUIPE = usuarios || [];
    MINHA_UEPS = me.ueps || [];

    var eqSetorEl = document.getElementById('eqSetor');
    if (eqSetorEl) {
      eqSetorEl.innerHTML = MINHA_UEPS.length
        ? montarOpcoesSetor(MINHA_UEPS, MINHA_UEPS.length === 1 ? MINHA_UEPS[0].id : null)
        : '<option value="">Nenhuma UEP liberada ainda</option>';
    }

    var linhas = '';
    EQUIPE.forEach(function (u) {
      var roleFrontend = ROLE_MAP_REVERSE[u.role] || 'aluno';
      linhas +=
        '<tr>' +
          '<td>' + u.nome + '</td>' +
          '<td>' + u.email + '</td>' +
          '<td>' + roleBadge(roleFrontend) + '</td>' +
          '<td><select class="fake-select" style="min-width:150px;" onchange="alterarPerfilEquipe(' + u.id + ', this.value)">' +
                buildEquipeRoleOptions(roleFrontend) +
              '</select></td>' +
          '<td>' + statusAcessoBadge(u) + '</td>' +
          '<td><span class="link-ver" style="color:var(--if-red);" onclick="removerMembroEquipe(' + u.id + ')">remover</span></td>' +
        '</tr>';
    });
    tbody.innerHTML = linhas || '<tr><td colspan="6">Nenhum integrante na equipe ainda.</td></tr>';
  }).catch(function(err) {
    tbody.innerHTML = '<tr><td colspan="6" style="color:#c00">Erro ao carregar equipe: ' + err.message + '</td></tr>';
  });
}

/* Chamado ao clicar em "remover" numa linha da equipe — mesma lógica de
   confirmação do removerAcesso (Controle de Acesso) e do
   confirmarRemoverAnimal (Gestão do Rebanho): pede confirmação antes,
   porque é irreversível. */
function removerMembroEquipe(userId) {
  var usuario = EQUIPE.find(function(u) { return u.id === userId; });
  var quem = usuario ? (usuario.nome + ' (' + usuario.email + ')') : 'este integrante';

  var confirmado = window.confirm(
    'Tem certeza que deseja remover ' + quem + ' da sua equipe?\n\nEssa ação não pode ser desfeita.'
  );
  if (!confirmado) return;

  apiFetch('/users/' + userId, { method: 'DELETE' }).then(function() {
    renderMinhaEquipe();
    mostrarToast('Integrante removido da equipe.');
  }).catch(function(err) {
    alert('Erro ao remover integrante: ' + err.message);
  });
}

/* onsubmit do formulário "Adicionar integrante" — POST /users.
   Não manda professorId no corpo de propósito: é sempre decidido pelo
   backend a partir de quem está logado (o token), nunca do que o cliente
   manda. uepId aqui é só "em qual UEP MINHA (do professor logado) essa
   pessoa entra" — o backend valida que é mesmo uma UEP que este professor
   tem acesso antes de aceitar (ver users.service.js -> escolherUepDaEquipe). */
function concederAcessoEquipe() {
  hideFormError('equipeError');

  var nome = document.getElementById('eqNome').value.trim();
  var email = document.getElementById('eqEmail').value.trim().toLowerCase();
  var roleFrontend = document.getElementById('eqRole').value;
  var senha = document.getElementById('eqSenha').value;
  var uepId = document.getElementById('eqSetor').value;
  var backendRole = ROLE_MAP[roleFrontend] || 'ALUNO';

  if (!uepId) {
    showFormError('equipeError', 'Selecione em qual das suas UEPs essa pessoa vai entrar.');
    return;
  }

  apiFetch('/users', {
    method: 'POST',
    body: JSON.stringify({ nome: nome, email: email, senha: senha, role: backendRole, uepId: Number(uepId) })
  }).then(function() {
    document.getElementById('novaEquipeForm').reset();
    renderMinhaEquipe();
    mostrarToast(nome + ' adicionado(a) à equipe.');
  }).catch(function(err) {
    showFormError('equipeError', err.message);
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
  var isProfessor = currentRole === 'professor';
  document.querySelectorAll('.op-only').forEach(function (el) {
    el.classList.toggle('hidden', isDiretoria);
  });
  document.querySelectorAll('.admin-only').forEach(function (el) {
    el.classList.toggle('hidden', !isDiretoria);
  });
  document.querySelectorAll('.professor-only').forEach(function (el) {
    el.classList.toggle('hidden', !isProfessor);
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
  if (currentRole !== 'diretoria') renderEstoque();
  if (currentRole === 'diretoria') { renderControleAcesso(); renderRelatorios(); }
  if (currentRole === 'diretoria' || currentRole === 'professor') renderDocumentos();
  if (currentRole === 'professor') renderMinhaEquipe();

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

  // documentos/seleção de PDFs são da conta que saiu — não podem aparecer para a próxima
  DOCUMENTOS_CACHE = [];
  UNIR_SELECAO = [];
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
// eqRole (formulário "Adicionar integrante" da aba Minha Equipe) é populado
// aqui porque é estático — sempre as mesmas 3 opções, não depende de fetch
// nenhum. Os chips de UEP (naSetorChips), por outro lado, só são montados
// dentro de renderControleAcesso(), porque a lista de UEPs vem de GET
// /ueps (precisa de token).
document.getElementById('eqRole').innerHTML = buildEquipeRoleOptions(null);

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