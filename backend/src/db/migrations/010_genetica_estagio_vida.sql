-- Sprint 6: atributos geneticos e estagio de vida dos animais.
--
-- grau_sangue: composicao genetica/grau de sangue informado pelo setor
--   (ex.: "PO" (puro de origem), "1/2 Nelore x Angus", "3/4 Holandes").
-- pai_id / mae_id: genealogia dentro do proprio rebanho. Se o pai ou a mae
--   for removido, o filho continua existindo (SET NULL).
--
-- O estagio de vida (CRIA / RECRIA / ADULTO) e a idade em meses nao sao
-- gravados: sao calculados na consulta a partir da categoria e da data de
-- nascimento (ver animais.genetica.js), para nunca ficarem desatualizados.

ALTER TABLE animais ADD COLUMN IF NOT EXISTS grau_sangue VARCHAR(30);
ALTER TABLE animais ADD COLUMN IF NOT EXISTS pai_id INTEGER REFERENCES animais(id) ON DELETE SET NULL;
ALTER TABLE animais ADD COLUMN IF NOT EXISTS mae_id INTEGER REFERENCES animais(id) ON DELETE SET NULL;

ALTER TABLE animais
  ADD CONSTRAINT ck_animais_pai_nao_e_ele_mesmo CHECK (pai_id IS NULL OR pai_id <> id),
  ADD CONSTRAINT ck_animais_mae_nao_e_ele_mesma CHECK (mae_id IS NULL OR mae_id <> id);

CREATE INDEX IF NOT EXISTS idx_animais_pai ON animais (pai_id);
CREATE INDEX IF NOT EXISTS idx_animais_mae ON animais (mae_id);
