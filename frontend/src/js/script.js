/* =====================================================================
   0. API — configuração e helpers de comunicação com o backend
   ===================================================================== */
var API_BASE = 'http://localhost:3000/api';

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
        var msg = (body && body.message) ? body.message : 'Erro ' + res.status;
        throw new Error(msg);
      });
    }
    return res.json();
  });
}

/* =====================================================================
   SISGEP — script.js
   Frontend estático (protótipo). Sem chamadas reais de API ainda —
   os pontos onde o backend deve entrar estão marcados com "BACKEND:".
   ===================================================================== */


/* =====================================================================
   1. CONFIGURAÇÃO — PERFIS DE USUÁRIO (ROLES)
   Cada perfil define: rótulo exibido, descrição curta (usada na tela
   de seleção de perfil), se pode se autocadastrar, se o e-mail precisa
   ser institucional (@ifpe.edu.br), e o ícone (SVG).
   ===================================================================== */
var ROLES = {
  aluno: {
    label: 'Aluno',
    desc: 'Consulta de dados e atividades do setor',
    cadastro: true,
    institucional: false,
    icon: 'M22 10L12 5 2 10l10 5 10-5z|M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5'
  },
  tecnico: {
    label: 'Técnico',
    desc: 'Apoio técnico e operacional ao rebanho',
    cadastro: true,
    institucional: false,
    icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z'
  },
  estagiario: {
    label: 'Estagiário',
    desc: 'Atividades de campo e apoio ao setor',
    cadastro: true,
    institucional: false,
    icon: 'M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z|M2 13h20'
  },
  professor: {
    label: 'Professor',
    desc: 'Orientação acadêmica e acompanhamento de projetos',
    cadastro: true,
    institucional: true, // exige e-mail @ifpe.edu.br no login e no cadastro
    icon: 'M12 3l9 4.5-9 4.5-9-4.5L12 3z|M3 12.5l9 4.5 9-4.5|M3 7.5v9'
  },
  diretoria: {
    label: 'Diretoria',
    desc: 'Gestão de notas fiscais e relatórios institucionais',
    cadastro: false, // conta provisionada pela instituição, sem autocadastro
    institucional: false,
    icon: 'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z'
  }
};

/* Regras de visibilidade das abas por perfil (ver SEÇÃO 8 — toggleTabsByRole):
   - .op-only  → abas "operacionais" (Painel, Gestão do Rebanho, Estoque de Ração).
                 Visíveis para todos os perfis, EXCETO Diretoria.
   - .admin-only → aba "Relatórios (PDF)". Visível SOMENTE para Diretoria.
   - Notas Fiscais não tem classe: fica visível para todo mundo, sempre.
   Resultado prático: a Diretoria só enxerga Notas Fiscais + Relatórios (PDF). */


/* =====================================================================
   2. CONFIGURAÇÃO — SETORES / UEPs
   Cada setor tem: rótulo, sigla (2 letras, vira o "monograma" colorido
   na tela de seleção), cor do monograma, descrição curta, dados de
   censo (categorias e raças), insumo de ração e uma lista de animais
   de exemplo. Trocar de setor não recarrega a página: renderSetor()
   repinta a tela com os dados do setor escolhido.
   ===================================================================== */
