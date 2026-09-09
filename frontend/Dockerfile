FROM nginx:1.27-alpine

# Atualiza pacotes do SO para corrigir vulnerabilidades criticas conhecidas
# (ex.: CVE do openssl/libcrypto/libssl) antes de publicar a imagem.
RUN apk update && apk upgrade --no-cache

COPY src/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
