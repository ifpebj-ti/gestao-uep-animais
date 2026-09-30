# Gestão UEP - Agropecuária - Animais

![CI/CD](https://github.com/ifpebj-ti/gestao-uep-animais/actions/workflows/ci-cd.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

Link para apresentação de acompanhamento semanal: https://canva.link/3n39oiun5u3gdbf

## Descrição

Sistema de gestão das Unidades Educativas de Produção (UEPs) agropecuárias (animais), cobrindo
navegação por setores (Bovinocultura, Suinocultura, Caprinocultura, etc.), gestão de rebanho,
controle de estoque de ração, geração de relatórios e apoio a processos de compra.

## Problema resolvido

Centralizar e automatizar o controle das UEPs, hoje feito de forma manual/descentralizada,
reduzindo erros de censo de rebanho, estoque e geração de relatórios.

## Tecnologias

| Camada          | Tecnologia                                      |
|-----------------|-------------------------------------------------|
| Front-end       | HTML, CSS, JavaScript (servido via Nginx)       |
| Back-end        | Node.js 20 + Express (API REST, JWT, RBAC)      |
| Dados           | Python 3.12 + Flask + Pandas                    |
| Banco de dados  | PostgreSQL 16                                   |
| Infraestrutura  | Docker, Docker Compose, GitHub Actions, GHCR    |

## Estrutura do repositório

```
gestao-uep-animais/
├── frontend/              # Interface web (HTML/CSS/JS + Nginx)
├── backend/               # API REST (Node.js/Express), migrations e testes
├── data/                  # Serviço de dados e relatórios (Python/Flask)
├── .github/               # CI/CD, Dependabot, templates de issue e PR
├── docker-compose.yml     # Ambiente de desenvolvimento (build local)
└── docker-compose.prod.yml# Ambiente de produção (imagens do GHCR)
```

## Documentação

Toda a documentação do projeto está na [Wiki](../../wiki):

- 📄 Documento de Visão do Projeto
- 🔍 Análise de Concorrência
- 🏗️ Arquitetura e Modelagem de Dados
- 🛡️ Modelagem de Ameaças
- 🔐 Guia de Boas Práticas de Desenvolvimento Seguro
- ⚙️ Guia de Execução, Configuração, Deploy e Operação

Outros links:

- 📊 [Backlog e Requisitos (GitHub Projects)](https://github.com/orgs/ifpebj-ti/projects)
- 📝 [Changelog](./CHANGELOG.md)

## Como rodar localmente

Pré-requisitos: Docker e Docker Compose instalados.

```bash
cp .env.example .env
docker compose up --build
```

Serviços disponíveis após subir:

| Serviço   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:8080        |
| Backend   | http://localhost:3000        |
| Health    | http://localhost:3000/health |
| Dados     | http://localhost:5000/health |

As migrations do banco rodam automaticamente na inicialização do backend.

> As contas de demonstração (uma por perfil) são criadas apenas para desenvolvimento.
> Consulte `backend/.env.example`. Nunca use essas credenciais em produção.

## Como rodar em produção

Usa as imagens publicadas no GitHub Container Registry, sem build local:

```bash
cp .env.prod.example .env
# preencha todas as variáveis obrigatórias (senhas, JWT_SECRET, API_URL)
docker compose -f docker-compose.prod.yml up -d
```

Para usar uma versão específica, defina `IMAGE_TAG` no `.env` (ex.: `IMAGE_TAG=0.3.0`).

## Testes e lint

```bash
# Backend
cd backend
npm install
npx eslint src
npm test

# Dados
cd data
pip install -r requirements-dev.txt
flake8 scripts/ --max-line-length=100
pytest test/ -v

# Frontend
cd frontend
npm install
npm run lint:html
npm run lint:css
```

## Esteira de CI/CD

O workflow [`ci-cd.yml`](./.github/workflows/ci-cd.yml) roda em todo push e pull request para a `main`:

1. **Lint** — ESLint (backend), flake8 (dados), HTMLHint e Stylelint (frontend)
2. **Build** — validação de sintaxe e compilação de cada serviço
3. **Testes** — testes automatizados do backend e do serviço de dados
4. **Migrações** — executa as migrations contra um PostgreSQL real, checa idempotência e roda smoke test da API
5. **Build da imagem** — imagem Docker de cada serviço
6. **Análise da imagem** — Trivy bloqueia o pipeline se houver vulnerabilidade crítica
7. **Publicação** — imagens enviadas ao GHCR (`ghcr.io/ifpebj-ti/gestao-uep-animais/<serviço>`)

Tags publicadas: `main` e `sha-<commit>` a cada push na main; `X.Y.Z`, `X.Y` e `latest` em releases (`vX.Y.Z`).

## Segurança

- Dependências monitoradas semanalmente pelo **Dependabot** (npm, pip, Docker e GitHub Actions)
- Imagens analisadas pelo **Trivy** antes da publicação
- Autenticação via JWT e login com Google restrito a contas institucionais IFPE
- Controle de acesso por perfil (Diretoria > Professor > Equipe)

Veja a Modelagem de Ameaças e o Guia de Boas Práticas na [Wiki](../../wiki).

## Equipe

| Nome                | Papel                  |
|---------------------|------------------------|
| Jakelyne Cavalcanti | DevSecOps / Infra / QA |
| Lucas Antônio       | Backend / DB           |
| João Guilherme      | Frontend / UX / UI     |

## Licença

Distribuído sob a licença [Apache-2.0](./LICENSE).