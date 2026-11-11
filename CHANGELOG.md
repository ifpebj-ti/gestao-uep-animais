# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Segurança
- Sprint 3: `JWT_SECRET` passa a ser obrigatório em produção (o backend não sobe com o valor de exemplo)
- Sprint 3: cada requisição confere se a conta do token ainda existe e está ativa, e usa o papel atual do banco
- Sprint 4: isolamento por UEP no backend — dados em `/api/ueps/:uepId/*` (animais, estoque, compras) só para quem tem acesso à UEP (Diretoria: todas; Professor: as concedidas; equipe: a própria), senão 403
- Sprint 4: criar, editar e excluir UEP passa a ser exclusivo da Diretoria (ADMIN)
- Sprint 5: animais de outra UEP não são mais alcançáveis pela rota de um setor (`/ueps/:uepId/animais/:id` → 404) e as rotas da raiz (`/api/animais`) só mostram as UEPs do usuário
- Sprint 13: `npm audit fix` nas dependências de produção do backend (body-parser/qs); XLSX gerado sem exceljs para não trazer pacotes com vulnerabilidade
- Sprint 14: token JWT exposto em `loadtest/resultado.json` foi removido do repositório, o `JWT_SECRET` de produção foi rotacionado e o arquivo passou a ser ignorado no `.gitignore`
- Sprint 14: HTTPS com certificado Let's Encrypt no proxy reverso e portas diretas da aplicação (3000, 5000 e 8080) fechadas no firewall

### Corrigido
- Sprint 3: login aceita o e-mail com maiúsculas/espaços; JSON malformado no corpo devolve 400 em vez de 500; senha mínima de 6 caracteres também no autocadastro
- Sprint 4: id de UEP inválido (`/ueps/abc`) e filtros fora do enum devolvem 400 em vez de 500
- Sprint 5: PATCH de animal consegue limpar campos opcionais (ex.: apagar as observações); filtros do censo validados (400); brinco/SISBOV repetido devolve 409 com mensagem clara; data de nascimento futura é recusada
- Sprint 6: datas (`DATE`) passam a sair da API como `AAAA-MM-DD`, sem depender do fuso do servidor
- Sprint 10: quantidades com mais de 3 casas decimais e movimentações com data futura são recusadas (antes eram arredondadas em silêncio ou geravam 500)
- Sprint 11: `.env.prod.example` atualizado (`IMAGE_TAG`, `CORS_ORIGINS`, `APP_DOMAIN`) e com aviso de que o `.env` não executa comandos

