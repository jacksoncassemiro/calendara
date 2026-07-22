# 02 — Plano de execução

Plano faseado para construir a biblioteca. Cada fase tem **entregável verificável** e **critério de
pronto (DoD)**. O escopo foi acordado com o Jackson: **esta 1ª sessão entrega apenas Fase 0** (análise +
plano + diário). As fases seguintes são para as próximas sessões.

Regra de ouro entre sessões: **sempre atualizar `00-STATUS.md`** ao terminar.

---

## Fase 0 — Análise e planejamento ✅ (concluída na sessão 1)
- [x] Extrair requisitos do uso atual (wsaude-web) e das 3 tentativas.
- [x] Analisar os 4 projetos de referência.
- [x] Pesquisar modelo de dados Google/Outlook.
- [x] Validar motor de recorrência Temporal vs rrule (43/44; gap documentado).
- [x] Produzir documentação (`docs/`) + harness executável.
- **DoD:** documentos completos e decisões travadas. ✅

## Fase 1 — Fundação: monorepo + tipos + motores puros ✅ (concluída na sessão 3)
Objetivo: base sólida **testável**, sem UI ainda.
1. [x] Scaffold **yarn workspaces**: `packages/core`, `packages/react` (stub), `packages/styles` (stub). TS estrito, Vitest.
2. [x] **Tipos canônicos** em `core/src/types` (base: `data-model-mapping.md`) — já **resource-aware** (`CalendarResource`, `event.resourceIds`).
3. [x] Portar **DateUtils** sobre Temporal (+ shim de polyfill `ensureTemporal()`) — com testes.
4. [x] **Motor de recorrência real** (`core/src/recurrence`) com o modelo corrigido
   (`byDay` com ordinal por entrada): iterador-por-FREQ (`engine.ts`) + `recurrence-set`
   (`recurrenceSet.ts`: RRULE/RDATE/EXDATE + overrides) + parser RRULE string↔modelo (`parser.ts`).
5. [x] **ConstraintEngine** (businessHours ∧ allowed ∧ ¬blocked + bloqueios) — com testes.
- **DoD:** `yarn test` (vitest) verde — **87/87**; suíte de recorrência = 50 cenários (44 base + multi-ordinal
  + WKST explícito) validados vs rrule.js como oráculo, **+** RDATE, overrides (editar/cancelar 1 instância),
  DST timed real (America/New_York spring-forward), janela lazy. TS estrito compila limpo. Sem UI. ✅

## Fase 2 — Render headless + view de Semana/Dia (time grid)
1. Camada **render Preact** isolada no container (`core/src/render`) + `CalendarApp` + **store com diff granular**.
2. **GeometryEngine** (posicionamento + sobreposição waterfall).
3. Views **Week** e **Day** (time grid) com `startHour/endHour/timeScale` dinâmicos e **linha "agora"**.
4. Camada visual de **horário comercial** e **bloqueios** (fundo) dirigida pelo ConstraintEngine.
- **DoD:** demo vanilla renderiza semana/dia com eventos, horário comercial dinâmico e bloqueios,
  navegando prev/next/today **sem recriar a instância**.

## Fase 3 — Views Mês, N-Dias, Lista/Agenda + recorrência na tela
1. **MonthView** (day grid), **NDaysView**, **ListView/Agenda**.
2. Integrar expansão de recorrência **lazy por range visível** no store.
3. Render de evento customizado (slot) + toolbar customizada (render-prop).
- **DoD:** todas as views trocam sem rerender; eventos recorrentes aparecem corretos em todas.

## Fase 3B — Recursos (Agenda Desvinculada) + Timeline/Resource + Multiagenda
Objetivo: suportar agenda cujo "dono" é um **recurso** (sala/equipamento/leito), não um profissional.
Requisito de 1ª classe — ver `reference/agenda-desvinculada.md`.
1. Entidade **`CalendarResource`** (type, unit, capacity, buffers, businessHours próprios, agrupamento).
   Os tipos já nascem resource-aware na Fase 1; aqui vem o comportamento.
2. **Multiagenda (colunas por recurso)**: variação da week/day com N colunas (Feegow/GestãoDS).
3. **Timeline/Resource view**: recursos em linhas, tempo no eixo X (padrão Syncfusion).
4. **Capacidade/lotação** (sobreposição configurável) e **buffers** na geometria + ConstraintEngine.
5. Evento com **múltiplos recursos** (`resourceIds`), conflito considerando todos; profissional opcional.
- **DoD:** demo com salas/equipamentos como agenda própria, lotação > 1, buffer visível, e um evento
  ocupando 2 recursos ao mesmo tempo; toggle de visibilidade por recurso/grupo.

## Fase 4 — Interação: drag & drop + resize + seleção ✅ (concluída na sessão 7)
1. [x] **InteractionEngine** com Pointer Events: mover entre dias/horas, resize de borda.
2. [x] **preview → commit → revert**; seleção de intervalo (`onDateSelect`).
3. [x] Bloqueio de drop/click inválido com `onDropBlocked`/`onClickBlocked` (+ validação DURA de lotação/buffer).
- **DoD:** paridade com o comportamento do wsaude atual (drop persiste, revert em falha), sem o diff manual. ✅

