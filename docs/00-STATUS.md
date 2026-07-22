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
| Fase atual | **Fase 6 — Empacotamento, docs e validação** ✅ concluída (sessão 9): tech-debt, estilização + guia, build ESM+CJS+d.ts (tsc, sem bundler nativo), README (React+vanilla), bench, a11y básica |
| Próxima fase | Backlog: navegação por teclado no grid; split de eventos multi-dia timed; edição de recorrência via drag; interação em Multiagenda/Timeline; adapters Vue/Angular/vanilla; pacote `ical` |
| Código de produção | `packages/core` (headless): tipos, DateUtils, recorrência, ConstraintEngine, store, GeometryEngine, render Preact + CalendarApp, views Week/Day/Month/NDays/List, Multiagenda + Timeline, capacity/buffers/multi-recurso, eventSource por range, slots renderEvent/renderToolbar, InteractionEngine (drag/resize/seleção, preview→commit→revert, validação dura de lotação/buffer). **`packages/react` (real): `<Calendar/>` (instância única + sync de props via API imperativa), `useCalendar` (handle imperativo estável), `createReactView` + `ReactIsland` (ponte React↔Preact), customToolbar/nativeToolbar, eventSource/refetchKey** — **~160 testes** (130 node + 30 jsdom; ver nota do sandbox) |
| Nomenclatura | Passe de clareza em TODO o core (sem identificadores de 1 caractere; `T`→`temporal`). Regras adicionais travadas: **imports do preact com alias semântico** (`h as createElement`) e **condições extraídas para `const` booleanas nomeadas** (nada de valor "solto" em `if`). |
| Motor de recorrência | Validado contra rrule.js: base 43/44 → **gap corrigido e provado (v2): 23/23**, incl. multi-ordinal. |
| Gerenciador de pacotes | **yarn (workspaces)** — decidido na sessão 2 |
| Recursos (`Resource` genérico) | **Requisito de 1ª classe** (Fase 3B); núcleo resource-aware. Conceito GENÉRICO, sem regra de negócio: `type` é string opaca do app, não há campo "profissional" (ADR-006). Cobre "Agenda Desvinculada". |
| Decisão de arquitetura | Core headless (TS puro) + render Preact isolado + binding React fino. Ver `03-ARQUITETURA.md` |
| Decisão de recorrência | Motor próprio Temporal API + polyfill p/ Safari; rrule.js só como oráculo de teste |

## Próximo passo concreto (para o próximo chat)

Iniciar a **Fase 6** conforme `02-PLANO.md` (Empacotamento, docs e validação):
1. Build ESM+CJS+`.d.ts` por pacote (core/react/styles); CSS compilado isolado (`packages/styles`).
   **Ordem de build importa:** react consome o core; para `tsc` cross-package sem dist, os `.tsx` do core levam
   pragma `/** @jsxImportSource preact */` (resolvem o JSX do Preact mesmo sob o tsconfig React do adapter).
2. README de consumo + exemplos (React e vanilla) + playground; **medir o custo do polyfill Temporal no bundle**
   (pendência carregada desde a Fase 1).
3. Bench de performance (muitos eventos) e a11y básica.
- Base pronta da Fase 5 (`packages/react`): `Calendar.tsx` (cria o `CalendarApp` 1x, monta no `<div>`, sincroniza
  props via API imperativa com guardas anti-redundância; callbacks/eventSource lidos de um ref → estáveis, sempre
  a versão mais recente), `useCalendar.ts` (`{ ref, api }` — handle imperativo estável), `handle.ts`
  (`createHandle`), `ReactIsland.tsx` (ponte: componente Preact que hospeda um root react-dom; reusado por
  renderEvent/customToolbar/createReactView), `createReactView.tsx`. Peer deps `react`/`react-dom` (>=18).
- **Views vanilla já funcionam** sem adapter: `app.registerView({...render→nós Preact})`. `createReactView` é só a
  conveniência para o corpo em React.
- **Pendências abertas:** medir custo do polyfill Temporal no bundle; **split de eventos multi-dia timed**;
  **edição de ocorrência recorrente via drag** (commit otimista só muta eventos NÃO recorrentes; recorrentes
  disparam o callback p/ o app criar override); interação hoje é das views de time-grid — estender à
  Multiagenda/Timeline; **`customToolbar`/`renderEvent` em React criam 1 root react-dom por nó (ilha)** — ok p/ POC,
  medir custo depois; per-file `@jsxImportSource react` nos `.tsx` do adapter para o esbuild do Vitest (a config
  global é Preact).

