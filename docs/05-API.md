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

## Espaçamento e abertura do mês

`pxPerMinute` define a escala dos horários em todas as grades; `1.5` corresponde a 45 px por meia hora. `timeLabelInterval: 60` mostra rótulos a cada hora, independentemente de `slotMinutes: 30`, usado para seleção e snapping. Sem intervalo explícito, os rótulos adaptam a distância mínima conforme a escala.

`monthMaxEvents` limita as faixas visíveis por semana: padrão 3, zero oculta todas, `false` mostra todas. Barras de vários dias preservam a mesma faixa; por isso um dia pode ter menos eventos visíveis que o limite. O botão informa quantas ocorrências daquele dia estão ocultas.

```tsx
<Calendar events={events}
  options={{pxPerMinute:1.5, timeLabelInterval:60, monthMaxEvents:3}}
  renderMonthMore={({dateISO, occurrences, close, openView}) => (
    <MinhaLista date={dateISO} events={occurrences}
      onClose={close} onOpenDay={() => openView('day')} />
  )} />
```

Sem `renderMonthMore`, o conteúdo padrão aparece em popover com posicionamento e gestão de foco do Floating UI. `options.monthMoreView: 'day'` abre diretamente a view registrada na data escolhida. Para um componente externo, use `onMonthMoreClick={info => { abrirPainel(info); return false; }}`: retornar false cancela a abertura interna. `MonthMoreInfo` fornece data, todas as ocorrências, ocorrências ocultas, âncora e funções close/openView.

Nas grades de semana/N dias e recursos, cabeçalho, dia inteiro e eventos compartilham uma rolagem horizontal. Containers até 640 px mantêm piso de 104 px por dia e 140 px por recurso. A barra aparece somente quando as colunas não cabem. Os tokens CSS `--mc-day-min-width` e `--mc-resource-min-width` permitem aumentar o piso.

## Capacidade global e por recurso

```tsx
<Calendar
  options={{defaultResourceCapacity: 4}}
  resources={[
    {id:'triagem', title:'Triagem'},             // herda 4
    {id:'consulta', title:'Consulta', capacity:1},
    {id:'coletas', title:'Coletas', capacity:false} // sem limite
  ]}
/>
```

`capacity: undefined` herda `options.defaultResourceCapacity`; `false` representa ilimitado. O padrão global também aceita `false`; omitido mantém 1. Um número próprio continua prevalecendo mesmo quando o global é ilimitado. A mesma capacidade efetiva é usada na avaliação de movimentos/criação e na indicação visual de lotação. Eventos de dia inteiro também contam na concorrência. Buffers estendem a ocupação de cada atendimento; não impõem capacidade 1. Sem limite, não há recusa por concorrência/buffer, mas expediente e bloqueios continuam sendo avaliados.

## Densidade, conteúdo e edição

Nas grades verticais de Dia/Semana/N dias/Recursos:

```tsx
<Calendar options={{
  timedEventOverflow:'more', // 'shrink' (padrão), 'scroll' ou 'more'
  eventMaxStack:3,
  minEventWidth:110,
  // eventMoreView:'day', // navega em vez de abrir o popover
}} />
```

`scroll` amplia colunas conforme a concorrência visual e a largura mínima. `more` reserva uma faixa para as ocorrências excedentes de cada grupo conectado. `renderEventMore` personaliza o conteúdo do popover; `onEventMoreClick` permite substituir sua abertura retornando false, como no mês. A timeline horizontal empilha eventos em linhas e também aceita more para agrupar o excesso por intervalo.

O popover padrão permite iniciar arraste de um evento para a grade. Conteúdo personalizado precisa preservar o contrato de atributos de interação ou oferecer edição própria. O editor permanece a alternativa de teclado/toque.

`event.color` controla o destaque lateral. Fundo/texto padrão são os tokens `--mc-color-event-bg` / `--mc-color-event-fg`; `renderEvent` troca o conteúdo React. Cor não representa bloqueio ou capacidade. As prévias de drag/resize ocultam a origem durante o gesto e mostram o título. Alças no início/fim só aparecem quando a extremidade real está visível.

`options.allowEventTypeChange: true` permite converter por arraste entre faixa de dia inteiro e grade de horários. Padrão false preserva o tipo. Timed→allDay arredonda duração para dias completos (mínimo um); allDay→timed preserva a quantidade de dias com início no horário alvo. Mudar a view ou mover no mês preserva tipo e relógio; não é uma conversão de evento.

