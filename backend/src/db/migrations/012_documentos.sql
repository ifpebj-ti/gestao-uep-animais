-- Sprint 13: documentos (notas fiscais e outros PDFs) enviados por
-- Professores e pela Diretoria, e unidos em um PDF so pela Diretoria.
--
-- O arquivo fica no proprio Postgres (BYTEA, ate 10 MB): nao precisa de
-- volume novo no Docker nem de mudanca no compose de producao, e entra no
-- backup do banco junto com o resto dos dados.

CREATE TYPE documento_tipo AS ENUM ('NOTA_FISCAL', 'OUTRO');

CREATE TABLE IF NOT EXISTS documentos (
  id             SERIAL PRIMARY KEY,
  nome_original  VARCHAR(255) NOT NULL,
  tipo           documento_tipo NOT NULL DEFAULT 'OUTRO',
  descricao      VARCHAR(120),
  tamanho_bytes  INTEGER NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760),
  sha256         CHAR(64) NOT NULL,
  conteudo       BYTEA NOT NULL,
  uep_id         INTEGER REFERENCES ueps(id) ON DELETE SET NULL,
  enviado_por    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_enviado_por ON documentos (enviado_por);
CREATE INDEX IF NOT EXISTS idx_documentos_created_at ON documentos (created_at DESC);
