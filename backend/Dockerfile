# ---------------------------------------------------------------------------
# Etapa 1 (deps): instala SO as dependencias de producao. O npm so existe
# aqui; esta etapa nao vai para a imagem publicada.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Etapa 2 (imagem final): so o Node, o node_modules da etapa anterior e o
# codigo. A API roda com "node" direto, entao npm, npx, yarn e corepack sao
# removidos: o npm global embute pacotes proprios (tar, undici,
# brace-expansion, ip-address...) que o Trivy aponta como HIGH/CRITICAL
# mesmo sem fazerem parte do nosso package.json. Sem eles na imagem, nao ha o
# que corrigir nem o que explorar. (Antes a imagem atualizava o npm para
# 11.18.0 so para fugir de um CVE do tar embutido; removendo o npm isso deixa
# de ser necessario.)
# ---------------------------------------------------------------------------
FROM node:20-alpine

# Atualiza pacotes do SO para corrigir vulnerabilidades conhecidas e remove
# os gerenciadores de pacote, que nao sao usados em tempo de execucao.
RUN apk update && apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

# Roda como o usuario "node" (ja existe na imagem oficial), nao como root:
# se a API for comprometida, o invasor nao ganha root dentro do container.
# Os arquivos copiados acima continuam do root e so precisam ser lidos.
USER node

EXPOSE 3000

CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