var SETORES = {
  bovinocultura: {
    label: 'Bovinocultura',
    sigla: 'BV',
    cor: '#2f9e41',
    desc: 'Bovinos de corte e leite',
    categorias: { 'Vaca': 52, 'Bezerro(a)': 18, 'Desmamado': 21, 'Novilha': 14, 'Touro': 23 },
    racas: { 'Nelore': 60, 'Girolando': 40, 'Holandês': 28 },
    insumo: 'Ração bovina',
    nivel: '380 kg',
    consumo: '95 kg/dia',
    animais: [
      ['BV-0412', 'Nelore', 'Vaca', 'Lactante', 'disp'],
      ['BV-0413', 'Girolando', 'Novilha', 'Em cobertura', 'disp'],
      ['BV-0287', 'Holandês', 'Vaca', 'Seca', 'quar'],
      ['BV-0301', 'Nelore', 'Touro', '—', 'vend'],
      ['BV-0098', 'Nelore', 'Vaca', '—', 'desc']
    ]
  },
  suinocultura: {
    label: 'Suinocultura',
    sigla: 'SU',
    cor: '#1f7a6c',
    desc: 'Produção e manejo de suínos',
    categorias: { 'Matriz': 34, 'Leitão': 86, 'Recria': 52, 'Terminação': 30, 'Reprodutor': 8 },
    racas: { 'Duroc': 70, 'Landrace': 90, 'Large White': 50 },
    insumo: 'Ração suína',
    nivel: '620 kg',
    consumo: '180 kg/dia',
    animais: [
      ['SU-0101', 'Duroc', 'Matriz', 'Lactante', 'disp'],
      ['SU-0102', 'Landrace', 'Leitão', '—', 'disp'],
      ['SU-0087', 'Large White', 'Reprodutor', '—', 'disp'],
      ['SU-0140', 'Duroc', 'Terminação', '—', 'vend']
    ]
  },
  avicultura: {
    label: 'Avicultura',
    sigla: 'AV',
    cor: '#6b8f2f',
    desc: 'Aves de postura e corte',
    categorias: { 'Poedeira': 420, 'Pintainha': 150, 'Frango de corte': 60, 'Matriz': 10 },
    racas: { 'Leghorn': 300, 'Rhode Island': 250, 'Embrapa 051': 190 },
    insumo: 'Ração de postura',
    nivel: '910 kg',
    consumo: '260 kg/dia',
    animais: [
      ['AV-2201', 'Leghorn', 'Poedeira', 'Postura', 'disp'],
      ['AV-2202', 'Rhode Island', 'Pintainha', '—', 'disp'],
      ['AV-2150', 'Embrapa 051', 'Matriz', '—', 'quar']
    ]
  },
  cunicultura: {
    label: 'Cunicultura',
    sigla: 'CN',
    cor: '#2f7a9e',
    desc: 'Criação e manejo de coelhos',
    categorias: { 'Matriz': 24, 'Filhote': 40, 'Recria': 26, 'Reprodutor': 6 },
    racas: { 'Nova Zelândia': 40, 'Californiano': 36, 'Chinchila': 20 },
    insumo: 'Ração de coelhos',
    nivel: '140 kg',
    consumo: '22 kg/dia',
    animais: [
      ['CU-0301', 'Nova Zelândia', 'Matriz', 'Gestante', 'disp'],
      ['CU-0302', 'Californiano', 'Filhote', '—', 'disp'],
      ['CU-0250', 'Chinchila', 'Reprodutor', '—', 'disp']
    ]
  }
};

/* Mapa de status → [classe css, texto exibido], usado ao montar a tabela de animais */
var STATUS_TAGS = {
  disp: ['disp', 'Disponível'],
  vend: ['vend', 'Vendido'],
  desc: ['desc', 'Descartado'],
  quar: ['quar', 'Quarentena']
};

/* Estado da sessão atual (só em memória — reseta ao recarregar a página) */
var currentRole = '';
var currentSetor = '';
var currentSetorNome = '';


/* =====================================================================
   3. HELPERS DE INTERFACE
   ===================================================================== */

/* Monta um <svg> a partir de uma string "pathA|pathB|pathC" (ver ROLES.icon) */
function svgIcon(paths) {
  var pathTags = paths.split('|').map(function (p) { return '<path d="' + p + '"/>'; }).join('');
  return '<svg class="icon" viewBox="0 0 24 24">' + pathTags + '</svg>';
}

/* Troca qual .auth-screen está visível (seleção de perfil / login / cadastro / setor) */
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


/* =====================================================================
   4. TELA DE SELEÇÃO DE PERFIL E DE SETOR
   Os cards são gerados a partir de ROLES/SETORES em vez de escritos
   à mão no HTML — assim, adicionar um novo perfil ou setor no futuro
   é só adicionar uma entrada nos objetos acima.
   ===================================================================== */

function buildRoleGrid() {
  var html = '';
  for (var key in ROLES) {
    var r = ROLES[key];
    html += '<div class="role-row" onclick="selectRole(\'' + key + '\')">' +
              '<div class="r-icon">' + svgIcon(r.icon) + '</div>' +
              '<div class="r-text"><h3>' + r.label + '</h3><p>' + r.desc + '</p></div>' +
              '<svg class="icon r-arrow" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>' +
            '</div>';
  }
  document.getElementById('roleGrid').innerHTML = html;
}

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
   5. FLUXO DE AUTENTICAÇÃO (login / cadastro)
   BACKEND: os forms #loginForm e #cadastroForm hoje só chamam
   showAuth('auth-setor') no onsubmit — troque isso por um fetch/axios
   real para POST /api/auth/login e POST /api/auth/cadastro.
   ===================================================================== */

