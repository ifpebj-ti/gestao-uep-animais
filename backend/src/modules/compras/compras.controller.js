import { comprasService } from "./compras.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const comprasController = {
  // GET /ueps/:uepId/compras/necessidades?dias=30
  necessidades: asyncHandler(async (req, res) => {
    res.json(await comprasService.necessidades(req.params.uepId, req.query));
  }),
};
