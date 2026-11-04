import { ApiError } from "../../utils/ApiError.js";
import { parseId } from "../../utils/validacao.js";
import { ROLES } from "../../config/roles.js";
import { animaisRepository } from "../animais/animais.repository.js";
import { atividadesRepository } from "./atividades.repository.js";
import { validarAtividade, validarEstadoFinal, parseAno } from "./atividades.validators.js";

/*
 * Calendário de atividades (Sprint 14). Todas as rotas ficam dentro de
 * /ueps/:uepId, então o acesso à UEP já foi conferido (requireUepAccess).
 *
 * Quem pode o quê (mesma regra que o front mostra):
 *   ver e registrar  -> qualquer perfil com acesso à UEP (inclusive Aluno e
 *                       Estagiário: registrar atividade de campo é a função deles)
 *   editar e remover -> Diretoria, Professor da UEP, ou quem criou a atividade
 */

export function podeAlterar(user, atividade) {
  if (user.role === ROLES.ADMIN || user.role === ROLES.PROFESSOR) return true;
  return atividade.criado_por !== null && Number(atividade.criado_por) === Number(user.id);
}

async function animalDaUep(uepId, animalId) {
  if (!animalId) return null;
  const animal = await animaisRepository.findById(animalId);
  return animal && Number(animal.uep_id) === Number(uepId) ? animal : null;
}

async function carregar(uepId, idRaw) {
  const id = parseId(idRaw, "id");
  const atividade = await atividadesRepository.findById(uepId, id);
  if (!atividade) throw ApiError.notFound("Atividade não encontrada");
  return atividade;
}

function anoAtual() {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric" }).format(new Date()));
}

export const atividadesService = {
  async listar(uepId, query = {}) {
    return atividadesRepository.findDoAno(uepId, parseAno(query.ano, anoAtual()));
  },

  async criar(user, uepId, body) {
    const dados = validarAtividade(body, { parcial: false });
    validarEstadoFinal(dados, await animalDaUep(uepId, dados.animal_id));
    return atividadesRepository.create(uepId, dados, user.id);
  },

  async atualizar(user, uepId, idRaw, body) {
    const atual = await carregar(uepId, idRaw);
    if (!podeAlterar(user, atual)) {
      throw ApiError.forbidden("Só o Professor ou quem registrou a atividade pode alterá-la.");
    }
    const dados = validarAtividade(body, { parcial: true });
    const final = { ...atual, ...dados };
    validarEstadoFinal(final, await animalDaUep(uepId, final.animal_id));
    return atividadesRepository.update(uepId, atual.id, dados);
  },

  async remover(user, uepId, idRaw) {
    const atual = await carregar(uepId, idRaw);
    if (!podeAlterar(user, atual)) {
      throw ApiError.forbidden("Só o Professor ou quem registrou a atividade pode removê-la.");
    }
    await atividadesRepository.remove(uepId, atual.id);
  },
};
