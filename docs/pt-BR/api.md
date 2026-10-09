# Guia da API

[English](../en/api.md) · [Documentação](README.md)

## Views e navegação

```tsx
import {
  Calendar,
  dayView,
  monthView,
  createResourceDayView,
  createTimelineView,
  useCalendar,
} from '@jacksoncassemiro/calendara';

const views = [dayView, monthView, createResourceDayView(), createTimelineView()];

function Agenda() {
  const { ref, api } = useCalendar();
  return (
    <>
      <button onClick={() => api.today()}>Hoje</button>
      <Calendar
        apiRef={ref}
        views={views}
        initialView="resources"
        initialDate="2026-10-08"
        options={{ timeZone: 'America/Sao_Paulo' }}
      />
    </>
  );
}
```

Mantenha definições fora do render ou memoizadas. `views` é obrigatória e define o conjunto completo, sem lista vazia ou nomes repetidos. Passe `BUILTIN_VIEWS` para semana/dia/mês/agenda, ou importe somente as definições necessárias. `createNDaysView(3)` adiciona três dias. `createReactView` recebe componente React, funções de período e navegação.

`initialView`/`initialDate` configuram somente a montagem. `view`/`date` solicitam navegação quando o valor muda; não são estado controlled estrito. A navegação da toolbar permanece em rerenders com o mesmo valor. Observe `onViewChange`, `onDateChange`, `onRangeChange` ou consulte `api.getState()`. Sem data explícita, usa hoje no fuso configurado.

## Eventos e persistência

Eventos exigem `id`, `calendarId`, `title` e `time`. Limites timed usam `dateTime` ISO local e `timeZone` IANA; dia inteiro usa `date` ISO. O fim é exclusivo: um evento de dia inteiro em 8 de outubro termina em 9 de outubro.

```tsx
import { useState } from 'react';
import { Calendar, applyEventTimeChange, type EventChange } from '@jacksoncassemiro/calendara';

function Agenda() {
  const [events, setEvents] = useState(initialEvents);

  async function commit(change: EventChange) {
    await persistChange(change);
    setEvents((current) => applyEventTimeChange(current, change));
  }

  return <Calendar views={views} events={events} onEventDrop={commit} onEventResize={commit} />;
}
```

`initialEvents` e `persistChange` pertencem à aplicação. Gestos são otimistas; retornar `false` ou rejeitar a Promise reverte o candidato interno. `applyEventTimeChange` atualiza estado imutável e registra override da ocorrência recorrente. Persista esse resultado ou implemente comportamento equivalente no servidor. Não altere coleções de props diretamente. A biblioteca não grava no servidor.

Para dados remotos, mantenha a fonte estável:

```tsx
<Calendar
  views={views}
  eventSource={async ({ start, end }, { signal }) => {
    const response = await fetch(`/api/events?start=${start}&end=${end}`, { signal });
    if (!response.ok) throw new Error('Falha ao buscar eventos');
    return response.json();
  }}
  onError={handleError}
  onLoadingChange={setLoading}
/>
```

Os limites do período visível são inclusivos. Navegação/troca de fonte/desmontagem cancelam pedidos antigos; repasse `signal` ao cliente HTTP. Resultados obsoletos são descartados mesmo se a fonte ignorar o sinal. Prefira `events` React ou `eventSource` como fonte de verdade: respostas remotas substituem os eventos carregados. Após edição remota, persista e execute `api.refetch()`. Trate carregamento/erros na aplicação.

## Recursos e disponibilidade

```tsx
import type { CalendarResource, ConstraintSet } from '@jacksoncassemiro/calendara';

const resources: CalendarResource[] = [
  { id: 'triagem', title: 'Triagem' },
  { id: 'consulta', title: 'Consulta', capacity: 1, bufferAfter: 15 },
  { id: 'coleta', title: 'Coleta', capacity: false },
];
const constraints: ConstraintSet = {
  businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
  blocked: [{ scope: 'day', date: '2026-10-12', description: 'Fechado' }],
};

<Calendar
  views={views}
  resources={resources}
  constraints={constraints}
  options={{ defaultResourceCapacity: 3 }}
/>;
```

