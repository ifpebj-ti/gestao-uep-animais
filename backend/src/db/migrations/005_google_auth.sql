-- Suporte a login com Google (Google Identity Services).
--
-- password_hash passa a ser opcional: uma conta criada no primeiro login
-- com Google nunca tem senha própria (ver
-- users.repository.js -> createGoogleUser). Contas criadas por e-mail/senha
-- continuam exigindo senha na aplicação (a validação fica em
-- users.service.js), essa coluna só deixa de ser NOT NULL no banco.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Identificador único do Google (campo "sub" do ID token) — permite
-- reconhecer o mesmo usuário em logins futuros e associar esse login a uma
-- conta já existente com o mesmo e-mail (ver auth.service.js ->
-- loginWithGoogle).
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
