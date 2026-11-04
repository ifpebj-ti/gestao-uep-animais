import { Router } from "express";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { authorize } from "../../middlewares/rbacMiddleware.js";
import { ROLES } from "../../config/roles.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { enviarArquivo } from "../../utils/download.js";
import { gerarRelatorio } from "./relatorios.service.js";

const router = Router();

// Painel de relatórios do gestor: exclusivo da Diretoria (ADMIN), que
// enxerga todas as UEPs. Ver contrato no front (script.js, seção 8D).
router.use(authenticate, authorize(ROLES.ADMIN));

// POST /api/relatorios/:tipo/gerar  { formato: 'pdf'|'xlsx', uepId?, dataInicio?, dataFim?, dias? }
router.post(
  "/:tipo/gerar",
  asyncHandler(async (req, res) => {
    const arquivo = await gerarRelatorio(req.params.tipo, req.body ?? {});
    enviarArquivo(res, arquivo);
  })
);

export default router;