### Adicionado
- Sprint 3: `backend/src/app.js` separado do `index.js` (base para testes de integração) e rota `GET /api/health`
- Sprint 4: contas de demonstração já nascem vinculadas (Professor demo com todas as UEPs; Técnico/Estagiário/Aluno demo na equipe dele)
- Sprint 6: atributos genéticos dos animais — grau de sangue, pai e mãe (genealogia, `GET .../animais/:id/genealogia`), idade em meses e estágio de vida (CRIA/RECRIA/ADULTO) calculados; censo por estágio e filtro `?estagioVida=`
- Sprint 6: regra de coerência entre categoria, sexo e fase reprodutiva (ex.: VACA exige fêmea; macho não fica PRENHE/LACTANTE/VAZIA)
- Sprint 7: regra de disponibilidade do animal no setor — todo indisponível tem motivo (VENDIDO, OBITO, TRANSFERIDO, EM_TRATAMENTO, QUARENTENA, RESERVADO, DESCARTE, OUTRO) e data; animal em DESCARTE nunca fica disponível; resumo em `GET .../animais/disponibilidade` e filtro `?motivoIndisponibilidade=`
- Sprint 10: `GET/PATCH /api/ueps/:uepId/insumos/:id` para consultar e editar o cadastro do insumo (nome, unidade, estoque mínimo, consumo médio); o saldo continua mudando só por movimentação
- Sprint 10: VM em nuvem (IaaS) na Oracle Cloud com Docker e Docker Compose, IP público reservado e swap para a memória limitada
- Sprint 11: deploy conteinerizado na VM a partir das imagens do GHCR e proxy reverso Caddy com HTTPS automático (`Caddyfile` e `docker-compose.proxy.yml`, domínio configurável por `APP_DOMAIN`)
- Sprint 11: regra de alerta de nível crítico de estoque (CRITICO = saldo no mínimo ou abaixo; ATENCAO = acaba em menos de 7 dias). Insumos saem com `nivel_alerta` e `previsao_dias`; novos `GET /api/ueps/:uepId/estoque/alertas` e `GET /api/estoque/alertas` (painel com as UEPs do usuário); compras passa a usar a mesma regra
- Sprint 12: cobertura mínima de 70% também no serviço de dados (`pytest-cov`) no CI
- Sprint 13: módulo de relatórios do gestor — `POST /api/relatorios/:tipo/gerar` em PDF ou Excel (.xlsx) para censo geral, status reprodutivo, movimentação de estoque (por período) e necessidades de compra; só Diretoria
- Sprint 13: documentos (notas fiscais e outros PDFs) — upload até 10 MB guardado no Postgres, listagem, download, remoção e `POST /api/documentos/unir` (junta documentos e relatórios gerados na hora em um PDF), no contrato que o front da Sprint 13 já usa
- Sprint 14: calendário de atividades dos animais — `GET/POST /api/ueps/:uepId/atividades` e `PATCH/DELETE .../atividades/:id` (gestação, vermífugo, vacina, aula de manejo, outro), no contrato que o front já usa; qualquer perfil da UEP registra, Professor ou autor altera
- Sprint 14: testes de integração da API contra Postgres real (`backend/test/integration`) e `npm run test:coverage` (c8) com mínimo de 70% — hoje ~97% de linhas; o CI roda no job de migrações e publica o relatório como artefato
- Sprint 14: teste de carga básico com k6 (`loadtest/k6-smoke.js`): 10 usuários virtuais por 80 s, 0% de falhas e p95 de 142 ms

## [0.3.0] - 2026-09-30

Entrega do Marco da Primeira Unidade.

### Adicionado
- Documentação completa na Wiki: Documento de Visão, Análise de Concorrência, Arquitetura e Modelagem de Dados, Modelagem de Ameaças, Guia de Boas Práticas de Desenvolvimento Seguro, Guia de Execução/Configuração/Deploy/Operação
- `docker-compose.prod.yml`: usa as imagens publicadas no GHCR em vez de build local
- Healthcheck e `depends_on: condition: service_healthy` em todos os serviços

PRs: #89

## [0.2.0] - 2026-09-23

### Adicionado
- Hierarquia de perfis Diretoria > Professor > Equipe no controle de acesso
- Professor pode ter acesso a mais de uma UEP simultaneamente
- Login com Google restrito a contas institucionais IFPE
- Tags semver das imagens publicadas no GHCR

PRs: #78, #79

## [0.1.0] - 2026-09-23

Marco da Primeira Unidade.

### Adicionado
- Estrutura inicial do monorepo (frontend, backend, data), Docker Compose e esteira de CI/CD inicial
- Protótipo SISGEP: login único, seleção de perfil e setor/UEP, controle de acesso da Diretoria
- Endpoint de autocadastro de usuário (`POST /api/auth/register`)
- Seed de UEPs e de animais de teste para ambiente de desenvolvimento
- Conta de demonstração por perfil de usuário
- Censo de animais por raça, com paginação na listagem
- Modal de cadastro de animal, com detalhe/edição/remoção por usuário e UEP
- Login com Google (Identity Services)
- Smoke test de integração real e lint real do frontend no CI
- Esteira de CI/CD consolidada em workflow único: lint, build, testes, automação de migrações, build/scan/push de imagem
- Templates de issue, PR e Dependabot

### Corrigido
- Vulnerabilidades críticas apontadas pelo Trivy nas imagens Docker
- Migrações do banco rodando automaticamente antes de iniciar o backend
- Escopo de UEP na busca por identificador (era `OR`, corrigido para `AND`)
- Diversos ajustes de frontend: handlers de login/cadastro, exibição do censo, payload de cadastro de animal
- CVE do `tar` no Dockerfile do backend

PRs: #1, #13, #15, #16, #19, #21, #61, #62, #63, #66, #67, #68, #69, #70, #75, #76, #78, #79, #89