## Decoração visual por dia

```tsx
<Calendar getDayStyle={({dateISO,resourceId}) =>
  dateISO==='2026-10-09'
    ? {backgroundColor:'#fff7ed', color:'#9a3412'}
    : undefined
} />
```

`getDayStyle` recebe `dateISO`, `viewName` e recurso quando aplicável. Decora mês, grade vertical, recursos, timeline e agenda sem mudar disponibilidade. Use-o para feriados, campanhas, status ou ocupação; constraints continuam sendo a API de bloqueio. Evite propriedades de geometria (posição, altura, largura) na decoração.


Os rótulos respeitam uma distância mínima de 60 px na timeline horizontal e 24 px nas grades verticais. Somente o modo automático adapta a frequência; um `timeLabelInterval` explícito é respeitado exatamente; isso não altera `slotMinutes` nem o snapping. A escala `pxPerMinute` usa pixels CSS: compacto 1 e amplo 2 dobram a largura temporal na timeline (e a altura nas grades verticais), sem alterar a altura das salas. Use `rem` em fontes e espaçamentos de interface; para derivar a escala de `rem`, converta a medida para pixels CSS efetivos antes de passar a opção.


### Contrato de eixo temporal e comparação

- FullCalendar separa slotDuration, slotHeaderInterval (slotLabelInterval em versões anteriores) e slotMinWidth: https://fullcalendar.io/docs/slotDuration , https://fullcalendar.io/docs/slotHeaderInterval , https://fullcalendar.io/docs/slotMinWidth .
- DayPilot configura a altura da célula em cellHeight: https://doc.daypilot.org/calendar/cell-height/ .
- Bryntum separa tickSize, timeResolution e headers do viewPreset: https://bryntum.com/products/scheduler-next/docs/guide/Scheduler/whats-new/api/Scheduler/view/Scheduler .
- Schedule-X usa weekOptions.gridHeight e gridStep: https://schedule-x.dev/docs/calendar/configuration . Não tem o mesmo contrato completo de nomes do FullCalendar.

Aqui, slotMinutes é o intervalo das células (e atualmente também o snapping), pxPerMinute define a escala e timeLabelInterval controla somente os textos. Exemplo: slotMinutes:30, pxPerMinute:2, timeLabelInterval:60 cria slots de 60px com rótulos separados por 120px. Intervalos explícitos nunca mudam ao trocar a escala; somente undefined (Automático) adapta os rótulos. Configurações explícitas muito densas podem produzir colisão de texto: aumente a escala ou escolha intervalo maior.


### Playground: controles independentes

Duração do slot configura slotMinutes (15/30/60 min); Tamanho do slot configura30/45/60px por divisão. A escala passada ao calendário é tamanhoEmPixels/slotMinutes. Intervalo dos rótulos configura timeLabelInterval (15/30/60min ou automático). Os valores efetivos aparecem abaixo dos controles. Mudar a duração mantém o tamanho visual escolhido por divisão; não altera o intervalo explícito dos textos.

### Formulário de recorrência

CalendarEventEditor expõe campos da frequência escolhida ao editar a série: intervalo, dias da semana, dia do mês (incluindo -1 para o último), mês anual e fim por quantidade ou data. Nos escopos ocorrência/seguintes, esses controles não alteram a regra da série. Editar apenas título conserva a RRULE original; campos avançados não editados são preservados. O formulário valida formato e limites; avaliar disponibilidade de todas as ocorrências futuras e persistir a série são responsabilidades do aplicativo.

### Prévia do gesto

O cartão do rascunho exibe o intervalo candidato atualizado e o título. Em eventos que atravessam dias, inclui as datas do intervalo completo; em dia inteiro, mostra as datas ocupadas com o fim exclusivo convertido para o último dia visível. Essa apresentação não confirma a alteração antes do fim do gesto.

### Rótulos em escalas horizontais compactas

Um intervalo explícito de rótulos é preservado mesmo quando a distância é curta. A timeline distribui textos em linhas alternadas para evitar colisões: 60 minutos em 30 px com rótulos a cada 30 minutos usa quatro linhas; 30 minutos em 30 px com rótulos a cada 30 minutos usa duas. O modo automático pode reduzir a frequência. Isso não modifica duração dos slots nem horários dos eventos.
