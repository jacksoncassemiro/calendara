# 05 — Guia de uso da API (com exemplos)

Guia prático: para cada conceito, **um exemplo preenchido**, o **propósito** de cada campo e **quando usar**. A tipagem formal está no código (`src/core/types`); aqui o foco é como preencher na prática.

---

## 1. Um evento

O tipo mínimo que você monta. Exemplo de uma consulta das 9h às 10h:

```ts
const consulta = {
  id: 'consulta-8821',        // seu ID único (string). Use o ID do seu banco.
  calendarId: 'agenda-dra-ana', // a qual agenda pertence — permite ligar/desligar agendas
  title: 'Maria Silva — retorno',
  time: {
    allDay: false,
    start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
    end:   { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
  },
  color: '#2563eb',           // opcional; sobrescreve a cor padrão do tema NESTE evento
  editable: true,             // opcional (default true). false = não deixa arrastar/redimensionar
  resourceIds: ['sala-1'],    // opcional; recurso(s) ocupado(s) — ver seção 4
};
```

- **`time.start.timeZone` / `time.end.timeZone`**: o horário é "wall-clock" naquela timezone. `'2026-07-22T09:00:00'` + `'America/Sao_Paulo'` = 9h no horário de São Paulo, independentemente da timezone de exibição. Use a tz de origem do evento (ex.: a da clínica). Os callbacks de gesto informam `change.timeZone`, a zona dos novos horários.
- **evento de dia inteiro** (feriado, férias): `allDay: true` e use `date` (não `dateTime`). O `end` é **exclusivo** (convenção Google): um feriado só no dia 22 vai de `22` a `23`.

```ts
const feriado = {
  id: 'feriado-22', calendarId: 'sistema', title: 'Feriado municipal',
  editable: false,
  time: { allDay: true, start: { date: '2026-07-22' }, end: { date: '2026-07-23' } },
};
```

---

## 2. Recorrência (subconjunto de RFC 5545)

Frequências DAILY/WEEKLY/MONTHLY/YEARLY. RDATE datetime preserva horário; EXDATE datetime exclui o início exato, enquanto date-only exclui o dia. UNTIL datetime respeita hora e timezone. Valores com Z/offset são projetados na timezone do mestre, ou UTC quando ela estiver ausente. Ao chamar `expandEvent` diretamente, forneça `window.end` para regras sem COUNT/UNTIL; materialização infinita lança erro. Não há suporte completo a filtros subdiários do RFC.

Coloque `recurrence` no evento. A `start`/`end` do evento definem o **horário** de cada ocorrência; a regra define **em quais dias**.

**Toda terça, 10 ocorrências:**
```ts
recurrence: { rule: { freq: 'WEEKLY', byDay: [{ weekday: 'TU' }], count: 10 } }
```

**"2ª e 4ª sexta do mês"** (o caso que quebrava no protótipo antigo — `ordinal` por entrada):
```ts
recurrence: { rule: { freq: 'MONTHLY', byDay: [{ weekday: 'FR', ordinal: 2 }, { weekday: 'FR', ordinal: 4 }] } }
```

**A cada 2 semanas, seg/qua/sex, até uma data:**
```ts
recurrence: { rule: { freq: 'WEEKLY', interval: 2,
  byDay: [{ weekday: 'MO' }, { weekday: 'WE' }, { weekday: 'FR' }], until: '2026-12-31' } }
```

**Série com exceção e uma ocorrência editada:**
```ts
recurrence: {
  rule: { freq: 'WEEKLY', byDay: [{ weekday: 'TU' }] },
  exDates: ['2026-07-28T09:00:00'],                 // pula esta terça
  overrides: {
    '2026-08-04T09:00:00': { title: 'Terça especial', // edita SÓ esta ocorrência
      time: { allDay: false,
        start: { dateTime: '2026-08-04T11:00:00', timeZone: 'America/Sao_Paulo' },
        end:   { dateTime: '2026-08-04T12:00:00', timeZone: 'America/Sao_Paulo' } } },
    '2026-08-11T09:00:00': { cancelled: true },       // cancela SÓ esta
  },
}
```

