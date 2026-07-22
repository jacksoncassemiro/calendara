# 01 — Análise: uso atual, tentativas anteriores e requisitos

Este documento consolida o que já existe (produção + 3 tentativas) e extrai a lista de
requisitos que a biblioteca nova precisa atender. É a base do `02-PLANO.md`.

---

## 1. Uso atual em produção — `wsaude-web` (rota `agenda`)

Hoje o produto usa **FullCalendar 6** com React (`@fullcalendar/react`, `daygrid`, `timegrid`,
`list`, `interaction`) e `date-fns`/`date-fns-tz`.

### Como é usado (arquivos-chave)
- `components/Schedule/TypeCalendar/FullCalendarProvider.tsx` — orquestra a API imperativa do FullCalendar.
- `utils/Calendar/parseBusinessHoursToBackgroundEvents.ts` — horário comercial vira **background events**.
- `utils/Calendar/parseBlockEventsCalendar.ts` — bloqueios (dia inteiro / faixa de hora) viram **background events** `display:"background"`.
- `components/Utils/Calendar/CustomViewEvent{Day,Week}Plugin.tsx` — views customizadas.
- `components/Utils/Calendar/CardSimpleEventCalendar.tsx` — render customizado do conteúdo do evento.

### O que isso revela sobre as dores (confirmando o que o Jackson relatou)

1. **Rerender / sincronização manual.** O provider precisa de um **diff incremental escrito à mão**
   (`useEffect` + `setTimeout(…,0)` + `api.getEvents()` + comparação por id + `setStart/setEnd/setProp`)
   só para atualizar eventos sem recriar tudo e sem travar. Isso é sintoma direto de o FullCalendar-React
   não se dar bem com o modelo declarativo do React. **É o problema nº 1 a resolver.**

2. **Bloqueios são "gambiarra" de background event.** Bloqueio de dia inteiro e bloqueio de faixa de
   hora são modelados como eventos de fundo com `overlap:false`, `editable:false`, cor fixa `#FFE4E6`,
   e `extendedProps.block`. Não existe um conceito de **primeira-classe** para "bloqueio". Toda a lógica
   de "esse clique/drop caiu em cima de bloqueio?" fica espalhada nos callbacks.

3. **Horário comercial dinâmico é duplicado por view.** Para funcionar em semana/dia (com faixa de hora)
   e em mês (dia inteiro), o mesmo horário comercial é emitido **duas vezes** com `classNames` diferentes
   (`horario-semana` / `horario-mes`). Suporta `start/end` customizados via `startRecur/endRecur`
   (lembrando que o `endRecur` do FC é exclusivo → soma-se +1 dia). Ou seja: o requisito de
   **"horário comercial com data de início/fim customizada e faixa de hora dinâmica por view"** já é real
   e hoje é resolvido de forma trabalhosa.

4. **Drag & drop com rollback.** `handleEventDrop` persiste no backend e chama `eventDrop.revert()` em
   caso de falha ou de regra de negócio (ex.: soltar sem `end`). O padrão `revert()` é essencial.

5. **Render de evento customizado** via `eventContent` retornando JSX — precisamos de um equivalente.

### Requisitos extraídos do uso atual
- API imperativa estável (`prev/next/today/changeView`) + navegação sem recriar a instância.
- Atualização de eventos **sem rerender global** e sem diff manual pelo consumidor.
- **Bloqueio como conceito de 1ª classe** (dia inteiro e faixa de hora), com efeito visual + regra de interação.
- **Horário comercial** por dia da semana, com faixa de hora e **janela de validade (start/end)**, refletido corretamente em todas as views.
- Drag & drop e resize com **preview + commit + revert**.
- Slot de render customizado para o card do evento e para a toolbar.
- Callbacks de clique em data/evento, seleção de intervalo, mudança de view e de range visível (para fetch por período).

---

## 2. Tentativa anterior A — `modularCalendar` (a primeira)

Biblioteca agnóstica, TS + Vite. ~2.7k linhas. Arquitetura em camadas:
`core/` (DateUtils, GeometryEngine, ModularCalendar) · `views/` (Month/Week/Day) ·
`interaction/InteractionEngine` · `layouts/VanillaLayout` · `ui/UIFactory`.

**Contratos-chave já bem pensados:**
- Evento no formato **Google-like**: `time.start.dateTime + timeZone` ou `time.start.date` (all-day),
  com `end` exclusivo na convenção Google.
- Views e layouts plugáveis via interfaces `ICalendarView` / `ICalendarLayout`.
- **Isolamento de CSS** com Tailwind `prefix(mc)` + reset escopado por `[data-modular-calendar]`
  (evita colisão com o Tailwind do app consumidor). **Ótima ideia — manter.**

**Onde travou:** `RecurrenceEngine (rrule)` ficou "🔄 em validação" — a recorrência com rrule.js
nunca fechou. As views básicas e o drag/resize foram dados como estáveis.

## 3. Tentativa anterior B — `calendario` (a mais avançada)

Evolução da anterior. ~4.5k linhas. Adiciona:
- **6 views**: Mês, Semana, Dia, Lista, N-Dias, Timeline.
- **`RecurrenceEngine V9` nativo** (substitui rrule.js): DAILY/WEEKLY/MONTHLY(exact/last_day/pos/last_pos)/YEARLY,
  `endType` never/count/until, `exdates`, e um **`TimezoneOffsetCache` com resolução de DST em 2 sondas**
  (`getOffsetMs` → probe A + probe B). Caminho **all-day 100% UTC** separado do caminho **timed timezone-aware**.
  Otimizações: fast-forward, pre-warming, flyweight de `Intl.DateTimeFormat`. Comentário no código:
  "validado contra rrule.js 2.8.1 com 24/24 testes".
