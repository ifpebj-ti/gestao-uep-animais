# 0003. Serviço de dados separado em Python/Flask

- **Status:** Aceito, com revisão pendente
- **Data:** 2026-09 (revisão de escopo na Sprint 13)

## Contexto

No início do projeto, a ideia era concentrar relatórios e processamento de dados (agregações do censo, consumo de ração, projeções) num serviço com o ecossistema de dados do Python (Pandas), separado da API de negócio em Node.js. Isso também atendia o uso obrigatório de Python previsto no Documento de Visão.

## Decisão

- Existe um terceiro serviço, `data`, em **Python 3.12 + Flask**, com imagem própria no GHCR, healthcheck no Docker Compose e cobertura mínima de 70% (`pytest-cov`) no CI.
- A intenção era que o backend chamasse o serviço por HTTP, dentro da rede do Docker Compose, sempre que precisasse de processamento de dados.

## O que mudou depois (Sprint 13)

Os relatórios em PDF e Excel foram implementados **no backend em Node.js** (`pdfkit` e um gerador de XLSX próprio), e não no serviço de dados. Motivos:

- os relatórios precisam do mesmo controle de acesso por perfil e por UEP da API; repetir isso no Flask duplicaria regras de segurança;
- as consultas são agregações simples, que o PostgreSQL faz direto (Pandas não era necessário);
- evita uma chamada a mais entre serviços e um segundo lugar para falhar.

Hoje o serviço `data` expõe só `GET /health`.

## Consequências

- **Positivas:** a estrutura para processamento em Python já está pronta (imagem, CI, cobertura, deploy) se surgir uma análise que justifique, como projeção de consumo ou indicadores reprodutivos.
- **Negativas:**
  - É um container a mais rodando na VM, com memória limitada, sem função de negócio no momento.
  - A porta 5000 é publicada no host pelo `docker-compose.prod.yml`. Hoje o firewall da VM só libera 22, 80 e 443, mas o mais seguro é não publicar a porta.
- **Revisão pendente:** decidir num ADR novo entre (a) dar ao serviço uma responsabilidade real, chamada só pelo backend, ou (b) retirá-lo da arquitetura e do deploy.
