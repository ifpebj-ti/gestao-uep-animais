-- Sprint 5: Censo e contagem de animais por categoria/UEP

CREATE TYPE animal_categoria AS ENUM (
  'VACA',
  'NOVILHA',
  'BEZERRO',
  'BEZERRA',
  'TOURO',
  'DESMAMADO',
  'MATRIZ',
  'REPRODUTOR',
  'LEITAO',
  'LEITOA',
  'CACHACO',
  'CORDEIRO',
  'CABRITO',
  'OUTRO'
);

CREATE TYPE animal_sexo AS ENUM ('MACHO', 'FEMEA');

CREATE TYPE status_reprodutivo AS ENUM (
  'NAO_APLICAVEL',
  'PRENHE',
  'VAZIA',
  'LACTANTE',
  'EM_CRESCIMENTO',
  'DESCARTE'
);

CREATE TABLE IF NOT EXISTS animais (
  id                  SERIAL PRIMARY KEY,
  uep_id              INTEGER NOT NULL REFERENCES ueps(id) ON DELETE CASCADE,
  categoria           animal_categoria NOT NULL,
  sexo                animal_sexo NOT NULL,
  raca                VARCHAR(100),
  data_nascimento     DATE,
  status_reprodutivo  status_reprodutivo NOT NULL DEFAULT 'NAO_APLICAVEL',
  brinco              VARCHAR(50),
  corte_australiano   VARCHAR(50),
  sisbov              VARCHAR(15),
  disponivel          BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes         TEXT,
  created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_animais_brinco_uep UNIQUE (uep_id, brinco),
  CONSTRAINT uq_animais_sisbov UNIQUE (sisbov)
);

CREATE INDEX IF NOT EXISTS idx_animais_uep ON animais (uep_id);
CREATE INDEX IF NOT EXISTS idx_animais_categoria ON animais (categoria);
CREATE INDEX IF NOT EXISTS idx_animais_disponivel ON animais (disponivel);
CREATE INDEX IF NOT EXISTS idx_animais_corte_australiano ON animais (corte_australiano);
