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
var USERS = [
  { nome: 'Cleber Silva', email: 'cleber.silva@ifpe.edu.br', senha: '123456', role: 'diretoria' },
  { nome: 'Arsênio Souza', email: 'arsenio.souza@ifpe.edu.br', senha: '123456', role: 'professor' },
  { nome: 'Marcos Lima', email: 'marcos.lima@ifpe.edu.br', senha: '123456', role: 'tecnico' },
  { nome: 'Ana Beatriz', email: 'ana.beatriz@aluno.ifpe.edu.br', senha: '123456', role: 'estagiario' },
  { nome: 'João Pedro', email: 'joao.pedro@aluno.ifpe.edu.br', senha: '123456', role: 'aluno' }
];


/* =====================================================================
   3. CONFIGURAÇÃO — SETORES / UEPs
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
var currentUser = null; // referência ao objeto de USERS que está logado
var currentRole = '';
var currentSetor = '';


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


/* =====================================================================
   5. TELA DE SELEÇÃO DE SETOR
   Os tiles são gerados a partir de SETORES em vez de escritos à mão no
   HTML — adicionar um novo setor no futuro é só adicionar uma entrada
   no objeto acima.
   ===================================================================== */
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
   6. FLUXO DE AUTENTICAÇÃO (login único / cadastro com perfil embutido)
   BACKEND: handleLogin/handleCadastro hoje validam tudo contra o array
   USERS, no próprio navegador. Troque o corpo dessas duas funções por
   chamadas fetch/axios para POST /api/auth/login e POST /api/auth/cadastro,
   mantendo a mesma sequência (em caso de sucesso → showAuth('auth-setor')).
   ===================================================================== */

/* Procura em USERS uma conta cujo e-mail e senha batam com o informado.
   Retorna o objeto do usuário, ou undefined se não achar. */
function tentarLogin(email, senha) {
  email = email.trim().toLowerCase();
  return USERS.find(function (u) {
    return u.email.toLowerCase() === email && u.senha === senha;
  });
}

/* onsubmit do #loginForm */
function handleLogin(e) {
  e.preventDefault();
  hideFormError('loginError');

  var email = document.getElementById('loginEmail').value;
  var senha = document.getElementById('loginSenha').value;
  var user = tentarLogin(email, senha);

  if (!user) {
    showFormError('loginError'); // usa a mensagem padrão já escrita no HTML
    return;
  }

  currentUser = user;
  currentRole = user.role;
  showAuth('auth-setor');
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
  document.getElementById('cadEmail').pattern = institucional ? '.+@ifpe\\.edu\\.br$' : '';
  document.getElementById('cadHint').style.display = institucional ? 'block' : 'none';
}

/* onsubmit do #cadastroForm */
function handleCadastro(e) {
  e.preventDefault();
  hideFormError('cadError');

  var nome = document.getElementById('cadNome').value.trim();
  var role = document.getElementById('cadRole').value;
  var email = document.getElementById('cadEmail').value.trim().toLowerCase();
  var senha = document.getElementById('cadSenha').value;
  var senha2 = document.getElementById('cadSenha2').value;

  if (senha !== senha2) {
    showFormError('cadError', 'As senhas digitadas não conferem.');
    return;
  }
  if (USERS.some(function (u) { return u.email.toLowerCase() === email; })) {
    showFormError('cadError', 'Já existe uma conta cadastrada com esse e-mail.');
    return;
  }

  var novoUsuario = { nome: nome, email: email, senha: senha, role: role };
  USERS.push(novoUsuario);
  currentUser = novoUsuario;
  currentRole = role;
  showAuth('auth-setor');
}

/* Chamado ao clicar num tile de setor/UEP — encerra o fluxo de autenticação e entra no app */
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

/* Repinta a tabela de contas com acesso, uma linha por usuário em USERS */
function renderControleAcesso() {
  var linhas = '';
  USERS.forEach(function (u, indice) {
    linhas +=
      '<tr>' +
        '<td>' + u.nome + '</td>' +
        '<td>' + u.email + '</td>' +
        '<td>' + roleBadge(u.role) + '</td>' +
        '<td><select class="fake-select" style="min-width:150px;" onchange="alterarAcesso(' + indice + ', this.value)">' +
              buildRoleOptions(u.role, true) +
            '</select></td>' +
        '<td><span class="link-ver" style="color:var(--if-red);" onclick="removerAcesso(' + indice + ')">remover</span></td>' +
      '</tr>';
  });
  document.getElementById('tabelaAcessos').innerHTML = linhas;
}

/* Chamado ao trocar o <select> de perfil de uma linha da tabela */
function alterarAcesso(indice, novoRole) {
  USERS[indice].role = novoRole;
  renderControleAcesso();
}

/* Chamado ao clicar em "remover", numa linha da tabela */
function removerAcesso(indice) {
  USERS.splice(indice, 1);
  renderControleAcesso();
}

/* onsubmit do formulário "Conceder novo acesso" */
function concederAcesso() {
  hideFormError('acessoError');

  var nome = document.getElementById('naNome').value.trim();
  var email = document.getElementById('naEmail').value.trim().toLowerCase();
  var role = document.getElementById('naRole').value;
  var senha = document.getElementById('naSenha').value;

  if (USERS.some(function (u) { return u.email.toLowerCase() === email; })) {
    showFormError('acessoError', 'Já existe um acesso cadastrado com esse e-mail.');
    return;
  }

  USERS.push({ nome: nome, email: email, senha: senha, role: role });
  document.getElementById('novoAcessoForm').reset();
  renderControleAcesso();
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
  document.getElementById('userMenu').classList.remove('show');
  document.getElementById('app').classList.add('hidden');
  reveal(document.getElementById('authFlow'));

  currentUser = null;
  currentRole = '';
  currentSetor = '';

  showAuth('auth-login');
  document.getElementById('loginForm').reset();
  document.getElementById('cadastroForm').reset();
  hideFormError('loginError');
  hideFormError('cadError');
}


/* =====================================================================
   11. INICIALIZAÇÃO
   ===================================================================== */
buildSetorGrid();
buildCadastroRoleOptions();
document.getElementById('naRole').innerHTML = buildRoleOptions(null, true); // formulário de concessão inclui Diretoria