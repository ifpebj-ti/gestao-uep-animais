# Registros de Decisão de Arquitetura (ADRs)

Cada arquivo desta pasta registra uma decisão de arquitetura do SISGEP: o contexto que levou a ela, o que foi decidido e as consequências, boas e ruins. Um ADR aceito não é apagado: se a decisão mudar, escreve-se um ADR novo que o substitui e o antigo passa a apontar para ele.

| Nº | Decisão | Status |
| --- | --- | --- |
| [0001](0001-autenticacao-jwt.md) | Autenticação stateless com JWT e conferência da conta a cada requisição | Aceito |
| [0002](0002-postgresql.md) | PostgreSQL 16 como banco único, com migrations SQL próprias | Aceito |
| [0003](0003-servico-de-dados-flask.md) | Serviço de dados separado em Python/Flask | Aceito, com revisão pendente |
| [0004](0004-deploy-vm-oracle-caddy.md) | Deploy em VM da Oracle Cloud com Docker Compose e Caddy | Aceito |
| [0005](0005-observabilidade.md) | Observabilidade por logs em stdout e healthchecks | Proposto |

## Como escrever um ADR novo

1. Copie o modelo abaixo para `NNNN-titulo-curto.md`, com o próximo número livre.
2. Abra o PR com o ADR junto da mudança que ele justifica (ou antes dela, com status **Proposto**).
3. Acrescente a linha na tabela acima.

```markdown
# NNNN. Título da decisão

- **Status:** Proposto | Aceito | Substituído por NNNN | Descontinuado
- **Data:** AAAA-MM-DD

## Contexto
Qual problema ou restrição exigiu uma decisão? Que forças estavam em jogo?

## Decisão
O que foi decidido, de forma direta.

## Alternativas consideradas
O que mais foi avaliado e por que não foi escolhido.

## Consequências
O que fica mais fácil, o que fica mais difícil e quais riscos ficam aceitos.
```
