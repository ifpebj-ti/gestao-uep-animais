-- Seed de UEPs para ambiente de desenvolvimento/teste
INSERT INTO ueps (nome, tipo, descricao) VALUES
  ('Bovinocultura', 'BOVINOCULTURA', 'Bovinos de corte e leite'),
  ('Suinocultura',  'SUINOCULTURA',  'Produção e manejo de suínos'),
  ('Avicultura',    'AVICULTURA',    'Aves de postura e corte'),
  ('Cunicultura',   'CUNICULTURA',   'Criação e manejo de coelhos')
ON CONFLICT DO NOTHING;
