# Gestão UEP - Agropecuária - animais

Link para apresentação de acompanhamento semanal: https://canva.link/3n39oiun5u3gdbf

![CI](https://github.com/ifpebj-ti/gestao-uep-animais/actions/workflows/ci.yml/badge.svg)
![Docker Build](https://github.com/ifpebj-ti/gestao-uep-animais/actions/workflows/docker-build.yml/badge.svg)
![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)

## Descrição

Sistema de gestão das Unidades Educativas de Produção (UEPs) agropecuárias (animais), cobrindo
navegação por setores (Bovinocultura, Suinocultura, Caprinocultura, etc), gestão de rebanho, controle de estoque de ração, geração de relatórios e apoio a processos de compra.

## Problema resolvido

Centralizar e automatizar o controle das UEPs, hoje feito de forma manual/descentralizada,
reduzindo erros de censo de rebanho, estoque e geração de relatórios.

## Tecnologias

- **Front-end:** HTML, CSS
- **Back-end:** JavaScript (API)
- **Dados:** Python (processamento e relatórios)
- **Infraestrutura:** Docker / Docker Compose

## Links

- 📖 [Wiki do projeto](../../wiki)
- 📊 [Backlog / GitHub Projects](https://github.com/orgs/ifpebj-ti/projects)
- 📝 [Sprint Report](#)

## Equipe

| Nome                | Papel                  |
| Jakelyne Cavalcanti | DevSecOps / Infra / QA |
| Lucas Antônio       | Backend / DB           |
| João Guilherme      | Frontend / UX / UI     |

## Como rodar localmente

```bash
cp .env.example .env
docker compose up --build
```

Consulte o [Guia de Execução, Configuração, Deploy e Operação](../../wiki) na Wiki para
detalhes completos.

## Licença

Distribuído sob a licença [Apache-2.0](./LICENSE).
