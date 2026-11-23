# 0002. PostgreSQL 16 como banco único, com migrations SQL próprias

- **Status:** Aceito
- **Data:** 2026-09 (documentos em BYTEA a partir da Sprint 13)

## Contexto

Os dados do SISGEP são fortemente relacionais: usuários pertencem a UEPs, animais pertencem a uma UEP e têm pai e mãe no próprio rebanho, insumos têm movimentações, atividades apontam para animais. Muitas regras de integridade precisam valer mesmo se a API tiver um bug: identificadores únicos (brinco, SISBOV), saldo de estoque que não fica negativo, coerência de horário nas atividades. O ambiente de produção é uma única VM.

## Decisão

- **PostgreSQL 16** é o único banco do sistema, em container (`postgres:16-alpine`) com volume persistente.
- O esquema é versionado em **migrations SQL** numeradas (`backend/src/db/migrations/NNN_*.sql`), aplicadas por um script próprio (`src/db/migrate.js`) na subida do backend. Cada migration roda em transação e fica registrada em `schema_migrations`; rodar duas vezes não faz nada (o CI confere isso).
- As regras de integridade ficam também no banco: chaves estrangeiras, `UNIQUE`, `CHECK`, tipos `ENUM`.
- Acesso pelo driver `pg`, sempre com **consultas parametrizadas** (`$1, $2...`), sem ORM.
- Colunas `DATE` são lidas como texto `AAAA-MM-DD`, para a data não "voltar um dia" em servidor com outro fuso.
- Os PDFs enviados (notas fiscais) ficam no próprio banco, em `BYTEA` com hash SHA-256, com limite de 10 MB por arquivo.

## Alternativas consideradas

- **ORM (Prisma, Sequelize):** acelera o CRUD, mas esconde o SQL das consultas de censo e relatório, que são a parte mais complexa. Também traz o próprio sistema de migrations.
- **MySQL/MariaDB:** atenderia, mas o PostgreSQL tem `ENUM`, `CHECK` e tipos de data mais completos, além de ser o que a equipe já usava.
- **Arquivos em disco ou object storage para os PDFs:** exigiria um segundo backup e permissões de escrita no container. No banco, o arquivo entra no mesmo backup e na mesma transação do registro.

## Consequências

- **Positivas:** dado inconsistente é barrado pelo banco mesmo se a validação da API falhar. Um único `pg_dump` cobre todos os dados, inclusive os PDFs. As migrations são testadas contra um Postgres real no CI.
- **Negativas:**
  - Sem ORM, cada consulta é escrita à mão. A proteção contra injeção de SQL depende da disciplina de usar só parâmetros; o Semgrep no CI ajuda a vigiar.
  - Guardar PDFs no banco aumenta o tamanho dos backups. Com o limite de 10 MB e o volume esperado de notas fiscais, isso é aceitável; se crescer muito, os arquivos podem migrar para object storage com um ADR novo.
  - Migrations só avançam: corrigir uma migration já aplicada exige escrever outra.
