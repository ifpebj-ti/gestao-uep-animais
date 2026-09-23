-- Um Professor pode ter acesso a mais de uma UEP ao mesmo tempo (a
-- Diretoria decide quais, marcando/desmarcando em Controle de Acesso).
-- A coluna users.uep_id (migration 006) continua existindo só pra quem
-- pertence a EXATAMENTE uma UEP (Aluno/Técnico/Estagiário da equipe) —
-- ela deixa de ser usada para Professor, que passa a usar esta tabela.
CREATE TABLE IF NOT EXISTS professor_ueps (
  professor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uep_id INTEGER NOT NULL REFERENCES ueps(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (professor_id, uep_id)
);

CREATE INDEX IF NOT EXISTS idx_professor_ueps_uep_id ON professor_ueps (uep_id);

-- Migra o vínculo que já existia (users.uep_id de quem é Professor) pra
-- não perder o que a Diretoria já tinha configurado antes desta migration.
INSERT INTO professor_ueps (professor_id, uep_id)
SELECT id, uep_id FROM users
WHERE role = 'PROFESSOR' AND uep_id IS NOT NULL
ON CONFLICT DO NOTHING;