/* Chamado ao clicar num card de perfil na tela inicial */
function selectRole(role) {
  currentRole = role;
  var r = ROLES[role];

  document.getElementById('loginTitle').textContent = 'Entrar como ' + r.label;
  document.getElementById('loginSub').textContent = role === 'professor'
    ? 'Acesso restrito a servidores docentes do IFPE.'
    : 'Acesso restrito à comunidade do IFPE — ' + r.label.toLowerCase() + '.';

  // Campo de e-mail muda de rótulo/placeholder quando o perfil exige e-mail institucional
  document.getElementById('loginEmailLabel').textContent = r.institucional ? 'E-mail institucional' : 'E-mail';
  document.getElementById('loginEmail').placeholder = r.institucional ? 'nome.sobrenome@ifpe.edu.br' : 'seuemail@exemplo.com';

  // Link "Cadastre-se" só aparece se o perfil permite autocadastro
  document.getElementById('cadastroSwitch').style.display = r.cadastro ? 'block' : 'none';

  showAuth('auth-login');
}

/* Chamado ao clicar em "Cadastre-se" dentro da tela de login */
function openCadastro() {
  var r = ROLES[currentRole];

  document.getElementById('cadTitle').textContent = 'Cadastro de ' + r.label;
  document.getElementById('cadSub').textContent = r.institucional
    ? 'Cadastro validado pelo e-mail institucional do IFPE.'
    : 'Preencha seus dados para criar sua conta de ' + r.label.toLowerCase() + '.';

  document.getElementById('cadEmailLabel').textContent = r.institucional ? 'E-mail institucional' : 'E-mail';
  document.getElementById('cadEmail').placeholder = r.institucional ? 'nome.sobrenome@ifpe.edu.br' : 'seuemail@exemplo.com';
  var cadEmailEl = document.getElementById('cadEmail');
  if (r.institucional) {
    cadEmailEl.setAttribute('pattern', '.+@ifpe\\.edu\\.br$');
  } else {
    cadEmailEl.removeAttribute('pattern');
  }
  document.getElementById('cadHint').style.display = r.institucional ? 'block' : 'none';

  showAuth('auth-cadastro');
}

/* Chamado ao clicar num card de setor/UEP — encerra o fluxo de autenticação e entra no app */
function selectSetor(setorId, setorNome) {
  currentSetor = setorId;
  currentSetorNome = setorNome;
  enterApp();
}

/* Botão "trocar" no cabeçalho do app — volta pra tela de seleção de setor sem deslogar */
function trocarSetor() {
  document.getElementById('userMenu').classList.remove('show');
  document.getElementById('app').classList.add('hidden');
  reveal(document.getElementById('authFlow'));
  showAuth('auth-setor');
}


/* =====================================================================
   6. MENU DO USUÁRIO (cabeçalho do app)
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
   7. RENDERIZAÇÃO DOS DADOS DO SETOR ATUAL
   Preenche Painel, Gestão do Rebanho e Estoque com os dados de
   SETORES[currentSetor]. É chamada sempre que o setor muda.
   BACKEND: troque as leituras de SETORES[...] por dados vindos da API
   (ex.: GET /api/setores/{setor}/animais, /estoque, etc.).
   ===================================================================== */
