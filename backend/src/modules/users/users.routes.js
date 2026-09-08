import { Router } from "express";
import { usersController } from "./users.controller.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { authorize } from "../../middlewares/rbacMiddleware.js";
import { USER_MANAGEMENT_ROLES } from "../../config/roles.js";

const router = Router();

router.use(authenticate);

// Qualquer usuário autenticado pode ver o próprio perfil
router.get("/me", usersController.me);

// Gestão de usuários/perfis: somente ADMIN (Sprint 3 - RBAC)
router.get("/", authorize(...USER_MANAGEMENT_ROLES), usersController.list);
router.get("/:id", authorize(...USER_MANAGEMENT_ROLES), usersController.getById);
router.post("/", authorize(...USER_MANAGEMENT_ROLES), usersController.create);
router.patch("/:id", authorize(...USER_MANAGEMENT_ROLES), usersController.update);
router.patch(
  "/:id/senha",
  authorize(...USER_MANAGEMENT_ROLES),
  usersController.changePassword
);
router.delete("/:id", authorize(...USER_MANAGEMENT_ROLES), usersController.remove);

export default router;
