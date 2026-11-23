# 0001. Autenticação stateless com JWT e conferência da conta a cada requisição

- **Status:** Aceito
- **Data:** 2026-09 (endurecido na Sprint 3)

## Contexto

O SISGEP tem um frontend estático (HTML/JS servido pelo Nginx) que fala com uma API REST em Node.js/Express, em outro subdomínio (`api.<domínio>`). Os perfis (Diretoria, Professor, Técnico, Estagiário e Aluno) têm permissões diferentes, e cada usuário só pode ver as UEPs a que tem acesso. A equipe é pequena, o servidor é uma única VM e não há Redis nem outro armazenamento de sessão. Parte dos usuários entra com a conta institucional do Google.

## Decisão

- A API emite um **JWT assinado com HS256** (`jsonwebtoken`) no login por e-mail/senha ou no login com Google. O token carrega o id e o perfil do usuário e expira em **8 horas** (`JWT_EXPIRES_IN`).
- O segredo vem de `JWT_SECRET`. Em produção (`NODE_ENV=production`) a API **não sobe** sem ele ou com o valor de exemplo (`src/utils/jwt.js`).
- A cada requisição, o middleware `authenticate` valida o token e **reconsulta a conta no banco**: conta removida ou desativada perde o acesso na hora, e o perfil usado é o atual, não o que estava no token.
- O login com Google valida o ID token com `google-auth-library` e aceita só e-mails institucionais (`@ifpe.edu.br` e subdomínios). Uma conta nova criada por esse caminho nasce pendente até a Diretoria aprovar.
- As senhas são guardadas com **bcrypt** (custo 10); contas criadas pelo Google não têm senha.
- O controle de acesso (RBAC e isolamento por UEP) é sempre decidido no backend.

## Alternativas consideradas

- **Sessão no servidor (cookie + tabela de sessões):** permite revogar sessão a qualquer momento, mas exige guardar estado e tratar CSRF. Com frontend e API em domínios diferentes, a configuração de cookies fica mais frágil.
- **Provedor externo (Keycloak, Auth0):** resolveria MFA e revogação, mas seria mais um serviço para manter numa VM com pouca memória, ou um custo externo.
- **Só login com Google:** nem todo perfil tem conta institucional ativa (alunos e técnicos), então o login por senha continua necessário.

## Consequências

- **Positivas:** a API não guarda estado de sessão e sobe vários processos sem coordenação. Desativar uma conta ou trocar o perfil vale imediatamente, por causa da reconsulta ao banco.
- **Custo:** uma consulta ao banco por requisição autenticada. Hoje é irrelevante (teste de carga k6: p95 de 142 ms com 10 usuários).
- **Riscos aceitos:**
  - Não há revogação de um token específico antes de expirar. Mitigação: trocar o `JWT_SECRET` invalida todos os tokens (foi feito quando um token vazou em `loadtest/resultado.json`).
  - O frontend guarda o token em `localStorage`, que fica exposto se houver XSS. Por isso o frontend escapa o texto vindo da API (`escaparHtml`) antes de inserir no HTML; cada novo uso de `innerHTML` precisa manter esse cuidado.
  - A validade de 8 h é maior que os 60 min recomendados no Guia de Boas Práticas. Foi escolhida para cobrir um turno de trabalho no setor sem novo login; reduzir exigiria um refresh token.
- **Pendências:** fixar `algorithms: ["HS256"]` na verificação do token e limitar tentativas de login (força bruta), como pede o Guia de Boas Práticas.
