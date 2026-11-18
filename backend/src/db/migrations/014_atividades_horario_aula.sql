-- Calendario em formato de agenda: so a aula de manejo tem horario; os
-- outros tipos (gestacao, vermifugo, vacina, outro) sao "o dia todo".
-- Limpa horas antigas desses tipos e garante a regra no banco.

UPDATE atividades SET hora = NULL WHERE tipo <> 'AULA_MANEJO' AND hora IS NOT NULL;

ALTER TABLE atividades DROP CONSTRAINT IF EXISTS atividades_hora_so_aula;
ALTER TABLE atividades
  ADD CONSTRAINT atividades_hora_so_aula CHECK (tipo = 'AULA_MANEJO' OR hora IS NULL);
