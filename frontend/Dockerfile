FROM nginx:1.31-alpine

# Atualiza pacotes do SO para corrigir vulnerabilidades criticas conhecidas
# (ex.: CVE do openssl/libcrypto/libssl) antes de publicar a imagem.
RUN apk update && apk upgrade --no-cache

COPY src/ /usr/share/nginx/html/

# Script que gera js/config.js a partir de js/config.js.template na
# inicializacao do container, substituindo API_URL pelo valor real
# (ver docker-entrypoint.d/40-generate-api-config.sh).
COPY docker-entrypoint.d/40-generate-api-config.sh /docker-entrypoint.d/40-generate-api-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-api-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
