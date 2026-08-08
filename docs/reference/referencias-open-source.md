# Referência — Análise dos 4 projetos open source

Objetivo: entender **como cada um resolve** os problemas que nos interessam (render/rerender,
views, recorrência, drag&drop, constraints) para **manter o padrão de comportamento** esperado —
sem copiar código. Fonte: repositórios clonados localmente (`/tmp/refs`) e documentação oficial.

---

## 1. FullCalendar (`fullcalendar/fullcalendar-workspace`)

Monorepo pnpm/turbo com `standard/` e `premium/`. O que importa para nós é a **topologia de pacotes**:

```
standard/packages/
  core-types, headless-calendar, preact,      ← núcleo
  vanilla, web-component,                       ← adapters "sem framework"
  react, vue3, angular, lwc-calendar,           ← adapters de framework
  icalendar, rrule, google-calendar,            ← integrações
  format-luxon3, format-moment, format-…        ← plugins de formatação
```

**A lição central (resolve o problema de rerender):**
FullCalendar tem um pacote `headless-calendar` e **renderiza internamente com Preact**. Os adapters
(`react`, `vue3`, `angular`) são **finos**: montam o core num container e passam props/callbacks. O React
do app **não reconcilia** a árvore interna do calendário — por isso mudanças de estado do app não causam
rerender do calendário inteiro. **É exatamente o desenho que vamos adotar** (ver `03-ARQUITETURA.md`).

- Recorrência: pacote `rrule` **opcional** (plugin), e `icalendar` para import. Ou seja, no FC a recorrência
  é plugável — não está no coração. Vamos embutir a nossa (Temporal) como parte do core, mas mantendo-a
  isolável.
- `google-calendar` é um plugin de **event source** (fetch por período) — confirma o padrão de
  `EventsSourceConfig.fetch({start,end})` que o Jackson já gosta.
- Licença MIT (standard). Premium (timeline/resource) é comercial — não usar como base de código.

## 2. Schedule-X (`schedule-x/schedule-x`)

Monorepo de pacotes pequenos e muito modular — **o modelo de modularidade mais próximo do que queremos**:

```
packages/
  calendar/            ← app principal (calendar.app.ts) — renderiza com PREACT
  events-service/      ← serviço de eventos (store) desacoplado
  recurrence/          ← motor RRULE PRÓPRIO (não usa rrule.js!)
  event-recurrence/    ← plugin que expande recorrências para o events-service
  ical/                ← import/export iCalendar
  calendar-controls/, current-time/, scroll-controller/
  event-modal/, date-picker/, time-picker/, timezone-select/
  theme-default/, theme-shadcn/   ← temas plugáveis
  translations/, shared/, types.d.ts
```

**Confirmações importantes:**
- `calendar.app.ts` faz `import { createElement, render } from 'preact'` e
  `render(createElement(CalendarWrapper, {$app}), el)` — **mesmo truque anti-rerender do FullCalendar**.
- Comentário no próprio código: os componentes internos são "consumidos por framework adapters para
  render customizado" — ou seja, arquitetura core + adapters + plugins.
- **`recurrence/`** tem motor RRULE próprio com **iteradores stateless por frequência**
  (`daily-iterator`, `weekly-iterator`, `monthly-iterators`, `yearly-iterator`), um `recurrence-set`
  (RRULE + EXDATE), parser `parse-rrule` (string↔JS) e **suíte de testes por frequência**
  (`freq-daily.spec`, `freq-weekly.spec`, …). **Excelente blueprint** para organizar o nosso motor:
  um iterador por FREQ + um "recurrence-set" que aplica EXDATE/RDATE por cima. Vamos seguir essa
  separação, com a diferença de usar **Temporal** em vez de `Date`.
- Licença: núcleo MIT (premium tem plano pago, mas o core é aberto).

**O que copiar como *ideia*:** a divisão iterador-por-freq + recurrence-set + parser + specs por freq;
os plugins pequenos (events-service, current-time, scroll-controller) como conceitos de módulos opcionais.

## 3. big-calendar (`lramos33/big-calendar`)

App Next.js (não é lib publicável) — **React idiomático puro**. Deps relevantes:
`react-dnd` + `react-dnd-html5-backend`, `date-fns@3`, shadcn/radix, `react-hook-form`+`zod`.
Views em `src/calendar/components/{month-view, week-and-day-view, agenda-view, year-view}` e `dnd/`.
Estado via **React Context** (`calendar-context.tsx`), sem recorrência.

**Uso para nós:** referência de **UX e composição de views em React** e de **drag&drop com react-dnd**
— útil para a camada `packages/react`. **Não** serve como arquitetura de core (é acoplado ao React e ao
Next). Bom para inspirar o visual das views (month/week/day/agenda/year) e o DnD idiomático. Licença MIT.

## 4. Syncfusion EJ2 React Scheduler (comercial — via documentação)

Fonte: documentação/blog oficial (código fechado). Serve como **checklist de paridade de features**:
- Views: day, week, work-week, month, **agenda**, e **timeline** (day/week/work-week/month/year).
- **Resources/grouping**: agrupar eventos por recurso (sala, profissional, equipamento) em linhas —
  relevante para o wsaude (agenda por profissional). Marcar como **fase posterior** (timeline/resource).
