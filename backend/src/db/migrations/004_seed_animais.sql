-- Seed de animais para ambiente de desenvolvimento/teste (uma amostra por
-- UEP, cobrindo categorias, sexos e status reprodutivos diferentes, para
-- dar dado real ao censo/paginação/filtros sem precisar cadastrar manualmente).
-- created_by fica NULL: as contas de demonstração só são criadas depois
-- desta migration rodar (ver backend/src/db/migrate.js).

INSERT INTO animais (uep_id, categoria, sexo, raca, data_nascimento, status_reprodutivo, brinco, corte_australiano, sisbov, disponivel, observacoes)
VALUES
  -- Bovinocultura
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'VACA',      'FEMEA', 'Nelore', '2020-03-12', 'PRENHE',         'BOV-001', 'AU-00001', '106000000000001', TRUE,  'Prenhez confirmada em exame de rotina.'),
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'VACA',      'FEMEA', 'Gir',    '2019-11-02', 'LACTANTE',       'BOV-002', NULL,       '106000000000002', TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'NOVILHA',   'FEMEA', 'Nelore', '2023-06-20', 'VAZIA',          'BOV-003', NULL,       NULL,              TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'TOURO',     'MACHO', 'Nelore', '2021-01-15', 'NAO_APLICAVEL',  'BOV-004', 'AU-00002', NULL,              TRUE,  'Reprodutor principal do plantel.'),
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'BEZERRO',   'MACHO', 'Nelore', '2025-08-05', 'NAO_APLICAVEL',  'BOV-005', NULL,       NULL,              TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'BEZERRA',   'FEMEA', 'Gir',    '2025-09-01', 'NAO_APLICAVEL',  'BOV-006', NULL,       NULL,              TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Bovinocultura'), 'DESMAMADO', 'MACHO', 'Nelore', '2024-12-10', 'NAO_APLICAVEL',  'BOV-007', NULL,       NULL,              FALSE, 'Reservado para venda.'),

  -- Suinocultura
  ((SELECT id FROM ueps WHERE nome = 'Suinocultura'), 'MATRIZ',     'FEMEA', 'Landrace', '2022-04-18', 'LACTANTE',      'SUI-001', NULL, NULL, TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Suinocultura'), 'REPRODUTOR', 'MACHO', 'Duroc',    '2021-09-30', 'NAO_APLICAVEL', 'SUI-002', NULL, NULL, TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Suinocultura'), 'LEITAO',     'MACHO', 'Landrace', '2026-07-22', 'NAO_APLICAVEL', 'SUI-003', NULL, NULL, TRUE,  NULL),
  ((SELECT id FROM ueps WHERE nome = 'Suinocultura'), 'LEITOA',     'FEMEA', 'Landrace', '2026-07-22', 'NAO_APLICAVEL', 'SUI-004', NULL, NULL, TRUE,  NULL),

  -- Avicultura (a enum de categoria não tem termos específicos de ave; usa OUTRO)
  ((SELECT id FROM ueps WHERE nome = 'Avicultura'), 'OUTRO', 'FEMEA', 'Poedeira Leghorn', '2025-02-01', 'NAO_APLICAVEL', 'AVI-001', NULL, NULL, TRUE, 'Lote de poedeiras em produção.'),
  ((SELECT id FROM ueps WHERE nome = 'Avicultura'), 'OUTRO', 'MACHO', 'Corte Cobb 500',   '2026-08-15', 'NAO_APLICAVEL', 'AVI-002', NULL, NULL, TRUE, 'Lote de corte em engorda.'),

  -- Cunicultura
  ((SELECT id FROM ueps WHERE nome = 'Cunicultura'), 'OUTRO', 'FEMEA', 'Nova Zelândia Branco', '2024-05-09', 'PRENHE',        'CUN-001', NULL, NULL, TRUE, NULL),
  ((SELECT id FROM ueps WHERE nome = 'Cunicultura'), 'OUTRO', 'MACHO', 'Nova Zelândia Branco', '2023-10-14', 'NAO_APLICAVEL', 'CUN-002', NULL, NULL, TRUE, NULL)
ON CONFLICT DO NOTHING;
