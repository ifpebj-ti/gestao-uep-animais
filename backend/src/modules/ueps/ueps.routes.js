import { Router } from "express";
import { uepsController } from "./ueps.controller.js";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { authorize } from "../../middlewares/rbacMiddleware.js";
import { requireUepAccess } from "../../middlewares/uepAccessMiddleware.js";
import { ROLES } from "../../config/roles.js";
import animaisRouter from "../animais/animais.routes.js";
import estoqueRouter from "../estoque/estoque.routes.js";
import comprasRouter from "../compras/compras.routes.js";

const router = Router();

router.use(authenticate);

// CRUD de setores/UEPs (Sprint 4)
// A lista e o detalhe são liberados a todo usuário autenticado (a tela de
// Controle de Acesso e a seleção de setor precisam dos nomes). Criar,
// editar e excluir uma UEP é só da Diretoria (ADMIN): excluir apaga em
// cascata todos os animais e o estoque do setor.
router.get("/", uepsController.list);
router.get("/:id", uepsController.getById);
router.post("/", authorize(ROLES.ADMIN), uepsController.create);
router.patch("/:id", authorize(ROLES.ADMIN), uepsController.update);
router.delete("/:id", authorize(ROLES.ADMIN), uepsController.remove);

// Tudo que fica DENTRO de uma UEP passa pelo isolamento por setor: o
// usuário só chega aqui se a UEP for uma das dele (ver uepAccessMiddleware).
router.use("/:uepId", requireUepAccess);

// Dados de animais sempre associados/isolados por UEP:
// GET/POST /api/ueps/:uepId/animais
router.use("/:uepId/animais", animaisRouter);

// Apoio as compras (Sprint 12): necessidades consolidadas da UEP
// GET /api/ueps/:uepId/compras/necessidades?dias=30
router.use("/:uepId/compras", comprasRouter);

// Estoque de insumos (racao) sempre isolado por UEP (Sprint 10):
// GET/POST /api/ueps/:uepId/insumos
// GET/POST /api/ueps/:uepId/estoque/movimentacoes
router.use("/:uepId", estoqueRouter);

export default router;
