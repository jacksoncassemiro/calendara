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
| Fase atual | **Fase 3B — Recursos (Agenda Desvinculada) + Timeline/Multiagenda** ✅ concluída (sessão 6) |
| Próxima fase | **Fase 4 — Interação: drag & drop + resize + seleção** ⏳ não iniciada |
| Código de produção | `packages/core` (headless): tipos, DateUtils, recorrência, ConstraintEngine, store, GeometryEngine, render Preact + CalendarApp, views Week/Day/Month/NDays/List, **Multiagenda (colunas por recurso) + Timeline, capacity/buffers/multi-recurso, toggle de visibilidade**, eventSource por range, slots renderEvent/renderToolbar — **122/122 testes verdes** |
| Nomenclatura | Passe de clareza em TODO o core (sem identificadores de 1 caractere; `T`→`temporal`). Regras adicionais travadas: **imports do preact com alias semântico** (`h as createElement`) e **condições extraídas para `const` booleanas nomeadas** (nada de valor "solto" em `if`). |
| Motor de recorrência | Validado contra rrule.js: base 43/44 → **gap corrigido e provado (v2): 23/23**, incl. multi-ordinal. |
| Gerenciador de pacotes | **yarn (workspaces)** — decidido na sessão 2 |
| Recursos (`Resource` genérico) | **Requisito de 1ª classe** (Fase 3B); núcleo resource-aware. Conceito GENÉRICO, sem regra de negócio: `type` é string opaca do app, não há campo "profissional" (ADR-006). Cobre "Agenda Desvinculada". |
| Decisão de arquitetura | Core headless (TS puro) + render Preact isolado + binding React fino. Ver `03-ARQUITETURA.md` |
| Decisão de recorrência | Motor próprio Temporal API + polyfill p/ Safari; rrule.js só como oráculo de teste |

## Próximo passo concreto (para o próximo chat)

Iniciar a **Fase 4** conforme `02-PLANO.md` (Interação: drag & drop + resize + seleção):
1. **InteractionEngine** com Pointer Events: mover entre dias/horas, resize de borda.
2. **preview → commit → revert**; seleção de intervalo (`onDateSelect`).
3. Bloqueio de drop/click inválido com `onDropBlocked`/`onClickBlocked` (consultando o `ConstraintEngine`,
   já exposto via `CalendarApp.evaluateSlot`).
- Base pronta da Fase 3B: derivações resource-aware (`resourceDerive.ts`: `buildResourceColumns`,
  `occurrencesForResource`, `resourceConstraintSet`, `maxConcurrency`), views `resources` (Multiagenda) e
  `timeline` (via `createResourceDayView`/`createTimelineView`), `options.visibleResourceIds` +
  `CalendarApp.setVisibleResources()`. Geometria/constraints já consomem capacity/buffers.
- **Pendências abertas:** medir custo do polyfill Temporal no bundle; **split de eventos multi-dia timed**
  (hoje ancorados no dia de início e recortados); buffers/capacity ainda são visuais/informativos — a
  validação dura por buffer/lotação entra junto da interação (Fase 4) ou numa extensão do ConstraintEngine.

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

### Sessão 6 — 2026-07-22 — Passe de qualidade + Fase 3B (Recursos) ✅
- **Passe de qualidade (regras do Jackson):** (a) imports do preact com **alias semântico** — `h as createElement`
  em todos os arquivos (views + Shell + calendarApp + testes); (b) **condições extraídas para `const` booleanas
  nomeadas** que indicam a intenção (ex.: `withinBusinessWindow`, `outsideGrid`, `startsNewCluster`,
  `usesOrdinalWeekdays`, `pastUntil`, `isLatestFetch`), e **magic numbers** viraram consts nomeadas
  (`DAY_START_MIN`/`DAY_END_MIN`, `MINUTES_PER_DAY`, `DEFAULT_MIN_EVENT_MINUTES`, `MIN_WIDTH_FRACTION_OF_COLUMN`,
  `DEFAULT_INTERVAL`/`DEFAULT_WEEK_START`). Cobriu constraintEngine, geometry, engine, parser, recurrenceSet,
  derive, timeGridModel, calendarApp. 112/112 seguiram verdes; `tsc` estrito limpo.
- **Fase 3B — derivações resource-aware** (`render/resourceDerive.ts`): `occurrencesForResource` (filtra por
  `event.resourceIds`, cobre multi-recurso), `resourceConstraintSet` (usa businessHours PRÓPRIO do recurso ou
  cai no global; preserva blocked/allowed globais), `maxConcurrency` (varredura de concorrência) e
  `buildResourceColumns` (uma coluna por recurso p/ 1 dia, com fundo próprio, bandas de **buffer** e flag de
  **lotação estourada** = concorrência > `capacity`). Genérico/sem regra de negócio (ADR-006).
- **Fase 3B — views** (`views/resourceViews.tsx`): **Multiagenda** (`createResourceDayView`) = N colunas por
  recurso num dia (fundo/expediente/bloqueio/buffer por recurso, badge de lotação, linha "agora", evento
  multi-recurso nas 2 colunas); **Timeline** (`createTimelineView`) = recursos em linhas, tempo no eixo X,
  eventos empacotados em lanes. `options.visibleResourceIds` + `CalendarApp.setVisibleResources()` fazem o
  **toggle de visibilidade** por recurso.
- **Testes: 122/122** (103 node + 6 render + 7 Fase 3 + 6 Fase 3B jsdom). Novos: helpers puros
  (occurrencesForResource, resourceConstraintSet) e views de recurso (2 colunas, lotação estourada 2/1,
  evento multi-recurso nas 2 colunas/linhas, 2 bandas de buffer, toggle de visibilidade, timeline 2 linhas).
  `tsc` estrito limpo. **Sem demo** (mantido).
