# 0005. Observabilidade por logs em stdout e healthchecks

- **Status:** Proposto
- **Data:** 2026-11-23

## Contexto

Em produção, o SISGEP roda numa única VM com Docker Compose (ADR 0004). Hoje a equipe descobre problemas quando alguém reclama ou ao abrir os logs manualmente por SSH. A seção "Observabilidade" do Guia de Execução na Wiki ainda está vazia, e o Guia de Boas Práticas pede logs sem dados sensíveis e eventos críticos registrados. A VM tem pouca memória, então uma pilha pesada (por exemplo, ELK) não cabe.

O que já existe:

- log HTTP de cada requisição com **Morgan** no formato `combined` em produção, saindo no stdout do container;
- log de erros não tratados e de erros SQL. Desde a correção do log SQL, só a query, o código do erro e a quantidade de parâmetros são gravados, sem os valores;
- **healthchecks** do Docker em todos os serviços (`/health` no backend e no serviço de dados);
- teste de carga k6 (`loadtest/k6-smoke.js`), rodado manualmente.

## Decisão proposta

1. **Logs:** continuar com logs em stdout, lidos com `docker compose logs`, e limitar o tamanho com o driver `json-file` (`max-size`, `max-file`) para não encher o disco da VM. Os logs não podem conter senhas, tokens, nem conteúdo de documentos.
2. **Disponibilidade:** usar um monitor externo de uptime, gratuito, que chame `https://api.<domínio>/health` e o frontend a cada poucos minutos e avise a equipe por e-mail.
3. **Métricas:** ficam adiadas. Se forem necessárias, a opção leve é expor `/metrics` no formato Prometheus com `prom-client` e coletar fora da VM.

## Alternativas consideradas

- **Prometheus + Grafana na própria VM:** completo, mas consome memória que a VM não tem e vira mais uma coisa para manter.
- **Serviço gerenciado de logs e erros (Sentry, Grafana Cloud):** bom, mas manda dados de produção para terceiros e exige revisar a LGPD (logs têm IP).

## Consequências

- **Positivas:** custo zero e nenhum serviço novo na VM; a equipe passa a saber que o sistema caiu antes do usuário.
- **Negativas:** sem métricas, não há histórico de latência nem de uso; investigar um problema continua exigindo SSH e leitura de log.
- **Para virar "Aceito":** configurar a rotação de logs no `docker-compose.prod.yml`, criar o monitor de uptime e preencher a seção 13 do Guia de Execução na Wiki com o procedimento.
