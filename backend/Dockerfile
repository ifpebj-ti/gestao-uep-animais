FROM node:20-alpine

# Atualiza pacotes do SO para corrigir vulnerabilidades criticas conhecidas
# antes de publicar a imagem.
RUN apk update && apk upgrade --no-cache

# O node:20-alpine vem com um npm global mais antigo, que embute sua própria
# cópia do pacote "tar" (usada internamente pelo npm pra extrair pacotes do
# registro) — essa cópia é o que o Trivy aponta como CRITICAL (CVE-2026-59873,
# gzip bomb), mesmo sem "tar" aparecer em nenhum lugar do nosso package.json.
# Como não é uma dependência nossa, não dá pra corrigir no package.json:
# atualizar o npm em si já traz uma versão do tar sem essa falha (fixed em
# tar@7.5.19, presente a partir do npm@11.18.0).
RUN npm install -g npm@latest

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3000

CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
