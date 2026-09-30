# Changelog

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere a [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

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