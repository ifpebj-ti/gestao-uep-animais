import { animaisRepository } from "./animais.repository.js";
import { uepsRepository } from "../ueps/ueps.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { parseId, parseTexto } from "../../utils/validacao.js";
import { validarAnimal } from "./animais.validators.js";

/*
 * Todas as operações recebem `escopo`: a lista de UEPs que a requisição pode
 * enxergar (null = todas, só para a Diretoria). Nas rotas aninhadas
 * (/ueps/:uepId/animais) o escopo é [uepId], já conferido pelo
 * requireUepAccess; nas rotas da raiz (/animais) é resolvido pelo controller
 * a partir das UEPs do usuário (ver ueps.acesso.js).
 */

function dentroDoEscopo(escopo, uepId) {
  return escopo === null || escopo.includes(Number(uepId));
}

async function carregarNoEscopo(escopo, idRaw) {
  const id = parseId(idRaw, "id");
  const animal = await animaisRepository.findById(id);
  // Animal de outra UEP responde 404 (e não 403): pela rota de um setor não
  // dá pra descobrir se existe um animal com aquele id em outro setor.
  if (!animal || !dentroDoEscopo(escopo, animal.uep_id)) {
    throw ApiError.notFound("Animal não encontrado");
  }
  return animal;
}

export const animaisService = {
  async list(escopo, filtros = {}, paginacao = {}) {
    const consulta = { ...filtros, ...paginacao, uepIds: escopo };

    // Sem paginacao explicita: mantem o retorno como array simples
    if (paginacao.limit === undefined || paginacao.limit === null) {
      return animaisRepository.findAll(consulta);
    }

    const [data, total] = await Promise.all([
      animaisRepository.findAll(consulta),
      animaisRepository.countTotal(consulta),
    ]);

    const limit = paginacao.limit;
    const offset = paginacao.offset ?? 0;
    return {
      data,
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit) || 1,
    };
  },

  async getById(escopo, id) {
    return carregarNoEscopo(escopo, id);
  },

  // Busca por identificador único: brinco, corte australiano ou SISBOV
  async searchByIdentifier(escopo, params = {}) {
    const brinco = parseTexto(params.brinco, "brinco", { max: 50 });
    const corteAustraliano = parseTexto(params.corteAustraliano, "corteAustraliano", { max: 50 });
    const sisbov = parseTexto(params.sisbov, "sisbov", { max: 15 });
    if (!brinco && !corteAustraliano && !sisbov) {
      throw ApiError.badRequest(
        "Informe ao menos um identificador: brinco, corteAustraliano ou sisbov"
      );
    }
    return animaisRepository.findByIdentifier({ brinco, corteAustraliano, sisbov, uepIds: escopo });
  },

  // Censo: total de animais por categoria/sexo, com os mesmos filtros da listagem
  async censo(escopo, filtros = {}) {
    const consulta = { ...filtros, uepIds: escopo };
    const [porCategoria, porRaca, total] = await Promise.all([
      animaisRepository.countByCategoria(consulta),
      animaisRepository.countByRaca(consulta),
      animaisRepository.countTotal(consulta),
    ]);
    return { total, porCategoria, porRaca };
  },

  /** uepIdRaw: o :uepId da rota aninhada ou o uepId do corpo (rota da raiz). */
  async create(escopo, uepIdRaw, body, createdBy) {
    if (uepIdRaw === undefined || uepIdRaw === null || uepIdRaw === "") {
      throw ApiError.badRequest("uepId, categoria e sexo são obrigatórios");
    }
    const uepId = parseId(uepIdRaw, "uepId");
    const dados = validarAnimal(body, { parcial: false });

    if (!dentroDoEscopo(escopo, uepId)) {
      throw ApiError.forbidden("Você não tem acesso a esta UEP.");
    }
    const uep = await uepsRepository.findById(uepId);
    if (!uep) throw ApiError.notFound(`UEP ${uepId} não encontrada`);

    return animaisRepository.create({ ...dados, uep_id: uepId, created_by: createdBy ?? null });
  },

  async update(escopo, id, body) {
    const atual = await carregarNoEscopo(escopo, id);
    const dados = validarAnimal(body, { parcial: true });
    return animaisRepository.update(atual.id, dados);
  },

  async remove(escopo, id) {
    const atual = await carregarNoEscopo(escopo, id);
    await animaisRepository.remove(atual.id);
  },
};
