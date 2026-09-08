-- Sprint 3 & 4: Autenticação, usuários/perfis (RBAC) e UEPs (setores)

CREATE TYPE user_role AS ENUM ('ADMIN', 'PROFESSOR', 'TECNICO', 'ESTAGIARIO', 'ALUNO');

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'ALUNO',
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE uep_tipo AS ENUM (
  'BOVINOCULTURA',
  'SUINOCULTURA',
  'CAPRINOCULTURA',
  'OVINOCULTURA',
  'AVICULTURA',
  'CUNICULTURA',
  'LATICINIOS',
  'OUTRO'
);

CREATE TABLE IF NOT EXISTS ueps (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(150) NOT NULL,
  tipo        uep_tipo NOT NULL,
  descricao   TEXT,
  responsavel_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome)
);

CREATE INDEX IF NOT EXISTS idx_ueps_tipo ON ueps (tipo);

-- Usuário admin semente para permitir o primeiro login (senha definida via seed.js)
