import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import usersRoutes from "../modules/users/users.routes.js";
import uepsRoutes from "../modules/ueps/ueps.routes.js";
import animaisRoutes from "../modules/animais/animais.routes.js";

const router = Router();

// Sprint 3
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);

// Sprint 4 (inclui rotas aninhadas de animais por UEP)
router.use("/ueps", uepsRoutes);

// Sprint 5: também exposto no nível raiz para censo/busca entre todas as UEPs
router.use("/animais", animaisRoutes);

export default router;
