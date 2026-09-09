FROM python:3.14-slim

# Atualiza pacotes do SO para corrigir vulnerabilidades criticas conhecidas
# antes de publicar a imagem.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY scripts/ ./scripts/

EXPOSE 5000

CMD ["python", "scripts/app.py"]
