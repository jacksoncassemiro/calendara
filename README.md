# projeto-calendario

Biblioteca de calendário/agenda própria — **núcleo headless em TypeScript** + **adapter React**,
sem os problemas de rerender do FullCalendar, com **bloqueios**, **horário comercial dinâmico** e
**recorrência própria via Temporal API**. Projetada para depois rodar em qualquer framework.

> **Status:** Fase 3 concluída — `packages/core` (headless): tipos canônicos, DateUtils (Temporal),
> recorrência RFC 5545, ConstraintEngine, store observável (diff granular), GeometryEngine (waterfall),
> render Preact isolado (`CalendarApp` + `CalendarShell`/toolbar) e views **Semana/Dia/Mês/N-Dias/Lista**
> (com horário comercial, bloqueios, linha "agora", `eventSource` por range e slots `renderEvent`/`renderToolbar`),
> **112/112 testes verdes** (vitest + jsdom; rrule.js como oráculo). Comece por **[`docs/00-STATUS.md`](docs/00-STATUS.md)**.

## Rodar

```bash
yarn install
yarn test        # vitest — 87/87 (recorrência validada vs rrule.js + constraints + DST)
```

## Documentação

| Doc | O que é |
|---|---|
| [`docs/00-STATUS.md`](docs/00-STATUS.md) | **Diário/continuidade** entre sessões. **Leia primeiro.** |
| [`docs/01-ANALISE.md`](docs/01-ANALISE.md) | Análise do uso atual (wsaude-web), das 3 tentativas e requisitos |
| [`docs/02-PLANO.md`](docs/02-PLANO.md) | Plano de execução faseado + ADRs (decisões) |
| [`docs/03-ARQUITETURA.md`](docs/03-ARQUITETURA.md) | Desenho técnico alvo (core headless, anti-rerender, views) |
| [`docs/reference/referencias-open-source.md`](docs/reference/referencias-open-source.md) | Análise de FullCalendar, Syncfusion, Schedule-X, big-calendar |
| [`docs/reference/google-calendar-api.md`](docs/reference/google-calendar-api.md) | Modelo de dados Google |
| [`docs/reference/outlook-graph-api.md`](docs/reference/outlook-graph-api.md) | Modelo de dados Microsoft Graph (Outlook) |
| [`docs/reference/data-model-mapping.md`](docs/reference/data-model-mapping.md) | Modelo canônico + mapeamento Google/Outlook/RFC 5545 |
| [`docs/reference/recurrence-validation.md`](docs/reference/recurrence-validation.md) | Validação Temporal vs rrule (43/44) + gap corrigido |

## Validação de recorrência (executável)

```bash
cd experiments/recurrence-validation
npm install
node harness.mjs && node harness2.mjs   # compara o motor Temporal com rrule.js
```

## Decisões-chave (resumo)
- **React primeiro**, mas com núcleo headless framework-agnostic (extração vanilla depois é meta).
- **Render interno com Preact isolado** → mata o rerender parasita (padrão FullCalendar/Schedule-X).
- **Recorrência própria via Temporal API** (rrule.js só como oráculo de teste); polyfill para Safari.
- **Modelo de dados canônico = superconjunto RFC 5545**, interoperável com Google e Outlook.
- **Bloqueios e horário comercial** como camadas/constraints de 1ª classe (não background-events).

Detalhes e alternativas descartadas nos ADRs de [`docs/02-PLANO.md`](docs/02-PLANO.md).
