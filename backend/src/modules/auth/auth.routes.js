import { Router } from "express";
import { authController } from "./auth.controller.js";

const router = Router();

// POST /api/auth/login  { email, senha }
router.post("/login", authController.login);

export default router;
