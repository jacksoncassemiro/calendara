# 00 — STATUS / DIÁRIO DO PROJETO

> **Leia isto primeiro.** Este arquivo é a memória viva do projeto entre sessões (chats).
> Toda sessão de trabalho deve: (1) ler este arquivo, (2) trabalhar, (3) atualizar a
> seção "Log de sessões" ao final e ajustar o "Estado atual" e o "Próximo passo".

---

## Visão de uma linha

Biblioteca de calendário/agenda própria, **headless core em TypeScript puro** + **adapter React**,
sem os problemas de rerender do FullCalendar, com **bloqueios**, **horário comercial dinâmico** e
**recorrência própria via Temporal API** — projetada para depois rodar em qualquer framework.

## Estado atual

| Item | Estado |
|---|---|
| Fase atual | **Fase 1 — Fundação: monorepo + tipos + motores puros** ✅ concluída (sessão 3) |
| Próxima fase | **Fase 2 — Render headless + view Semana/Dia (time grid)** ⏳ não iniciada |
| Código de produção | `packages/core` (headless): tipos, DateUtils, recorrência, ConstraintEngine — **87/87 testes verdes** |
| Motor de recorrência | Validado contra rrule.js: base 43/44 → **gap corrigido e provado (v2): 23/23**, incl. multi-ordinal. |
| Gerenciador de pacotes | **yarn (workspaces)** — decidido na sessão 2 |
| Recursos (`Resource` genérico) | **Requisito de 1ª classe** (Fase 3B); núcleo resource-aware. Conceito GENÉRICO, sem regra de negócio: `type` é string opaca do app, não há campo "profissional" (ADR-006). Cobre "Agenda Desvinculada". |
| Decisão de arquitetura | Core headless (TS puro) + render Preact isolado + binding React fino. Ver `03-ARQUITETURA.md` |
| Decisão de recorrência | Motor próprio Temporal API + polyfill p/ Safari; rrule.js só como oráculo de teste |

## Próximo passo concreto (para o próximo chat)

Iniciar a **Fase 2** conforme `02-PLANO.md` (render headless + Semana/Dia):
1. Camada **render Preact** isolada no container (`core/src/render`) + `CalendarApp` + **store com diff granular**.
2. **GeometryEngine** (posicionamento + sobreposição waterfall).
3. Views **Week** e **Day** (time grid) com `startHour/endHour/timeScale` dinâmicos e **linha "agora"**.
4. Camada visual de **horário comercial** e **bloqueios** (fundo) dirigida pelo `ConstraintEngine` (já pronto).
- Consumir o core da Fase 1: `expandEvent()` (ocorrências por janela), `ConstraintEngine.evaluate()`, `createDateUtils()`.
- **Medir custo do polyfill Temporal no bundle** (pendência registrada da Fase 1).

### Como rodar o que já existe
```bash
# na raiz (yarn é o gerenciador oficial; no sandbox de verificação usamos npm pois yarn não instala lá)
yarn install && yarn test      # vitest: 87/87
# core/src/index.ts exporta: ensureTemporal, createDateUtils, expandEvent, expandRule,
# parseRRule/serializeRRule, ConstraintEngine e todos os tipos canônicos.
```

## Decisões travadas com o Jackson (não reabrir sem motivo)

- **Arquitetura:** React primeiro, MAS com toda a lógica em core headless framework-agnostic (extração vanilla depois é meta, não descartada). Motivo: uso inicial é React; migração para vanilla não pode exigir reescrever o núcleo.
- **Recorrência:** Temporal API (motor próprio). Safari ainda sem suporte nativo estável em 2026 → usar polyfill. rrule.js NÃO entra no bundle final, só nos testes.
- **Escopo desta 1ª execução:** apenas análise + plano + diário. **Sem MVP** (o usuário não quer entregas incompletas).
- **APIs externas:** pesquisar só o modelo de dados (Google/Outlook), sem auth/sync.
- **Gerenciador de pacotes:** **yarn (workspaces)**, não pnpm (sessão 2).
- **Recursos = `Resource` genérico** (padrão de calendário), **sem regra de negócio** na lib: `type` é
  string opaca do app; não existe campo "profissional"; obrigatoriedade é do app (ADR-006). Cobre "Agenda Desvinculada".
- **Views customizadas:** criar view nova é 1ª classe via `registerView` — nunca travado às views internas.

## Onde está cada coisa

```
docs/00-STATUS.md      ← este arquivo (diário/continuidade)
docs/01-ANALISE.md     ← análise do uso atual, tentativas anteriores e requisitos
docs/02-PLANO.md       ← plano de execução faseado + ADRs
docs/03-ARQUITETURA.md ← desenho técnico alvo (core headless, anti-rerender, views, plugins)
docs/reference/
  referencias-open-source.md ← análise dos 4 projetos (FullCalendar, Syncfusion, Schedule-X, big-calendar)
  agenda-desvinculada.md     ← recursos/exames/equipamentos (requisito de 1ª classe)
  google-calendar-api.md     ← modelo de dados Google
  outlook-graph-api.md       ← modelo de dados Microsoft Graph (Outlook)
  data-model-mapping.md      ← como nossos tipos mapeiam para Google/Outlook/RFC 5545
  recurrence-validation.md   ← resultado da validação Temporal vs rrule + gap encontrado
experiments/recurrence-validation/ ← harness executável (node harness.mjs)
```

## Repositórios de referência do próprio Jackson (fora desta pasta)

