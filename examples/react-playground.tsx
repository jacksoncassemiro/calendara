/** @jsxImportSource react */
import { StrictMode, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Calendar, useCalendar, createReactView, useCompactCalendar, createResourceDayView, createTimelineView, createNDaysView, type ViewRenderContext } from '@meucalendario/calendar';
import { applyEventTimeChange, getTemporal, type CalendarEvent, type EventChange, type EventOccurrence } from '@meucalendario/calendar';
import '@meucalendario/calendar/styles.css';
import './react-playground.css';

const TZ = 'America/Sao_Paulo';
const REF = '2026-10-07';
const initialEvents: CalendarEvent[] = [
  { id: 'consulta', calendarId: 'agenda', title: 'Consulta inicial', resourceIds: ['sala-1'], color: '#2563eb', time: {
    allDay: false, start: { dateTime: `${REF}T09:00:00`, timeZone: TZ }, end: { dateTime: `${REF}T10:00:00`, timeZone: TZ },
  } },
  { id: 'retorno', calendarId: 'agenda', title: 'Retorno semanal', resourceIds: ['sala-2'], time: {
    allDay: false, start: { dateTime: `${REF}T11:00:00`, timeZone: TZ }, end: { dateTime: `${REF}T11:30:00`, timeZone: TZ },
  }, recurrence: { rule: 'FREQ=WEEKLY;COUNT=8' } },
  { id: 'congresso', calendarId: 'agenda', title: 'Congresso · 3 dias', time: {
    allDay: true, start: { date: '2026-10-06' }, end: { date: '2026-10-09' },
  } },
  { id: 'plantao', calendarId: 'agenda', title: 'Plantão noturno', resourceIds: ['sala-1'], time: {
    allDay: false, start: { dateTime: `${REF}T19:00:00`, timeZone: TZ }, end: { dateTime: '2026-10-08T09:00:00', timeZone: TZ },
  } },
];
const constraints = {
  businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '20:00' }],
  blocked: [{ scope: 'time' as const, date: REF, startTime: '12:00', endTime: '13:00', description: 'Almoço' }],
};
const options = { timeZone: TZ, startHour: 7, endHour: 21, locale: 'pt-BR', slotMinutes: 30 };
const resources = [{ id: 'sala-1', title: 'Sala 1', capacity: 1, bufferAfter: 15 }, { id: 'sala-2', title: 'Sala 2', capacity: 1 }];
function SummaryView(context: ViewRenderContext) {
  const [expanded, setExpanded] = useState(true);
  return <div className="demo-summary"><h2>Resumo do dia</h2><button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? 'Recolher eventos' : 'Mostrar eventos'}</button>
    {expanded && <ul>{context.occurrences.map(occurrence => <li key={`${occurrence.masterId}@${occurrence.originalStart}`}>
      <button type="button" onClick={() => context.onEventClick?.(occurrence)}>{occurrence.event.title}</button>
    </li>)}</ul>}
  </div>;
}
const views = [createResourceDayView(resources), createTimelineView(resources), createNDaysView(3), createReactView({ name: 'summary', label: 'Resumo' }, SummaryView)];

