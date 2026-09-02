import { animaisRepository } from "./animais.repository.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  ANIMAL_CATEGORIAS,
  ANIMAL_SEXOS,
  STATUS_REPRODUTIVOS,
} from "../../config/enums.js";

function assertEnum(value, allowed, label) {
  if (value !== undefined && value !== null && !allowed.includes(value)) {
    throw ApiError.badRequest(`${label} inválido: ${value}. Valores aceitos: ${allowed.join(", ")}`);
  }
}

async function assertUepExists(uepId) {
  const uep = await uepsRepository.findById(uepId);
  if (!uep) throw ApiError.notFound(`UEP ${uepId} não encontrada`);
  return uep;
}

export const animaisService = {
  async list(filters) {
    return animaisRepository.findAll(filters);
  },

  async getById(id) {
    const animal = await animaisRepository.findById(id);
    if (!animal) throw ApiError.notFound("Animal não encontrado");
    return animal;
  },

  // Busca por identificador único: brinco, corte australiano ou SISBOV
  async searchByIdentifier(params) {
    if (!params.brinco && !params.corteAustraliano && !params.sisbov) {
      throw ApiError.badRequest(
        "Informe ao menos um identificador: brinco, corteAustraliano ou sisbov"
      );
    }
    return animaisRepository.findByIdentifier(params);
  },

  // Censo: total de animais por categoria/sexo, com os mesmos filtros da listagem
  async censo(filters) {
    const [porCategoria, total] = await Promise.all([
      animaisRepository.countByCategoria(filters),
      animaisRepository.countTotal(filters),
    ]);
    return { total, porCategoria };
  },

  async create(data) {
    const { uepId, categoria, sexo } = data;
    if (!uepId || !categoria || !sexo) {
      throw ApiError.badRequest("uepId, categoria e sexo são obrigatórios");
    }
    assertEnum(categoria, ANIMAL_CATEGORIAS, "categoria");
    assertEnum(sexo, ANIMAL_SEXOS, "sexo");
    assertEnum(data.statusReprodutivo, STATUS_REPRODUTIVOS, "statusReprodutivo");

    await assertUepExists(uepId);
    return animaisRepository.create(data);
  },

  async update(id, data) {
    assertEnum(data.categoria, ANIMAL_CATEGORIAS, "categoria");
    assertEnum(data.sexo, ANIMAL_SEXOS, "sexo");
    assertEnum(data.statusReprodutivo, STATUS_REPRODUTIVOS, "statusReprodutivo");

    const updated = await animaisRepository.update(id, data);
    if (!updated) throw ApiError.notFound("Animal não encontrado");
    return updated;
  },

  async remove(id) {
    const removed = await animaisRepository.remove(id);
    if (!removed) throw ApiError.notFound("Animal não encontrado");
  },
};
