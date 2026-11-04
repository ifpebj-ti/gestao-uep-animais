import { estoqueService } from "./estoque.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const estoqueController = {
  listInsumos: asyncHandler(async (req, res) => {
    res.json(await estoqueService.listInsumos(req.params.uepId));
  }),

  createInsumo: asyncHandler(async (req, res) => {
    const insumo = await estoqueService.createInsumo(req.params.uepId, req.body, req.user?.id);
    res.status(201).json(insumo);
  }),

  getInsumo: asyncHandler(async (req, res) => {
    res.json(await estoqueService.getInsumo(req.params.uepId, req.params.insumoId));
  }),

  updateInsumo: asyncHandler(async (req, res) => {
    res.json(await estoqueService.updateInsumo(req.params.uepId, req.params.insumoId, req.body));
  }),

  listMovimentacoes: asyncHandler(async (req, res) => {
    res.json(await estoqueService.listMovimentacoes(req.params.uepId, req.query));
  }),

  registrarMovimentacao: asyncHandler(async (req, res) => {
    const mov = await estoqueService.registrarMovimentacao(
      req.params.uepId,
      req.body,
      req.user?.id
    );
    res.status(201).json(mov);
  }),
};
