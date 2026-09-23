#!/bin/sh
# Roda automaticamente na inicializacão do nginx (ver /docker-entrypoint.d/
# no Dockerfile oficial da imagem nginx:alpine). Gera js/config.js a partir
# do template, substituindo ${API_URL} e ${GOOGLE_CLIENT_ID} pelos valores
# reais das variaveis de ambiente do container (definidas em
# frontend/.env.example ou pelo docker-compose.yml).
set -e

: "${API_URL:=http://localhost:3000}"
: "${GOOGLE_CLIENT_ID:=}"

envsubst '${API_URL} ${GOOGLE_CLIENT_ID}' \
  < /usr/share/nginx/html/js/config.js.template \
  > /usr/share/nginx/html/js/config.js

echo "config.js gerado com API_URL=${API_URL} (GOOGLE_CLIENT_ID $( [ -n "$GOOGLE_CLIENT_ID" ] && echo definido || echo vazio ))"
