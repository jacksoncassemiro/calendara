# 03 — Arquitetura alvo

> Estado de 07/10/2026: migração para React nativo concluída. Core contém motores TypeScript; views e CalendarApp estão em packages/react. Preact, ReactIsland e portals removidos. As seções abaixo preservam o plano/arquitetura históricos e não são a referência vigente. Consulte 00-STATUS.md, README e 05-API.md. A separação interna motor/UI não exige pacotes npm separados; a consolidação pública ainda está pendente.

Desenho técnico da biblioteca. Deriva diretamente de `01-ANALISE.md` (requisitos) e
`reference/referencias-open-source.md` (padrões consolidados). Formaliza como **matamos o rerender**
e como **criar view nova fica simples**.

## Princípio central: núcleo headless + render isolado + adapter fino

```
┌─────────────────────────────────────────────────────────┐
│ App do usuário (React hoje; Vue/Angular/Vanilla depois)  │
└───────────────┬─────────────────────────────────────────┘
                │ props declarativas + callbacks (nunca manipula DOM interno)
┌───────────────▼─────────────────────────────────────────┐
│ packages/react  — <Calendar/>  (ADAPTER FINO)            │
│  • cria a instância do core 1x (useRef)                  │
│  • repassa dados via store; NÃO reconcilia a árvore interna │
└───────────────┬─────────────────────────────────────────┘
                │ API imperativa + store observável
┌───────────────▼─────────────────────────────────────────┐
│ packages/core — CalendarApp (HEADLESS, TS puro)          │
│  • Store (estado: date, view, events, constraints)       │
│  • Engines: DateUtils · Recurrence · Geometry · Constraint│
│  • Render próprio via PREACT em um container isolado      │
│  • Views plugáveis (ICalendarView) · Plugins             │
└─────────────────────────────────────────────────────────┘
```

### Por que isso elimina o rerender parasita
O `CalendarApp` **renderiza a si mesmo com Preact** dentro do seu container (mesmo padrão de
FullCalendar e Schedule-X). O React do app **não reconcilia** nada dentro do calendário: ele só
entrega dados ao store e recebe eventos por callback. Resultado: mudar um filtro no app **não** re-renderiza
o calendário inteiro; o store faz **diff granular** e só re-renderiza o que mudou. Isso remove a necessidade
do diff manual (`api.getEvents()` + `setStart/setEnd`) que existe hoje no `wsaude-web`.

> Preact é escolhido para o render interno por ser minúsculo (~4kB), ter API tipo-React (fácil de escrever
> views) e ser o padrão dos dois maiores projetos do mercado para exatamente esse fim. **Fica encapsulado**
> no core — o app não precisa saber que existe.

## Pacotes (monorepo yarn workspaces)

```
packages/
  core/      @meucalendario/core   — headless, framework-agnostic (inclui render Preact interno)
  react/     @meucalendario/react  — <Calendar/> + hooks (useCalendar)
  styles/    @meucalendario/styles — CSS com tokens (custom properties), isolado
  (futuro) vue/, angular/, vanilla/, ical/, resource-timeline/
```

### `core` — estrutura interna
```
core/src/
  types/            ← contratos públicos (CalendarEvent, EventTime, RRuleModel, ICalendarView, …)
  store/            ← estado observável + diff granular (sem framework)
  date/DateUtils    ← utilitários puros (sobre Temporal)
  recurrence/       ← motor RFC 5545 sobre Temporal (iterador-por-FREQ + recurrence-set + parser)
  geometry/         ← layout de eventos (algoritmo de sobreposição/waterfall)
  constraint/       ← businessHours ∧ allowedRanges ∧ ¬blockedRanges + bloqueios
  render/           ← camada Preact (CalendarWrapper) + componentes base
  views/            ← Month, Week, Day, NDays, List (implementam ICalendarView)
  interaction/      ← drag&drop + resize (Pointer Events) com preview→commit→revert
  plugins/          ← current-time, event-source(fetch por período), …
  index.ts
```

## Contrato de View (torna "criar view nova" simples)

Uma view é um objeto pequeno — o mesmo contrato que já funcionou nas tentativas anteriores, formalizado:

