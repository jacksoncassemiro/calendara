# Referência — modelo de dados e integrações

A definição atual está nos [tipos públicos](../../src/core/types/index.ts) e no [guia de API](../pt-BR/api.md). Este documento orienta adapters; não declara conectores implementados.

## Regras do modelo

- Um evento tem ID estável, título e intervalo all-day ou timed, com fim exclusivo.
- Eventos timed preservam o horário local e o fuso; eventos all-day usam datas civis.
- Uma série reúne RRULE, datas adicionais, exclusões e overrides identificados pelo início original.
- Recursos, capacidade, buffers e disponibilidade são genéricos. Informações de negócio ficam na aplicação.
- Bloqueios e expediente são constraints; não precisam ser eventos de conteúdo.

## Mapeamento orientativo

| Calendara | Google Calendar | Microsoft Graph |
|---|---|---|
| `title` | `summary` | `subject` |
| `description` | `description` | `body.content` |
| `time` | `start` / `end` | `start` / `end`, `isAllDay` |
| `recurrence.rule` | Linha RRULE em `recurrence` | `recurrence.pattern` e `recurrence.range` |
| `recurrence.exDates` | EXDATE / instâncias excluídas | Exceções e instâncias canceladas |
| `recurrence.rDates` | RDATE | Sem equivalência direta geral |
| Overrides | `originalStartTime`, `recurringEventId` | `seriesMasterId`, ocorrências e exceções |

Conversões precisam tratar formatos, identidade, fusos e limites de recorrência. Nem toda regra tem tradução equivalente; o adapter deve rejeitar ou explicar perdas. Cores e status remotos exigem mapeamento da aplicação, não correspondência automática.

[Referência Google](google-calendar-api.md) · [Referência Microsoft](outlook-graph-api.md) · [Validação de recorrência](recurrence-validation.md).
