# Backlog do Produto — SISGEP (Sistema de Gestão Pecuária)

> Documento de referência do Backlog do Produto, exigido no Marco da Primeira Unidade
> (seção 14.1.3 do Documento de Entregas do Projeto Integrador). As user stories aqui
> descritas devem ser cadastradas como Issues no GitHub e organizadas no GitHub Projects,
> uma a uma, vinculando cada issue ao seu épico (label) e à sua prioridade (label).
>
> Legenda de status: ✅ Concluído · 🔄 Parcial (backend pronto, falta UI ou vice-versa) · ⬜ Não iniciado

Última atualização: 09/09/2026 (Sprint 6 em andamento, conforme cronograma)

---

## Como usar este backlog

1. Cada User Story abaixo vira **uma Issue** no GitHub, com o mesmo título.
2. Cole a "Descrição" e os "Critérios de aceite" no corpo da issue.
3. Aplique as labels sugeridas: `epic:<nome>`, `prioridade:alta|media|baixa`.
4. Adicione a issue ao Project do repositório e defina o campo de Sprint/Status.
5. Marque o item como "Done" no Project somente quando o critério de aceite for
   demonstrável (rodar local, PR revisada, testes passando — ver seção 12 do
   Documento de Entregas).

Convenção de branch/commit ao implementar uma story: `feat/<slug-da-issue>` e
commits `feat: ...` / `fix: ...`, sempre referenciando o número da issue
(`Closes #12`) na descrição do PR.

---

## Épico 1 — Autenticação e Perfis
`epic:autenticacao`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-01 | Autocadastro de usuário por perfil | Alta | ✅ Concluído |
| US-02 | Login único com token de sessão | Alta | ✅ Concluído |
| US-03 | Diretoria concede/altera/remove acesso de usuários | Alta | ✅ Concluído |
| US-04 | Recuperação de senha ("esqueci minha senha") | Alta | ⬜ Não iniciado |
| US-05 | Troca de senha pelo próprio usuário logado | Alta | ⬜ Não iniciado |

### US-01 — Autocadastro de usuário por perfil
**Como** visitante do sistema, **quero** me cadastrar escolhendo meu perfil (Aluno, Técnico,
Estagiário ou Professor), **para** acessar o sistema com as permissões corretas desde o
primeiro acesso.

**Critérios de aceite**
- Professor exige e-mail institucional (`@ifpe.edu.br`); os demais perfis aceitam qualquer e-mail.
- Diretoria (ADMIN) não pode ser escolhida no autocadastro público.
- E-mail já cadastrado é rejeitado com mensagem clara.
- Senha e confirmação de senha devem coincidir.
- Ao concluir, o usuário entra automaticamente no sistema (token emitido).

### US-02 — Login único com token de sessão
**Como** usuário cadastrado, **quero** fazer login com e-mail e senha, **para** acessar minha
área de trabalho já com o perfil correto aplicado, sem escolher o perfil manualmente.

**Critérios de aceite**
- Credenciais inválidas retornam erro sem expor qual campo está errado.
- Token JWT é emitido e persiste a sessão entre recarregamentos de página.
- O perfil do usuário logado determina quais abas ficam visíveis.

### US-03 — Diretoria concede/altera/remove acesso de usuários
**Como** Diretoria, **quero** ver todos os usuários com acesso ao sistema, mudar o perfil de
qualquer um deles ou remover o acesso, **para** administrar quem pode usar o sistema sem
depender de acesso direto ao banco de dados.

**Critérios de aceite**
- Apenas o perfil Diretoria/ADMIN acessa a aba "Controle de Acesso".
- Trocar o perfil de um usuário na tabela reflete imediatamente (persistido via API).
- Remover o acesso de um usuário impede logins futuros dele.
- É possível conceder um novo acesso, inclusive com o perfil Diretoria (única forma de criar
  outro ADMIN, já que ele não aparece no autocadastro público).

### US-04 — Recuperação de senha
**Como** usuário que esqueceu a senha, **quero** solicitar uma redefinição por e-mail,
**para** recuperar o acesso sem depender de um administrador.

