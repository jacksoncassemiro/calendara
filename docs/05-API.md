# 05 — Guia de uso da API (com exemplos)

Guia prático: para cada conceito, **um exemplo preenchido**, o **propósito** de cada campo e **quando usar**. A tipagem formal está no código (`packages/core/src/types`); aqui o foco é como preencher na prática.

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

- **`time.timeZone`**: o horário é "wall-clock" naquela timezone. `'2026-07-22T09:00:00'` + `'America/Sao_Paulo'` = 9h no horário de São Paulo, independentemente da timezone de exibição. Use a tz de origem do evento (ex.: a da clínica).
- **evento de dia inteiro** (feriado, férias): `allDay: true` e use `date` (não `dateTime`). O `end` é **exclusivo** (convenção Google): um feriado só no dia 22 vai de `22` a `23`.

```ts
const feriado = {
  id: 'feriado-22', calendarId: 'sistema', title: 'Feriado municipal',
  editable: false,
  time: { allDay: true, start: { date: '2026-07-22' }, end: { date: '2026-07-23' } },
};
```

---

## 2. Recorrência (motor próprio, superconjunto RFC 5545)

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

import { createNDaysView, createResourceDayView, createTimelineView } from '@meucalendario/core';
app.registerView(createNDaysView(3));                 // escala de 3 dias corridos → view 'ndays-3'
app.registerView(createResourceDayView(resources));   // Multiagenda (1 dia, N colunas) → 'resources'
app.registerView(createTimelineView(resources));      // Timeline (recursos em linhas) → 'timeline'
```

**View totalmente customizada** (o `render` devolve nós Preact; no React use `createReactView`):
```ts
import { h } from 'preact';
app.registerView({
  name: 'resumo', label: 'Resumo',
  getRange: (date) => ({ days: [date], startDate: date, endDate: date }),
  navigate: (dir, date) => (dir === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 })),
  getTitle: (range) => `Resumo de ${range.startDate.toString()}`,
  render: (ctx) => h('ul', null, ctx.occurrences.map((o) => h('li', { key: o.event.id }, o.event.title))),
});
```

---

## 8. React (`@meucalendario/react`)

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
  renderEvent={(info) => <MeuEventoReact occ={info.occurrence} />} // conteúdo React (ilha)
  customToolbar={(t) => <MinhaToolbar title={t.title} onNext={t.goNext} />}
  onEventDrop={(c) => salvar(c)}
/>;

// em qualquer handler:
api.next(); api.changeView('day'); api.getTitle();
```

A instância do core é criada **uma vez**; trocar `events`/`view`/`date` entra pela API imperativa (sem re-render da árvore interna). `renderEvent`/`customToolbar` aceitam React de verdade, embutido via ilha (`ReactIsland`).

> A tipagem formal (todos os campos e defaults) está em `packages/core/src/types` e em `render/state.ts` (`DEFAULT_OPTIONS`).