function App() {
  const { ref, api } = useCalendar();
  const { containerRef, compact } = useCompactCalendar();
  const [events, setEvents] = useState(initialEvents);
  const [rejectNext, setRejectNext] = useState(false);
  const [feedback, setFeedback] = useState('Selecione um horário livre ou abra um evento para editar.');
  const [editing, setEditing] = useState<EventOccurrence | null>(null);
  const [title, setTitle] = useState('');
  const [selection, setSelection] = useState<{ date: string; minute: number } | null>(null);
  const [mounted, setMounted] = useState(true);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(true);
  const [start, setStart] = useState(`${REF}T09:00`);
  const [end, setEnd] = useState(`${REF}T09:30`);
  const [allDay, setAllDay] = useState(false);
  const [editorResources, setEditorResources] = useState<string[]>([]);
  const [editorError, setEditorError] = useState('');
  const [visibleResource, setVisibleResource] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editing || selection) { if (!dialog.open) dialog.showModal(); }
    else if (dialog.open) dialog.close();
  }, [editing, selection]);
  const openEditor = (occurrence: EventOccurrence) => {
    setEditorResources([...(occurrence.event.resourceIds ?? [])]); setEditorError('');
    setEditing(occurrence); setTitle(occurrence.event.title); setAllDay(occurrence.event.time.allDay);
    setStart(occurrence.event.time.start.date ?? occurrence.event.time.start.dateTime!.slice(0, 16));
    setEnd(occurrence.event.time.end.date ?? occurrence.event.time.end.dateTime!.slice(0, 16));
  };
  const openCreate = (date: string, minute: number, endMinute = minute + 30, resourceId?: string) => {
    const Temporal = getTemporal();
    setEditorResources(resourceId ? [resourceId] : []); setEditorError('');
    const dayStart = Temporal.PlainDate.from(date).toPlainDateTime('00:00');
    setStart(dayStart.add({ minutes: minute }).toString().slice(0, 16));
    setEnd(dayStart.add({ minutes: endMinute }).toString().slice(0, 16));
    setSelection({ date, minute }); setTitle(''); setAllDay(false);
  };
  const commit = async (change: EventChange) => {
    if (rejectNext) {
      setRejectNext(false);
      setFeedback('Gravação recusada: o horário original foi restaurado.');
      return false;
    }
    setEvents(current => applyEventTimeChange(current, change));
    setFeedback('Horário atualizado nesta demonstração.');
    return true;
  };
  const closeEditor = () => { setEditing(null); setSelection(null); setTitle(''); };
  return <main>
    <header className="demo-header">
      <div><h1>Meu Calendário</h1><p>Agenda React · São Paulo</p></div>
      <button type="button" onClick={() => api.setDate(REF)}>Voltar ao exemplo</button>
    </header>
    <section className="demo-tools" aria-label="Controles da demonstração">
      <label><input type="checkbox" checked={rejectNext} onChange={event => setRejectNext(event.target.checked)} /> Recusar próxima gravação</label>
      <label><input type="checkbox" checked={businessHoursEnabled} onChange={event => setBusinessHoursEnabled(event.target.checked)} /> Limitar ao expediente</label>
      <label>Recurso visível<select value={visibleResource} onChange={event => setVisibleResource(event.target.value)}>
        <option value="">Todos os recursos</option>{resources.map(resource => <option key={resource.id} value={resource.id}>{resource.title}</option>)}
      </select></label>
      <button type="button" onClick={() => setMounted(value => !value)}>{mounted ? 'Desmontar calendário' : 'Montar calendário'}</button>
    </section>
    <p className="demo-feedback" role="status">{feedback}</p>
    <section ref={containerRef} className="demo-calendar" aria-label="Agenda">
      {mounted ? <Calendar apiRef={ref} date={REF} view={compact ? 'day' : 'week'} events={events} options={{ ...options, visibleResourceIds: visibleResource ? [visibleResource] : resources.map(resource => resource.id) }} constraints={businessHoursEnabled ? constraints : { blocked: constraints.blocked }} resources={resources} views={views}
        onEventDrop={commit} onEventResize={commit}
        onEventClick={openEditor}
        onDateClick={(date, minute = 9 * 60) => openCreate(date, minute)}
        onDateSelect={selection => openCreate(selection.dateISO, selection.startMin, selection.endMin, selection.resourceId)}
        onDropBlocked={info => setFeedback(`Movimento indisponível: ${info.reason}.`)}
        onClickBlocked={info => setFeedback(`Horário indisponível: ${info.reason}.`)}
      /> : <p>Calendário desmontado. Use “Montar calendário” para continuar.</p>}
    </section>
    <p className="demo-note">Os dados ficam em memória. Arraste ou redimensione eventos de um dia; use as visualizações Dia e Lista em telas pequenas.</p>
    <dialog ref={dialogRef} className="demo-editor" aria-labelledby="editor-title" onCancel={closeEditor}>
      <form onSubmit={event => {
        const Temporal = getTemporal();
        event.preventDefault();
        if (!title.trim()) return;
        if (!start || !end || end <= start) { setEditorError('O fim precisa ser posterior ao início.'); return; }
        const time = allDay ? { allDay: true, start: { date: start.slice(0, 10) }, end: { date: end.slice(0, 10) } }
          : { allDay: false, start: { dateTime: `${start}:00`, timeZone: TZ }, end: { dateTime: `${end}:00`, timeZone: TZ } };
        const firstDay = Temporal.PlainDate.from(start.slice(0, 10));
        const lastDay = Temporal.PlainDate.from(end.slice(0, 10));
        for (let day = firstDay; Temporal.PlainDate.compare(day, lastDay) <= 0; day = day.add({ days: 1 })) {
          const iso = day.toString();
          const minuteOf = (value: string) => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16));
          const startMin = iso === firstDay.toString() ? minuteOf(start) : 0;
          const endMin = iso === lastDay.toString() ? minuteOf(end) : 1440;
          if (allDay && iso === lastDay.toString() || !allDay && endMin === 0) continue;
          const constraint = api.evaluateSlot(allDay ? { date: iso } : { date: iso, startMin, endMin });
          if (!constraint.valid) { setEditorError(`Horário indisponível em ${iso}: ${constraint.reason}.`); return; }
          for (const resourceId of editorResources) {
            const evaluation = api.evaluatePlacement({ dateISO: iso,
              startMin: allDay ? 0 : startMin, endMin: allDay ? 1440 : endMin, resourceId,
              ...(editing ? { occurrence: editing } : {}) });
            if (!evaluation.valid) { setEditorError(`Recurso indisponível em ${iso}: ${evaluation.reason}.`); return; }
          }
        }
        if (editing) {
          setEvents(current => current.map(item => item.id !== editing.masterId ? item : item.recurrence ? {
            ...item, recurrence: { ...item.recurrence, overrides: { ...item.recurrence.overrides, [editing.originalStart]: { ...item.recurrence.overrides?.[editing.originalStart], title: title.trim(), time, resourceIds: editorResources } } },
          } : { ...item, title: title.trim(), time, resourceIds: editorResources }));
        } else if (selection) {
          setEvents(current => [...current, { id: crypto.randomUUID(), calendarId: 'agenda', title: title.trim(), time, resourceIds: editorResources }]);
        }
        setFeedback(editing ? 'Evento atualizado.' : 'Evento criado.'); closeEditor();
      }}>
        <h2 id="editor-title">{editing ? 'Editar evento' : 'Criar evento'}</h2>
        {editorError && <p role="alert">{editorError}</p>}
        <label>Título<input autoFocus value={title} onChange={event => setTitle(event.target.value)} required /></label>
        <label><span><input type="checkbox" checked={allDay} onChange={event => {
          setAllDay(event.target.checked);
          setStart(event.target.checked ? start.slice(0, 10) : `${start.slice(0, 10)}T09:00`);
          setEnd(event.target.checked ? getTemporal().PlainDate.from(start.slice(0, 10)).add({ days: 1 }).toString() : `${end.slice(0, 10)}T09:30`);
        }} /> Dia inteiro</span></label>
        <label>Início<input type={allDay ? 'date' : 'datetime-local'} value={start} onChange={event => setStart(event.target.value)} required /></label>
        <label>{allDay ? 'Fim (data exclusiva)' : 'Fim'}<input type={allDay ? 'date' : 'datetime-local'} value={end} onChange={event => setEnd(event.target.value)} required /></label>
        <fieldset><legend>Recursos</legend>{resources.map(resource => <label key={resource.id}><span>
          <input type="checkbox" checked={editorResources.includes(resource.id)} onChange={event => setEditorResources(current => event.target.checked ? [...current, resource.id] : current.filter(id => id !== resource.id))} /> {resource.title}
        </span></label>)}</fieldset>
        <div className="demo-actions"><button type="button" onClick={closeEditor}>Cancelar</button><button type="submit">Salvar evento</button></div>
      </form>
    </dialog>
  </main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
