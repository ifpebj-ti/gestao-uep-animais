import { Router } from "express";
import { authController } from "./auth.controller.js";

const router = Router();

// POST /api/auth/login    { email, senha }
router.post("/login", authController.login);

// POST /api/auth/register  { nome, email, senha, role }
// Roles permitidos para autocadastro: ALUNO, TECNICO, ESTAGIARIO, PROFESSOR
router.post("/register", authController.register);

// POST /api/auth/google  { credential }
// credential = ID token (JWT) emitido pelo Google Identity Services no front.
// Cria a conta automaticamente no primeiro login (ver auth.service.js).
router.post("/google", authController.loginGoogle);

export default router;