**Critérios de aceite**
- Fluxo de "esqueci minha senha" gera um token de redefinição com expiração.
- O token só pode ser usado uma vez.
- A nova senha respeita a política mínima (≥ 6 caracteres).

### US-05 — Troca de senha pelo usuário logado
**Como** usuário autenticado, **quero** trocar minha própria senha a qualquer momento,
**para** manter minha conta segura.

**Critérios de aceite**
- Exige a senha atual para confirmar a troca.
- Nova senha respeita a política mínima.
- Existe uma tela/opção visível no menu do usuário (hoje só existe o endpoint no backend).

---

## Épico 2 — Setores / UEPs
`epic:ueps`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-06 | Listar UEPs disponíveis | Alta | ✅ Concluído |
| US-07 | Cadastrar nova UEP | Média | 🔄 Parcial (API pronta, sem tela) |
| US-08 | Editar dados de uma UEP | Média | 🔄 Parcial (API pronta, sem tela) |
| US-09 | Remover uma UEP | Baixa | 🔄 Parcial (API pronta, sem tela) |

### US-06 — Listar UEPs disponíveis
**Como** usuário autenticado, **quero** ver a lista de UEPs cadastradas ao entrar no sistema,
**para** escolher em qual setor vou trabalhar.

**Critérios de aceite**
- A tela de seleção de setor busca as UEPs reais do banco (não mais dados fixos).
- Cada UEP mostra nome, tipo e uma sigla/cor de identificação.

### US-07 — Cadastrar nova UEP
**Como** ADMIN, PROFESSOR ou TECNICO, **quero** cadastrar uma nova UEP informando nome, tipo
e descrição, **para** expandir os setores geridos pelo sistema sem precisar mexer no banco
diretamente.

**Critérios de aceite**
- Tipo é validado contra a lista de tipos aceitos (Bovinocultura, Suinocultura, etc.).
- ALUNO e ESTAGIARIO não conseguem criar UEP (RBAC).
- Existe uma tela no frontend para isso (hoje só é possível via API).

### US-08 — Editar dados de uma UEP
**Como** ADMIN, PROFESSOR ou TECNICO, **quero** editar nome, tipo ou descrição de uma UEP
existente, **para** manter as informações atualizadas.

**Critérios de aceite**
- Alterações são refletidas imediatamente na tela de seleção de setor.
- Existe uma tela no frontend para isso (hoje só é possível via API).

### US-09 — Remover uma UEP
**Como** ADMIN, **quero** remover uma UEP que não está mais em uso, **para** manter o sistema
organizado.

**Critérios de aceite**
- Remoção é bloqueada ou avisa claramente se a UEP ainda tem animais vinculados.
- Existe uma tela no frontend para isso (hoje só é possível via API).

---

## Épico 3 — Gestão do Rebanho e Censo de Animais
`epic:rebanho`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-10 | Listar animais da UEP com paginação | Alta | ✅ Concluído |
| US-11 | Cadastrar novo animal | Alta | ✅ Concluído |
| US-12 | Censo agregado por categoria e raça | Alta | ✅ Concluído |
| US-13 | Ver detalhamento de um animal específico | Alta | ⬜ Não iniciado |
| US-14 | Editar dados de um animal | Média | 🔄 Parcial (API pronta, sem tela) |
| US-15 | Remover um animal | Baixa | 🔄 Parcial (API pronta, sem tela) |
| US-16 | Filtrar animais por categoria, raça, status e disponibilidade | Média | 🔄 Parcial (UI existe, não conectada à API) |
| US-17 | Buscar animal por brinco, corte australiano ou SISBOV | Média | 🔄 Parcial (API pronta, sem tela) |

### US-10 — Listar animais da UEP com paginação
**Como** usuário do setor, **quero** ver a lista de animais cadastrados na UEP, paginada,
**para** não sobrecarregar a tela quando o rebanho for grande.

**Critérios de aceite**
- A tabela busca os dados reais da API (`GET /ueps/:id/animais`).
- Os botões de página anterior/próxima funcionam e mostram o total correto.

