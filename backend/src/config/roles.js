// RBAC - papéis do sistema
export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  PROFESSOR: "PROFESSOR",
  TECNICO: "TECNICO",
  ESTAGIARIO: "ESTAGIARIO",
  ALUNO: "ALUNO",
});

export const ALL_ROLES = Object.values(ROLES);

// Papéis com permissão de escrita (criar/atualizar/excluir)
export const WRITE_ROLES = [ROLES.ADMIN, ROLES.PROFESSOR, ROLES.TECNICO];

// Papéis apenas leitura (consultas)
export const READ_ONLY_ROLES = [ROLES.ESTAGIARIO, ROLES.ALUNO];

// Somente ADMIN gerencia usuários/perfis
export const USER_MANAGEMENT_ROLES = [ROLES.ADMIN];
