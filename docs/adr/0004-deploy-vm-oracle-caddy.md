# 0004. Deploy em VM da Oracle Cloud com Docker Compose e Caddy

- **Status:** Aceito
- **Data:** 2026-10 (VM na Sprint 10, proxy reverso na Sprint 11)

## Contexto

O sistema precisa ficar no ar em nuvem pública com HTTPS (requisito do Documento de Visão), com custo zero ou perto disso, e ser operado por uma equipe de três pessoas. São quatro containers (frontend, backend, serviço de dados e PostgreSQL), cujas imagens a esteira de CI/CD já publica no GitHub Container Registry (GHCR).

## Decisão

- **Infraestrutura (IaaS):** uma VM na **Oracle Cloud**, região São Paulo (`sa-saopaulo-1`), com IP público reservado e swap configurado para compensar a memória limitada.
- **Orquestração:** **Docker Compose** com `docker-compose.prod.yml`, que usa as imagens versionadas do GHCR (não faz build na VM). Todos os serviços têm healthcheck e sobem na ordem certa com `depends_on: condition: service_healthy`.
- **Proxy reverso e TLS:** **Caddy 2** (`docker-compose.proxy.yml` + `Caddyfile`), que emite e renova sozinho os certificados Let's Encrypt. `<domínio>` vai para o frontend e `api.<domínio>` para o backend. O domínio é configurável por `APP_DOMAIN`; hoje é `uepanimais.me`.
- **Rede:** o firewall da VM só libera as portas **22, 80 e 443**.
- **Segredos:** ficam só no `.env` da VM. O Compose de produção se recusa a subir sem `JWT_SECRET`, `DB_PASSWORD` e as senhas das contas semente.

## Alternativas consideradas

- **PaaS (Render, Railway, Fly.io):** deploy mais simples, mas os planos gratuitos dormem, limitam o banco ou mudam de regra; e o Documento de Visão prevê a execução em VM na nuvem pública (IaaS).
- **Kubernetes (k3s, OKE):** escalável, mas complexo demais para quatro containers e uma VM pequena.
- **Nginx + Certbot como proxy:** funciona, mas exige configurar a renovação do certificado à parte. O Caddy faz isso sozinho, com um `Caddyfile` de poucas linhas.

## Consequências

- **Positivas:** custo zero no nível gratuito da Oracle, HTTPS automático e deploy repetível: atualizar é `docker compose pull && docker compose up -d`. As imagens são as mesmas que passaram pelo CI e pelo Trivy.
- **Negativas e riscos aceitos:**
  - Ponto único de falha: se a VM cair, o sistema todo cai. Não há réplica nem balanceador.
  - Backup do volume do PostgreSQL é responsabilidade manual da equipe (`pg_dump`).
  - O deploy na VM ainda é manual, por SSH; não há entrega contínua automática.
  - Depende do nível gratuito da Oracle, que pode recuperar VMs ociosas.
