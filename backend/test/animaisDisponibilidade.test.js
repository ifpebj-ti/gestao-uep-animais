import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverDisponibilidade } from "../src/modules/animais/animais.disponibilidade.js";

const HOJE = "2026-11-03";
const erro400 = (e) => e.statusCode === 400;
const disponivelAtual = { disponivel: true, motivo_indisponibilidade: null, indisponivel_desde: null, status_reprodutivo: "VAZIA" };

test("criacao padrao: disponivel, sem motivo nem data", () => {
  assert.deepEqual(resolverDisponibilidade({}, {}, HOJE), { disponivel: true, motivo_indisponibilidade: null, indisponivel_desde: null });
});

test("regra 1: DESCARTE deixa indisponivel com motivo DESCARTE e recusa disponivel=true", () => {
  assert.deepEqual(
    resolverDisponibilidade(disponivelAtual, { status_reprodutivo: "DESCARTE" }, HOJE),
    { disponivel: false, motivo_indisponibilidade: "DESCARTE", indisponivel_desde: HOJE }
  );
  assert.throws(() => resolverDisponibilidade({}, { status_reprodutivo: "DESCARTE", disponivel: true }, HOJE), erro400);
  // descarte que ja tinha sido vendido continua VENDIDO
  const vendido = { ...disponivelAtual, disponivel: false, motivo_indisponibilidade: "VENDIDO", indisponivel_desde: "2026-10-01" };
  assert.equal(resolverDisponibilidade(vendido, { status_reprodutivo: "DESCARTE" }, HOJE).motivo_indisponibilidade, "VENDIDO");
});

test("regra 2: informar motivo torna indisponivel; motivo com disponivel=true e 400", () => {
  assert.deepEqual(
    resolverDisponibilidade(disponivelAtual, { motivo_indisponibilidade: "QUARENTENA" }, HOJE),
    { disponivel: false, motivo_indisponibilidade: "QUARENTENA", indisponivel_desde: HOJE }
  );
  assert.throws(() => resolverDisponibilidade({}, { motivo_indisponibilidade: "VENDIDO", disponivel: true }, HOJE), erro400);
});

test("regra 3: disponivel=false sem motivo vira OUTRO", () => {
  assert.equal(resolverDisponibilidade(disponivelAtual, { disponivel: false }, HOJE).motivo_indisponibilidade, "OUTRO");
});

test("regra 4: disponivel=true ou motivo null limpa motivo e data", () => {
  const indisponivel = { ...disponivelAtual, disponivel: false, motivo_indisponibilidade: "EM_TRATAMENTO", indisponivel_desde: "2026-10-01" };
  const esperado = { disponivel: true, motivo_indisponibilidade: null, indisponivel_desde: null };
  assert.deepEqual(resolverDisponibilidade(indisponivel, { disponivel: true }, HOJE), esperado);
  assert.deepEqual(resolverDisponibilidade(indisponivel, { motivo_indisponibilidade: null }, HOJE), esperado);
});

test("regra 5: saiu do DESCARTE volta a ficar disponivel", () => {
  const descarte = { disponivel: false, motivo_indisponibilidade: "DESCARTE", indisponivel_desde: "2026-10-01", status_reprodutivo: "DESCARTE" };
  assert.equal(resolverDisponibilidade(descarte, { status_reprodutivo: "VAZIA" }, HOJE).disponivel, true);
  // mudar outra coisa (observacoes) nao mexe na disponibilidade
  const tratamento = { ...descarte, status_reprodutivo: "VAZIA", motivo_indisponibilidade: "EM_TRATAMENTO" };
  assert.deepEqual(resolverDisponibilidade(tratamento, { observacoes: "x" }, HOJE), {
    disponivel: false, motivo_indisponibilidade: "EM_TRATAMENTO", indisponivel_desde: "2026-10-01",
  });
});

test("regra 6: data informada vale; ja indisponivel mantem a data antiga", () => {
  assert.equal(resolverDisponibilidade(disponivelAtual, { disponivel: false, indisponivel_desde: "2026-09-01" }, HOJE).indisponivel_desde, "2026-09-01");
  const indisponivel = { ...disponivelAtual, disponivel: false, motivo_indisponibilidade: "QUARENTENA", indisponivel_desde: "2026-10-05" };
  assert.equal(resolverDisponibilidade(indisponivel, { motivo_indisponibilidade: "EM_TRATAMENTO" }, HOJE).indisponivel_desde, "2026-10-05");
});
