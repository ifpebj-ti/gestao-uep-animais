-- Sprint 14: calendario de atividades dos animais por UEP (aba Calendario
-- do front). Datas passadas sao registro ("engravidou em..."), datas futuras
-- sao agendamento (vacina, vermifugo, aula de manejo).

CREATE TYPE atividade_tipo AS ENUM ('GESTACAO', 'VERMIFUGO', 'VACINA', 'AULA_MANEJO', 'OUTRO');

CREATE TABLE IF NOT EXISTS atividades (
  id          SERIAL PRIMARY KEY,
  uep_id      INTEGER NOT NULL REFERENCES ueps(id) ON DELETE CASCADE,
  tipo        atividade_tipo NOT NULL,
  data        DATE NOT NULL,
  hora        TIME,
  animal_id   INTEGER REFERENCES animais(id) ON DELETE SET NULL,
  observacao  TEXT,
  criado_por  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atividades_uep_data ON atividades (uep_id, data);
CREATE INDEX IF NOT EXISTS idx_atividades_animal ON atividades (animal_id);
