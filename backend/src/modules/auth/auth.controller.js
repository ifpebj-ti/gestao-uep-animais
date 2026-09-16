import { authService } from "./auth.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const authController = {
  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  }),

  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  }),

  loginGoogle: asyncHandler(async (req, res) => {
    const result = await authService.loginWithGoogle(req.body.credential);
    // conta recém-criada e pendente de aprovação -> 202 (aceito, mas ainda
    // não pode ser usado); conta ativa -> 200 normal, com token.
    res.status(result.pendente ? 202 : 200).json(result);
  }),
};