### US-11 — Cadastrar novo animal
**Como** TECNICO, PROFESSOR ou ADMIN, **quero** cadastrar um novo animal informando brinco,
categoria, sexo, raça, data de nascimento e status reprodutivo, **para** manter o rebanho
atualizado.

**Critérios de aceite**
- Categoria, sexo e status reprodutivo são validados contra os valores aceitos.
- O animal aparece na tabela imediatamente após o cadastro.
- ALUNO e ESTAGIARIO não conseguem cadastrar (RBAC).

### US-12 — Censo agregado por categoria e raça
**Como** usuário do setor, **quero** ver o total de animais agrupado por categoria e por
raça, **para** entender a composição do rebanho sem precisar contar manualmente.

**Critérios de aceite**
- Os números batem com os filtros aplicados na tabela (quando houver filtro ativo).
- O censo é recalculado no backend, não estimado no navegador.

### US-13 — Ver detalhamento de um animal específico
**Como** usuário do setor, **quero** clicar em "ver" na tabela e abrir os dados completos de
um animal (incluindo histórico e status reprodutivo em destaque), **para** acompanhar sua
situação individual sem depender só da linha resumida da tabela.

**Critérios de aceite**
- Modal ou tela dedicada mostra todos os campos do animal.
- O status reprodutivo aparece destacado (badge colorido).
- A partir dessa tela é possível acionar a edição (US-14).

### US-14 — Editar dados de um animal
**Como** TECNICO, PROFESSOR ou ADMIN, **quero** editar os dados de um animal já cadastrado,
**para** corrigir erros ou atualizar informações (ex.: mudança de status reprodutivo).

**Critérios de aceite**
- Formulário de edição reaproveita os mesmos campos e validações do cadastro.
- ALUNO e ESTAGIARIO não conseguem editar (RBAC).

### US-15 — Remover um animal
**Como** TECNICO, PROFESSOR ou ADMIN, **quero** remover um registro de animal incorreto ou
duplicado, **para** manter a base de dados confiável.

**Critérios de aceite**
- Pede confirmação antes de remover.
- ALUNO e ESTAGIARIO não conseguem remover (RBAC).

### US-16 — Filtrar animais por categoria, raça, status e disponibilidade
**Como** usuário do setor, **quero** aplicar filtros na tabela de animais, **para** localizar
rapidamente um subconjunto do rebanho (ex.: só fêmeas prenhes).

**Critérios de aceite**
- Os `<select>` de categoria e raça já existem na tela; falta disparar a requisição filtrada
  à API ao selecionar um valor.
- Mais de um filtro pode ser combinado ao mesmo tempo.
- A paginação respeita o filtro ativo.

### US-17 — Buscar animal por identificador
**Como** usuário do setor, **quero** digitar um brinco, corte australiano ou SISBOV na busca,
**para** encontrar um animal específico sem navegar pela tabela toda.

**Critérios de aceite**
- Usa o endpoint já existente (`GET /animais/buscar`).
- Busca funciona mesmo com o identificador parcial (like/ilike).
- Resultado respeita o isolamento por UEP.

---

## Épico 4 — Estoque de Ração
`epic:estoque`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-18 | Registrar entrada/saída de ração | Alta | ⬜ Não iniciado |
| US-19 | Ver nível atual de estoque e consumo estimado | Alta | ⬜ Não iniciado |
| US-20 | Alerta de nível crítico de estoque | Média | ⬜ Não iniciado |

### US-18 — Registrar entrada/saída de ração
**Como** TECNICO, **quero** registrar entradas (compra) e saídas (consumo) de ração por UEP,
**para** manter o controle de estoque do setor.

**Critérios de aceite**
- Cada movimentação tem tipo (entrada/saída), insumo, quantidade e data.
- O saldo do estoque é recalculado automaticamente após cada movimentação.
- Não existe hoje nenhum módulo de estoque no backend — é necessário criar a tabela, os
  endpoints e a lógica de saldo do zero.

### US-19 — Ver nível atual de estoque e consumo estimado
**Como** usuário do setor, **quero** ver o nível atual de ração disponível e o consumo médio
diário, **para** saber quando será necessário repor.

**Critérios de aceite**
- Os valores vêm do banco (hoje a tela mostra "—" fixo, é só um placeholder visual).
- O histórico de movimentações fica visível na aba de Estoque.

