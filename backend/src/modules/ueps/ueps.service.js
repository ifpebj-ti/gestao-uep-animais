import { uepsRepository } from "./ueps.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { UEP_TIPOS } from "../../config/enums.js";

function assertValidTipo(tipo) {
  if (!UEP_TIPOS.includes(tipo)) {
    throw ApiError.badRequest(
      `Tipo de UEP inválido: ${tipo}. Valores aceitos: ${UEP_TIPOS.join(", ")}`
    );
  }
}

export const uepsService = {
  async list(filters) {
    return uepsRepository.findAll(filters);
  },

  async getById(id) {
    const uep = await uepsRepository.findById(id);
    if (!uep) throw ApiError.notFound("UEP não encontrada");
    return uep;
  },

  async create({ nome, tipo, descricao, responsavelId }) {
    if (!nome || !tipo) throw ApiError.badRequest("nome e tipo são obrigatórios");
    assertValidTipo(tipo);
    return uepsRepository.create({ nome, tipo, descricao, responsavelId });
  },

  async update(id, data) {
    if (data.tipo) assertValidTipo(data.tipo);
    const updated = await uepsRepository.update(id, data);
    if (!updated) throw ApiError.notFound("UEP não encontrada");
    return updated;
  },

  async remove(id) {
    const removed = await uepsRepository.remove(id);
    if (!removed) throw ApiError.notFound("UEP não encontrada");
  },
};
