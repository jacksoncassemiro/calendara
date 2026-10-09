/// <reference types="vite/client" />
import type { CalendarOptions } from '@jacksoncassemiro/calendara';
import summarySource from './Summary.tsx?raw';

export type DemoDefinition = {
  id: string;
  title: [string, string];
  code: string;
  view: string;
  options?: Partial<CalendarOptions>;
  description?: [string, string];
};

export const demos: DemoDefinition[] = [
  {
    id: 'editor-language',
    title: ['Traduções próprias do editor', 'Custom editor translations'],
    description: [
      'Dicionário parcial em espanhol com fallback EN/PT e datas pelo locale.',
      'Partial Spanish dictionary with EN/PT fallback and locale-formatted dates.',
    ],
    view: 'day',
    code: `<CalendarEventEditor event={editing.event} locale="es-ES"
  messages={{ title: 'Título de la cita', start: 'Inicio', end: 'Fin', saveEvent: 'Guardar', cancel: 'Cancelar', saveFailed: 'No se pudo guardar' }}
  onCancel={() => setEditing(undefined)}
  onSave={candidate => {
    setEvents(current => current.map(item => item.id === editing.masterId ? candidate : item));
    setEditing(undefined);
  }} />`,
  },
  {
    id: 'history',
    title: ['Desfazer e refazer alterações', 'Undo and redo changes'],
    description: [
      'Histórico limitado, rejeição de gravação e recarga externa controlados pelo consumidor.',
      'Bounded history, rejected saves and external reloads controlled by the consumer.',
    ],
    view: 'day',
    code: `const history = useCalendarHistory({
  initialEvents: seedEvents('history'), limit: 20,
  persist: async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (reject) throw new Error('Save rejected / Gravação recusada');
  },
});
const commit = async (change: EventChange) => {
  const accepted = await history.commit(applyEventTimeChange({ events: history.events, change }));
  if (!accepted) return false;
};
<button disabled={!history.canUndo} onClick={() => history.undo().catch(error => setStatus(String(error)))}>Undo / Desfazer</button>
<button disabled={!history.canRedo} onClick={() => history.redo().catch(error => setStatus(String(error)))}>Redo / Refazer</button>
<Calendar views={[dayView]} initialDate="2026-10-07" events={history.events}
  onEventDrop={commit} onEventResize={commit} options={{ timeZone: 'UTC' }} />`,
  },
  {
    id: 'ics',
    title: ['Importar e exportar ICS', 'Import and export ICS'],
    description: [
      'Cole VEVENTs, confira diagnósticos e exporte os eventos atuais para um arquivo ICS.',
      'Paste VEVENTs, inspect diagnostics and export current events to an ICS file.',
    ],
    view: 'week',
    code: `async function importText() {
  const temporal = await ensureTemporal();
  const result = importICalendar({ text: icsText, calendarId: 'example', temporal });
  setEvents(result.events);
  setStatus(JSON.stringify(result.diagnostics, null, 2));
}
async function exportText() {
  const temporal = await ensureTemporal();
  const result = exportICalendar({ events, temporal, timestamp: new Date().toISOString() });
  setIcsText(result.text);
  setStatus(JSON.stringify(result.diagnostics, null, 2));
}
<textarea value={icsText} onChange={event => setIcsText(event.target.value)} />
<button onClick={() => importText().catch(error => setStatus(String(error)))}>Import / Importar</button>
<button onClick={() => exportText().catch(error => setStatus(String(error)))}>Export / Exportar</button>
<Calendar views={[weekView]} initialDate="2026-10-07" events={events} options={{ timeZone: 'UTC' }} />`,
  },
  {
    id: 'timeline-tree',
    title: ['Hierarquia, virtualização e RTL', 'Hierarchy, virtualization and RTL'],
    description: [
      'Árvore de recursos com recolhimento, janela vertical de 360 px e direção configurável.',
      'Collapsible resource tree, a 360 px vertical window and configurable reading direction.',
    ],
    view: 'timeline-tree',
    code: `const treeResources = [
  { id: 'site', title: 'Building / Prédio' },
  ...Array.from({ length: 120 }, (_, index) => ({
    id: index === 0 ? 'room' : 'room-' + index,
    title: 'Room / Sala ' + (index + 1), parentId: 'site', capacity: 2,
  })),
];
const tree = createResourceTimelineView({ name: 'timeline-tree', duration: 'week',
  hierarchy: true, virtualization: { height: 360, overscan: 3 }, dayWidth: 180 });
<Calendar views={[tree]} initialDate="2026-10-07" resources={treeResources} events={events}
  options={{ direction: rtl ? 'rtl' : 'ltr', timeZone: 'UTC' }} />`,
  },
  {
    id: 'week',
    title: ['Semana, dia e slots', 'Week, day and slots'],
    description: [
      'Slots, snapping e rótulos independentes; navegue entre semana e dia.',
      'Independent slots, snapping and labels; navigate between week and day.',
    ],
    view: 'week',
    code: '<Calendar views={[weekView, dayView]} initialView="week" options={{ slotMinutes: 30, pxPerMinute: 1.5, timeLabelInterval: 60 }} />',
  },
  {
    id: 'month',
    title: ['Mês e responsividade', 'Month and responsiveness'],
    description: [
      'Eventos entre dias, +mais e indicadores compactos opcionais.',
      'Multi-day events, overflow and optional compact indicators.',
    ],
    view: 'month',
    code: '<Calendar views={[monthView, dayView]} initialView="month" options={{ monthCompactBreakpoint: indicators ? 480 : false, monthMaxEvents: 2 }} />',
    options: { monthMaxEvents: 2, monthCompactBreakpoint: 480 },
  },
  {
    id: 'list',
    title: ['Agenda por data', 'Date-grouped agenda'],
    description: [
      'Lista cronológica por data com acesso ao editor de eventos.',
      'Chronological date-grouped list with access to event editing.',
    ],
    view: 'list',
    code: '<Calendar views={[listView]} events={events} onEventClick={openEditor} />',
  },
  {
    id: 'resources',
    title: ['Capacidade e salas', 'Capacity and rooms'],
    description: [
      'Salas com capacidade limitada ou ilimitada e bloqueios de horário.',
      'Rooms with bounded or unlimited capacity and blocked time ranges.',
    ],
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
    description: [
      'Horários na horizontal e recursos na vertical com escala configurável.',
      'Horizontal time and vertical resources with a configurable scale.',
    ],
    view: 'timeline',
    code: '<Calendar views={[createTimelineView()]} resources={resources} options={{ slotMinutes: 30, pxPerMinute: 1.5, timeLabelInterval: 60 }} />',
  },
  {
    id: 'persistence',
    title: ['Persistir ou rejeitar gestos', 'Persist or reject gestures'],
    description: [
      'Arraste ou redimensione e compare gravação aceita com rollback.',
      'Drag or resize and compare accepted persistence with rollback.',
    ],
    view: 'day',
    code: 'async function commit(change) {\n  if (reject) return false;\n  setEvents(current => applyEventTimeChange({ events: current, change }));\n}\n<Calendar views={[dayView]} events={events} onEventDrop={commit} onEventResize={commit} />',
  },
  {
    id: 'recurrence',
    title: ['Recorrência e editor', 'Recurrence and editor'],
    description: [
      'Inspecione mestres recorrentes e abra o fluxo de edição por escopo.',
      'Inspect recurring masters and open the edit-by-scope workflow.',
    ],
    view: 'week',
    code: 'const event = { ...appointment, recurrence: { rule: "FREQ=DAILY;COUNT=5" } };\n// The application opens CalendarEventEditor from onEventClick.',
  },
  {
    id: 'external-drag',
    title: ['Arrasto entre áreas', 'Drag between areas'],
    description: [
      'Insira modelos e transfira eventos entre agenda e área externa.',
      'Insert templates and transfer events between the calendar and an outside area.',
    ],
    view: 'day',
    code: 'const draggable = useCalendarDraggable(template);\n<button {...draggable}>Template</button>\n<Calendar views={[dayView]} onExternalEventDrop={({ event }) => setEvents(current => [...current, event])} onEventDropOutside={archiveOccurrence} />',
  },
  {
    id: 'overflow',
    title: ['Sobreposição e +mais', 'Overlap and +more'],
    description: [
      'Sobreposição parcial, limite de pilhas e acesso aos eventos ocultos.',
      'Partial overlap, stack limits and access to hidden events.',
    ],
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
    description: [
      'Resumo do exemplo integrado à navegação por createReactView.',
      'Example summary integrated with navigation through createReactView.',
    ],
    view: 'summary',
    code: `${summarySource}\nconst summary = createReactView({ name: "summary", label: "Summary" }, Summary);\n<Calendar views={[summary]} initialView="summary" />`,
  },
  {
    id: 'custom-render',
    title: ['Conteúdo do evento', 'Event content'],
    description: [
      'Troque o conteúdo do evento preservando sua geometria e interação.',
      'Replace event content while retaining its geometry and interaction.',
    ],
    view: 'day',
    code: '<Calendar views={[dayView]} renderEvent={({ event, timeLabel }) => <strong>{timeLabel} · {event.title}</strong>} />',
  },
  {
    id: 'custom-toolbar',
    title: ['Navegação própria', 'Custom navigation'],
    description: [
      'Renderize seus controles com título e ações do calendário.',
      'Render your controls with the calendar title and actions.',
    ],
    view: 'day',
    code: '<Calendar views={[dayView]} customToolbar={({ title, goPrev, goNext }) => <nav><button onClick={goPrev}>←</button><strong>{title}</strong><button onClick={goNext}>→</button></nav>} />',
  },
  {
    id: 'day-style',
    title: ['Fundo do dia sem bloqueio', 'Day background without blocking'],
    description: [
      'Aplique estados visuais por data sem alterar as restrições.',
      'Apply visual date states without changing restrictions.',
    ],
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
    description: [
      'Valide o candidato e salve pelo formulário da aplicação.',
      'Validate the candidate and save through your application form.',
    ],
    view: 'day',
    code: '<Calendar views={[dayView]} onEventClick={setEditing} />\n// Render your own form outside Calendar; validate before persisting:\nconst result = api.evaluateEvent(candidate, editing);\nif (result.valid) setEvents(current => current.map(event => event.id === candidate.id ? candidate : event));',
  },
  {
    id: 'source',
    title: ['Fonte assíncrona', 'Async event source'],
    description: [
      'Carga simulada com sinal de abort, status e tratamento de erro.',
      'Simulated loading with an abort signal, status and error handling.',
    ],
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
    description: [
      'Crie uma grade de três dias com navegação correspondente.',
      'Create a three-day grid with matching navigation.',
    ],
    view: 'three-days',
    code: 'const threeDays = createNDaysView(3, "three-days");\n<Calendar views={[threeDays]} initialView="three-days" />',
  },
  {
    id: 'resource-week',
    title: ['Recursos por semana', 'Resources across a week'],
    description: [
      'Colunas agrupadas por recurso para acompanhar a semana.',
      'Resource-grouped columns for planning across the week.',
    ],
    view: 'resource-week',
    code: `const resourceWeek = createResourceView({ days: 7, alignment: 'week', groupBy: 'resource', name: 'resource-week' });
<Calendar views={[resourceWeek]} initialView="resource-week" initialDate="2026-10-07" resources={rooms} events={events} options={demoOptions} />`,
  },
  {
    id: 'timeline-week',
    title: ['Timeline semanal e grupos', 'Weekly timeline and groups'],
    description: [
      'Faixas por data com grupos de recursos recolhíveis.',
      'Dated tracks with collapsible resource groups.',
    ],
    view: 'timeline-week',
    code: `const timelineWeek = createResourceTimelineView({ duration: 'week', name: 'timeline-week', groupBy: (resource) => resource.id === 'room' ? 'Rooms / Salas' : 'Open / Livre' });
<Calendar views={[timelineWeek]} initialView="timeline-week" initialDate="2026-10-07" resources={rooms} events={events} options={demoOptions} />`,
  },
  {
    id: 'timeline-month',
    title: ['Timeline mensal e grupos', 'Monthly timeline and groups'],
    description: [
      'Planeje o mês em faixas horizontais com grupos recolhíveis.',
      'Plan the month on horizontal tracks with collapsible groups.',
    ],
    view: 'timeline-month',
    code: `const timelineMonth = createResourceTimelineView({ duration: 'month', name: 'timeline-month', groupBy: (resource) => resource.id === 'room' ? 'Rooms / Salas' : 'Open / Livre' });
<Calendar views={[timelineMonth]} initialView="timeline-month" initialDate="2026-10-07" resources={rooms} events={events} options={demoOptions} />`,
  },
  {
    id: 'year',
    title: ['Ano em meses', 'Year in month panels'],
    description: [
      'Painéis mensais com eventos e ações de overflow.',
      'Month panels with events and overflow actions.',
    ],
    view: 'year',
    code: '<Calendar views={[yearView]} initialView="year" initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
  {
    id: 'quarter',
    title: ['Trimestre', 'Quarter'],
    description: [
      'Três meses alinhados ao trimestre e navegação por trimestre.',
      'Three quarter-aligned months and quarter navigation.',
    ],
    view: 'quarter',
    code: '<Calendar views={[quarterView]} initialView="quarter" initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
  {
    id: 'year-planner',
    title: ['Planejamento anual', 'Year planner'],
    description: [
      'Datas do ano com indicadores e navegação por teclado.',
      'Annual dates with indicators and keyboard navigation.',
    ],
    view: 'year-planner',
    code: '<Calendar views={[yearPlannerView]} initialView="year-planner" initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
  {
    id: 'day-agenda',
    title: ['Agenda do dia', 'Day agenda'],
    description: [
      'Eventos em ordem de horário com resumo dos recursos.',
      'Time-ordered events with resource summaries.',
    ],
    view: 'day-agenda',
    code: '<Calendar views={[dayAgendaView]} initialView="day-agenda" initialDate="2026-10-07" events={events} resources={rooms} options={demoOptions} />',
  },
  {
    id: 'print',
    title: ['Impressão e PDF', 'Printing and PDF'],
    description: [
      'Documento isolado e salvar como PDF pelo navegador.',
      'Isolated document and browser Save as PDF.',
    ],
    view: 'week',
    code: '<button onClick={() => api.print({ title: "Calendar / Agenda", orientation: "landscape" })}>Print / Imprimir</button>\n<Calendar apiRef={apiRef} views={[weekView]} initialDate="2026-10-07" events={events} options={demoOptions} />',
  },
];
