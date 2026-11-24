## O que foi feito
Descreva resumidamente a mudança e o motivo (o "porquê").

## Issue relacionada
Closes #

## Tipo de mudança
- [ ] feat
- [ ] fix
- [ ] docs
- [ ] refactor
- [ ] test
- [ ] chore

## Como testar
1. ...
2. ...

## Evidências (print, GIF ou log)
Cole aqui, quando houver mudança visível ou de comportamento.

## Definition of Done (DoD)
**Requisito**
- [ ] A PR está vinculada a uma issue (`Closes #`)
- [ ] Os **critérios de aceite** da issue foram atendidos (conferi um a um)

**Qualidade**
- [ ] Rodei localmente e testei a funcionalidade
- [ ] Testes novos ou ajustados para a mudança; todos passaram (lint + testes no CI)
- [ ] Cobertura mínima mantida (70% backend/dados)
- [ ] Código limpo: nomes claros e comentários só para explicar o "porquê"

**Segurança**
- [ ] **SAST (job `sast`, Semgrep) passou** no CI, sem findings de severidade ERROR
- [ ] Trivy (imagens) e workflow Security (SCA, Gitleaks) sem falha nova
- [ ] Nenhum segredo, senha ou token no código ou no histórico da PR

**Documentação e revisão**
- [ ] Documentação impactada atualizada (README, Wiki, CHANGELOG; ADR em `docs/adr` se houve decisão de arquitetura)
- [ ] Consigo demonstrar isso na weekly/review
- [ ] Pelo menos 1 revisor aprovou, com comentários técnicos (não só "LGTM")
