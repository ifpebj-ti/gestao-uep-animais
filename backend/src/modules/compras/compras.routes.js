import { Router } from "express";
import { comprasController } from "./compras.controller.js";
import { authenticate } from "../../middlewares/authMiddleware.js";

// mergeParams permite ler :uepId quando montado em /api/ueps/:uepId/compras
const router = Router({ mergeParams: true });

// Somente leitura: qualquer perfil autenticado consulta (a decisao de
// comprar e dos perfis de escrita, mas todos podem ver a necessidade).
router.get("/necessidades", authenticate, comprasController.necessidades);

export default router;
