/*
 * Uma conta de demonstração por perfil, criada quando as migrations rodam,
 * para toda a equipe ter os mesmos logins de teste no banco local. O e-mail
 * e a senha de cada uma podem ser sobrescritos por variável de ambiente
 * (SEED_<PERFIL>_EMAIL / SEED_<PERFIL>_PASSWORD, ver backend/.env.example).
 *
 * As senhas padrão abaixo são públicas (estão no repositório). Por isso, em
 * produção (NODE_ENV=production), a conta só é criada se a senha vier da
 * variável de ambiente; e, se uma conta semente já existente ainda usar a
 * senha padrão, a migração avisa no log. Para não criar nenhuma conta de
 * demonstração, use SEED_DEMO_USERS=false.
 */
export const DEMO_USERS = Object.freeze([
  { envPrefix: "ADMIN", nome: "Administrador", role: "ADMIN", defaultEmail: "admin@ifpe.edu.br", defaultPassword: "admin123" },
  { envPrefix: "PROFESSOR", nome: "Professor Demo", role: "PROFESSOR", defaultEmail: "professor@ifpe.edu.br", defaultPassword: "professor123" },
  { envPrefix: "TECNICO", nome: "Tecnico Demo", role: "TECNICO", defaultEmail: "tecnico@ifpe.edu.br", defaultPassword: "tecnico123" },
  { envPrefix: "ESTAGIARIO", nome: "Estagiario Demo", role: "ESTAGIARIO", defaultEmail: "estagiario@ifpe.edu.br", defaultPassword: "estagiario123" },
  { envPrefix: "ALUNO", nome: "Aluno Demo", role: "ALUNO", defaultEmail: "aluno@ifpe.edu.br", defaultPassword: "aluno123" },
]);

export function resolverContaSemente(conta, env = process.env) {
  const email = env[`SEED_${conta.envPrefix}_EMAIL`] || conta.defaultEmail;
  const senha = env[`SEED_${conta.envPrefix}_PASSWORD`] || conta.defaultPassword;
  return { email, senha, usaSenhaPadrao: senha === conta.defaultPassword };
}
