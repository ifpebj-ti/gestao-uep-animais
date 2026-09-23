-- Hierarquia de acesso: Diretoria -> Professor -> Equipe
--
-- uep_id: UEP a que o usuário pertence. Para Professor, definida pela
--   Diretoria; para integrantes da equipe, é sempre a do professor
--   responsável (o backend copia na criação e propaga quando muda).
-- professor_id: professor responsável por um Aluno/Técnico/Estagiário.
--   Se o professor for removido, a equipe fica sem responsável (SET NULL)
--   em vez de ser apagada junto.
ALTER TABLE users ADD COLUMN IF NOT EXISTS uep_id INTEGER REFERENCES ueps(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS professor_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_professor_id ON users (professor_id);
CREATE INDEX IF NOT EXISTS idx_users_uep_id ON users (uep_id);
