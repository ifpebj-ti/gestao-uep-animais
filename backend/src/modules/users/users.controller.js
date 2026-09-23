import { usersService } from "./users.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

/* req.user ({ id, role }) vem do token JWT (authenticate) e é passado como
   "actor" pro service, que aplica a hierarquia Diretoria -> Professor ->
   Equipe (ver users.policy.js). */
export const usersController = {
  list: asyncHandler(async (req, res) => {
    const { role, ativo, professorId } = req.query;
    const users = await usersService.list(req.user, {
      role,
      ativo: ativo === undefined ? undefined : ativo === "true",
      professorId,
    });
    res.json(users);
  }),

  getById: asyncHandler(async (req, res) => {
    const user = await usersService.getById(req.user, req.params.id);
    res.json(user);
  }),

  me: asyncHandler(async (req, res) => {
    const user = await usersService.getSelf(req.user.id);
    res.json(user);
  }),

  create: asyncHandler(async (req, res) => {
    const user = await usersService.create(req.user, req.body);
    res.status(201).json(user);
  }),

  update: asyncHandler(async (req, res) => {
    const user = await usersService.update(req.user, req.params.id, req.body);
    res.json(user);
  }),

  changePassword: asyncHandler(async (req, res) => {
    await usersService.changePassword(req.user, req.params.id, req.body.novaSenha);
    res.status(204).send();
  }),

  remove: asyncHandler(async (req, res) => {
    await usersService.remove(req.user, req.params.id);
    res.status(204).send();
  }),
};
