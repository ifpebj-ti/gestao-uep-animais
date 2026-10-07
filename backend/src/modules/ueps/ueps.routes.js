import { Router } from "express";
import { uepsController } from "./ueps.controller.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { allowWriteOrReadOnly } from "../../middlewares/rbacMiddleware.js";
import animaisRouter from "../animais/animais.routes.js";
import estoqueRouter from "../estoque/estoque.routes.js";

const router = Router();

router.use(authenticate);

// CRUD de setores/UEPs (Sprint 4)
// GET liberado para todos os papéis autenticados; escrita restrita a
// ADMIN/PROFESSOR/TECNICO (ALUNO e ESTAGIARIO ficam somente-leitura).
router.get("/", uepsController.list);
router.get("/:id", uepsController.getById);
router.post("/", allowWriteOrReadOnly, uepsController.create);
router.patch("/:id", allowWriteOrReadOnly, uepsController.update);
router.delete("/:id", allowWriteOrReadOnly, uepsController.remove);

// Dados de animais sempre associados/isolados por UEP:
// GET/POST /api/ueps/:uepId/animais
router.use("/:uepId/animais", animaisRouter);

// Estoque de insumos (racao) sempre isolado por UEP (Sprint 10):
// GET/POST /api/ueps/:uepId/insumos
// GET/POST /api/ueps/:uepId/estoque/movimentacoes
router.use("/:uepId", estoqueRouter);

export default router;