## Fase 5 — Adapter React idiomático ✅ (concluída na sessão 8)
1. [x] `<Calendar/>` fino (cria core 1x; entrega dados; callbacks estáveis via ref).
2. [x] `eventSource` + `refetchKey`; `customToolbar`/`nativeToolbar`; `createReactView` (+ `ReactIsland`).
3. [x] Hook `useCalendar` para a API imperativa (prev/next/changeView) quando necessário.
- **DoD:** `<Calendar/>` cria o core uma vez e sincroniza props pela API imperativa, **sem** `setTimeout`+diff
  manual; interação da Fase 4 exposta por callbacks. `tsc` estrito limpo nos dois pacotes; testes node verdes +
  specs jsdom (CI). Peer deps `react`/`react-dom` (>=18). **Nota:** views vanilla já funcionam via `registerView`;
  `createReactView` é a conveniência para corpo em React (ilha react-dom). Verificação jsdom não roda no sandbox. ✅

## Fase 6 — Empacotamento, docs e validação ✅ (concluída na sessão 9)
1. [x] Build ESM+CJS+`.d.ts` (por pacote) via **`tsc` puro** (sem bundler nativo); CSS isolado (tema real +
   `docs/04-ESTILIZACAO.md`). Root `build` = core → react → styles (ordem explícita).
2. [x] README de consumo + exemplos (React e vanilla). (storybook/playground: backlog.)
3. [x] Bench de performance (`scripts/bench.mjs`, muitos eventos) e a11y básica (roles/aria na toolbar).
- **Passe extra:** tech-debt (código morto removido, helpers deduplicados em `date/time.ts` e `views/utils.ts`).
- **DoD:** `yarn build` gera dist por pacote; testes 163/163; exemplos no README. Storybook, teclado no grid e
  bench com Temporal nativo ficam no backlog.
- **DoD:** pacotes instaláveis; exemplos rodando; testes verdes; `00-STATUS.md` atualizado.

## Fases posteriores (backlog)
- Adapters Vue/Angular/Vanilla puro; pacote `ical` (import/export .ics); timezone Windows↔IANA (Outlook).
- Editor de recorrência (UI estilo Outlook) reaproveitando o protótipo do Jackson.

---

## ADRs (registro de decisões de arquitetura)

### ADR-000 — Esta sessão não escreve código de produção
**Contexto:** o Jackson não quer entregas incompletas (MVP raso). **Decisão:** limitar a sessão 1 a
análise/plano/diário + validação do motor de recorrência (de-risking). **Consequência:** próximas sessões
executam o plano com base sólida; nada de código de produção agora.

### ADR-001 — React primeiro, mas core headless framework-agnostic
**Contexto:** uso inicial é React; meta futura é multi-framework/vanilla. React puro sofre rerender.
**Decisão:** núcleo headless em TS puro com render Preact isolado; React como adapter fino. **Consequência:**
funciona já no React sem rerender; extração vanilla depois não exige reescrever o núcleo. Alternativas
descartadas: (a) React puro (rerender + acoplamento); (b) vanilla-first imediato (mais lento p/ o uso real).

### ADR-002 — Render interno com Preact isolado
**Contexto:** matar o rerender parasita e o diff manual do consumidor. **Decisão:** o core renderiza a si
mesmo com Preact num container; o framework host não reconcilia a árvore interna (padrão FullCalendar +
Schedule-X). **Consequência:** +~4kB encapsulados; ganho de isolamento e performance; views fáceis de escrever.

### ADR-003 — Motor de recorrência próprio via Temporal API
**Contexto:** validação mostrou 43/44 vs rrule.js; Temporal nativo em Chrome/Firefox/Edge (2026), Safari via
polyfill. **Decisão:** motor próprio sobre Temporal; rrule.js só como oráculo de teste (fora do runtime).
**Consequência:** zero dep de recorrência no bundle; precisa do modelo de regra corrigido (ordinal por BYDAY)
e polyfill p/ Safari. Alternativa descartada: rrule.js em runtime (dep + quirks já enfrentadas).

### ADR-004 — Modelo de dados canônico = superconjunto RFC 5545
**Contexto:** interop com Google (RRULE) e Outlook (patternedRecurrence, subconjunto). **Decisão:** canônico
fiel ao RFC 5545 (`byDay` com ordinal por entrada, `byMonthDay[]`, `bySetPos[]`, `weekStart`); Google ~1:1,
Outlook por tabela de conversão. **Consequência:** cobre "2ª e 4ª sexta" e afins; corrige o gap do protótipo.

### ADR-006 — "Resource" genérico, sem regra de negócio na lib
**Contexto:** risco de acoplar semântica de domínio (profissional/exame/clínica) à biblioteca.
**Decisão:** adotar o conceito **padrão e genérico `Resource`** (como FullCalendar/Syncfusion/Graph). A lib
só conhece `Resource { id, title, type, capacity, buffers, businessHours, parentId, metadata }` +
`event.resourceIds`. `type` é **string opaca** definida pelo app; **não existe** campo/flag "profissional".
Obrigatoriedade e significado de recursos são validados **no app** (via `metadata` + callbacks).
**Consequência:** cobre "Agenda Desvinculada" e qualquer outro domínio (salão, oficina, coworking) só
mudando `type`/`metadata`, sem tocar na lib. Extensível por `metadata`. Zero regra de negócio embutida.
Alternativa descartada: campos de domínio (`professional`, `room`) no core — acoplaria negócio à lib.

### ADR-005 — Bloqueio e horário comercial como camadas/constraints de 1ª classe
**Contexto:** hoje o wsaude usa background-events manuais. **Decisão:** modelar como camadas próprias +
ConstraintEngine, não como `CalendarEvent`. **Consequência:** interação (drop/click) valida nativamente;
menos gambiarra no app consumidor.
