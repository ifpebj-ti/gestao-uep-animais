import { comprasRepository } from "./compras.repository.js";
import { estoqueRepository } from "../estoque/estoque.repository.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { parseId } from "../estoque/estoque.validators.js";
import {
  DIAS_PADRAO,
  DIAS_MAX,
  consolidarInsumos,
  consolidarAnimais,
} from "./compras.algoritmo.js";

function parseDias(value) {
  if (value === undefined || value === null || value === "") return DIAS_PADRAO;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(n) || n < 1 || n > DIAS_MAX) {
    throw ApiError.badRequest(`dias deve ser um inteiro entre 1 e ${DIAS_MAX}.`);
  }
  return n;
}

export const comprasService = {
  async necessidades(uepIdRaw, query = {}) {
    const uepId = parseId(uepIdRaw, "uepId");
    const dias = parseDias(query.dias);

    const uep = await uepsRepository.findById(uepId);
    if (!uep) throw ApiError.notFound(`UEP ${uepId} não encontrada`);

    const [insumos, rebanho] = await Promise.all([
      estoqueRepository.findInsumos(uepId),
      comprasRepository.countAnimaisPorCategoria(uepId),
    ]);

    return {
      dias,
      gerado_em: new Date().toISOString(),
      insumos: consolidarInsumos(insumos, dias),
      animais: consolidarAnimais(rebanho),
    };
  },
};
