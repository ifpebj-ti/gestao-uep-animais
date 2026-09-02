import { animaisService } from "./animais.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// Monta o objeto de filtros comum a partir de query params + :uepId da rota aninhada
const MAX_LIMIT = 100;

function parseFilters(req) {
  const { categoria, sexo, statusReprodutivo, disponivel, busca } = req.query;
  return {
    uepId: req.params.uepId ?? req.query.uepId,
    categoria,
    sexo,
    statusReprodutivo,
    disponivel: disponivel === undefined ? undefined : disponivel === "true",
    busca,
  };
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
    const animais = await animaisService.list({
      ...parseFilters(req),
      ...parsePagination(req),
    });
    res.json(animais);
  }),

  getById: asyncHandler(async (req, res) => {
    const animal = await animaisService.getById(req.params.id);
    res.json(animal);
  }),

  // GET /animais/buscar?brinco=...&corteAustraliano=...&sisbov=...
  search: asyncHandler(async (req, res) => {
    const { brinco, corteAustraliano, sisbov } = req.query;
    const resultados = await animaisService.searchByIdentifier({
      brinco,
      corteAustraliano,
      sisbov,
      uepId: req.params.uepId ?? req.query.uepId,
    });
    res.json(resultados);
  }),

  // GET /animais/censo -> contagem por categoria/sexo (Sprint 5)
  censo: asyncHandler(async (req, res) => {
    const resultado = await animaisService.censo(parseFilters(req));
    res.json(resultado);
  }),

  create: asyncHandler(async (req, res) => {
    const payload = {
      ...req.body,
      uepId: req.params.uepId ?? req.body.uepId,
      createdBy: req.user?.id,
    };
    const animal = await animaisService.create(payload);
    res.status(201).json(animal);
  }),

  update: asyncHandler(async (req, res) => {
    const animal = await animaisService.update(req.params.id, req.body);
    res.json(animal);
  }),

  remove: asyncHandler(async (req, res) => {
    await animaisService.remove(req.params.id);
    res.status(204).send();
  }),
};