### US-20 — Alerta de nível crítico de estoque
**Como** usuário do setor, **quero** ser avisado visualmente quando o estoque de um insumo
atingir um nível crítico, **para** evitar desabastecimento do rebanho.

**Critérios de aceite**
- Regra de negócio define o que é "nível crítico" (ex.: menos de X dias de consumo restante).
- O alerta aparece destacado na tela de Estoque e/ou no Painel.

---

## Épico 5 — Notas Fiscais
`epic:notas-fiscais`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-21 | Anexar nota fiscal a uma compra ou entrada de animal | Média | ⬜ Não iniciado |
| US-22 | Listar notas fiscais cadastradas | Média | ⬜ Não iniciado |

### US-21 — Anexar nota fiscal
**Como** usuário do setor, **quero** anexar o arquivo de uma nota fiscal vinculada a uma
compra de ração ou entrada de animal, **para** manter o histórico documental das operações.

**Critérios de aceite**
- Upload de arquivo (PDF/imagem) com validação de tipo e tamanho.
- A nota fica vinculada à movimentação/animal de origem.
- Hoje o botão "Anexar nota fiscal" só mostra um alerta — não existe upload real.

### US-22 — Listar notas fiscais cadastradas
**Como** Diretoria, **quero** ver todas as notas fiscais cadastradas no sistema, **para**
conferência e prestação de contas.

**Critérios de aceite**
- Lista mostra data, valor, UEP de origem e link para o arquivo anexado.
- Filtro por período e por UEP.

---

## Épico 6 — Relatórios
`epic:relatorios`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-23 | Gerar relatório em PDF do censo geral | Média | ⬜ Não iniciado |
| US-24 | Gerar relatório em PDF do status reprodutivo | Média | ⬜ Não iniciado |
| US-25 | Exportar dados em Excel | Baixa | ⬜ Não iniciado |

### US-23 — Relatório em PDF do censo geral
**Como** Diretoria, **quero** gerar um PDF com a distribuição do rebanho por categoria, raça
e disponibilidade, **para** apresentação institucional.

**Critérios de aceite**
- O botão "Gerar PDF" produz um arquivo real (hoje é só um `alert()`).
- O relatório reflete os dados atuais do banco no momento da geração.

### US-24 — Relatório em PDF do status reprodutivo
**Como** Diretoria, **quero** gerar um PDF com a fase reprodutiva de cada animal agrupada por
categoria, **para** acompanhar a saúde reprodutiva do rebanho.

**Critérios de aceite**
- Mesmo padrão de geração do US-23, com dados de status reprodutivo.

### US-25 — Exportar dados em Excel
**Como** Diretoria, **quero** exportar os dados do rebanho em uma planilha Excel, **para**
fazer análises externas ao sistema.

**Critérios de aceite**
- Exportação inclui pelo menos os mesmos dados do relatório de censo.

---

## Épico 7 — Infraestrutura, CI/CD e Qualidade
`epic:infra`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-26 | Pipeline de CI executando lint, build e testes de verdade | Alta | ⬜ Não iniciado |
| US-27 | Build e publicação de imagem Docker com análise de vulnerabilidades | Alta | ⬜ Não iniciado |
| US-28 | Smoke test automatizado rodando no CI | Alta | 🔄 Parcial (existe, roda só localmente) |
| US-29 | Deploy em VM na nuvem com domínio e SSL | Média | ⬜ Não iniciado |
| US-30 | Observabilidade (métricas, logs, traces) | Baixa | ⬜ Não iniciado |
| US-31 | Teste de carga básico | Baixa | ⬜ Não iniciado |

### US-26 — Pipeline de CI real
**Como** equipe de desenvolvimento, **quero** que o CI rode lint, build e testes de verdade a
cada PR, **para** pegar erros antes do merge.

**Critérios de aceite**
- O job de backend hoje roda `node --test` sem nenhum teste existir — passa vazio sempre.
- Adicionar testes unitários mínimos + rodar o smoke test com um Postgres de serviço no CI.
- Job de frontend hoje é um `echo` de placeholder — precisa de um linter real (ex.: htmlhint).

