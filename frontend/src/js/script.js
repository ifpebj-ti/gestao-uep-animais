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
  var html = '';
  for (var key in SETORES) {
    var s = SETORES[key];
    html += '<div class="setor-tile" onclick="selectSetor(\'' + key + '\')">' +
              '<div class="setor-badge" style="background:' + s.cor + '">' + s.sigla + '</div>' +
              '<h3>' + s.label + '</h3><p>' + s.desc + '</p>' +
              '<svg class="icon s-arrow" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>' +
            '</div>';
  }
  document.getElementById('setorGrid').innerHTML = html;
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
  document.getElementById('cadEmail').pattern = r.institucional ? '.+@ifpe\\.edu\\.br$' : '';
  document.getElementById('cadHint').style.display = r.institucional ? 'block' : 'none';

  showAuth('auth-cadastro');
}

/* Chamado ao clicar num card de setor/UEP — encerra o fluxo de autenticação e entra no app */
function selectSetor(setor) {
  currentSetor = setor;
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
  var s = SETORES[currentSetor];

  var totalAnimais = 0;
  for (var k in s.categorias) totalAnimais += s.categorias[k];

  // --- Cabeçalhos e KPIs que citam o setor atual ---
  document.getElementById('setorAtual').textContent = s.label;
  document.getElementById('heroSetor').textContent = s.label;
  document.getElementById('rebanhoTitulo').textContent = 'Gestão do Rebanho — ' + s.label;
  document.getElementById('kpiTotal').textContent = totalAnimais;
  document.getElementById('kpiQuarentena').textContent = s.animais.filter(function (a) { return a[4] === 'quar'; }).length;
  document.getElementById('feed1').innerHTML = '<b>' + s.animais[0][0] + '</b> foi cadastrado(a)';
  document.getElementById('feed2').innerHTML = 'Animal movido para atenção/quarentena';

  // --- Censo rápido por categoria ---
  var censoCategoriaHtml = '<div class="counter"><div class="n">' + totalAnimais + '</div><div class="l">Total</div></div>';
  for (var categoria in s.categorias) {
    censoCategoriaHtml += '<div class="counter sub"><div class="n">' + s.categorias[categoria] + '</div><div class="l">' + categoria + '</div></div>';
  }
  document.getElementById('censoCategoria').innerHTML = censoCategoriaHtml;

  // --- Censo rápido por raça ---
  var censoRacaHtml = '';
  for (var raca in s.racas) {
    censoRacaHtml += '<div class="counter sub"><div class="n">' + s.racas[raca] + '</div><div class="l">' + raca + '</div></div>';
  }
  document.getElementById('censoRaca').innerHTML = censoRacaHtml;

  // --- Opções dos filtros (categoria / raça) ---
  var opcoesCategoria = '<option value="">Categoria</option>';
  for (var c in s.categorias) opcoesCategoria += '<option>' + c + '</option>';
  document.getElementById('filtroCategoria').innerHTML = opcoesCategoria;

  var opcoesRaca = '<option value="">Raça</option>';
  for (var r in s.racas) opcoesRaca += '<option>' + r + '</option>';
  document.getElementById('filtroRaca').innerHTML = opcoesRaca;

  // --- Tabela de animais ---
  var linhasTabela = '';
  s.animais.forEach(function (animal) {
    var id = animal[0], raca = animal[1], categoria = animal[2], fase = animal[3], statusKey = animal[4];
    var tag = STATUS_TAGS[statusKey]; // [classeCss, textoExibido]

    linhasTabela +=
      '<tr>' +
        '<td class="brinco">' + id + '</td>' +
        '<td>' + raca + '</td>' +
        '<td>' + categoria + '</td>' +
        '<td>' + fase + '</td>' +
        '<td><span class="tag ' + tag[0] + '">' + tag[1] + '</span></td>' +
        '<td><span class="link-ver">ver</span></td>' +
      '</tr>';
  });
  document.getElementById('tabelaAnimais').innerHTML = linhasTabela;
  document.getElementById('paginacaoInfo').textContent =
    'Mostrando 1–' + s.animais.length + ' de ' + totalAnimais + ' animais';

  // --- Estoque de ração do setor ---
  document.getElementById('estoqueInsumo').textContent = 'Nível crítico — ' + s.insumo;
  document.getElementById('estoqueNivel').textContent = s.nivel;
  document.getElementById('estoqueLabel').textContent = 'Nível atual — ' + s.insumo;
  document.getElementById('estoqueConsumo').textContent = s.consumo;

  var consumoDiarioKg = s.consumo.split(' ')[0]; // extrai só o número de "95 kg/dia"
  document.getElementById('tabelaEstoque').innerHTML =
    '<tr><td>20/08/2026</td><td><span class="tag entrada">Entrada</span></td><td>' + s.insumo + '</td><td>500 kg</td><td>Sistema</td></tr>' +
    '<tr><td>21/08/2026</td><td><span class="tag saida">Saída</span></td><td>' + s.insumo + '</td><td>' + consumoDiarioKg + ' kg</td><td>Sistema</td></tr>';
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
  var email = document.getElementById('loginEmail').value || document.getElementById('cadEmail').value || '';
  var nome = document.getElementById('cadNome').value || '';

  var displayName = nome ? nome.split(' ')[0] : (email ? email.split('@')[0].split('.')[0] : 'Usuário');
  displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  document.getElementById('headerUserName').textContent = displayName;
  document.getElementById('menuUserName').textContent = displayName;
  document.getElementById('menuUserRole').textContent = ROLES[currentRole] ? ROLES[currentRole].label : currentRole;
  document.getElementById('heroGreeting').textContent = 'Bem-vindo(a) de volta, ' + displayName;

  toggleTabsByRole();
  renderSetor();

  document.getElementById('authFlow').classList.add('hidden');
  reveal(document.getElementById('app'));

  // Diretoria não tem aba "Painel" — abre direto em Notas Fiscais.
  // Os demais perfis abrem normalmente no Painel.
  var telaInicial = (currentRole === 'diretoria') ? 'notas' : 'painel';
  go(telaInicial, { currentTarget: document.getElementById('tab-' + telaInicial) });
}

/* Botão "Sair da conta" no menu do usuário */
function logout() {
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
buildSetorGrid();