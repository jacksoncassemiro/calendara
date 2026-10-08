import type { CalendarOptions } from '@jacksoncassemiro/calendara';

export type DemoDefinition = {
  id: string;
  title: [string, string];
  code: string;
  view: string;
  options?: Partial<CalendarOptions>;
};

export const demos: DemoDefinition[] = [
  {
    id: 'week',
    title: ['Semana, dia e slots', 'Week, day and slots'],
    view: 'week',
    code: '<Calendar views={[weekView, dayView]} options={{ slotMinutes: 30, pxPerMinute: 2, timeLabelInterval: 60 }} />',
  },
  {
    id: 'month',
    title: ['Mês e responsividade', 'Month and responsiveness'],
    view: 'month',
    code: '<Calendar views={[monthView, dayView]} options={{ monthCompactBreakpoint: 480, monthMaxEvents: 2 }} />',
    options: { monthMaxEvents: 2, monthCompactBreakpoint: 480 },
  },
  {
    id: 'list',
    title: ['Agenda por data', 'Date-grouped agenda'],
    view: 'list',
    code: '<Calendar views={[listView]} events={events} onEventClick={openEditor} />',
  },
  {
    id: 'resources',
    title: ['Capacidade e salas', 'Capacity and rooms'],
    view: 'resources',
    code: 'const resources = [{ id: "room", title: "Room", capacity: 2 }, { id: "open", title: "Open", capacity: false }];\n<Calendar resources={resources} views={[createResourceDayView()]} options={{ defaultResourceCapacity: 1 }} />',
  },
  {
    id: 'timeline',
    title: ['Timeline horizontal', 'Horizontal timeline'],
    view: 'timeline',
    code: '<Calendar views={[createTimelineView()]} resources={resources} options={{ slotMinutes: 30, pxPerMinute: 2, timeLabelInterval: 60 }} />',
  },
  {
    id: 'persistence',
    title: ['Persistir ou rejeitar gestos', 'Persist or reject gestures'],
    view: 'day',
    code: 'async function commit(change) {\n  if (reject) return false;\n  setEvents(current => applyEventTimeChange(current, change));\n}\n<Calendar views={[dayView]} events={events} onEventDrop={commit} onEventResize={commit} />',
  },
  {
    id: 'recurrence',
    title: ['Recorrência e editor', 'Recurrence and editor'],
    view: 'week',
    code: 'const event = { ...appointment, recurrence: { rule: "FREQ=DAILY;COUNT=5" } };\n// The application opens CalendarEventEditor from onEventClick.',
  },
  {
    id: 'external-drag',
    title: ['Arrasto entre áreas', 'Drag between areas'],
    view: 'day',
    code: 'const draggable = useCalendarDraggable(template);\n<button {...draggable}>Template</button>\n<Calendar views={[dayView]} onExternalEventDrop={({ event }) => setEvents(current => [...current, event])} onEventDropOutside={archiveOccurrence} />',
  },
  {
    id: 'overflow',
    title: ['Sobreposição e +mais', 'Overlap and +more'],
    view: 'day',
    code: '<Calendar views={[dayView]} options={{ slotEventOverlap: true, timedEventOverflow: "more", eventMaxStack: 2, defaultResourceCapacity: false }} />',
    options: {
      slotEventOverlap: true,
      timedEventOverflow: 'more',
      eventMaxStack: 2,
      defaultResourceCapacity: false,
    },
  },
  {
    id: 'custom-view',
    title: ['Sua própria view', 'Your own view'],
    view: 'summary',
    code: 'function Summary(context) {\n  return <p>{context.occurrences.length} occurrences</p>;\n}\nconst summary = createReactView({ name: "summary", label: "Summary" }, Summary);\n<Calendar views={[summary, dayView]} />',
  },
  {
    id: 'custom-render',
    title: ['Conteúdo do evento', 'Event content'],
    view: 'day',
    code: '<Calendar views={[dayView]} renderEvent={({ event, timeLabel }) => <strong>{timeLabel} · {event.title}</strong>} />',
  },
  {
    id: 'custom-toolbar',
    title: ['Navegação própria', 'Custom navigation'],
    view: 'day',
    code: '<Calendar views={[dayView]} customToolbar={({ title, goPrev, goNext }) => <nav><button onClick={goPrev}>←</button><strong>{title}</strong><button onClick={goNext}>→</button></nav>} />',
  },
  {
    id: 'day-style',
    title: ['Fundo do dia sem bloqueio', 'Day background without blocking'],
    view: 'week',
    code: '<Calendar views={[weekView]} getDayStyle={({ dateISO }) => dateISO === "2026-10-08" ? { backgroundColor: "#d8efe3" } : undefined} />',
  },
  {
    id: 'custom-editor',
    title: ['Formulário do consumidor', 'Consumer-owned form'],
    view: 'day',
    code: '<Calendar views={[dayView]} onEventClick={setEditing} />\n// Render your own form outside Calendar; validate before persisting:\nconst result = api.evaluateEvent(candidate, editing);\nif (result.valid) setEvents(current => current.map(event => event.id === candidate.id ? candidate : event));',
  },
  {
    id: 'source',
    title: ['Fonte assíncrona', 'Async event source'],
    view: 'week',
    code: '<Calendar views={[weekView]} eventSource={async (range, { signal }) => {\n  const response = await fetch(`/events?from=${range.start}&to=${range.end}`, { signal });\n  if (!response.ok) throw new Error("Request failed");\n  return response.json();\n}} onLoadingChange={setLoading} onError={setError} />',
  },
  {
    id: 'period',
    title: ['Período personalizado', 'Custom period'],
    view: 'three-days',
    code: 'const threeDays = createNDaysView(3, "three-days");\n<Calendar views={[threeDays]} initialView="three-days" />',
  },
];
