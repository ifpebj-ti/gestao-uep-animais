export const UEP_TIPOS = Object.freeze([
  "BOVINOCULTURA",
  "SUINOCULTURA",
  "CAPRINOCULTURA",
  "OVINOCULTURA",
  "AVICULTURA",
  "CUNICULTURA",
  "LATICINIOS",
  "OUTRO",
]);

export const ANIMAL_CATEGORIAS = Object.freeze([
  "VACA",
  "NOVILHA",
  "BEZERRO",
  "BEZERRA",
  "TOURO",
  "DESMAMADO",
  "MATRIZ",
  "REPRODUTOR",
  "LEITAO",
  "LEITOA",
  "CACHACO",
  "CORDEIRO",
  "CABRITO",
  "OUTRO",
]);

export const ANIMAL_SEXOS = Object.freeze(["MACHO", "FEMEA"]);

export const STATUS_REPRODUTIVOS = Object.freeze([
  "NAO_APLICAVEL",
  "PRENHE",
  "VAZIA",
  "LACTANTE",
  "EM_CRESCIMENTO",
  "DESCARTE",
]);

// Sprint 7: por que um animal nao esta disponivel no setor
export const MOTIVOS_INDISPONIBILIDADE = Object.freeze([
  "VENDIDO",
  "OBITO",
  "TRANSFERIDO",
  "EM_TRATAMENTO",
  "QUARENTENA",
  "RESERVADO",
  "DESCARTE",
  "OUTRO",
]);

export const MOVIMENTACAO_TIPOS = Object.freeze(["ENTRADA", "SAIDA"]);
