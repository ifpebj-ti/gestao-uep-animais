import { ApiError } from "../../utils/ApiError.js";

/*
 * Regras de genética, estágio de vida e fase reprodutiva (Sprint 6).
 * Funções puras + um trecho de SQL gerado a partir das MESMAS listas, para a
 * regra existir num lugar só (ver test/animaisGenetica.test.js).
 */

export const ESTAGIOS_VIDA = Object.freeze(["CRIA", "RECRIA", "ADULTO"]);

// Estágio definido pela própria categoria do animal.
export const ESTAGIO_POR_CATEGORIA = Object.freeze({
  BEZERRO: "CRIA",
  BEZERRA: "CRIA",
  LEITAO: "CRIA",
  LEITOA: "CRIA",
  CORDEIRO: "CRIA",
  CABRITO: "CRIA",
  DESMAMADO: "RECRIA",
  NOVILHA: "RECRIA",
  VACA: "ADULTO",
  TOURO: "ADULTO",
  MATRIZ: "ADULTO",
  REPRODUTOR: "ADULTO",
  CACHACO: "ADULTO",
});

// Para a categoria OUTRO (aves, coelhos...) o estágio vem da idade.
export const LIMITE_CRIA_MESES = 3;
export const LIMITE_RECRIA_MESES = 12;

// Sexo que cada categoria exige (as que não aparecem aceitam os dois).
export const SEXO_POR_CATEGORIA = Object.freeze({
  VACA: "FEMEA",
  NOVILHA: "FEMEA",
  BEZERRA: "FEMEA",
  MATRIZ: "FEMEA",
  LEITOA: "FEMEA",
  TOURO: "MACHO",
  BEZERRO: "MACHO",
  REPRODUTOR: "MACHO",
  CACHACO: "MACHO",
  LEITAO: "MACHO",
});

// Fases reprodutivas que só existem para fêmeas.
export const STATUS_SO_FEMEA = Object.freeze(["PRENHE", "VAZIA", "LACTANTE"]);

/** Idade em meses completos na data `hoje` (AAAA-MM-DD). null sem nascimento. */
export function calcularIdadeMeses(dataNascimento, hoje) {
  if (!dataNascimento) return null;
  const [an, mn, dn] = paraISO(dataNascimento).split("-").map(Number);
  const [ah, mh, dh] = hoje.split("-").map(Number);
  let meses = (ah - an) * 12 + (mh - mn);
  if (dh < dn) meses -= 1;
  return Math.max(0, meses);
}

/** "AAAA-MM-DD" a partir de texto (corta o horário, se vier) ou de um Date (UTC). */
export function paraISO(data) {
  if (typeof data === "string") return data.slice(0, 10);
  const d = new Date(data);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function calcularEstagioVida(categoria, idadeMeses) {
  if (ESTAGIO_POR_CATEGORIA[categoria]) return ESTAGIO_POR_CATEGORIA[categoria];
  if (idadeMeses === null || idadeMeses === undefined) return null;
  if (idadeMeses < LIMITE_CRIA_MESES) return "CRIA";
  if (idadeMeses < LIMITE_RECRIA_MESES) return "RECRIA";
  return "ADULTO";
}

const lista = (valores) => valores.map((v) => `'${v}'`).join(", ");
const categoriasDo = (estagio) =>
  Object.keys(ESTAGIO_POR_CATEGORIA).filter((c) => ESTAGIO_POR_CATEGORIA[c] === estagio);

/** Expressão SQL da idade em meses (alias "a" = tabela animais). */
export const SQL_IDADE_MESES = `
  CASE WHEN a.data_nascimento IS NULL THEN NULL
       ELSE (EXTRACT(YEAR FROM age(CURRENT_DATE, a.data_nascimento)) * 12
             + EXTRACT(MONTH FROM age(CURRENT_DATE, a.data_nascimento)))::int
  END`;

/** Expressão SQL do estágio de vida, gerada das mesmas listas da função JS. */
export const SQL_ESTAGIO_VIDA = `
  CASE
    WHEN a.categoria IN (${lista(categoriasDo("CRIA"))}) THEN 'CRIA'
    WHEN a.categoria IN (${lista(categoriasDo("RECRIA"))}) THEN 'RECRIA'
    WHEN a.categoria IN (${lista(categoriasDo("ADULTO"))}) THEN 'ADULTO'
    WHEN a.data_nascimento IS NULL THEN NULL
    WHEN age(CURRENT_DATE, a.data_nascimento) < interval '${LIMITE_CRIA_MESES} months' THEN 'CRIA'
    WHEN age(CURRENT_DATE, a.data_nascimento) < interval '${LIMITE_RECRIA_MESES} months' THEN 'RECRIA'
    ELSE 'ADULTO'
  END`;

/**
 * Confere se categoria, sexo e fase reprodutiva combinam entre si. Recebe o
 * estado FINAL do animal (no PATCH: o que já existia + o que mudou).
 */
export function validarCoerencia({ categoria, sexo, status_reprodutivo: status }) {
  const sexoExigido = SEXO_POR_CATEGORIA[categoria];
  if (sexoExigido && sexo && sexo !== sexoExigido) {
    throw ApiError.badRequest(
      `A categoria ${categoria} exige sexo ${sexoExigido}.`
    );
  }
  if (sexo === "MACHO" && STATUS_SO_FEMEA.includes(status)) {
    throw ApiError.badRequest(
      `O status reprodutivo ${status} só se aplica a fêmeas.`
    );
  }
}

/**
 * Confere pai/mãe escolhidos para um animal. `animal` é o estado final (com
 * id quando já existe), `pai`/`mae` são as linhas do banco (ou null).
 */
export function validarGenealogia(animal, { pai, mae, paiId, maeId }) {
  const checar = (pariente, idPedido, papel, sexoEsperado) => {
    if (idPedido === null || idPedido === undefined) return;
    if (!pariente) throw ApiError.badRequest(`${papel} não encontrado(a) nesta UEP.`);
    if (animal.id && Number(pariente.id) === Number(animal.id)) {
      throw ApiError.badRequest(`Um animal não pode ser ${papel.toLowerCase()} dele mesmo.`);
    }
    if (pariente.sexo !== sexoEsperado) {
      throw ApiError.badRequest(`${papel} precisa ser ${sexoEsperado === "MACHO" ? "macho" : "fêmea"}.`);
    }
    const nascFilho = animal.data_nascimento ? paraISO(animal.data_nascimento) : null;
    const nascPariente = pariente.data_nascimento ? paraISO(pariente.data_nascimento) : null;
    if (nascFilho && nascPariente && nascPariente >= nascFilho) {
      throw ApiError.badRequest(`${papel} precisa ter nascido antes do animal.`);
    }
  };
  checar(pai, paiId, "Pai", "MACHO");
  checar(mae, maeId, "Mãe", "FEMEA");
}