### US-27 — Build e publicação de imagem Docker com Trivy
**Como** equipe de desenvolvimento, **quero** que a pipeline gere a imagem Docker e rode o
Trivy nela, **para** garantir zero vulnerabilidades críticas antes de publicar no registry.

**Critérios de aceite**
- Imagem publicada no GHCR (GitHub Container Registry).
- Build funcionando em amd64 e arm64.
- Trivy aprovado com 0 vulnerabilidades críticas (exigência explícita do Marco 1).

### US-28 — Smoke test automatizado no CI
**Como** equipe de desenvolvimento, **quero** que o `npm run smoke` rode automaticamente a
cada PR, **para** ter uma rede de segurança real (hoje só roda quando alguém lembra de rodar
manualmente).

**Critérios de aceite**
- CI sobe um Postgres de serviço, roda as migrations e executa o smoke test.
- PR é bloqueada se o smoke falhar.

### US-29 — Deploy em VM na nuvem
**Como** Diretoria/stakeholder, **quero** acessar o sistema publicado numa URL com domínio e
HTTPS, **para** usá-lo fora do ambiente de desenvolvimento.

**Critérios de aceite**
- VM provisionada como IaaS em nuvem pública.
- Domínio configurado, certificado SSL válido, proxy reverso.

### US-30 — Observabilidade
**Como** equipe de desenvolvimento, **quero** ver métricas básicas (CPU, memória, disco),
logs e traces da aplicação, **para** diagnosticar problemas em produção.

**Critérios de aceite**
- Stack leve (ex.: Grafana/OTel/Loki/Tempo) coletando métricas da VM e dos contêineres.

### US-31 — Teste de carga básico
**Como** equipe de desenvolvimento, **quero** rodar um teste de carga com k6, **para**
entender os limites da aplicação antes de apresentá-la.

**Critérios de aceite**
- Script de teste versionado no repositório.
- Relatório com quantidade de requisições simuladas, gargalos identificados e sugestões de
  melhoria.

---

## Épico 8 — Segurança
`epic:seguranca`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-32 | Modelagem de ameaças documentada | Alta | ⬜ Não iniciado |
| US-33 | Guia de boas práticas de desenvolvimento seguro | Alta | ⬜ Não iniciado |
| US-34 | Zero vulnerabilidades críticas (Dependabot) | Alta | 🔄 Parcial (Dependabot ativo, PRs de bump abertos e não avaliados) |

### US-32 — Modelagem de ameaças
**Como** equipe de desenvolvimento, **quero** documentar o que precisa ser protegido, as
principais ameaças, o impacto e como mitigá-las, **para** priorizar os controles de segurança
certos.

**Critérios de aceite**
- Documento na Wiki cobrindo pelo menos: dados de usuários/senhas, dados de animais/UEPs,
  tokens JWT, e o próprio pipeline de CI/CD.

### US-33 — Guia de boas práticas de desenvolvimento seguro
**Como** equipe de desenvolvimento, **quero** um guia com diretrizes mínimas de autenticação,
autorização, validação de entradas, segredos e logs, **para** manter um padrão de segurança
consistente entre todos que codam no projeto.

**Critérios de aceite**
- Documento cobre os pontos exigidos: autenticação, autorização, inputs, upload de arquivos,
  dependências, segredos, logs, erros.

### US-34 — Zero vulnerabilidades críticas
**Como** equipe de desenvolvimento, **quero** revisar e mergear os PRs do Dependabot,
**para** não acumular dependências vulneráveis conhecidas.

**Critérios de aceite**
- Os PRs de dependabot já abertos no repositório são avaliados (testados e mergeados, ou
  fechados com justificativa).
- Nenhuma vulnerabilidade crítica ou alta sem tratamento fica aberta.

---

## Épico 9 — Documentação e Governança
`epic:docs`

| # | User Story | Prioridade | Status |
|---|---|---|---|
| US-35 | README principal completo | Alta | ⬜ Não iniciado |
| US-36 | Wiki com documentação consolidada | Alta | ⬜ Não iniciado |
| US-37 | Templates de Issue e Pull Request | Alta | ⬜ Não iniciado |
| US-38 | CHANGELOG e releases | Média | ⬜ Não iniciado |
| US-39 | Branch principal protegida | Alta | ⬜ Não iniciado |