- **`rDates`**: datas avulsas extras que não seguem a regra (ex.: `['2026-09-07T09:00:00']`).
- A chave de `overrides` é o **`originalStart`** (ISO) da ocorrência — o instante que ela teria SEM o override.
- `freq` aceita `DAILY | WEEKLY | MONTHLY | YEARLY`; `weekStart` muda o início da semana no cálculo (default `MO`).

---

## 3. Horário comercial, bloqueios e faixas permitidas (constraints)

São camadas próprias (não são eventos — ADR-005). Passe em `constraints`. A interação (drag/drop) valida contra elas automaticamente.

```ts
const constraints = {
  // Expediente: seg–sex, 08:00–18:00. daysOfWeek usa 0=domingo..6=sábado.
  businessHours: [
    { daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' },
    { daysOfWeek: [6], startTime: '08:00', endTime: '12:00' }, // sábado meio-período
  ],
  // Bloqueio pontual (almoço nesta quarta) — barra drop/seleção nessa faixa:
  blocked: [
    { scope: 'time', date: '2026-07-22', startTime: '12:00', endTime: '13:00', description: 'Almoço' },
    { scope: 'day',  date: '2026-07-25', description: 'Manutenção' }, // dia inteiro
  ],
};
```

**Sim, `businessHours` aceita validade por data** — `start`/`end` limitam EM QUAIS DATAS a regra vale (não confundir com `startTime`/`endTime`, que é o horário). Útil para expediente sazonal:

```ts
// Horário de verão só entre 01/12/2026 e 28/02/2027:
businessHours: [
  { daysOfWeek: [1,2,3,4,5], startTime: '07:00', endTime: '16:00', start: '2026-12-01', end: '2027-02-28' },
  { daysOfWeek: [1,2,3,4,5], startTime: '08:00', endTime: '18:00' }, // regra padrão (sem validade = sempre)
]
```

**`allowedRanges`** (opcional): se presente, SÓ slots dentro dele são válidos — útil para "só é possível agendar nas próximas 2 semanas":
```ts
allowedRanges: [{ start: '2026-07-22', end: '2026-08-05' }]
```

Precedência: `blocked` > `businessHours` > `allowedRanges`.

---

## 4. Recursos (salas, equipamentos, leitos) — "agenda desvinculada"

Recurso é genérico (a lib não sabe o que ele "é" — ADR-006). Ligue eventos a recursos por `event.resourceIds`. Habilita as views Multiagenda/Timeline e a **validação dura de lotação/buffer** no drag.

```ts
const resources = [
  { id: 'sala-1', title: 'Consultório 1', type: 'sala',
    capacity: 1,          // 1 atendimento por vez; um 2º evento sobreposto é BARRADO no drop
    bufferAfter: 15 },    // 15 min de limpeza depois de cada evento (bloqueados para outro)
  { id: 'raiox', title: 'Raio-X', type: 'equipamento',
    capacity: 2 },        // aceita 2 simultâneos
  { id: 'dra-ana', title: 'Dra. Ana', type: 'profissional',
    businessHours: [{ daysOfWeek: [1,2,3], startTime: '08:00', endTime: '12:00' }] }, // expediente PRÓPRIO
];

// Evento que ocupa DOIS recursos ao mesmo tempo (sala + equipamento):
const exame = { id: 'ex-1', calendarId: 'c1', title: 'Tomografia',
  resourceIds: ['sala-1', 'raiox'], time: { /* ... */ } };
```

- `type` é uma **string livre** sua (`'sala'`, `'profissional'`, `'leito'`…). A lib não interpreta — a regra de negócio é do app.
- `capacity`/`bufferBefore`/`bufferAfter` viram **validação**: mover um evento para cima de um recurso lotado ⇒ `onDropBlocked` com `reason: 'over-capacity'`; violar o buffer ⇒ `reason: 'buffer-conflict'`.
- `businessHours` no recurso sobrepõe o global só para aquele recurso.

---

## 5. Opções de exibição (`options`)

