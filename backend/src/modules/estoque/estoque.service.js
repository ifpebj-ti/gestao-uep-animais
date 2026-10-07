import { estoqueRepository } from "./estoque.repository.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { MOVIMENTACAO_TIPOS } from "../../config/enums.js";
import { parseId, parseNumero, parseTexto, parseData } from "./estoque.validators.js";

async function assertUepExists(uepId) {
  const uep = await uepsRepository.findById(uepId);
  if (!uep) throw ApiError.notFound(`UEP ${uepId} não encontrada`);
}

function parseTipo(value) {
  if (!MOVIMENTACAO_TIPOS.includes(value)) {
    throw ApiError.badRequest(
      `tipo inválido: ${value}. Valores aceitos: ${MOVIMENTACAO_TIPOS.join(", ")}`
    );
  }
  return value;
}

export const estoqueService = {
  async listInsumos(uepIdRaw) {
    const uepId = parseId(uepIdRaw, "uepId");
    await assertUepExists(uepId);
    return estoqueRepository.findInsumos(uepId);
  },

  async createInsumo(uepIdRaw, body = {}, createdBy) {
    const uepId = parseId(uepIdRaw, "uepId");
    const nome = parseTexto(body.nome, "nome", { max: 100, obrigatorio: true });
    const unidade = parseTexto(body.unidade, "unidade", { max: 20, obrigatorio: true });
    const saldoInicial = parseNumero(body.saldoInicial, "saldoInicial", { padrao: 0 });
    const estoqueMinimo = parseNumero(body.estoqueMinimo, "estoqueMinimo", { padrao: 0 });
    const consumoMedioDiario = parseNumero(body.consumoMedioDiario, "consumoMedioDiario", {
      padrao: 0,
    });

    await assertUepExists(uepId);
    return estoqueRepository.createInsumo({
      uepId,
      nome,
      unidade,
      saldoInicial,
      estoqueMinimo,
      consumoMedioDiario,
      createdBy,
    });
  },

  async listMovimentacoes(uepIdRaw, query = {}) {
    const uepId = parseId(uepIdRaw, "uepId");
    const filtros = {};
    if (query.tipo !== undefined && query.tipo !== "") filtros.tipo = parseTipo(query.tipo);
    if (query.insumoId !== undefined && query.insumoId !== "") {
      filtros.insumoId = parseId(query.insumoId, "insumoId");
    }

    await assertUepExists(uepId);
    return estoqueRepository.findMovimentacoes(uepId, filtros);
  },

  // `responsavel` nunca vem do corpo: o repository grava created_by e a
  // listagem resolve o nome pelo JOIN com users.
  async registrarMovimentacao(uepIdRaw, body = {}, createdBy) {
    const uepId = parseId(uepIdRaw, "uepId");
    const insumoId = parseId(body.insumoId, "insumoId");
    const tipo = parseTipo(body.tipo);
    const quantidade = parseNumero(body.quantidade, "quantidade", { minimoExclusivo: true });
    const data = parseData(body.data);
    const observacao = parseTexto(body.observacao, "observacao", { max: 1000 });

    await assertUepExists(uepId);
    return estoqueRepository.registrarMovimentacao({
      uepId,
      insumoId,
      tipo,
      quantidade,
      data,
      observacao,
      createdBy,
    });
  },
};