`event.resourceIds` reserva salas/equipamentos/profissionais juntos. Capacidade ausente herda o default global (1 quando omitido); `false` é ilimitado. Número local substitui o default. Buffers são minutos antes/depois da ocupação. `constraints` do recurso adiciona regras: disponibilidade intersecta a global e bloqueios se somam. `businessHours` legado do recurso também participa dessa composição. Todos os recursos atribuídos são avaliados. O servidor deve garantir a capacidade em transações concorrentes.

## Formulário e conteúdo próprios

`Calendar` não monta nem abre `CalendarEventEditor`. Abra modal/drawer/rota própria por `onEventClick`, `onDateSelect` ou pelo aplicativo. Valide com `api.evaluateEvent(draft, originalOccurrence?)`; na edição, passe a ocorrência original para excluir sua reserva. A avaliação cobre intervalo/recursos do candidato, não todas as repetições futuras, e lança erro antes do motor ficar pronto. Persista, atualize estado e feche o formulário.

O editor opcional aceita `event`, `occurrence`, `resources`, `timeZone`, `locale`, `validate`, `onSave`, `onDelete` e `onCancel`. Use `key={occurrenceKey(occurrence)}` ao trocar de ocorrência editada. Os callbacks definem persistência e escopo recorrente. Defina `locale="en-US"` ou `locale="pt-BR"` no editor padrão; o padrão é português. Formulários próprios controlam suas traduções.

`renderEvent={info => <MeuEvento {...info} />}` troca o conteúdo mantendo geometria. Hooks ficam dentro de `MeuEvento`, nunca diretamente no callback. `customToolbar` substitui a navegação. `renderMonthMore`/`renderEventMore` personalizam ver mais; callbacks de clique correspondentes podem retornar `false` e abrir componente próprio. `monthMoreView`/`eventMoreView` direcionam para outra view registrada.

## Interação e layout

```tsx
<Calendar
  views={views}
  options={{
    slotMinutes: 30,
    pxPerMinute: 2,
    timeLabelInterval: 60,
    timedEventOverflow: 'more',
    eventMaxStack: 3,
    slotEventOverlap: false,
    monthMaxEvents: 3,
    monthCompactBreakpoint: 480,
  }}
/>
```

`slotMinutes` controla células e snapping; `pxPerMinute`, a escala temporal; `timeLabelInterval`, somente os textos. Intervalo explícito é preservado até em escalas densas. O automático adapta os textos quando omitido. Overflow timed aceita `shrink`, `scroll` ou `more`; a timeline horizontal empilha linhas. `slotEventOverlap` habilita sobreposição parcial nas grades verticais. `allowEventTypeChange` converte opcionalmente timed/dia inteiro entre suas faixas. Consulte `CalendarOptions` para todos os defaults.

A página controla o scroll vertical; grades largas podem rolar horizontalmente. O mês compacto oferece lista do dia selecionado. Toolbar e ativação de horários por teclado atendem layouts estreitos; ofereça formulário/ação para mover e redimensionar por teclado/toque. Não considere toque físico validado automaticamente.

Cartões externos usam `useCalendarDraggable(event)` na fonte do ponteiro e `onExternalEventDrop` para inserir/persistir o candidato validado. `onEventDropOutside` habilita saída sem remoção automática. IDs devem ser únicos. Templates de entrada não podem ser recorrentes; materialize uma ocorrência escolhida. Escape cancela. Não há HTML DataTransfer entre documentos ou transferência automática entre calendários.

## Recorrência

O mês mantém cartões e +mais em qualquer largura por padrão (`monthCompactBreakpoint: false`). Habilite a lista do dia com um limite do contêiner, como 480 pixels CSS; a largura da janela não dispara essa troca. A toolbar tem seu próprio limite de 640px do contêiner. Media queries do editor e dos alvos de toque ainda podem depender da janela/dispositivo de entrada.

```ts
recurrence: {
  rule: { freq: 'WEEKLY', byDay: [{ weekday: 'MO' }, { weekday: 'WE' }], count: 12 },
  exDates: ['2026-10-12T09:00:00'],
}
```

Campos públicos: DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYMONTH, BYMONTHDAY, BYDAY, BYSETPOS, WKST e BYYEARDAY para YEARLY. `rDates` adiciona ocorrências; `exDates` exclui; overrides usam `originalStart` como chave. Exclusão date-only remove o dia; datetime remove o início original exato. O iterador civil gera datas da regra; Temporal injetada trata fusos e composição dos eventos. Temporal nativo tem prioridade, com fallback lazy `temporal-polyfill`. Horários locais inexistentes na recorrência não consomem COUNT.

