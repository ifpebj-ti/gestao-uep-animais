import { usersService } from "./users.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const usersController = {
  list: asyncHandler(async (req, res) => {
    const { role, ativo } = req.query;
    const users = await usersService.list({
      role,
      ativo: ativo === undefined ? undefined : ativo === "true",
    });
    res.json(users);
  }),

  getById: asyncHandler(async (req, res) => {
    const user = await usersService.getById(req.params.id);
    res.json(user);
  }),

  me: asyncHandler(async (req, res) => {
    const user = await usersService.getById(req.user.id);
    res.json(user);
  }),

  create: asyncHandler(async (req, res) => {
    const user = await usersService.create(req.body);
    res.status(201).json(user);
  }),

  update: asyncHandler(async (req, res) => {
    const user = await usersService.update(req.params.id, req.body);
    res.json(user);
  }),

  changePassword: asyncHandler(async (req, res) => {
    await usersService.changePassword(req.params.id, req.body.novaSenha);
    res.status(204).send();
  }),

  remove: asyncHandler(async (req, res) => {
    await usersService.remove(req.params.id);
    res.status(204).send();
  }),
};
