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

// Papéis que formam a equipe de um Professor (aba "Minha Equipe")
export const TEAM_ROLES = [ROLES.ALUNO, ROLES.TECNICO, ROLES.ESTAGIARIO];

// Quem pode entrar nas rotas de gestão de usuários. O QUE cada um enxerga
// lá dentro é decidido por MANAGEABLE_ROLES_BY + users.policy.js:
//   ADMIN (Diretoria) -> só contas de PROFESSOR
//   PROFESSOR         -> só a própria equipe (professor_id = ele mesmo)
export const USER_MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.PROFESSOR];

export const MANAGEABLE_ROLES_BY = Object.freeze({
  [ROLES.ADMIN]: [ROLES.PROFESSOR],
  [ROLES.PROFESSOR]: TEAM_ROLES,
});