### US-35 — README principal completo
**Como** qualquer pessoa que abrir o repositório, **quero** entender o que é o projeto, como
rodar e quem é a equipe só de ler o README, **para** não depender de explicação verbal.

**Critérios de aceite**
- Contém: nome, descrição, problema resolvido, tecnologias, links para Wiki/protótipos,
  equipe e papéis (exigência da seção 13.1 do Documento de Entregas).

### US-36 — Wiki com documentação consolidada
**Como** avaliador do projeto, **quero** encontrar toda a documentação técnica e funcional
organizada na Wiki do repositório, **para** avaliar o projeto sem precisar pedir arquivos
soltos.

**Critérios de aceite**
- Contém, no mínimo: Documento de Visão, Arquitetura e Modelagem de Dados, Guia de Segurança
  e Privacidade, Estratégia de Testes, Guia de Execução/Deploy/Operação, Manual de Uso,
  Análise de Concorrência, Modelagem de Ameaças.

### US-37 — Templates de Issue e Pull Request
**Como** equipe de desenvolvimento, **quero** templates padronizados ao abrir uma issue ou
PR, **para** garantir que título, descrição, objetivo e critério de aceite nunca fiquem de
fora.

**Critérios de aceite**
- Template de issue cobre: título, descrição, objetivo, critério de aceite, labels,
  responsável.
- Template de PR cobre: o que foi feito, como testar, issue relacionada.

### US-38 — CHANGELOG e releases
**Como** avaliador do projeto, **quero** ver a evolução do sistema através de releases e um
changelog, **para** acompanhar o progresso sem precisar ler todos os commits.

**Critérios de aceite**
- Cada entrega relevante gera uma tag, uma release no GitHub e uma entrada no
  `CHANGELOG.md`.

### US-39 — Branch principal protegida
**Como** equipe de desenvolvimento, **quero** que a branch `main` exija PR e não aceite push
direto, **para** evitar que um merge malfeito (como o da regressão do PR #19) aconteça sem
revisão.

**Critérios de aceite**
- `main` configurada com branch protection: PR obrigatório, pelo menos 1 aprovação, CI
  precisa passar antes do merge.

---

## Resumo por prioridade

**Alta (fazer antes do Marco 1, 30/09):** US-01 a US-03, US-04, US-05, US-06, US-10 a US-13,
US-26 a US-28, US-32 a US-34 (parcial), US-35 a US-37, US-39.

**Média (Marco 1 tardio / início do Marco 2):** US-07, US-08, US-16, US-17, US-18 a US-21,
US-23, US-24, US-29, US-38.

**Baixa (Marco 2 ou se sobrar tempo):** US-09, US-15, US-20, US-22, US-25, US-30, US-31.

---

## Mapeamento com o cronograma de sprints

| Sprint | Período | Épicos relacionados |
|---|---|---|
| 3 | 15/08–21/08 | Épico 1 (concluído) |
| 4 | 22/08–28/08 | Épico 2 (concluído, falta UI) |
| 5 | 29/08–04/09 | Épico 3 — censo (concluído) |
| 6 (atual) | 05/09–11/09 | Épico 3 — US-13, US-14 (detalhamento/edição de animal) |
| 7 | 12/09–18/09 | Épico 3 — US-16, US-17 (filtros e busca) |
| 8 | 19/09–25/09 | Épico 9 — fechamento da documentação da Unidade 1 |
| 9 | 26/09–30/09 | Entrega do Marco 1 — Épicos 7, 8, 9 em dia |
| 10–11 | 01/10–16/10 | Épico 4 — Estoque de Ração |
| 12 | 17/10–23/10 | Épico 5 — Notas Fiscais |
| 13 | 24/10–30/10 | Épico 6 — Relatórios |
| 14 | 31/10–06/11 | Épico 7 — testes de carga e qualidade de código |
| 15 | 07/11–13/11 | Épico 9 — Manual de Uso e Guia de Privacidade |
