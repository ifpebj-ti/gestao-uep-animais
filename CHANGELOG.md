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

### Corrigido
- Sprint 3: login aceita o e-mail com maiúsculas/espaços; JSON malformado no corpo devolve 400 em vez de 500; senha mínima de 6 caracteres também no autocadastro
- Sprint 4: id de UEP inválido (`/ueps/abc`) e filtros fora do enum devolvem 400 em vez de 500
- Sprint 5: PATCH de animal consegue limpar campos opcionais (ex.: apagar as observações); filtros do censo validados (400); brinco/SISBOV repetido devolve 409 com mensagem clara; data de nascimento futura é recusada
- Sprint 6: datas (`DATE`) passam a sair da API como `AAAA-MM-DD`, sem depender do fuso do servidor
- Sprint 10: quantidades com mais de 3 casas decimais e movimentações com data futura são recusadas (antes eram arredondadas em silêncio ou geravam 500)

### Adicionado
- Sprint 3: `backend/src/app.js` separado do `index.js` (base para testes de integração) e rota `GET /api/health`
- Sprint 6: atributos genéticos dos animais — grau de sangue, pai e mãe (genealogia, `GET .../animais/:id/genealogia`), idade em meses e estágio de vida (CRIA/RECRIA/ADULTO) calculados; censo por estágio e filtro `?estagioVida=`
- Sprint 6: regra de coerência entre categoria, sexo e fase reprodutiva (ex.: VACA exige fêmea; macho não fica PRENHE/LACTANTE/VAZIA)
- Sprint 7: regra de disponibilidade do animal no setor — todo indisponível tem motivo (VENDIDO, OBITO, TRANSFERIDO, EM_TRATAMENTO, QUARENTENA, RESERVADO, DESCARTE, OUTRO) e data; animal em DESCARTE nunca fica disponível; resumo em `GET .../animais/disponibilidade` e filtro `?motivoIndisponibilidade=`
- Sprint 10: `GET/PATCH /api/ueps/:uepId/insumos/:id` para consultar e editar o cadastro do insumo (nome, unidade, estoque mínimo, consumo médio); o saldo continua mudando só por movimentação
- Sprint 11: regra de alerta de nível crítico de estoque (CRITICO = saldo no mínimo ou abaixo; ATENCAO = acaba em menos de 7 dias). Insumos saem com `nivel_alerta` e `previsao_dias`; novos `GET /api/ueps/:uepId/estoque/alertas` e `GET /api/estoque/alertas` (painel com as UEPs do usuário); compras passa a usar a mesma regra

- Sprint 4: contas de demonstração já nascem vinculadas (Professor demo com todas as UEPs; Técnico/Estagiário/Aluno demo na equipe dele)
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