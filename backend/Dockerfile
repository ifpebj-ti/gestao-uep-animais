FROM node:26-alpine

# Atualiza pacotes do SO para corrigir vulnerabilidades criticas conhecidas
# antes de publicar a imagem.
RUN apk update && apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3000

CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
