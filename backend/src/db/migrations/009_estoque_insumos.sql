-- Sprint 10: controle de estoque de insumos (racao) por UEP.
--
-- insumos: um item de estoque por UEP (ex.: "Racao inicial", unidade "kg"),
-- com o saldo atual mantido pelo backend a cada movimentacao.
-- estoque_movimentacoes: historico de ENTRADAS e SAIDAS de cada insumo.
--
-- O saldo_atual nunca fica negativo: alem da validacao na aplicacao (SAIDA
-- maior que o saldo devolve 400), o CHECK abaixo garante isso no banco mesmo
-- se alguem alterar o saldo por fora da API.

CREATE TYPE movimentacao_tipo AS ENUM ('ENTRADA', 'SAIDA');

CREATE TABLE IF NOT EXISTS insumos (
  id                    SERIAL PRIMARY KEY,
  uep_id                INTEGER NOT NULL REFERENCES ueps(id) ON DELETE CASCADE,
  nome                  VARCHAR(100) NOT NULL,
  unidade               VARCHAR(20) NOT NULL,
  saldo_atual           NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (saldo_atual >= 0),
  estoque_minimo        NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  consumo_medio_diario  NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (consumo_medio_diario >= 0),
  created_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_insumos_uep_nome UNIQUE (uep_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_insumos_uep ON insumos (uep_id);

CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id          SERIAL PRIMARY KEY,
  insumo_id   INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  tipo        movimentacao_tipo NOT NULL,
  quantidade  NUMERIC(14,3) NOT NULL CHECK (quantidade > 0),
  data        DATE NOT NULL DEFAULT CURRENT_DATE,
  observacao  TEXT,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estoque_mov_insumo_data
  ON estoque_movimentacoes (insumo_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_estoque_mov_tipo ON estoque_movimentacoes (tipo);
