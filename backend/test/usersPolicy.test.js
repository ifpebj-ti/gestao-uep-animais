import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertCanManage,
  assertCanAssignRole,
  scopeListFilters,
} from "../src/modules/users/users.policy.js";

const admin = { id: 1, role: "ADMIN" };
const profA = { id: 10, role: "PROFESSOR" };
const aluno = { id: 99, role: "ALUNO" };

const alunoDoA = { id: 20, role: "ALUNO", professor_id: 10 };
const alunoDoB = { id: 21, role: "ALUNO", professor_id: 11 };
const profB = { id: 11, role: "PROFESSOR", professor_id: null };

const status = (fn) => {
  try {
    fn();
    return 200;
  } catch (e) {
    return e.statusCode;
  }
};

test("ADMIN gerencia Professor, mas nao Aluno nem outro ADMIN", () => {
  assert.equal(status(() => assertCanManage(admin, profB)), 200);
  assert.equal(status(() => assertCanManage(admin, alunoDoA)), 404);
  assert.equal(status(() => assertCanManage(admin, { id: 2, role: "ADMIN" })), 404);
});

test("PROFESSOR gerencia so a propria equipe", () => {
  assert.equal(status(() => assertCanManage(profA, alunoDoA)), 200);
  assert.equal(status(() => assertCanManage(profA, alunoDoB)), 404);
  assert.equal(status(() => assertCanManage(profA, profB)), 404);
  assert.equal(status(() => assertCanManage(profA, { ...profA })), 404);
});

test("id do token como string tambem casa com professor_id numerico", () => {
  assert.equal(status(() => assertCanManage({ id: "10", role: "PROFESSOR" }, alunoDoA)), 200);
});

test("Papeis que cada um pode atribuir", () => {
  assert.equal(status(() => assertCanAssignRole(admin, "PROFESSOR")), 200);
  assert.equal(status(() => assertCanAssignRole(admin, "ALUNO")), 403);
  assert.equal(status(() => assertCanAssignRole(admin, "ADMIN")), 403);
  assert.equal(status(() => assertCanAssignRole(profA, "TECNICO")), 200);
  assert.equal(status(() => assertCanAssignRole(profA, "PROFESSOR")), 403);
  assert.equal(status(() => assertCanAssignRole(profA, "ADMIN")), 403);
  assert.equal(status(() => assertCanAssignRole(aluno, "ALUNO")), 403);
});

test("GET /users como PROFESSOR sem filtro devolve so a propria equipe", () => {
  const f = scopeListFilters(profA, {});
  assert.equal(f.professorId, 10);
  assert.deepEqual(f.roles, ["ALUNO", "TECNICO", "ESTAGIARIO"]);
});

test("PROFESSOR nao lista a equipe de outro professor", () => {
  assert.equal(status(() => scopeListFilters(profA, { professorId: "11" })), 403);
  assert.equal(scopeListFilters(profA, { professorId: "10" }).professorId, 10);
});

test("ADMIN so lista Professores", () => {
  assert.deepEqual(scopeListFilters(admin, {}).roles, ["PROFESSOR"]);
  assert.equal(status(() => scopeListFilters(admin, { role: "ALUNO" })), 403);
});

test("Perfil sem gestao nao recebe ninguem", () => {
  assert.deepEqual(scopeListFilters(aluno, {}).roles, []);
});