- **`ConstraintEngine`**: `businessHours`, `allowedRanges` (whitelist), `blockedRanges` (blacklist),
  combinados em AND, com callbacks `onDropBlocked` / `onClickBlocked`.
- Interação com `revert()` e preview.

**Pontos fortes a reaproveitar (não copiar cru — reescrever/refinar):**
- O **modelo de constraints** (business hours + allowed + blocked em AND) é exatamente o que o wsaude precisa
  e resolve os itens 2 e 3 da análise de produção de forma limpa.
- O **cache de offset de timezone com 2-probe DST** é conhecimento valioso e correto.
- A separação **all-day (UTC) vs timed (tz-aware)** é a decisão certa.

**Limitações do modelo de recorrência dele:** o `RecurrenceRule` é um modelo "achatado"
(`subType`, `targetDay`, `targetWeekday`, `posNumeric`, `weeklyDays`) que **não cobre** RRULE genérico:
sem múltiplos `BYMONTHDAY`, sem múltiplos BYDAY com ordinais distintos (ex.: 2ª e 4ª sexta),
sem `BYSETPOS` combinado arbitrário. Para interoperar com Google/Outlook (que exportam RRULE completo)
precisamos de um modelo mais fiel ao RFC 5545 — ver seção 5 e `recurrence-validation.md`.

## 4. Tentativa anterior C — `testes-nextjs`

Dois experimentos:
- `components/FullCalendar/` — **wrapper React refinado** sobre FullCalendar (713 linhas + README de 642).
  Traz a **API-alvo desejada**: `events` como array **ou** como `EventsSourceConfig.fetchEvents({start,end})`
  com `refetchKey` (fetch por período), `customToolbar` render-prop com `{api,title,activeView,availableViews}`,
  `nativeToolbar`+`customButtons`, registro de views React via `createViewComponent`, e `utils/calendarUtils.ts`
  com funções **puras de constraint** reutilizáveis. Views customizadas: Agenda, Day, Kanban.
- `components/projectModularCalendar/ModularCalendarAPI/` — outra iteração do core próprio (build via tsc + serve).

**Lição:** aqui está o **desenho de API pública** que agrada o Jackson (event source por período, toolbar
render-prop, views plugáveis). Devemos adotar essa ergonomia na camada React — só que sobre um core que
não seja o FullCalendar.

---

## 5. Síntese — requisitos consolidados da biblioteca nova

### Funcionais
- Views: **Mês, Semana, Dia, N-Dias, Lista/Agenda** (Timeline/Resource como fase posterior).
- Eventos **timed** (com timezone) e **all-day** (UTC, end exclusivo — convenção Google).
- **Recorrência** compatível com RFC 5545 (interoperável com Google/Outlook), motor próprio (Temporal).
- **Bloqueios** como 1ª classe: dia inteiro e faixa de hora.
- **Horário comercial** por dia da semana, com faixa horária e janela de validade (start/end) por regra.
- **Constraints** (businessHours ∧ allowedRanges ∧ ¬blockedRanges) com callbacks de bloqueio.
- **Drag & drop** e **resize** com preview → commit → **revert**.
- **Múltiplas agendas** (calendars) com cor e toggle de visibilidade.
- **Recursos genéricos (1ª classe) — "Resource"**: o conceito padrão de calendário. O "dono" do horário
  pode ser um **`Resource`** genérico (a lib não sabe se é sala, equipamento ou pessoa — isso é `type`
  opaco do app). Evento com **múltiplos recursos** (`resourceIds`), recurso com **capacidade/lotação**,
  **buffers** e **disponibilidade própria**. Nenhum recurso é obrigatório pela lib (obrigatoriedade é do
  app). Cobre "Agenda Desvinculada / exames e equipamentos" **sem** acoplar regra de negócio.
  Ver `reference/agenda-desvinculada.md`.
- **Views customizadas livres**: criar uma view nova (Kanban, escala de plantão, painel de recursos) é
  1ª classe via `registerView` — não travado às views internas. É uma das dores do FullCalendar a matar.
- Slots de **render customizado**: card de evento, toolbar, célula, cabeçalho.
- **Event source por período** (`fetch({start,end})`) + array estático; `refetchKey`.
- i18n via `Intl`; tema claro/escuro; **CSS isolado** (sem vazar/colidir com o app).

### Não-funcionais (as dores a matar)
- **Zero rerender parasita**: o consumidor entrega dados declarativamente; o core faz o diff e o
  render isolado. Nada de `setTimeout(…,0)` + `api.getEvents()` no app.
- **Criar view nova deve ser simples**: contrato pequeno e documentado (`mount/update/destroy/getTitle/navigate`).
- **Agnóstico de framework** no núcleo; React é só um adapter fino.
- Tipagem TS completa e exportada; testado (recorrência, geometria, constraints).

### Anti-requisitos (o que evitar)
- Não depender de rrule.js/moment em runtime.
- Não acoplar lógica de negócio (persistência, toasts) ao core — só callbacks.
- Não usar `localStorage`/estado global escondido no core.
