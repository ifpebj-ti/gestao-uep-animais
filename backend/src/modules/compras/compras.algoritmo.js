/**
 * Algoritmo de apoio as compras (Sprint 12).
 *
 * Funcoes puras (sem banco, sem Express) para ficarem faceis de testar e para
 * a regra ficar escrita em UM lugar so — o frontend consome o resultado em vez
 * de reimplementar a conta.
 *
 * Regras:
 *   previsao_dias       = floor(saldo_atual / consumo_medio_diario)
 *                         (null quando o consumo medio e 0: nao ha como prever)
 *   quantidade_sugerida = max(0, consumo_medio_diario * dias + estoque_minimo - saldo_atual)
 *                         (cobre o consumo do horizonte e ainda termina com o estoque minimo)
 *   urgencia:
 *     CRITICA  saldo_atual <= estoque_minimo
 *     ATENCAO  acima do minimo, mas a previsao e de menos de 7 dias
 *     OK       demais casos
 *   "Comprar" no frontend equivale a urgencia CRITICA ou ATENCAO.
 *
 *   reposicao_sugerida (animais) = animais da categoria marcados com
 *                                  status DESCARTE (reposicao 1 para 1).
 */

export const DIAS_PADRAO = 30;
export const DIAS_MAX = 365;
export const LIMITE_ATENCAO_DIAS = 7;

const ORDEM_URGENCIA = Object.freeze({ CRITICA: 0, ATENCAO: 1, OK: 2 });

// Evita ruido de ponto flutuante (ex.: 0.1 * 3) mantendo as 3 casas do banco.
function arredondar(n) {
  return Math.round(n * 1000) / 1000;
}

export function calcularPrevisaoDias(saldoAtual, consumoMedioDiario) {
  const consumo = Number(consumoMedioDiario);
  if (!(consumo > 0)) return null;
  return Math.floor(Number(saldoAtual) / consumo);
}

export function calcularQuantidadeSugerida({ saldoAtual, estoqueMinimo, consumoMedioDiario, dias }) {
  const necessario =
    Number(consumoMedioDiario) * dias + Number(estoqueMinimo) - Number(saldoAtual);
  return Math.max(0, arredondar(necessario));
}

export function classificarUrgencia({ saldoAtual, estoqueMinimo, previsaoDias }) {
  if (Number(saldoAtual) <= Number(estoqueMinimo)) return "CRITICA";
  if (previsaoDias !== null && previsaoDias < LIMITE_ATENCAO_DIAS) return "ATENCAO";
  return "OK";
}

/** Monta a linha de necessidade de um insumo (formato snake_case do contrato). */
export function avaliarInsumo(insumo, dias) {
  const saldo = Number(insumo.saldo_atual);
  const minimo = Number(insumo.estoque_minimo);
  const consumo = Number(insumo.consumo_medio_diario);
  const previsaoDias = calcularPrevisaoDias(saldo, consumo);

  return {
    insumo_id: insumo.id,
    nome: insumo.nome,
    unidade: insumo.unidade,
    saldo_atual: saldo,
    estoque_minimo: minimo,
    consumo_medio_diario: consumo,
    previsao_dias: previsaoDias,
    quantidade_sugerida: calcularQuantidadeSugerida({
      saldoAtual: saldo,
      estoqueMinimo: minimo,
      consumoMedioDiario: consumo,
      dias,
    }),
    urgencia: classificarUrgencia({ saldoAtual: saldo, estoqueMinimo: minimo, previsaoDias }),
  };
}

/**
 * Consolida os insumos da UEP. Ordem: mais urgente primeiro, depois quem
 * acaba antes (sem previsao vai por ultimo) e, por fim, o nome.
 */
export function consolidarInsumos(insumos, dias) {
  return insumos
    .map((i) => avaliarInsumo(i, dias))
    .sort((a, b) => {
      const porUrgencia = ORDEM_URGENCIA[a.urgencia] - ORDEM_URGENCIA[b.urgencia];
      if (porUrgencia !== 0) return porUrgencia;
      const pa = a.previsao_dias ?? Number.POSITIVE_INFINITY;
      const pb = b.previsao_dias ?? Number.POSITIVE_INFINITY;
      if (pa !== pb) return pa < pb ? -1 : 1;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/** Consolida o rebanho por categoria: total, descartes e reposicao sugerida. */
export function consolidarAnimais(linhas) {
  return linhas.map((l) => ({
    categoria: l.categoria,
    total: Number(l.total),
    em_descarte: Number(l.em_descarte),
    reposicao_sugerida: Number(l.em_descarte),
  }));
}
