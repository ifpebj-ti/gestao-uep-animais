import { uepsService } from "./ueps.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const uepsController = {
  list: asyncHandler(async (req, res) => {
    const { tipo, ativo } = req.query;
    const ueps = await uepsService.list({
      tipo,
      ativo: ativo === undefined ? undefined : ativo === "true",
    });
    res.json(ueps);
  }),

  getById: asyncHandler(async (req, res) => {
    const uep = await uepsService.getById(req.params.id);
    res.json(uep);
  }),

  create: asyncHandler(async (req, res) => {
    const uep = await uepsService.create(req.body);
    res.status(201).json(uep);
  }),

  update: asyncHandler(async (req, res) => {
    const uep = await uepsService.update(req.params.id, req.body);
    res.json(uep);
  }),

  remove: asyncHandler(async (req, res) => {
    await uepsService.remove(req.params.id);
    res.status(204).send();
  }),
};