- **Próximo:** Fase 4 (drag & drop + resize + seleção) — ver "Próximo passo concreto".

### Sessão 5 — 2026-07-22 — Passe de nomenclatura + Fase 3 (Month/NDays/List) ✅
- **Nomenclatura (pedido do Jackson):** passe de clareza em TODO o `packages/core` — eliminados identificadores
  de 1 caractere em params/locais/constants/generics. `T`→`temporal` (incl. campo público `DateUtils.temporal`
  e `ViewContext.temporal`), `du`→`dateUtils`, `ps/pe/nps`→`periodStart/End/nextPeriodStart`, `cand`→`candidates`,
  generics `<S>`→`<State>` / `<R>`→`<Result>`, etc. Corrigido casing de imports antigos nos testes
  (`DateUtils.js`→`dateUtils.js`). **105/105 verdes** após o passe; `tsc` estrito limpo.
- **Contrato de view generalizado:** de `TimeGridViewDef` para **`CalendarView`** (`getRange/navigate/getTitle/
  **render**`). A construção do time-grid saiu do CalendarApp para `views/timeGridModel.ts` (`buildTimeGridVM`),
  compartilhada por Week/Day/NDays. Novo **`CalendarShell`** é dono do nó raiz (`data-mc-root`) e desenha
  a **toolbar** (padrão com prev/hoje/next + troca de view, ou custom via `renderToolbar`) + o corpo da view.
- **Fase 3 — novas views:** `MonthView` (day grid, semanas×dias, chips por horário), `createNDaysView(n)`
  (N dias corridos) e `ListView`/`createListView` (agenda cronológica agrupada por dia). Recorrência aparece
  correta em todas (expandida no range). `occurrenceStart()` (derive) projeta/ordena ocorrências p/ Month/List.
- **Fase 3 — eventSource + slots:** `eventSource.fetch({start,end})` disparado a cada mudança de range
  (expansão lazy; `ready()` aguarda o fetch inicial; token anti-corrida). Slots `renderEvent` (conteúdo custom
  de evento em todas as views) e `renderToolbar` (render-prop).
- **Testes: 112/112** (99 node + 6 render + 7 Fase 3). Novos (jsdom): Month com 35 células e recorrência 5×,
  List com itens/dia, NDays 3 colunas, eventSource inicial + refetch ao navegar, `renderEvent`/`renderToolbar`,
  e toolbar padrão navegando por clique. `tsc` estrito limpo. **Sem demo** (mantido).
- **Próximo:** Fase 3B (Recursos/Agenda Desvinculada) — ver "Próximo passo concreto".

### Sessão 4 — 2026-07-22 — Fase 2: render headless + views Week/Day ✅
- **Renomeação** (a pedido do Jackson): arquivos com inicial minúscula por padrão (`DateUtils.ts`→`dateUtils.ts`,
  `ConstraintEngine.ts`→`constraintEngine.ts`); imports já consistentes. Esclarecido o **porquê dos imports `.js`**
  em arquivos `.ts`: o TS não reescreve especificadores; escreve-se a extensão do output (`.js`) — à prova de
  NodeNext/ESM. Aqui `moduleResolution: Bundler` deixaria omitir, mas mantivemos `.js` por consistência/futuro.
- **`store/`** — store observável mínimo (sem framework): `createStore` com **diff granular** (notifica só as chaves
  que mudaram, por identidade) + `memoize` (por identidade de args) para as derivações caras.
- **`geometry/`** — `GeometryEngine` puro (`layoutDay`): vertical (top/height por minuto, recorte ao grid, altura
  mínima) + horizontal (empacotamento em colunas + **expansão waterfall**). Colisão trata "fim==início" como não-sobreposto.
- **`render/`** — `derive.ts` (expandRange + buildDays: projeta ocorrências em minutos-do-dia na tz de exibição,
  incl. conversão de timezone via ZonedDateTime; deriva fundo de horário comercial/bloqueios do `ConstraintSet`).
  `calendarApp.ts` — **CalendarApp**: store como fonte de verdade, resolve Temporal (injetável), API imperativa
  (`prev/next/today/changeView/setEvents/setConstraints/registerView/getTitle/getVisibleRange/evaluateSlot/on`),
  **render Preact isolado no container** (`preact.render` no mesmo nó → diff, **sem recriar instância**).
- **`views/`** — `TimeGridViewDef` (contrato de view = lógica pura), `weekView` (7 dias, WKST) e `dayView` (1 dia)
  usando o **mesmo** componente Preact `TimeGrid` (cabeçalho, faixa dia-inteiro, eixo de horas, colunas com fundo
  de expediente/bloqueio, eventos posicionados e **linha "agora"** injetável por relógio). `format.ts` (Intl/UTC determinístico).
- **Config**: Preact adicionado a `packages/core` (dep real, ADR-002); `jsdom` (devDep raiz); tsconfig do core com
  `jsx: react-jsx` + `jsxImportSource: preact` e `.tsx`; vitest com esbuild JSX (Preact) e specs de render em jsdom.
- **Testes: 105/105** (99 node + 6 jsdom). Novos: geometry (7), store/memoize (5), render em jsdom (6: 7 colunas na
  semana, eventos posicionados/sobrepostos, fundo de expediente, bloqueio, linha "agora", **navegação prev/next/today
  e troca week↔day mantendo o mesmo nó raiz**, título/range/evaluateSlot). TS estrito compila limpo. **Sem demo**
  (não faz parte dos itens da Fase 2 — validado por testes headless/jsdom).
- **Próximo:** Fase 3 (Month/NDays/List + eventSource.fetch por range) — ver "Próximo passo concreto".

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