```ts
options: {
  timeZone: 'America/Sao_Paulo', // tz em que o grid é DESENHADO (converte eventos de outras tz)
  locale: 'pt-BR',               // formatação de datas/horas (Intl)
  weekStart: 'MO',               // 1º dia da semana na view Semana
  startHour: 7,                  // grid começa às 07:00
  endHour: 20,                   // grid termina às 20:00
  slotMinutes: 30,               // linhas de 30 min; também é o "snap" ao arrastar
  pxPerMinute: 1,                // 1px por minuto → 1h = 60px de altura
  minEventMinutes: 15,           // altura mínima de um evento e duração mínima ao redimensionar
  nowMs: null,                   // relógio da linha "agora"; null = Date.now() (injete p/ testes)
}
```

Tudo é opcional — os defaults acima são os efetivos. `visibleResourceIds: ['sala-1']` filtra recursos nas views de recurso.

---

## 6. Interação (drag & drop, resize, seleção)

Passe callbacks na config (core) ou nas props (`<Calendar/>`). O commit é **otimista com revert**: retorne `false` (ou rejeite a Promise) para desfazer.

```ts
onEventDrop: async (change) => {
  // change traz o novo horário JÁ calculado como wall-clock ISO:
  const ok = await api.reagendar(change.occurrence.masterId, change.startDateTime, change.endDateTime);
  return ok; // false ⇒ o evento volta para o lugar (revert)
},
onEventResize: async (change) => api.mudarDuracao(change.occurrence.masterId, change.endDateTime),
onDateSelect: (sel) => abrirModalDeCriacao(sel.dateISO, sel.startMin, sel.endMin), // arrastar em área vazia
onDropBlocked: (info) => toast(`Não pode: ${traduz(info.reason)}`), // 'blocked' | 'over-capacity' | ...
```

`change.startDateTime`/`endDateTime` são `'YYYY-MM-DDTHH:mm:00'` na tz de exibição — prontos para persistir.

---

## 7. Trocar e criar views

```ts
app.changeView('day');   // internas: 'week' | 'day' | 'month' | 'list'

import { createNDaysView, createResourceDayView, createTimelineView } from '@meucalendario/calendar';
app.registerView(createNDaysView(3));                 // escala de 3 dias corridos → view 'ndays-3'
app.registerView(createResourceDayView(resources));   // Multiagenda (1 dia, N colunas) → 'resources'
app.registerView(createTimelineView(resources));      // Timeline (recursos em linhas) → 'timeline'
```

**View totalmente customizada** (o `render` devolve nós React; para componentes com hooks use `createReactView`):
```ts
import { createElement } from 'react';
app.registerView({
  name: 'resumo', label: 'Resumo',
  getRange: (date) => ({ days: [date], startDate: date, endDate: date }),
  navigate: (dir, date) => (dir === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 })),
  getTitle: (range) => `Resumo de ${range.startDate.toString()}`,
  render: (ctx) => createElement('ul', null, ctx.occurrences.map((o) => createElement('li', { key: o.event.id }, o.event.title))),
});
```

---

## 8. React (`@meucalendario/calendar`)

O pacote único exporta motor, componentes e tipos. Importe os estilos por `@meucalendario/calendar/styles.css`; `/core` é uma entrada opcional do mesmo pacote sem renderer.

`CalendarEventEditor` é um formulário opcional para criação, edição e exclusão. Recebe `event`, `occurrence` opcional, `resources`, `timeZone`, `validate`, `onSave`, `onDelete` e `onCancel`. `validate` retorna uma mensagem de erro ou undefined; callbacks podem ser assíncronos e retornar false para rejeitar. O consumidor aplica as mudanças ao estado/servidor. `context.scope` informa occurrence/series; `context.occurrence.originalStart` identifica a exceção. Monte com key da ocorrência ao trocar de evento. A interface all-day pede o último dia inclusivo e converte para fim exclusivo nos dados.

Gestos multiday timed e all-day na faixa de dias preservam o intervalo completo. `EventChange` e `SelectionChange` podem incluir `endDateISO` e `allDay`. `evaluatePlacement` valida todos os dias quando `endDateISO` é fornecido, incluindo ocupação fora do range visível. Regras do cliente não substituem validação transacional no servidor.

