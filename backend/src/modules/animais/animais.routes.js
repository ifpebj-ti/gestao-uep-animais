import { Router } from "express";
import { animaisController } from "./animais.controller.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { allowWriteOrReadOnly } from "../../middlewares/rbacMiddleware.js";

// mergeParams permite ler :uepId quando montado em /api/ueps/:uepId/animais
const router = Router({ mergeParams: true });

router.use(authenticate);

// Rotas específicas ANTES de "/:id" para não colidirem com o parâmetro
router.get("/censo", animaisController.censo);
router.get("/buscar", animaisController.search);

router.get("/", animaisController.list);
router.get("/:id", animaisController.getById);
router.post("/", allowWriteOrReadOnly, animaisController.create);
router.patch("/:id", allowWriteOrReadOnly, animaisController.update);
router.delete("/:id", allowWriteOrReadOnly, animaisController.remove);

export default router;