function renderSetor() {
  var uepId = currentSetor;
  var uepNome = currentSetorNome || 'UEP';

  document.getElementById('setorAtual').textContent = uepNome;
  document.getElementById('heroSetor').textContent = uepNome;
  document.getElementById('rebanhoTitulo').textContent = 'Gestão do Rebanho — ' + uepNome;

  // Busca animais e censo em paralelo
  Promise.all([
    apiFetch('/ueps/' + uepId + '/animais'),
    apiFetch('/ueps/' + uepId + '/animais/censo')
  ]).then(function(results) {
    var animais = Array.isArray(results[0]) ? results[0] : (results[0].data || []);
    var censo   = results[1] || {};

    var total = censo.total || animais.length;
    var emQuarentena = animais.filter(function(a) { return a.status_reprodutivo === 'DESCARTE'; }).length;

    document.getElementById('kpiTotal').textContent = total;
    document.getElementById('kpiQuarentena').textContent = emQuarentena;

    if (animais.length > 0) {
      document.getElementById('feed1').innerHTML = '<b>' + (animais[0].brinco || animais[0].id) + '</b> está cadastrado(a)';
    }
    document.getElementById('feed2').innerHTML = 'Dados carregados da API';

    // censo.porCategoria é um array [{categoria, sexo, total}]
    // Agrupa em {VACA: N, TOURO: N, ...}
    var censoPorCat = {};
    var censoPorRaca = {};
    (censo.porCategoria || []).forEach(function(row) {
      var cat = row.categoria || '?';
      censoPorCat[cat] = (censoPorCat[cat] || 0) + (row.total || 0);
    });
    // Raça: agrupa a partir da lista de animais
    animais.forEach(function(a) {
      if (a.raca) censoPorRaca[a.raca] = (censoPorRaca[a.raca] || 0) + 1;
    });

    // Censo por categoria
    var censoCategoriaHtml = '<div class="counter"><div class="n">' + total + '</div><div class="l">Total</div></div>';
    Object.keys(censoPorCat).forEach(function(cat) {
      censoCategoriaHtml += '<div class="counter sub"><div class="n">' + censoPorCat[cat] + '</div><div class="l">' + cat + '</div></div>';
    });
    document.getElementById('censoCategoria').innerHTML = censoCategoriaHtml;

    // Censo por raça
    var censoRacaHtml = '';
    Object.keys(censoPorRaca).forEach(function(raca) {
      censoRacaHtml += '<div class="counter sub"><div class="n">' + censoPorRaca[raca] + '</div><div class="l">' + raca + '</div></div>';
    });
    document.getElementById('censoRaca').innerHTML = censoRacaHtml || '<div class="counter sub"><div class="l">—</div></div>';

    // Filtros
    var opcoesCategoria = '<option value="">Categoria</option>';
    Object.keys(censoPorCat).forEach(function(c) { opcoesCategoria += '<option>' + c + '</option>'; });
    document.getElementById('filtroCategoria').innerHTML = opcoesCategoria;

    var opcoesRaca = '<option value="">Raça</option>';
    Object.keys(censoPorRaca).forEach(function(r) { opcoesRaca += '<option>' + r + '</option>'; });
    document.getElementById('filtroRaca').innerHTML = opcoesRaca;

    // Tabela de animais
    var STATUS_LABEL = {
      NAO_APLICAVEL: ['disp', 'Disponível'],
      PRENHE:        ['disp', 'Prenhe'],
      VAZIA:         ['disp', 'Vazia'],
      LACTANTE:      ['disp', 'Lactante'],
      EM_CRESCIMENTO:['disp', 'Em crescimento'],
      DESCARTE:      ['desc', 'Descarte']
    };
    var linhasTabela = '';
    animais.forEach(function(animal) {
      var statusKey = animal.status_reprodutivo || 'NAO_APLICAVEL';
      var tag = STATUS_LABEL[statusKey] || ['disp', statusKey];
      linhasTabela +=
        '<tr>' +
          '<td class="brinco">' + (animal.brinco || animal.id) + '</td>' +
          '<td>' + (animal.raca || '—') + '</td>' +
          '<td>' + (animal.categoria || '—') + '</td>' +
          '<td>' + (animal.sexo || '—') + '</td>' +
          '<td><span class="tag ' + tag[0] + '">' + tag[1] + '</span></td>' +
          '<td><span class="link-ver">ver</span></td>' +
        '</tr>';
    });
    document.getElementById('tabelaAnimais').innerHTML = linhasTabela || '<tr><td colspan="6">Nenhum animal cadastrado.</td></tr>';
    document.getElementById('paginacaoInfo').textContent = 'Mostrando ' + animais.length + ' de ' + total + ' animais';

    // Estoque (placeholder — módulo de estoque será integrado futuramente)
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
   8. SESSÃO — entrar no app / sair
   ===================================================================== */

/* Aplica as regras de visibilidade de aba descritas lá na SEÇÃO 1 (junto de ROLES.diretoria):
   - Diretoria: esconde .op-only (Painel / Rebanho / Estoque), mostra .admin-only (Relatórios)
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
   BACKEND: hoje o "nome" exibido no cabeçalho vem só do que foi digitado
   no formulário local. Troque pelo nome retornado pela API após o login. */
function enterApp() {
  var user = getUser();
  var displayName = 'Usuário';
  if (user && user.nome) {
    displayName = user.nome.split(' ')[0];
    displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  }

  document.getElementById('headerUserName').textContent = displayName;
  document.getElementById('menuUserName').textContent = displayName;
  document.getElementById('menuUserRole').textContent = ROLES[currentRole] ? ROLES[currentRole].label : currentRole;
  document.getElementById('heroGreeting').textContent = 'Bem-vindo(a) de volta, ' + displayName;

  toggleTabsByRole();
  renderSetor();

  document.getElementById('authFlow').classList.add('hidden');
  reveal(document.getElementById('app'));

  var telaInicial = (currentRole === 'diretoria') ? 'notas' : 'painel';
  go(telaInicial, { currentTarget: document.getElementById('tab-' + telaInicial) });
}

/* Botão "Sair da conta" no menu do usuário */
function logout() {
  clearToken();
  clearUser();
  currentRole = '';
  currentSetor = '';
  currentSetorNome = '';
  document.getElementById('userMenu').classList.remove('show');
  document.getElementById('app').classList.add('hidden');
  reveal(document.getElementById('authFlow'));
  showAuth('auth-role');
  document.getElementById('loginForm').reset();
  document.getElementById('cadastroForm').reset();
}


/* =====================================================================
   9. INICIALIZAÇÃO
   ===================================================================== */
buildRoleGrid();

/* =====================================================================
   10. HANDLERS DE FORMULÁRIO — login e cadastro (integração com API)
   ===================================================================== */
/* Script carregado no fim do <body> — DOM já está pronto, sem precisar de DOMContentLoaded */
(function() {

  /* --- Login --- */
  var loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var email  = document.getElementById('loginEmail').value.trim();
      var senha  = document.getElementById('loginSenha').value;
      apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, senha: senha })
      }).then(function(data) {
        setToken(data.token);
        setUser(data.user);
        var backendRole = data.user.role;
        currentRole = ROLE_MAP_REVERSE[backendRole] || 'aluno';
        buildSetorGrid();
        showAuth('auth-setor');
      }).catch(function(err) {
        alert('Erro no login: ' + err.message);
      });
    });
  }

  /* --- Cadastro --- */
  var cadastroForm = document.getElementById('cadastroForm');
  if (cadastroForm) {
    cadastroForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var nome   = document.getElementById('cadNome').value.trim();
      var email  = document.getElementById('cadEmail').value.trim();
      var senha  = document.getElementById('cadSenha').value;
      var senha2 = document.getElementById('cadSenha2').value;
      if (senha !== senha2) { alert('As senhas não coincidem.'); return; }
      var backendRole = ROLE_MAP[currentRole] || 'ALUNO';
      apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ nome: nome, email: email, senha: senha, role: backendRole })
      }).then(function(data) {
        setToken(data.token);
        setUser(data.user);
        buildSetorGrid();
        showAuth('auth-setor');
      }).catch(function(err) {
        alert('Erro no cadastro: ' + err.message);
      });
    });
  }

})();