```ts
interface ICalendarView {
  mount(container: HTMLElement, api: CalendarAPI): void;
  update(state: ViewState): void;      // date, eventos expandidos+posicionados, constraints
  destroy(): void;
  getTitle(date: Temporal.PlainDate, locale: string): string;
  navigate(dir: 'prev'|'next', date): Temporal.PlainDate;   // quanto avançar
  getRange(date): { start; end };      // range visível → dispara event-source fetch
}
calendar.registerView('week', 'Semana', WeekViewFactory);
```

O core cuida de: expandir recorrências no range, posicionar (geometry), aplicar constraints e chamar
`update`. A view só desenha. **Views podem ser escritas em Preact (padrão) ou entregar HTML puro.**
Um app React poderá também registrar uma view feita em React via um helper `createReactView` (padrão
`createViewComponent` do `testes-nextjs`).

> **Criar view nova NÃO é travado.** As views internas (Month/Week/Day/NDays/List/Timeline) são apenas
> implementações padrão do mesmo contrato público `ICalendarView`. Qualquer view customizada — Kanban,
> "3 dias úteis", escala de plantão, painel de recursos — é cidadã de 1ª classe via `registerView(...)`.
> Este é justamente um dos pontos que hoje é difícil no FullCalendar e que resolvemos por design: o
> contrato é pequeno (mount/update/destroy/getTitle/navigate/getRange) e recebe do core os eventos já
> expandidos e posicionados. Nenhuma view é "especial" para o núcleo.

## Estado e fluxo de dados
- **Fonte de verdade**: store no core. App envia `events` (array) **ou** um `eventSource.fetch({start,end})`
  com `refetchKey` (padrão FullCalendar/`testes-nextjs`).
- **Expansão de recorrência é lazy por range**: só expande ocorrências dentro da janela visível (+buffer).
- **Interações** emitem callbacks (`onEventDrop(event, old, revert)`, `onEventResize`, `onDateSelect`,
  `onDateClick`, `onEventClick`, `onDropBlocked`, `onClickBlocked`, `onViewChange`, `onRangeChange`).

## Camadas visuais especiais (bloqueio / horário comercial)
Renderizadas pelo core como **camada de fundo** (não como eventos), a partir de `businessHours`,
`blockedRanges`/`blocking` e `allowedRanges`. O `ConstraintEngine` responde "esse slot é válido?" para
drag/drop/click, disparando `onDropBlocked`/`onClickBlocked`. Resolve os itens 2 e 3 de `01-ANALISE.md`
de forma nativa (sem background-events manuais).

## CSS e isolamento
- `packages/styles`: CSS com **custom properties** (`--mc-*`) para tema (claro/escuro) e tokens.
- Escopo por atributo raiz (`[data-mc-root]`), reset local (box-sizing/button/input) — **sem preflight global**.
- Herda a ideia validada em `modularCalendar` (prefixo + reset escopado) para não colidir com o Tailwind do app.

## Temporal API — política de compatibilidade
- Código usa `Temporal` diretamente. Um shim no bootstrap: se `globalThis.Temporal` ausente (Safari),
  carrega o polyfill. Medir custo de bundle na Fase 1; oferecer build "sem polyfill" para quem só tem
  navegadores modernos.

## Recursos (`Resource`) — conceito genérico, resource-aware desde o núcleo
O core nasce **resource-aware** usando o conceito **padrão e genérico de calendário: `Resource`**
(o mesmo de FullCalendar/Syncfusion/Graph). A lib **não** tem noção de "profissional/sala/equipamento":
isso é apenas o `type` (string opaca) que o app define. `CalendarResource { type, capacity, buffers,
businessHours, parentId, metadata }` + `event.resourceIds: string[]` (0..N). Capacity/buffers/disponibilidade
são consumidos pela geometria e pelo ConstraintEngine. As **views orientadas a recurso** (Timeline em
linhas; Multiagenda em colunas) são só mais implementações de `ICalendarView`. **Nenhuma regra de negócio
entra na lib** — obrigatoriedade/semântica de recurso vive no app (via `metadata` + callbacks).
Detalhes e a fronteira lib×app: `reference/agenda-desvinculada.md`.
A entidade e os tipos entram já na Fase 1; o comportamento/visões na **Fase 3B** (`02-PLANO.md`).

## Fora do MVP (fases posteriores)
- Adapters Vue/Angular/Vanilla, pacote `ical` (import/export), timezone Windows↔IANA (interop Outlook).
