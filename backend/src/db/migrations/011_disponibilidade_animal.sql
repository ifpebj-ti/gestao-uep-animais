-- Sprint 7: regra de negocio da disponibilidade atual do animal no setor.
--
-- Antes "disponivel" era so um booleano que o cliente mudava livremente.
-- Agora todo animal indisponivel tem um MOTIVO e a data desde quando esta
-- assim. A regra completa (ex.: animal em DESCARTE nunca fica disponivel)
-- fica em animais.disponibilidade.js; o CHECK abaixo garante o minimo no
-- banco mesmo se alguem alterar a linha por fora da API.

CREATE TYPE motivo_indisponibilidade AS ENUM (
  'VENDIDO',
  'OBITO',
  'TRANSFERIDO',
  'EM_TRATAMENTO',
  'QUARENTENA',
  'RESERVADO',
  'DESCARTE',
  'OUTRO'
);

ALTER TABLE animais ADD COLUMN IF NOT EXISTS motivo_indisponibilidade motivo_indisponibilidade;
ALTER TABLE animais ADD COLUMN IF NOT EXISTS indisponivel_desde DATE;

-- Aplica a regra aos dados que ja existem:
-- 1) animal em DESCARTE fica indisponivel com motivo DESCARTE
UPDATE animais
   SET disponivel = FALSE,
       motivo_indisponibilidade = 'DESCARTE',
       indisponivel_desde = COALESCE(indisponivel_desde, updated_at::date)
 WHERE status_reprodutivo = 'DESCARTE';

-- 2) quem ja estava indisponivel sem motivo recebe OUTRO
UPDATE animais
   SET motivo_indisponibilidade = 'OUTRO',
       indisponivel_desde = COALESCE(indisponivel_desde, updated_at::date)
 WHERE disponivel = FALSE AND motivo_indisponibilidade IS NULL;

ALTER TABLE animais
  ADD CONSTRAINT ck_animais_motivo_indisponibilidade CHECK (
    (disponivel = TRUE AND motivo_indisponibilidade IS NULL)
    OR (disponivel = FALSE AND motivo_indisponibilidade IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_animais_motivo_indisp ON animais (motivo_indisponibilidade);