/* =====================================================================
   11. MODAL DE CADASTRO DE ANIMAL
   ===================================================================== */
function abrirModalAnimal() {
  document.getElementById('formAnimal').reset();
  var modal = document.getElementById('modalAnimal');
  modal.style.display = 'flex';
}

function fecharModalAnimal() {
  document.getElementById('modalAnimal').style.display = 'none';
}

// Fecha ao clicar fora do painel
document.getElementById('modalAnimal') && document.addEventListener('click', function(e) {
  var modal = document.getElementById('modalAnimal');
  if (e.target === modal) fecharModalAnimal();
});

function salvarAnimal() {
  var btn = document.getElementById('btnSalvarAnimal');
  btn.disabled = true;
  btn.textContent = 'Salvando…';

  var payload = {
    brinco:            document.getElementById('anBrinco').value.trim(),
    categoria:         document.getElementById('anCategoria').value,
    sexo:              document.getElementById('anSexo').value,
    raca:              document.getElementById('anRaca').value.trim() || null,
    data_nascimento:   document.getElementById('anNasc').value || null,
    status_reprodutivo:document.getElementById('anStatus').value,
    observacoes:       document.getElementById('anObs').value.trim() || null
  };

  apiFetch('/ueps/' + currentSetor + '/animais', {
    method: 'POST',
    body: JSON.stringify(payload)
  }).then(function() {
    fecharModalAnimal();
    renderSetor(); // recarrega a tabela
  }).catch(function(err) {
    alert('Erro ao salvar: ' + err.message);
  }).finally(function() {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  });
}