`splitEventSeries` corta esta-e-seguintes numa ocorrência RRULE ativa. Corte RDATE-only, filtros incompatíveis, troca de fuso e conversão timed/dia inteiro são recusados. Persista os dois mestres atomicamente e defina janela de validação para séries infinitas. Expandir regra ilimitada diretamente exige janela finita.

## Tema

### Estado do dia e cabeçalhos a partir da API

Use estado do aplicativo para associar datas/recursos a situações. `getDayStyle` aplica cores ao cabeçalho e corpo do dia; `renderDayHeader` recebe `dateISO`, `viewName`, `resourceId` opcional, `isToday`, `isSelected` opcional e `defaultContent`. Preserve `defaultContent` ao adicionar legenda ou ícone para manter os controles padrão da data. Hooks ficam dentro de um componente retornado.

```tsx
<Calendar views={[weekView]} events={events}
  getDayStyle={({ dateISO }) => statuses[dateISO] ? {
    backgroundColor: `var(--status-${statuses[dateISO]}-bg)`,
    color: `var(--status-${statuses[dateISO]}-fg)`,
    '--mc-color-muted': `var(--status-${statuses[dateISO]}-fg)`,
    '--mc-color-btn-active-bg': `var(--status-${statuses[dateISO]}-fg)`,
  } : undefined}
  renderDayHeader={({ dateISO, defaultContent }) => <>
    {defaultContent}
    {statuses[dateISO] && <small>{statusLabels[statuses[dateISO]]}</small>}
  </>}
/>
```

Atualize `statuses` com a resposta da API usando estado do aplicativo; a biblioteca não busca nem classifica esses valores. Defina tokens de fundo/texto para claro e escuro com contraste legível. Uma decoração “cheio” ou “indisponível” é visual: use `constraints` ou capacidade do recurso para restringir agendamentos. O [exemplo focado](../../examples/features.html?demo=day-style) simula uma resposta assíncrona.

Deslizar por toque preserva o scroll nativo; segure aproximadamente 450 ms antes de arrastar um evento ou selecionar um intervalo. Grades de horários/timelines com transbordamento fornecem uma scrollbar horizontal superior sincronizada. Cartões do mês continuam como padrão em contêineres estreitos; indicadores opcionais usam `monthCompactBreakpoint`, medido pelo contêiner do calendário.

Importe o CSS da biblioteca; o CSS do playground é separado. Sobrescreva tokens após a importação:

```css
[data-mc-root] {
  --mc-color-event-bg: #eaf4e7;
  --mc-color-event-fg: #244d20;
  --mc-color-now: #b45309;
  --mc-font-family: system-ui, sans-serif;
}
```

`event.color` define o destaque, não disponibilidade. `getDayStyle` decora o dia sem bloqueá-lo; restrições usam constraints. Evite mudar geometria na decoração de cartões/dias. `options` substitui valores declarados sobre defaults; remover um campo restaura o default. `setOptions` imperativo aplica patch.

## Entradas nomeadas nos utilitários

Utilitários do núcleo aceitam entradas nomeadas quando vários valores formam uma operação:

```ts
import { expandRange } from '@jacksoncassemiro/calendara/core';

const occurrences = expandRange({
  temporal,
  events,
  startISO: '2026-10-01',
  endISO: '2026-10-31',
  displayTimeZone: 'America/Sao_Paulo',
});
```

Use a forma com entradas nomeadas nessas operações; as sobrecargas posicionais foram removidas. Conversões unárias e comparações binárias mantêm suas assinaturas usuais. Views próprias navegam com `navigate({ direction, date, context })`.

## Recursos e limites

React/React DOM 18 e 19 são peers; testes atuais de runtime usam React 19, com verificação de tipos React 18. SSR emite o container inicial. Não se promete RFC completo, virtualização/hierarquia de recursos, ICS, undo/redo, RTL ou API de impressão. Hooks de editor/slots adicionais nas specs são propostas. Browser automatizado usa Edge; validação física mobile/Safari e leitor de tela permanece pendente. Veja releases/specs para evidências da versão.