```tsx
const { ref, api } = useCalendar();

<Calendar
  apiRef={ref}
  view="week"
  date="2026-07-22"
  events={events}
  resources={resources}
  constraints={constraints}
  options={{ timeZone: 'America/Sao_Paulo', startHour: 7, endHour: 20 }}
  refetchKey={filtroAtual}                // muda ⇒ dispara eventSource de novo
  eventSource={({ start, end }) => api.buscarEventos(start, end)}
  renderEvent={(info) => <MeuEventoReact occ={info.occurrence} />} // React nativo com contexto do consumidor
  customToolbar={(t) => <MinhaToolbar title={t.title} onNext={t.goNext} />}
  onEventDrop={(c) => salvar(c)}
/>;

// em qualquer handler:
api.next(); api.changeView('day'); api.getTitle();
```

A instância acompanha a montagem; trocar `events`/`view`/`date` entra pela API imperativa. As extensões `renderEvent`, `customToolbar` e `createReactView` pertencem à árvore React do consumidor e compartilham seus providers. Props imutáveis equivalentes são deduplicadas; mudanças de dados/view/date são agrupadas. `CalendarApp` e as fábricas de views são exportados por @meucalendario/calendar. SSR renderiza inicialmente apenas o container.

`evaluateSlot` consulta constraints globais. Para criação/edição com recursos, use `api.evaluatePlacement({ dateISO, startMin, endMin, resourceId, occurrence? })`: considera expediente do recurso, capacidade e buffers. A ocorrência original opcional evita contar a própria reserva durante a edição. Para eventos atravessando dias, avalie cada segmento diário e cada recurso antes de persistir; a biblioteca não grava no servidor.

`useCompactCalendar(640)` retorna `{ containerRef, compact }` e acompanha a largura do container com ResizeObserver. Defina a view inicial conforme a largura, preservando as escolhas posteriores do usuário (veja o exemplo React). Passar continuamente `view={compact ? 'day' : 'week'}` pode sobrescrever uma escolha manual quando a largura mudar. A toolbar troca botões por seletor em containers estreitos.

Nas grades de horário, Tab entra na primeira célula; setas seguem o eixo de tempo ou mudam o dia/recurso, Home/End vão ao início/fim da coluna (Ctrl: grade inteira). Enter/Espaço disparam `onDateSelect` com um slot e `resourceId`, respeitando constraints, capacidade e buffers; se houver rejeição, disparam `onClickBlocked`. Sem `onDateSelect`, a ativação válida usa `onDateClick`. No mês, setas percorrem dias/semanas e Home/End a semana; a ativação mantém o comportamento do botão do dia. Seleção de intervalo e mover/redimensionar pelo teclado ainda são pendências.

> A tipagem formal (todos os campos e defaults) está em `src/core/types` e em `render/state.ts` (`DEFAULT_OPTIONS`).

## Editar ou excluir esta ocorrência e as seguintes

`CalendarEventEditor` envia `context.scope === 'following'`. O consumidor pode chamar:

```ts
const {before, following} = splitEventSeries(temporal, master, occurrence.originalStart,
  crypto.randomUUID(), {title: draft.title, time: draft.time, resourceIds: draft.resourceIds});
// Substitua master por before (ou remova quando null) e persista following como novo mestre.
// Para excluir esta e seguintes, persista somente before.
```

O corte usa a chave original da ocorrência, não seu horário efetivo após override. COUNT é dividido antes de EXDATE/cancelamentos; RDATE não consome COUNT. Exceções e overrides são particionados pelo início original e os futuros acompanham o deslocamento wall-clock do novo início. O histórico anterior permanece imutável. Um corte sem alterações recompõe a série original nos cenários existentes de frequências/filtros.

O corte precisa ser uma ocorrência ativa gerada pela RRULE. Datas extras RDATE-only, troca de timezone ou all-day↔timed e início incompatível com os filtros são rejeitados. Para filtros explícitos como BYDAY=MO, reagendar o novo início para terça exige alterar a regra em uma operação própria. O helper não grava dados nem verifica constraints de todos os eventos futuros: faça essa validação e a persistência dos dois mestres em uma transação no consumidor; séries infinitas exigem uma política de janela de validação.
