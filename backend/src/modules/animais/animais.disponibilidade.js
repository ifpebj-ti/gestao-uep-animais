import { ApiError } from "../../utils/ApiError.js";

/*
 * Regra de disponibilidade atual do animal no setor (Sprint 7). Função pura:
 * recebe o estado atual do animal (ou {} na criação), o que a requisição
 * quer mudar e a data de hoje, e devolve as colunas de disponibilidade que
 * devem ser gravadas. Ver test/animaisDisponibilidade.test.js.
 *
 * Regras:
 *  1. Animal com status reprodutivo DESCARTE nunca está disponível: fica
 *     indisponível com motivo DESCARTE (ou mantém um motivo definitivo que
 *     já tinha, como VENDIDO ou OBITO). Pedir disponivel=true nele -> 400.
 *  2. Informar um motivo torna o animal indisponível.
 *  3. disponivel=false sem motivo -> motivo OUTRO (o front antigo só manda
 *     o booleano, e todo indisponível precisa de um motivo).
 *  4. disponivel=true limpa motivo e data.
 *  5. Saiu do DESCARTE (status mudou) e o motivo era DESCARTE, sem a
 *     requisição dizer nada sobre disponibilidade -> volta a ficar disponível.
 *  6. indisponivel_desde: data informada, ou hoje quando o animal acabou de
 *     ficar indisponível; mantém a data antiga se já estava indisponível.
 */

export function resolverDisponibilidade(atual = {}, mudou = {}, hoje) {
  const status = mudou.status_reprodutivo ?? atual.status_reprodutivo;
  const pediuDisponivel = "disponivel" in mudou ? mudou.disponivel : undefined;
  const pediuMotivo = "motivo_indisponibilidade" in mudou ? mudou.motivo_indisponibilidade : undefined;
  const estavaDisponivel = atual.disponivel ?? true;
  const motivoAtual = atual.motivo_indisponibilidade ?? null;

  let disponivel;
  let motivo;

  if (status === "DESCARTE") {
    if (pediuDisponivel === true) {
      throw ApiError.badRequest("Animal em DESCARTE não pode ficar disponível. Mude o status reprodutivo antes.");
    }
    disponivel = false;
    motivo = pediuMotivo || (motivoAtual && motivoAtual !== "OUTRO" ? motivoAtual : "DESCARTE");
  } else if (pediuMotivo) {
    if (pediuDisponivel === true) {
      throw ApiError.badRequest("Animal disponível não tem motivo de indisponibilidade.");
    }
    disponivel = false;
    motivo = pediuMotivo;
  } else if (pediuDisponivel === false) {
    disponivel = false;
    motivo = motivoAtual && motivoAtual !== "DESCARTE" ? motivoAtual : "OUTRO";
  } else if (pediuDisponivel === true || pediuMotivo === null) {
    disponivel = true;
    motivo = null;
  } else if (motivoAtual === "DESCARTE" && "status_reprodutivo" in mudou) {
    disponivel = true; // regra 5
    motivo = null;
  } else {
    disponivel = estavaDisponivel;
    motivo = estavaDisponivel ? null : motivoAtual ?? "OUTRO";
  }

  let desde = null;
  if (!disponivel) {
    desde = mudou.indisponivel_desde || (estavaDisponivel ? hoje : atual.indisponivel_desde || hoje);
  }

  return { disponivel, motivo_indisponibilidade: motivo, indisponivel_desde: desde };
}
