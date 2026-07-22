# projeto-calendario

Biblioteca de calendário/agenda própria — **núcleo headless em TypeScript** + **adapter React fino**, sem os problemas de rerender do FullCalendar, com **bloqueios**, **horário comercial dinâmico** e **recorrência própria via Temporal API**. Projetada para rodar em qualquer framework.

> **Status:** Fases 1–5 concluídas; Fase 6 (empacotamento/docs) em andamento. Núcleo, views (Semana/Dia/Mês/N-dias/Lista + Multiagenda/Timeline de recursos), interação (drag/resize/seleção) e adapter React prontos. Comece por **[`docs/00-STATUS.md`](docs/00-STATUS.md)**.

## Pacotes

| Pacote | O quê |
|---|---|
| `@meucalendario/core` | núcleo headless: tipos, recorrência RFC 5545, ConstraintEngine, geometria (waterfall), render Preact isolado, `CalendarApp`, views, interação. |
| `@meucalendario/react` | adapter fino: `<Calendar/>`, `useCalendar`, `createReactView`. |
| `@meucalendario/styles` | tema padrão (tokens `--mc-*` + classes `mc-*`). Ver [`docs/04-ESTILIZACAO.md`](docs/04-ESTILIZACAO.md). |

## Instalação

```bash
yarn add @meucalendario/react @meucalendario/core @meucalendario/styles react react-dom
# navegadores sem Temporal nativo (Safari) precisam do polyfill:
yarn add @js-temporal/polyfill
```

## Uso — React

```tsx
import { Calendar, useCalendar } from '@meucalendario/react';
import '@meucalendario/styles';
import type { CalendarEvent } from '@meucalendario/core';

const events: CalendarEvent[] = [{
  id: 'e1', calendarId: 'c1', title: 'Consulta',
  time: {
    allDay: false,
    start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
  },
}];

export function Agenda() {
  const { ref, api } = useCalendar();
  return (
    <>
      <button onClick={() => api.prev()}>‹</button>
      <button onClick={() => api.today()}>Hoje</button>
      <button onClick={() => api.next()}>›</button>

      <Calendar
        apiRef={ref}
        view="week"
        date="2026-07-22"
        events={events}
        options={{ timeZone: 'America/Sao_Paulo', startHour: 7, endHour: 20 }}
        constraints={{
          businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
          blocked: [{ scope: 'time', date: '2026-07-22', start: '12:00', endTime: '13:00' }],
        }}
        onEventDrop={(change) =>
          // persista; retorne false / rejeite para REVERTER o movimento otimista.
          saveNewTime(change.occurrence.masterId, change.startDateTime, change.endDateTime)
        }
        onDateSelect={(sel) => openCreateModal(sel.dateISO, sel.startMin, sel.endMin)}
        onDropBlocked={(info) => toast(`Movimento inválido: ${info.reason}`)}
      />
    </>
  );
}
```

A instância do core é criada **uma vez**; mudanças de props entram pela API imperativa (sem rerender/diff manual). `renderEvent`/`customToolbar` aceitam conteúdo React (embutido via ilha). `resources` habilita a validação dura de lotação/buffer no drag.

## Uso — vanilla (sem React)

O core é framework-agnostic; views customizadas são 1ª classe via `registerView` (não precisa de adapter):

```ts
import { CalendarApp } from '@meucalendario/core';
import { h } from 'preact';
import '@meucalendario/styles';

const app = new CalendarApp({ view: 'week', date: '2026-07-22', events,
  options: { timeZone: 'America/Sao_Paulo' }, onEventDrop: (c) => persist(c) });
app.mount(document.getElementById('cal')!);
await app.ready();
app.next(); app.changeView('day');

app.registerView({
  name: 'minha-view', label: 'Minha',
  getRange: (date) => ({ days: [date], startDate: date, endDate: date }),
  navigate: (dir, date) => (dir === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 })),
  getTitle: (range) => range.startDate.toString(),
  render: (ctx) => h('div', null, `${ctx.occurrences.length} eventos`),
});
```