- Recorrência com exceções por ocorrência; timezone; drag & resize (módulo `resize`, `allowResizing`).
- Integração com Google/Outlook; **load on demand** (fetch por período) para performance.
- Há um "Pure React Scheduler" novo (2026), 100% hooks — indica a direção de mercado de schedulers
  idiomáticos em React, mas com estado/perf próprios. **Não** é base de código (licença comercial);
  usamos apenas como referência de **superfície de recursos**.

---

## 5. Como cada um resolve MOBILE / viewport estreita

O problema é sempre o mesmo: a **week view** é uma grade de 7 colunas; num celular de 375px cada
coluna cai para ~40px e vira ilegível. As saídas do mercado são só duas — **rolar** ou **trocar de
view** — e cada projeto escolheu uma:

| Projeto | Saída | Como |
|---|---|---|
| **FullCalendar** | **Rolar** | `dayMinWidth`: piso de largura por coluna; abaixo disso aparece **scroll horizontal** em vez de espremer. Vale para timegrid, daygrid e resource view. Complemento `dayNarrowWidth` (texto de data em variante curta quando a coluna fica estreita) e `stickyFooterScrollbar` (barra horizontal presa ao rodapé da viewport). **Detalhe importante: `dayMinWidth` está no plugin `scrollgrid`, que é PREMIUM** — a saída "certa" do FullCalendar é paga. |
| **Schedule-X** | **Trocar de view** | Breakpoint interno de **700px**. Cada view declara compatibilidade com tela pequena/grande, e abaixo do breakpoint o calendário só exibe as compatíveis. Na tabela oficial, **Week e Month-grid são "large screen only"**; Day, Month-agenda, Week-agenda e List são as de tela pequena. Consequência: o app é **obrigado** a registrar pelo menos uma view de cada lado. |
| **react-big-calendar** | **Nenhuma** | Sem estratégia responsiva. As issues do repo pedem o básico (datas cortadas no mobile, `onSelectSlot` que não funciona no toque) e a resposta da comunidade é workaround no app: custom view de 3 dias com paginação, ou cair na **agenda view**. |
| **Mobiscroll / Syncfusion** (comerciais) | **Trocar de view**, configurável | Opção `responsive` declarativa: o app mapeia breakpoint → view (day no celular, week no desktop). |

**Leitura para nós.** As duas saídas não competem — resolvem coisas diferentes:

- **Trocar de view é a melhor UX**, e é o que Schedule-X/Mobiscroll fazem. Mas empurra uma decisão
  para o app (quais views registrar, quando trocar) e, no caso do Schedule-X, chega a **impor**
  quais views existem.
- **Rolar é o piso de segurança**: funciona sem nenhuma decisão do app e sem forçar view alguma.

Por isso a nossa decisão é **implementar o piso de rolagem** (estilo `dayMinWidth`, só que de graça
e por token: `--mc-day-min-width`) **e recomendar** a troca para Dia/Agenda no celular como a UX
preferida — sem transformar isso em regra do core. Detalhes em `../04-ESTILIZACAO.md`.

Um ponto que nenhum dos três resolve bem e que herdamos: **alvo de toque**. Nossos botões de toolbar
tinham `padding: 4px 10px` (~26px de altura), abaixo dos 44px de WCAG 2.5.5 / guias iOS e Android —
daí o token `--mc-touch-target`.

Fontes: [dayMinWidth](https://fullcalendar.io/docs/dayMinWidth) · [dayNarrowWidth](https://fullcalendar.io/docs/dayNarrowWidth) · [stickyFooterScrollbar](https://fullcalendar.io/docs/stickyFooterScrollbar) · [Schedule-X — Calendar views](https://schedule-x.dev/docs/calendar/views) · [react-big-calendar #2197](https://github.com/bigcalendar/react-big-calendar/issues/2197) · [react-big-calendar #1005](https://github.com/jquense/react-big-calendar/issues/1005)

---

## Conclusões que entram na arquitetura

1. **Render isolado com Preact dentro de um container** é o padrão consolidado (FullCalendar *e*
   Schedule-X) para não sofrer com rerender do framework host. **Adotar.**
2. **Core + adapters + plugins pequenos** (events-service, recurrence, temas) é a modularidade certa.
   **Adotar** a divisão, começando enxuto (core + react + styles) e crescendo em plugins.
3. **Motor de recorrência próprio com iterador-por-FREQ + recurrence-set + parser + specs por freq**
   (padrão Schedule-X), porém sobre **Temporal** (nossa decisão) e validado contra rrule.js.
4. **Event source por período** (padrão FullCalendar/Syncfusion/`testes-nextjs`) como primeira classe.
5. **Resource/Timeline views** = **Agenda Desvinculada** (requisito real do wsaude: agenda de exames e
   equipamentos). Promovido de backlog para **Fase 3B**; o núcleo nasce resource-aware na Fase 1.
   Detalhamento em `agenda-desvinculada.md`.
6. **Responsivo = piso de rolagem no core + troca de view recomendada ao app.** Pegamos o
   `dayMinWidth` do FullCalendar (mas por token e sem plugin pago) como garantia mínima, e deixamos
   a troca Semana→Dia/Agenda no celular (padrão Schedule-X) como recomendação, não como imposição.
   Tudo em CSS: nenhum breakpoint vaza para o core. Ver `../04-ESTILIZACAO.md`.
