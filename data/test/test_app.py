"""
Testes unitarios do servico de dados (Flask).
Rodar com: pytest data/test
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from app import app  # noqa: E402


def test_health_retorna_status_ok():
    client = app.test_client()
    response = client.get("/health")

    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["service"] == "gestao-uep-data"
