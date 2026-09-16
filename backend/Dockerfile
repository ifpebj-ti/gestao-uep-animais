FROM node:26-alpine

# Atualiza pacotes do SO para corrigir vulnerabilidades criticas conhecidas
# antes de publicar a imagem.
RUN apk update && apk upgrade --no-cache

# O node:20-alpine vem com um npm global mais antigo, que embute sua própria
# cópia do pacote "tar" (usada internamente pelo npm pra extrair pacotes do
# registro) — essa cópia é o que o Trivy aponta como CRITICAL (CVE-2026-59873,
# gzip bomb), mesmo sem "tar" aparecer em nenhum lugar do nosso package.json.
# Como não é uma dependência nossa, não dá pra corrigir no package.json:
# atualizar o npm em si já traz uma versão do tar sem essa falha (fixed a
# partir do npm@11.18.0, que já embute tar@7.5.19+).
#
# NÃO usar "npm@latest" aqui: a partir do npm 12 o próprio npm passou a
# exigir Node >=22, e essa imagem roda Node 20 (o "npm install -g npm@latest"
# quebra o build com EBADENGINE). 11.18.0 é a versão fixa mais antiga já
# corrigida, e roda em Node ^20.17.0 || >=22.9.0 — compatível com o node:20
# desta imagem.
RUN npm install -g npm@11.18.0

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3000

CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
