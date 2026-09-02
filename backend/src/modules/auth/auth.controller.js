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
};