- `C:\Users\jackson\GitHub\wsaude-web` — uso **atual** em produção (FullCalendar, rota `agenda`).
- `C:\Users\jackson\GitHub\calendario` — melhor tentativa anterior (core agnóstico, RecurrenceEngine V9, 6 views).
- `C:\Users\jackson\GitHub\modularCalendar` — tentativa anterior (3 views, rrule em validação).
- `C:\Users\jackson\GitHub\testes-nextjs` — wrapper FullCalendar refinado + `projectModularCalendar`.

---

## Log de sessões

### Sessão 1 — 2026-07-21 — Análise e planejamento (Fase 0)
- Analisado uso atual (wsaude-web) e as 3 tentativas anteriores; extraídos requisitos reais.
- Analisados os 4 projetos de referência (clonados big-calendar, schedule-x, fullcalendar-workspace; Syncfusion via docs).
- Pesquisado modelo de dados Google Calendar e Microsoft Graph (Outlook).
- Confirmada compatibilidade do Temporal API (Chrome 144 / Firefox 139+ / Edge nativos; Safari só atrás de flag → polyfill).
- **Validado** o protótipo de recorrência Temporal contra rrule.js: **43/44** cenários OK. Gap: BYDAY multi-ordinal (`2FR,4FR`) — documentado em `recurrence-validation.md`.
- Produzidos todos os documentos em `docs/`. Nenhum código de produção (por decisão de escopo).
- **Próximo:** iniciar Fase 1 (scaffold monorepo + tipos + portar DateUtils/recorrência).

### Sessão 3 — 2026-07-21 — Fase 1: fundação do monorepo + core headless ✅
- **Scaffold** monorepo yarn workspaces: raiz (`package.json` com `workspaces`, `tsconfig.base.json` estrito,
  `vitest.config.ts`, `.gitignore`) + `packages/core` (real) e `packages/react`/`packages/styles` (stubs que
  reservam os pacotes; implementação nas Fases 5 e 2).
- **Tipos canônicos** (`core/src/types`): `CalendarEvent`, `EventTime/EventDateTime`, `RRuleModel`
  (`byDay` com ordinal por entrada), `Recurrence` (rule/rDates/exDates/overrides), `EventOccurrence`,
  `CalendarResource` (genérico, ADR-006), `BusinessHours/DateRange/Blocking/ConstraintSet`, `ICalendarView`.
- **Temporal shim** (`core/src/date/temporal.ts`): `ensureTemporal()` usa nativo se houver, senão carrega
  `@js-temporal/polyfill` sob demanda. Injeção de dependência: engines recebem o `Temporal` resolvido.
- **DateUtils** (`core/src/date/DateUtils.ts`): fábrica pura (`createDateUtils(T)`) — conversões de weekday,
  `startOfWeek` (com WKST), `eachDayOfRange`, `nthWeekdayInMonth`, `epochMsInZone` (p/ DST).
- **Motor de recorrência** (`core/src/recurrence`): `parser.ts` (RRULE string↔modelo, incl. multi-ordinal,
  BYSETPOS lista, WKST), `engine.ts` (iterador-por-FREQ portado do `temporal-rrule-v2` + janela lazy),
  `recurrenceSet.ts` (compõe hora/tz + RDATE/EXDATE/overrides → `EventOccurrence[]`; timed via toZonedDateTime).
- **ConstraintEngine** (`core/src/constraint`): puro em minutos-do-dia; `evaluate()/isValid()` com precedência
  blocked > businessHours > allowed.
- **Testes (vitest): 87/87 verdes.** Recorrência: **50 cenários vs rrule.js** (44 base + 4 multi-ordinal + 2 WKST
  explícito) + RDATE/overrides/cancelamento + **DST timed real** (NY spring-forward) + janela lazy/perf.
  Parser, DateUtils e ConstraintEngine cobertos. TS estrito compila limpo (`tsc --noEmit`).
- **Notas:** no sandbox de verificação o `yarn`/`corepack` não instala por permissão → rodei com `npm install`
  + `vitest` (mesmo campo `workspaces`); yarn continua sendo o gerenciador oficial do projeto.
  Pendência carregada p/ Fase 2: **medir custo do polyfill Temporal no bundle**.
- **Próximo:** Fase 2 (render Preact isolado + store diff granular + GeometryEngine + views Week/Day).

### Sessão 2 — 2026-07-21 — Ajustes de escopo (ainda Fase 0)
- **yarn** confirmado no lugar de pnpm (docs atualizados).
- **Gap de recorrência PROVADO como resolvível:** implementado `experiments/recurrence-validation/temporal-rrule-v2.mjs`
  (modelo `byDay: [{weekday, ordinal|null}]`) e `harness3.mjs` → **23/23**, incl. `2FR,4FR`, `1MO,3MO`,
  `1SU,-1SU`, anual `1MO,3MO`. Correção é só de modelo de dados; abordagem Temporal mantida.
- **Agenda Desvinculada (recursos)** elevada a requisito de 1ª classe: criado `reference/agenda-desvinculada.md`;
  adicionada **Fase 3B** no plano; `CalendarResource` + `event.resourceIds` no modelo; núcleo resource-aware na Fase 1.
- Esclarecido que **views customizadas** não são travadas (contrato `ICalendarView` aberto).
- **Refinamento (a pedido do Jackson):** recursos adotam o conceito **genérico `Resource`** (padrão de
  calendário), **sem semântica de domínio**. Removido qualquer resquício de "profissional" como campo/flag:
  vira `type` string opaca + `metadata`. Adicionado **ADR-006** e seção de fronteira lib×app em
  `agenda-desvinculada.md`. Objetivo: não acoplar regra de negócio à biblioteca.
- **Próximo:** continua sendo iniciar a Fase 1. Nada de produção ainda.
