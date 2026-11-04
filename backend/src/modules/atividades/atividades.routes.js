import { Router } from "express";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { atividadesService } from "./atividades.service.js";

// Montado em /api/ueps/:uepId/atividades, depois do requireUepAccess.
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await atividadesService.listar(req.uepId, req.query));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    res.status(201).json(await atividadesService.criar(req.user, req.uepId, req.body ?? {}));
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await atividadesService.atualizar(req.user, req.uepId, req.params.id, req.body ?? {}));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await atividadesService.remover(req.user, req.uepId, req.params.id);
    res.status(204).send();
  })
);

export default router;
