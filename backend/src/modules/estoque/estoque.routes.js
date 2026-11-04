import { Router } from "express";
import { estoqueController } from "./estoque.controller.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { allowWriteOrReadOnly } from "../../middlewares/rbacMiddleware.js";

// mergeParams permite ler :uepId quando montado em /api/ueps/:uepId
const router = Router({ mergeParams: true });

// Leitura liberada a todo usuario autenticado; escrita bloqueada para
// ALUNO/ESTAGIARIO (mesma regra do modulo de animais).
router.get("/insumos", authenticate, estoqueController.listInsumos);
router.post("/insumos", authenticate, allowWriteOrReadOnly, estoqueController.createInsumo);
router.get("/insumos/:insumoId", authenticate, estoqueController.getInsumo);
router.patch(
  "/insumos/:insumoId",
  authenticate,
  allowWriteOrReadOnly,
  estoqueController.updateInsumo
);

router.get("/estoque/movimentacoes", authenticate, estoqueController.listMovimentacoes);
// Sprint 11: insumos em nível crítico/atenção desta UEP
router.get("/estoque/alertas", authenticate, estoqueController.alertasDaUep);
router.post(
  "/estoque/movimentacoes",
  authenticate,
  allowWriteOrReadOnly,
  estoqueController.registrarMovimentacao
);

export default router;

// Montado em /api/estoque: alertas de todas as UEPs que o usuário enxerga.
export const estoqueRaizRouter = Router();
estoqueRaizRouter.get("/alertas", authenticate, estoqueController.alertasGerais);
