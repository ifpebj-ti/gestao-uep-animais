"""
Serviço de dados: geração de relatórios e processamento de dados
do rebanho/estoque das UEPs.
"""
from flask import Flask, jsonify
import os

app = Flask(__name__)


@app.get("/health")
def health():
    return jsonify(status="ok", service="gestao-uep-data")


if __name__ == "__main__":
    port = int(os.environ.get("DATA_SERVICE_PORT", 5000))
    app.run(host="0.0.0.0", port=port)