## Interação, recorrência, estilização, a11y

- **Interação** (views de time-grid): `onEventDrop`/`onEventResize` (retornar `false`/rejeitar ⇒ **revert**), `onDateSelect`, `onDropBlocked`/`onClickBlocked`. Validade = `ConstraintEngine` (horário comercial/bloqueios/allowed) **+** ocupação do recurso (lotação por `capacity`, `bufferBefore`/`bufferAfter`).
- **Recorrência:** motor próprio sobre a **Temporal API** (superconjunto RFC 5545); polyfill sob demanda para Safari. `rrule.js` só como oráculo de teste, fora do bundle.
- **Estilização:** `import '@meucalendario/styles'` e redefina tokens `--mc-*` sob `[data-mc-root]`. Guia: [`docs/04-ESTILIZACAO.md`](docs/04-ESTILIZACAO.md).
- **Acessibilidade:** toolbar com `role="toolbar"`, `aria-label` nos ícones ‹/›, `aria-pressed` nas views, `aria-live` no título (navegação por teclado no grid fica para depois).

## Desenvolvimento

```bash
yarn install
yarn test          # vitest (node + jsdom) — 163 testes
yarn typecheck     # tsc estrito por pacote
yarn build         # ESM + CJS + .d.ts por pacote (core → react → styles)
node scripts/bench.mjs 2000 15   # bench (requer core buildado)
```

> **Perf:** o bench roda sob o **polyfill** Temporal (Node não tem nativo) — em navegadores com Temporal nativo é bem mais rápido; o gargalo são as conversões de timezone por ocorrência.

### Playground (validação visual)

Além dos testes automatizados (jsdom montam o calendário e checam o DOM real), há um playground para ver rodando no navegador:

```bash
yarn build                       # gera packages/core/dist (usado pelo playground)
npx serve .                      # ou o "Live Server" do VSCode
# abra http://localhost:3000/examples/playground.html
```

Ele exercita as views, drag & drop / resize / seleção, recorrência, bloqueios e recursos (lotação/buffer), com um log das interações.

### Compatibilidade React

O adapter declara `react`/`react-dom` como peers em **`^18 || ^19`** — funciona no React 18 e 19. A suíte de testes do repo roda no 18 (matriz estável); usar 19 no app consumidor é suportado.

## Documentação

| Doc | O que é |
|---|---|
| [`docs/00-STATUS.md`](docs/00-STATUS.md) | **Diário/continuidade** entre sessões. **Leia primeiro.** |
| [`docs/01-ANALISE.md`](docs/01-ANALISE.md) | Análise do uso atual (wsaude-web), das 3 tentativas e requisitos |
| [`docs/02-PLANO.md`](docs/02-PLANO.md) | Plano de execução faseado + ADRs (decisões) |
| [`docs/03-ARQUITETURA.md`](docs/03-ARQUITETURA.md) | Desenho técnico alvo (core headless, anti-rerender, views) |
| [`docs/04-ESTILIZACAO.md`](docs/04-ESTILIZACAO.md) | Tokens, classes e hooks de customização |
| [`docs/05-API.md`](docs/05-API.md) | **Referência completa**: modelo de dados, opções, callbacks, views (todos os campos) |
| [`docs/reference/`](docs/reference) | Referências open-source, modelos Google/Outlook/RFC 5545, validação de recorrência |

## Decisões-chave (resumo)
- **React primeiro**, mas núcleo headless framework-agnostic (extração vanilla é meta).
- **Render interno com Preact isolado** → mata o rerender parasita (padrão FullCalendar/Schedule-X).
- **Recorrência própria via Temporal API** (rrule.js só como oráculo de teste); polyfill para Safari.
- **Modelo canônico = superconjunto RFC 5545**, interoperável com Google e Outlook.
- **Bloqueios e horário comercial** como constraints de 1ª classe (não background-events).

Detalhes e alternativas descartadas nos ADRs de [`docs/02-PLANO.md`](docs/02-PLANO.md).
