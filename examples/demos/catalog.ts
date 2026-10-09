/// <reference types="vite/client" />
import type { CalendarOptions } from '@jacksoncassemiro/calendara';
import summarySource from './Summary.tsx?raw';

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
    code: '<Calendar views={[weekView, dayView]} initialView="week" options={{ slotMinutes: 30, pxPerMinute: 1.5, timeLabelInterval: 60 }} />',
  },
  {
    id: 'month',
    title: ['Mês e responsividade', 'Month and responsiveness'],
    view: 'month',
    code: '<Calendar views={[monthView, dayView]} initialView="month" options={{ monthCompactBreakpoint: indicators ? 480 : false, monthMaxEvents: 2 }} />',
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
    code: `const resources = [
  { id: "room", title: "Room / Sala", capacity: 2 },
  { id: "open", title: "Open / Livre", capacity: false },
];
<Calendar resources={resources} views={[createResourceDayView()]}
  constraints={{ blocked: [{ date: "2026-10-07", scope: "time", startTime: "12:00", endTime: "13:00" }] }}
/>`,
  },
  {
    id: 'timeline',
    title: ['Timeline horizontal', 'Horizontal timeline'],
    view: 'timeline',
    code: '<Calendar views={[createTimelineView()]} resources={resources} options={{ slotMinutes: 30, pxPerMinute: 1.5, timeLabelInterval: 60 }} />',
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
    code: `${summarySource}\nconst summary = createReactView({ name: "summary", label: "Summary" }, Summary);\n<Calendar views={[summary]} initialView="summary" />`,
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
    code: `const [dateStatuses, setDateStatuses] = useState({ "2026-10-08": "near" });
// Apply API data with setDateStatuses. PT: Aplica dados da API com setDateStatuses.
<Calendar views={[weekView]}
  getDayStyle={({ dateISO }) => {
    const status = dateStatuses[dateISO];
    return status ? {
      backgroundColor: "var(--demo-day-" + status + "-bg)",
      color: "var(--demo-day-" + status + "-fg)",
      "--mc-color-muted": "var(--demo-day-" + status + "-fg)",
      "--mc-color-btn-active-bg": "var(--demo-day-" + status + "-fg)",
    } : undefined;
  }}
  renderDayHeader={({ dateISO, defaultContent }) => <>
    {defaultContent}
    {dateStatuses[dateISO] && <small className="focused-day-status">
      {dateStatuses[dateISO] === "unavailable" && <span aria-hidden="true">⊘ </span>}
      {dateStatusLabels[dateStatuses[dateISO]]}
    </small>}
  </>}
/>`,
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
    code: `const simulatedSource = async (_range, { signal }) => {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 350);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
  return seedEvents("source");
};
<Calendar views={[weekView]} eventSource={simulatedSource}
  onLoadingChange={loading => setStatus(loading ? "Loading simulated source…" : "Simulated source loaded.")}
  onError={error => setStatus(String(error))}
/>`,
  },
  {
    id: 'period',
    title: ['Período personalizado', 'Custom period'],
    view: 'three-days',
    code: 'const threeDays = createNDaysView(3, "three-days");\n<Calendar views={[threeDays]} initialView="three-days" />',
  },
  {
    id: 'resource-week',
    title: ['Recursos por semana', 'Resources across a week'],
    view: 'resource-week',
    code: `const resourceWeek = createResourceView({ days: 7, alignment: 'week', groupBy: 'resource', name: 'resource-week' });
<Calendar views={[resourceWeek]} initialView="resource-week" initialDate="2026-10-07" resources={rooms} events={events} options={demoOptions} />`,
  },
  {
    id: 'timeline-week',
    title: ['Timeline semanal e grupos', 'Weekly timeline and groups'],
    view: 'timeline-week',
    code: `const timelineWeek = createResourceTimelineView({ duration: 'week', name: 'timeline-week', groupBy: (resource) => resource.id === 'room' ? 'Rooms / Salas' : 'Open / Livre' });
<Calendar views={[timelineWeek]} initialView="timeline-week" initialDate="2026-10-07" resources={rooms} events={events} options={demoOptions} />`,
  },
  {
    id: 'timeline-month',
    title: ['Timeline mensal e grupos', 'Monthly timeline and groups'],
    view: 'timeline-month',
    code: `const timelineMonth = createResourceTimelineView({ duration: 'month', name: 'timeline-month', groupBy: (resource) => resource.id === 'room' ? 'Rooms / Salas' : 'Open / Livre' });
<Calendar views={[timelineMonth]} initialView="timeline-month" initialDate="2026-10-07" resources={rooms} events={events} options={demoOptions} />`,
  },
  {
    id: 'year',
    title: ['Ano em meses', 'Year in month panels'],
    view: 'year',
    code: '<Calendar views={[yearView]} initialView="year" initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
  {
    id: 'quarter',
    title: ['Trimestre', 'Quarter'],
    view: 'quarter',
    code: '<Calendar views={[quarterView]} initialView="quarter" initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
  {
    id: 'year-planner',
    title: ['Planejamento anual', 'Year planner'],
    view: 'year-planner',
    code: '<Calendar views={[yearPlannerView]} initialView="year-planner" initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
  {
    id: 'day-agenda',
    title: ['Agenda do dia', 'Day agenda'],
    view: 'day-agenda',
    code: '<Calendar views={[dayAgendaView]} initialView="day-agenda" initialDate="2026-10-07" events={events} resources={rooms} options={demoOptions} />',
  },
  {
    id: 'print',
    title: ['Impressão e PDF', 'Printing and PDF'],
    view: 'week',
    code: '<button onClick={() => api.print({ title: "Calendar / Agenda", orientation: "landscape" })}>Print / Imprimir</button>\n<Calendar apiRef={apiRef} views={[weekView]} initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
];
