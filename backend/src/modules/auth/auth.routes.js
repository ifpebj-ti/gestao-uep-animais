import { Router } from "express";
import { authController } from "./auth.controller.js";

const router = Router();

// POST /api/auth/login    { email, senha }
router.post("/login", authController.login);

// POST /api/auth/register  { nome, email, senha, role }
// Roles permitidos para autocadastro: ALUNO, TECNICO, ESTAGIARIO, PROFESSOR
router.post("/register", authController.register);

export default router;
