#!/bin/sh
# Roda automaticamente na inicialização do nginx (ver /docker-entrypoint.d/
# no Dockerfile oficial da imagem nginx:alpine). Gera js/config.js a partir
# do template, substituindo ${API_URL} pelo valor real da variável de
# ambiente do container (definida em frontend/.env.example ou pelo
# docker-compose.yml).
set -e

: "${API_URL:=http://localhost:3000}"

envsubst '${API_URL}' \
  < /usr/share/nginx/html/js/config.js.template \
  > /usr/share/nginx/html/js/config.js

echo "config.js gerado com API_URL=${API_URL}"
