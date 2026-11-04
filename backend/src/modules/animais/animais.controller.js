import { animaisService } from "./animais.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { resolverEscopo } from "../ueps/ueps.acesso.js";
import { validarFiltros } from "./animais.validators.js";

const MAX_LIMIT = 100;

/**
 * UEPs que esta requisição enxerga:
 *  - rota aninhada (/ueps/:uepId/animais): só aquela UEP (o requireUepAccess
 *    já conferiu o acesso e deixou req.uepId);
 *  - rota da raiz (/animais): as UEPs do usuário, ou só a do ?uepId= (que
 *    precisa ser uma delas). Diretoria sem ?uepId= -> null (todas).
 */
async function escopoDe(req, uepIdPedido = req.query.uepId) {
  if (req.uepId) return [req.uepId];
  return resolverEscopo(req.user, uepIdPedido);
}

/**
 * Le page/limit da query. Sem limit, a listagem devolve tudo (compatibilidade).
 * page e 1-based; limit e limitado a MAX_LIMIT.
 */
function parsePagination(req) {
  const { page, limit } = req.query;
  if (limit === undefined) return {};

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), MAX_LIMIT);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  return { limit: parsedLimit, offset: (parsedPage - 1) * parsedLimit };
}

export const animaisController = {
  list: asyncHandler(async (req, res) => {
    const filtros = validarFiltros(req.query);
    const animais = await animaisService.list(await escopoDe(req), filtros, parsePagination(req));
    res.json(animais);
  }),

  getById: asyncHandler(async (req, res) => {
    const animal = await animaisService.getById(await escopoDe(req, null), req.params.id);
    res.json(animal);
  }),

  // GET /animais/buscar?brinco=...&corteAustraliano=...&sisbov=...
  search: asyncHandler(async (req, res) => {
    const resultados = await animaisService.searchByIdentifier(await escopoDe(req), req.query);
    res.json(resultados);
  }),

  // GET /animais/censo -> contagem por categoria/sexo (Sprint 5)
  censo: asyncHandler(async (req, res) => {
    const resultado = await animaisService.censo(await escopoDe(req), validarFiltros(req.query));
    res.json(resultado);
  }),

  create: asyncHandler(async (req, res) => {
    const uepId = req.uepId ?? req.body?.uepId;
    const animal = await animaisService.create(
      await escopoDe(req, null),
      uepId,
      req.body,
      req.user?.id
    );
    res.status(201).json(animal);
  }),

  update: asyncHandler(async (req, res) => {
    const animal = await animaisService.update(await escopoDe(req, null), req.params.id, req.body);
    res.json(animal);
  }),

  remove: asyncHandler(async (req, res) => {
    await animaisService.remove(await escopoDe(req, null), req.params.id);
    res.status(204).send();
  }),
};
