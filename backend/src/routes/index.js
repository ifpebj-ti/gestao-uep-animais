import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import uepsRoutes from "../modules/ueps/ueps.routes.js";
import animaisRoutes from "../modules/animais/animais.routes.js";
import { estoqueRaizRouter } from "../modules/estoque/estoque.routes.js";

const router = Router();

// Sprint 3
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);

// Sprint 4 (inclui rotas aninhadas de animais por UEP)
router.use("/ueps", uepsRoutes);

// Sprint 5: também exposto no nível raiz para censo/busca entre todas as UEPs
router.use("/animais", animaisRoutes);

// Sprint 11: painel de alertas de estoque entre as UEPs do usuário
router.use("/estoque", estoqueRaizRouter);

export default router;
