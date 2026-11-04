/*
 * Regra de alerta de nível de estoque de ração/insumos (Sprint 11).
 *
 * Funções puras (sem banco) — uma definição só, usada pela listagem de
 * insumos, pelos endpoints de alerta e pelo apoio às compras (Sprint 12).
 * Ver test/estoqueAlertas.test.js.
 *
 *   previsao_dias = floor(saldo / consumo médio diário)   (null sem consumo)
 *   CRITICO  saldo <= estoque mínimo
 *   ATENCAO  acima do mínimo, mas acaba em menos de LIMITE_ATENCAO_DIAS dias
 *   NORMAL   demais casos
 */

export const NIVEIS_ALERTA = Object.freeze(["CRITICO", "ATENCAO", "NORMAL"]);
export const LIMITE_ATENCAO_DIAS = 7;

const ORDEM_NIVEL = Object.freeze({ CRITICO: 0, ATENCAO: 1, NORMAL: 2 });

export function calcularPrevisaoDias(saldoAtual, consumoMedioDiario) {
  const consumo = Number(consumoMedioDiario);
  if (!(consumo > 0)) return null;
  return Math.floor(Number(saldoAtual) / consumo);
}

export function classificarNivel({ saldoAtual, estoqueMinimo, previsaoDias }) {
  if (Number(saldoAtual) <= Number(estoqueMinimo)) return "CRITICO";
  if (previsaoDias !== null && previsaoDias !== undefined && previsaoDias < LIMITE_ATENCAO_DIAS) {
    return "ATENCAO";
  }
  return "NORMAL";
}

function formatar(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** Texto pronto para banner/notificação, no mesmo tom do front. */
export function mensagemAlerta({ nome, unidade, saldo_atual, estoque_minimo, previsao_dias, nivel }) {
  if (nivel === "CRITICO") {
    const zerado = Number(saldo_atual) <= 0;
    return zerado
      ? `${nome} está zerado (mínimo ${formatar(estoque_minimo)} ${unidade}). Registre uma entrada.`
      : `${nome} está no nível mínimo ou abaixo (${formatar(saldo_atual)} ${unidade} de ${formatar(estoque_minimo)} ${unidade}). Recomenda-se registrar entrada.`;
  }
  if (nivel === "ATENCAO") {
    return `${nome} acaba em ${previsao_dias} dia(s) no consumo atual. Planeje a compra.`;
  }
  return null;
}

/** Acrescenta previsao_dias e nivel_alerta a uma linha de insumo do banco. */
export function avaliarNivel(insumo) {
  const previsao = calcularPrevisaoDias(insumo.saldo_atual, insumo.consumo_medio_diario);
  return {
    ...insumo,
    previsao_dias: previsao,
    nivel_alerta: classificarNivel({
      saldoAtual: insumo.saldo_atual,
      estoqueMinimo: insumo.estoque_minimo,
      previsaoDias: previsao,
    }),
  };
}

// Quem já zerou vem antes de tudo; depois, quem acaba antes; sem previsão, por último.
function chaveUrgencia(i) {
  if (Number(i.saldo_atual) <= 0) return -1;
  return i.previsao_dias ?? Number.POSITIVE_INFINITY;
}

/**
 * Lista de alertas (só CRITICO e ATENCAO), do mais grave para o mais leve e,
 * no mesmo nível, de quem acaba antes. `insumos` já passados por avaliarNivel.
 */
export function montarAlertas(insumos) {
  return insumos
    .filter((i) => i.nivel_alerta !== "NORMAL")
    .sort((a, b) => {
      const porNivel = ORDEM_NIVEL[a.nivel_alerta] - ORDEM_NIVEL[b.nivel_alerta];
      if (porNivel !== 0) return porNivel;
      const pa = chaveUrgencia(a);
      const pb = chaveUrgencia(b);
      if (pa !== pb) return pa < pb ? -1 : 1;
      return String(a.nome).localeCompare(String(b.nome), "pt-BR");
    })
    .map((i) => ({
      insumo_id: i.id,
      uep_id: i.uep_id,
      ...(i.uep_nome !== undefined ? { uep_nome: i.uep_nome } : {}),
      nome: i.nome,
      unidade: i.unidade,
      saldo_atual: i.saldo_atual,
      estoque_minimo: i.estoque_minimo,
      consumo_medio_diario: i.consumo_medio_diario,
      previsao_dias: i.previsao_dias,
      nivel: i.nivel_alerta,
      mensagem: mensagemAlerta({ ...i, nivel: i.nivel_alerta }),
    }));
}

/** Contadores de um conjunto de insumos avaliados. */
export function resumirNiveis(insumos) {
  return {
    total_insumos: insumos.length,
    criticos: insumos.filter((i) => i.nivel_alerta === "CRITICO").length,
    atencao: insumos.filter((i) => i.nivel_alerta === "ATENCAO").length,
  };
}
