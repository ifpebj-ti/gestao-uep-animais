import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import uepsRoutes from "../modules/ueps/ueps.routes.js";
import animaisRoutes from "../modules/animais/animais.routes.js";
import { estoqueRaizRouter } from "../modules/estoque/estoque.routes.js";
import relatoriosRoutes from "../modules/relatorios/relatorios.routes.js";
import documentosRoutes from "../modules/documentos/documentos.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);

// As rotas de dentro de uma UEP (animais, estoque, compras, atividades)
// ficam aninhadas em /ueps/:uepId para passar pelo isolamento por setor.
router.use("/ueps", uepsRoutes);

// Na raiz, censo e busca consideram todas as UEPs que o usuário enxerga.
router.use("/animais", animaisRoutes);

router.use("/estoque", estoqueRaizRouter);

router.use("/relatorios", relatoriosRoutes);
router.use("/documentos", documentosRoutes);

export default router;