### Como rodar o que já existe
```bash
# na raiz (yarn é o gerenciador oficial; no sandbox de verificação usamos npm pois yarn não instala lá)
yarn install && yarn test      # vitest: ~160 (130 node + 30 jsdom). Adapter React em packages/react.
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

### Sessão 9 — 2026-07-22 — Fase 6 ✅ (tech-debt, estilização, build, README, bench, a11y)
- **Passe de tech-debt (skill `engineering:tech-debt` + `tsc --noUnusedLocals --noUnusedParameters` como detector).**
  Achados e correções:
  - **Código morto removido:** `occurrenceKey` (definido e NUNCA usado em `views/resourceViews.tsx` — era o que o
    Jackson apontou), import `ViewContext` idem, e import `PlacementInfo` sem uso em `render/calendarApp.ts`.
  - **Duplicação eliminada (fonte única):** `occurrenceKey` estava em 4 arquivos → agora exportado só de
    `render/derive.ts` (reusado por calendarApp/timeGridModel). `toMinutes` (hh:mm→min) duplicado em
    constraintEngine+derive → novo `date/time.ts` (`hhmmToMinutes`). `toPx`/`GUTTER_PX` e `segmentStyle` (que no
    resourceViews se chamava `bandStyle`, idêntico) duplicados em TimeGrid+resourceViews → novo **`views/utils.ts`**
    (responde à pergunta do Jackson: sim, os helpers de apresentação das views foram isolados num util da própria
    pasta `views/`). Também unifiquei o magic number de altura mínima: resourceViews agora usa `options.minEventMinutes`.
  - Verificação: `tsc` estrito **+ noUnusedLocals/Parameters = 0** nos dois pacotes; 56 testes node verdes no run.
- **Estilização (item "CSS compilado isolado" da Fase 6).** `packages/styles` deixou de ser stub: `index.css` agora
  tem o **tema padrão** — 30 tokens (`--mc-*`) + ~60 regras de classe `mc-*` consumindo-os, tudo escopado por
  `[data-mc-root]`. Reafirmado o contrato: **core só escreve geometria inline**; cor/borda/tipografia vêm das classes.
  Novo **`docs/04-ESTILIZACAO.md`**: tabela de TODOS os tokens, todas as classes por área, os hooks `data-mc-*`
  (contrato estável, alguns consumidos pela interação) e como customizar (redefinir tokens ou mirar classe).
- **NOTA (execução definitiva no VSCode):** o preview de artefato do Cowork não suporta `preact`/imports de workspace
  (erro "bibliotecas não suportadas") — é esperado: são módulos de biblioteca para build, não artefatos live. E o
  sandbox não boota jsdom nem roda bundler no tempo dado. Então **build (ESM+CJS+d.ts), specs jsdom e bench devem
  rodar no VSCode** (`yarn install && yarn test && yarn typecheck && yarn build`).
- **Build (concluído):** ESM+CJS+`.d.ts` por pacote via **`tsc` puro** (NÃO tsup — o rollup nativo do tsup não roda
  no sandbox Linux; e tsc é sem dependência nativa, cross-platform). Cada pacote tem `tsconfig.build.json` (ESM,
  `module ESNext`, `moduleResolution Bundler`, `declaration`) + `tsconfig.cjs.json` (`CommonJS`/`Node`,
  `verbatimModuleSyntax:false`, grava `dist/cjs/package.json` `{"type":"commonjs"}`). `dev` continua em `src`
  (main/exports); `publishConfig` aponta `dist/esm` (import/types) e `dist/cjs` (require). **Ordem importa:** o
  react consome as `.d.ts` buildadas do core (`tsconfig.build`/`cjs` do react mapeiam `@meucalendario/core`→
  `../core/dist/esm/index.d.ts`); o root `build` roda **core → react → styles** explicitamente (não
  `yarn workspaces run build`, que não garante ordem e falhava com "Command build not found"). Verificado no
  sandbox: core e react emitem ESM+CJS+d.ts e importam limpo (54 exports cada).
- **README** reescrito (uso React `<Calendar/>`+`useCalendar`, uso vanilla `CalendarApp`+`registerView`, interação,
  recorrência, estilização, a11y, build, bench). **Bench** (`scripts/bench.mjs`): expand+buildDays+layout p/ N
  eventos — no sandbox (polyfill Temporal) ~0,4 ms/evento (500→~208ms, 2000→~822ms); **gargalo = conversões de
  timezone do polyfill**; com Temporal nativo é bem mais rápido (fecha a pendência "medir polyfill no bundle").
  **a11y:** toolbar ganhou `role="toolbar"`, `aria-label` nos ícones ‹/›, `aria-pressed` nas views, `aria-live` no
  título (navegação por teclado no grid fica no backlog).
- **Correção:** o teste de seleção do `interactionApp.spec.ts` (jsdom) usava minutos na zona inválida do stub
  (≥720) → ajustado p/ 600–660 (mesmo fix já feito no spec node). Suíte real do Jackson: **163/163** após o fix.
- **Fase 6 concluída.** Backlog (fases posteriores): teclado no grid, split multi-dia timed, edição de recorrência
  via drag, interação em Multiagenda/Timeline, adapters Vue/Angular/vanilla, pacote `ical`.

### Sessão 8 — 2026-07-22 — Fase 5 (Adapter React idiomático) ✅
- **`packages/react` deixou de ser stub.** Implementado o adapter FINO (ADR-001/002): a instância do
  `CalendarApp` é criada **uma vez** e montada num `<div>`; o React nunca reconcilia a árvore interna (Preact).
  - `Calendar.tsx` — `<Calendar/>`: cria o core no `useEffect` de montagem; props subsequentes entram por
    **efeitos de sync** que chamam a API imperativa (`setEvents`/`setConstraints`/`setOptions`/`setResources`/
    `changeView`/`setDate`/`refetch` por `refetchKey`) com **guardas anti-redundância** (compara com o estado
    atual). Callbacks e `eventSource` são lidos de um `propsRef` → "estáveis" para o core, mas sempre chamam a
    versão mais recente. Mata o `setTimeout`+diff manual do wsaude.
  - `useCalendar.ts` — `{ ref, api }`: ligue `ref` em `<Calendar apiRef={ref}/>` e use `api` (métodos estáveis)
    em handlers p/ comandar prev/next/changeView etc. `handle.ts` adapta a API do core p/ `CalendarHandle`.
  - `ReactIsland.tsx` — **ponte React↔Preact**: componente Preact que cria um root `react-dom/client` no seu nó e
    o atualiza quando o `node` muda (desmonta em microtask). Reusado por `renderEvent`, `customToolbar` e
    `createReactView`. `createReactView.tsx` — view com corpo em React (defaults de 1 dia / ±1 / título ISO).
  - **customToolbar/nativeToolbar:** com `customToolbar` a toolbar nativa é suprimida (vai por `renderToolbar` do
    core embrulhando uma ilha React); sem ele, o core desenha a toolbar padrão.
- **Deps:** `react`/`react-dom` como **peerDependencies** do `@meucalendario/react` (+ `preact` como dep, usada na
  ilha); `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react` como **devDeps** na raiz.
- **Cross-package typecheck:** o adapter (tsconfig JSX = React) importa o core em **source**; para os `.tsx` do core
  (JSX Preact) não quebrarem sob esse tsconfig, cada um recebeu o pragma `/** @jsxImportSource preact */`. Os `.tsx`
  do adapter recebem `/** @jsxImportSource react */` (p/ o esbuild do Vitest, cuja config global é Preact).
- **Testes:** `packages/react/tests/reactAdapter.spec.ts` (**3, node**) — delegação do `createHandle` e defaults do
  `createReactView` (lógica pura, sem DOM). `packages/react/tests/Calendar.dom.spec.tsx` (**~5, jsdom, CI**) —
  montagem única + render, sync da prop `events` sem recriar a instância, `useCalendar.next()`, `customToolbar`
  substituindo a nativa, `createReactView` embutindo corpo React. **`tsc` estrito limpo nos DOIS pacotes**;
  suíte node verde (49 no run combinado). **Sem demo** (mantido).
- **NOTA do sandbox:** idem Fase 4 — jsdom não boota no limite de 45s, então os specs React/DOM não rodaram aqui
  (só `tsc` + os specs node). Além disso, um `npm install` interrompido corrompeu `node_modules/csstype`; como
  `node_modules` é efêmero (o `yarn install` real do projeto o restaura), usei um shim de tipos mínimo só p/ o `tsc`
  local — **nada disso é versionado** (`dist/`, `node_modules/` no `.gitignore`).
- **Próximo:** Fase 6 (empacotamento/build ESM+CJS+d.ts, README/exemplos, bench, a11y) — ver "Próximo passo".

### Sessão 7 — 2026-07-22 — Fase 4 (Interação: drag & drop + resize + seleção) ✅
- **Novo módulo `packages/core/src/interaction/`** (puro + DOM-thin, seguindo a filosofia do projeto):
  - `gestureGeometry.ts` — geometria de GESTO pura (minutos-do-dia): `snapMinute`, `clampSpanToGrid`,
    `computeMoveDraft` (preserva duração + ponto de agarre), `computeResizeDraft` (mantém início, duração
    mínima), `computeSelectDraft` (ordena/snap para fora). **Não confundir** com `geometry/geometry.ts`
    (GeometryEngine de RENDER, que empacota eventos existentes) — renomeei de `geometry.ts` p/ evitar dois
    arquivos homônimos (pedido do Jackson).
  - `occupancy.ts` — **validação DURA de lotação/buffer** (`validateOccupancy`): buffer ESTENDE o intervalo
    ocupado, então uma varredura de concorrência pega lotação (`over-capacity`) e buffer (`buffer-conflict`)
    de uma vez. Genérico, zero regra de negócio (ADR-006). Resolve a pendência da Fase 3B.
  - `model.ts` — tipos + `minutesToDateTime` + `applyEventTimeChange` (muta só evento NÃO recorrente; preserva
    tz/allDay). `DraftReason` = superconjunto de `SlotEvaluation.reason` + `over-capacity`/`buffer-conflict`.
  - `interactionEngine.ts` — **InteractionEngine**: delegação de Pointer Events no container, hit-test
    evento/alça(`data-mc-resize`)/coluna vazia, gesto move/resize/select, threshold clique×arrasto,
    `preview→commit→revert`, `setPointerCapture` guardado, localizador por retângulos das colunas (injetável).
- **Integração no CalendarApp:** novos callbacks (`onEventDrop`/`onEventResize`/`onDateSelect`/`onDropBlocked`/
  `onClickBlocked`) + `config.resources` (habilita ocupação). `evaluate` combina ConstraintEngine + ocupação por
  recurso (via `buildDays` full-day pra não recortar). Commit **otimista** com **revert** se o callback retornar
  `false`/rejeitar. `draft` no `ViewRenderContext`→`GridVM`; `TimeGrid` desenha o fantasma (`data-mc-draft`
  valid/invalid) e a alça de resize; `EventVM` agora carrega `startMin/endMin/editable` (emitidos como
  `data-mc-*`). Nova opção `minEventMinutes` (default 15) unifica altura mínima + duração mínima de resize.
- **Testes (novos):** `interaction.spec.ts` (16, node) geometria+ocupação+model; `interactionEngine.spec.ts`
  (8, node, **DOM falso mínimo** — o motor toca poucas APIs de DOM) máquina de gesto completa incl. localizador
  por rects; `interactionApp.spec.ts` (9, jsdom) integração ponta-a-ponta (drag persiste no store + `onEventDrop`,
  drop bloqueado→`onDropBlocked`+revert, seleção→`onDateSelect`, lotação `capacity 1`→`over-capacity`+revert).
  **24 testes node verdes** aqui; `tsc` estrito **limpo** (src e tests). **Sem demo** (mantido).
- **NOTA do sandbox:** o ambiente de verificação **não consegue bootar o jsdom dentro do limite de 45s** (o
  pré-existente `render.spec.ts` também estoura) — por isso os specs jsdom (render/views3/resources/interactionApp)
  não foram executados aqui; rodar `yarn test` num ambiente normal. Por isso o motor foi coberto TAMBÉM em node
  (DOM falso), garantindo verificação real da lógica de gesto sem depender do jsdom.
- **Próximo:** Fase 5 (Adapter React) — ver "Próximo passo concreto".

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
