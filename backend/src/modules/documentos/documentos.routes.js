import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authMiddleware.js";
import { authorize } from "../../middlewares/rbacMiddleware.js";
import { ROLES } from "../../config/roles.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { enviarArquivo } from "../../utils/download.js";
import { documentosService } from "./documentos.service.js";
import { TAMANHO_MAXIMO } from "./documentos.pdf.js";

const router = Router();

// Upload em memória (o arquivo vai direto para o banco): 1 arquivo, até
// 10 MB, e só campos de texto curtos além dele.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1, fields: 10, fieldSize: 2048 },
});

// Professores enviam para a Diretoria; a Diretoria também adiciona PDFs.
router.use(authenticate, authorize(ROLES.ADMIN, ROLES.PROFESSOR));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await documentosService.listar(req.user));
  })
);

router.post(
  "/",
  upload.single("arquivo"),
  asyncHandler(async (req, res) => {
    const doc = await documentosService.enviar(req.user, req.file, req.body ?? {});
    res.status(201).json(doc);
  })
);

// União de PDFs: só a Diretoria. Antes de "/:id" para não colidir.
router.post(
  "/unir",
  authorize(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    enviarArquivo(res, await documentosService.unir(req.body?.itens));
  })
);

router.get(
  "/:id/arquivo",
  asyncHandler(async (req, res) => {
    enviarArquivo(res, { ...(await documentosService.arquivo(req.user, req.params.id)), inline: true });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await documentosService.remover(req.user, req.params.id);
    res.status(204).send();
  })
);

export default router;
