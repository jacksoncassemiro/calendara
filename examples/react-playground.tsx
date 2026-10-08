/** @jsxImportSource react */
import {
  applyEventTimeChange,
  BUILTIN_VIEWS,
  Calendar,
  CalendarEventEditor,
  createNDaysView,
  createReactView,
  createResourceDayView,
  createTimelineView,
  getTemporal,
  occurrenceKey,
  splitEventSeries,
  useCalendar,
  useCalendarDraggable,
  useCompactCalendar,
  type CalendarEvent,
  type EventChange,
  type EventOccurrence,
  type ViewRenderContext,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './react-playground.css';

const TZ = 'America/Sao_Paulo';
const REF = '2026-10-07';
const initialEvents: CalendarEvent[] = [
  {
    id: 'consulta',
    calendarId: 'agenda',
    title: 'Consulta inicial',
    resourceIds: ['sala-1'],
    color: '#2563eb',
    time: {
      allDay: false,
      start: { dateTime: `${REF}T09:00:00`, timeZone: TZ },
      end: { dateTime: `${REF}T10:00:00`, timeZone: TZ },
    },
  },
  {
    id: 'retorno',
    calendarId: 'agenda',
    title: 'Retorno semanal',
    resourceIds: ['sala-2'],
    time: {
      allDay: false,
      start: { dateTime: `${REF}T11:00:00`, timeZone: TZ },
      end: { dateTime: `${REF}T11:30:00`, timeZone: TZ },
    },
    recurrence: { rule: 'FREQ=WEEKLY;COUNT=8' },
  },
  {
    id: 'congresso',
    calendarId: 'agenda',
    title: 'Congresso · 3 dias',
    time: {
      allDay: true,
      start: { date: '2026-10-06' },
      end: { date: '2026-10-09' },
    },
  },
  {
    id: 'plantao',
    calendarId: 'agenda',
    title: 'Plantão noturno',
    resourceIds: ['sala-1'],
    time: {
      allDay: false,
      start: { dateTime: `${REF}T19:00:00`, timeZone: TZ },
      end: { dateTime: '2026-10-08T09:00:00', timeZone: TZ },
    },
  },
];
const constraints = {
  businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '20:00' }],
  blocked: [
    {
      scope: 'time' as const,
      date: REF,
      startTime: '12:00',
      endTime: '13:00',
      description: 'Almoço',
    },
  ],
};
const options = {
  timeZone: TZ,
  startHour: 7,
  endHour: 21,
  locale: 'pt-BR',
  slotMinutes: 30,
};
const resources = [
  { id: 'sala-1', title: 'Sala 1', bufferAfter: 15 },
  { id: 'sala-2', title: 'Sala 2' },
];
function SummaryView(context: ViewRenderContext) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="demo-summary">
      <h2>Resumo do dia</h2>
      <button type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Recolher eventos' : 'Mostrar eventos'}
      </button>
      {expanded && (
        <ul>
          {context.occurrences.map((occurrence) => (
            <li key={`${occurrence.masterId}@${occurrence.originalStart}`}>
              <button type="button" onClick={() => context.onEventClick?.(occurrence)}>
                {occurrence.event.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
const views = [
  ...BUILTIN_VIEWS,
  createResourceDayView(resources),
  createTimelineView(resources),
  createNDaysView(3),
  createReactView({ name: 'summary', label: 'Resumo' }, SummaryView),
];

function App() {
  const { ref, api } = useCalendar();
  const { containerRef } = useCompactCalendar();
  // Width changes alter layout, not a view the user explicitly selected.
  const initialView = useRef(window.innerWidth < 640 ? 'day' : 'week');
  const [events, setEvents] = useState(initialEvents);
  const externalEvent: CalendarEvent = {
    id: 'external-template',
    calendarId: 'agenda',
    title: 'Agendamento externo',
    time: {
      allDay: false,
      start: { dateTime: `${REF}T09:00:00`, timeZone: TZ },
      end: { dateTime: `${REF}T09:30:00`, timeZone: TZ },
    },
  };
  const externalDrag = useCalendarDraggable(externalEvent);
  const [rejectNext, setRejectNext] = useState(false);
  const [feedback, setFeedback] = useState(
    'Selecione um horário livre ou abra um evento para editar.',
  );
  const [editing, setEditing] = useState<EventOccurrence | null>(null);
  const [title, setTitle] = useState('');
  const [selection, setSelection] = useState<{
    date: string;
    minute: number;
  } | null>(null);
  const [mounted, setMounted] = useState(true);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [start, setStart] = useState(`${REF}T09:00`);
  const [end, setEnd] = useState(`${REF}T09:30`);
  const [allDay, setAllDay] = useState(false);
  const [editorResources, setEditorResources] = useState<string[]>([]);
  const [editorError, setEditorError] = useState('');
  const [visibleResource, setVisibleResource] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('1');
  const [room1Capacity, setRoom1Capacity] = useState('inherit');
  const [room2Capacity, setRoom2Capacity] = useState('inherit');
  const activeResources = resources.map((resource) => {
    const own = resource.id === 'sala-1' ? room1Capacity : room2Capacity;
    return {
      ...resource,
      ...(own === 'inherit'
        ? {}
        : { capacity: own === 'unlimited' ? (false as const) : Number(own) }),
    };
  });
  const [densityPolicy, setDensityPolicy] = useState<'shrink' | 'scroll' | 'more'>('shrink');
  const [slotEventOverlap, setSlotEventOverlap] = useState(false);
  const [timeScale, setTimeScale] = useState(1.5);
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [labelInterval, setLabelInterval] = useState(0);
  const [moreBehavior, setMoreBehavior] = useState('popover');
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (editing || selection) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [editing, selection]);
  const openEditor = (occurrence: EventOccurrence) => {
    setEditorResources([...(occurrence.event.resourceIds ?? [])]);
    setEditorError('');
    setEditing(occurrence);
    setTitle(occurrence.event.title);
    setAllDay(occurrence.event.time.allDay);
    setStart(
      occurrence.event.time.start.date ?? occurrence.event.time.start.dateTime!.slice(0, 16),
    );
    setEnd(occurrence.event.time.end.date ?? occurrence.event.time.end.dateTime!.slice(0, 16));
  };
  const openCreate = (
    date: string,
    minute: number,
    endMinute = minute + 30,
    resourceId?: string,
  ) => {
    const Temporal = getTemporal();
    setEditorResources(resourceId ? [resourceId] : []);
    setEditorError('');
    const dayStart = Temporal.PlainDate.from(date).toPlainDateTime('00:00');
    setStart(dayStart.add({ minutes: minute }).toString().slice(0, 16));
    setEnd(dayStart.add({ minutes: endMinute }).toString().slice(0, 16));
    setSelection({ date, minute });
    setTitle('');
    setAllDay(false);
  };
  const commit = async (change: EventChange) => {
    if (rejectNext) {
      setRejectNext(false);
      setFeedback('Gravação recusada: o horário original foi restaurado.');
      return false;
    }
    setEvents((current) => applyEventTimeChange(current, change));
    setFeedback('Horário atualizado nesta demonstração.');
    return true;
  };
  const closeEditor = () => {
    setEditing(null);
    setSelection(null);
    setTitle('');
  };
  return (
    <main>
      <nav className="demo-navigation" aria-label="Navegação do projeto">
        <a href="../index.html">Calendara</a>
        <a href="../index.html#getting-started">Documentação</a>
        <a href="../index.html#api">API</a>
        <a href="https://github.com/jacksoncassemiro/calendara">GitHub</a>
      </nav>
      <header className="demo-header">
        <div>
          <h1>Experimente sua agenda</h1>
          <p>Explore eventos, salas e recorrência no fuso de São Paulo.</p>
        </div>
        <button type="button" onClick={() => api.setDate(REF)}>
          Voltar ao exemplo
        </button>
      </header>
      <p className="demo-project-note">
        Projeto pessoal e experimental desenvolvido com assistência do OpenAI Codex. Os dados desta
        demonstração ficam em memória.
      </p>
      <div className="demo-tools-heading">
        <h2>Configurar a demonstração</h2>
        <p>Altere as regras e compare a apresentação na agenda abaixo.</p>
      </div>
      <section className="demo-tools" aria-label="Controles da demonstração">
        <label>
          <input
            type="checkbox"
            checked={rejectNext}
            onChange={(event) => setRejectNext(event.target.checked)}
          />{' '}
          Recusar próxima gravação
        </label>
        <label>
          <input
            type="checkbox"
            checked={businessHoursEnabled}
            onChange={(event) => setBusinessHoursEnabled(event.target.checked)}
          />{' '}
          Aplicar restrições de horário
        </label>
        <label>
          Capacidade padrão
          <select
            aria-label="Capacidade padrão"
            value={roomCapacity}
            onChange={(event) => setRoomCapacity(event.target.value)}
          >
            <option value={1}>1 simultâneo</option>
            <option value={4}>4 simultâneos</option>
            <option value={10}>10 simultâneos</option>
            <option value="unlimited">Sem limite</option>
          </select>
        </label>
        <label>
          Capacidade Sala 1
          <select
            aria-label="Capacidade Sala 1"
            value={room1Capacity}
            onChange={(event) => setRoom1Capacity(event.target.value)}
          >
            <option value="inherit">Usar padrão</option>
            <option value="1">1 simultâneo</option>
            <option value="4">4 simultâneos</option>
            <option value="unlimited">Sem limite</option>
          </select>
        </label>
        <label>
          Capacidade Sala 2
          <select
            aria-label="Capacidade Sala 2"
            value={room2Capacity}
            onChange={(event) => setRoom2Capacity(event.target.value)}
          >
            <option value="inherit">Usar padrão</option>
            <option value="1">1 simultâneo</option>
            <option value="4">4 simultâneos</option>
            <option value="unlimited">Sem limite</option>
          </select>
        </label>
        <label>
          Eventos próximos
          <select
            aria-label="Eventos próximos"
            value={densityPolicy}
            onChange={(event) => setDensityPolicy(event.target.value as typeof densityPolicy)}
          >
            <option value="shrink">Comprimir</option>
            <option value="scroll">Ampliar e rolar</option>
            <option value="more">Agrupar em +mais</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={slotEventOverlap}
            onChange={(event) => setSlotEventOverlap(event.target.checked)}
          />{' '}
          Sobreposição parcial de eventos
        </label>
        <label>
          Recurso visível
          <select
            value={visibleResource}
            onChange={(event) => setVisibleResource(event.target.value)}
          >
            <option value="">Todos os recursos</option>
            {resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setMounted((value) => !value)}>
          {mounted ? 'Desmontar calendário' : 'Montar calendário'}
        </button>
        <label>
          Duração do slot
          <select
            aria-label="Duração do slot"
            value={slotMinutes}
            onChange={(event) => setSlotMinutes(Number(event.target.value))}
          >
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={60}>60 minutos</option>
          </select>
        </label>
        <label>
          Tamanho do slot
          <select
            aria-label="Tamanho do slot"
            value={timeScale}
            onChange={(event) => setTimeScale(Number(event.target.value))}
          >
            <option value={1}>30 px por slot</option>
            <option value={1.5}>45 px por slot</option>
            <option value={2}>60 px por slot</option>
          </select>
        </label>
        <label>
          Intervalo dos rótulos
          <select
            aria-label="Intervalo dos rótulos"
            value={labelInterval}
            onChange={(event) => setLabelInterval(Number(event.target.value))}
          >
            <option value={0}>Automático</option>
            <option value={15}>A cada 15 minutos</option>
            <option value={30}>A cada 30 minutos</option>
            <option value={60}>A cada hora</option>
          </select>
        </label>
        <label>
          Ver mais
          <select value={moreBehavior} onChange={(event) => setMoreBehavior(event.target.value)}>
            <option value="popover">Popover padrão</option>
            <option value="custom">Conteúdo React personalizado</option>
            <option value="day">Abrir view Dia</option>
          </select>
        </label>
      </section>
      <p className="demo-note" aria-label="Configuração do eixo">
        <code>
          slotMinutes: {slotMinutes} · pxPerMinute:{' '}
          {Number(((timeScale * 30) / slotMinutes).toFixed(3))} · timeLabelInterval:{' '}
          {labelInterval || 'automático'}
        </code>
      </p>
      <p className="demo-feedback" role="status">
        {feedback}
      </p>
      <section aria-label="Arrasto externo" className="demo-controls">
        <button type="button" {...externalDrag} style={{ touchAction: 'none' }}>
          Arrastar agendamento externo · 30 minutos
        </button>
        <div data-demo-drop-zone>Área externa: solte aqui para receber a ação de saída</div>
      </section>
      <section ref={containerRef} className="demo-calendar" aria-label="Agenda">
        {mounted ? (
          <Calendar
            apiRef={ref}
            initialDate={REF}
            initialView={initialView.current}
            events={events}
            options={{
              ...options,
              defaultResourceCapacity: roomCapacity === 'unlimited' ? false : Number(roomCapacity),
              timedEventOverflow: densityPolicy,
              slotEventOverlap,
              eventMaxStack: 3,
              minEventWidth: 110,
              eventMoreView: moreBehavior === 'day' ? 'day' : undefined,
              slotMinutes,
              pxPerMinute: (timeScale * 30) / slotMinutes,
              timeLabelInterval: labelInterval || undefined,
              monthMoreView: moreBehavior === 'day' ? 'day' : undefined,
              visibleResourceIds: visibleResource
                ? [visibleResource]
                : resources.map((resource) => resource.id),
            }}
            constraints={businessHoursEnabled ? constraints : {}}
            resources={activeResources}
            views={views}
            renderMonthMore={
              moreBehavior === 'custom'
                ? (info) => (
                    <div className="demo-more-custom">
                      <p>{info.occurrences.length} eventos nesta data</p>
                      {info.occurrences.map((occurrence) => (
                        <button
                          type="button"
                          key={`${occurrence.masterId}@${occurrence.originalStart}`}
                          onClick={() => {
                            info.close();
                            openEditor(occurrence);
                          }}
                        >
                          {occurrence.event.title}
                        </button>
                      ))}
                      <button type="button" onClick={() => info.openView('day')}>
                        Abrir agenda do dia
                      </button>
                    </div>
                  )
                : undefined
            }
            onEventDrop={commit}
            onExternalEventDrop={(change) => {
              setEvents((current) => [...current, { ...change.event, id: crypto.randomUUID() }]);
              setFeedback('Agendamento externo recebido e salvo nesta demonstração.');
            }}
            onEventDropOutside={({ occurrence, target }) => {
              if (target?.closest('[data-demo-drop-zone]')) {
                setFeedback(
                  `${occurrence.event.title}: saída recebida; o consumidor decide persistir ou remover.`,
                );
              }
            }}
            onEventResize={commit}
            onEventClick={openEditor}
            onDateClick={(date, minute = 9 * 60) => openCreate(date, minute)}
            onDateSelect={(selection) => {
              if (selection.allDay) {
                setEditing(null);
                setSelection({ date: selection.dateISO, minute: 0 });
                setAllDay(true);
                setStart(selection.dateISO);
                setEnd(selection.endDateISO!);
                setEditorResources(selection.resourceId ? [selection.resourceId] : []);
              } else
                openCreate(
                  selection.dateISO,
                  selection.startMin,
                  selection.endMin,
                  selection.resourceId,
                );
            }}
            onDropBlocked={(info) =>
              setFeedback(
                info.reason === 'blocked'
                  ? 'Alteração recusada: o intervalo atravessa um bloqueio. Desative “Aplicar restrições de horário” para experimentar livremente.'
                  : info.reason === 'outside-business-hours'
                    ? 'Alteração recusada: o intervalo ultrapassa o expediente. Desative “Aplicar restrições de horário” para experimentar livremente.'
                    : info.reason === 'over-capacity'
                      ? 'Alteração recusada: capacidade da sala excedida (limite configurado por sala).'
                      : info.reason === 'buffer-conflict'
                        ? 'Alteração recusada: conflito com os 15 minutos de preparação da Sala 1.'
                        : `Alteração recusada: ${info.reason}.`,
              )
            }
            onClickBlocked={(info) =>
              setFeedback(
                info.reason === 'outside-business-hours'
                  ? 'Horário indisponível: fora do expediente (segunda a sexta, 08h–20h).'
                  : info.reason === 'blocked'
                    ? 'Horário indisponível: intervalo bloqueado.'
                    : info.reason === 'over-capacity'
                      ? 'Horário indisponível: capacidade da sala excedida (limite configurado por sala).'
                      : info.reason === 'buffer-conflict'
                        ? 'Horário indisponível: conflito com a preparação de 15 minutos da Sala 1.'
                        : `Horário indisponível: ${info.reason}.`,
              )
            }
          />
        ) : (
          <p>Calendário desmontado. Use “Montar calendário” para continuar.</p>
        )}
      </section>
      <p className="demo-note">
        Os dados ficam em memória. Arraste ou redimensione o intervalo completo; abra o editor para
        reagendar por teclado ou no celular.
      </p>
      <dialog
        ref={dialogRef}
        className="demo-editor"
        aria-labelledby="editor-title"
        onCancel={closeEditor}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="0"]',
            ),
          ].filter((control) => control.getClientRects().length > 0);
          const first = controls[0],
            last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <h2 id="editor-title">{editing ? 'Editar evento' : 'Criar evento'}</h2>
        {(editing || selection) && (
          <CalendarEventEditor
            key={editing ? occurrenceKey(editing) : selection?.date}
            event={
              editing?.event ?? {
                id: 'new',
                calendarId: 'agenda',
                title: '',
                resourceIds: editorResources,
                time: allDay
                  ? { allDay: true, start: { date: start }, end: { date: end } }
                  : {
                      allDay: false,
                      start: { dateTime: start, timeZone: TZ },
                      end: { dateTime: end, timeZone: TZ },
                    },
              }
            }
            occurrence={editing ?? undefined}
            resources={activeResources}
            timeZone={TZ}
            onCancel={closeEditor}
            validate={(draft) => {
              const evaluation = api.evaluateEvent(draft, editing ?? undefined);
              if (!evaluation.valid)
                return `Horário ou recurso indisponível: ${evaluation.reason}.`;
            }}
            onSave={(draft, context) => {
              if (editing && context.scope === 'following') {
                const master = events.find((item) => item.id === editing.masterId)!;
                const split = splitEventSeries(
                  getTemporal(),
                  master,
                  editing.originalStart,
                  crypto.randomUUID(),
                  draft,
                );
                setEvents((current) => [
                  ...current.filter((item) => item.id !== master.id),
                  ...(split.before ? [split.before] : []),
                  split.following,
                ]);
                setFeedback('Este evento e os seguintes foram atualizados.');
                closeEditor();
                return;
              }
              setEvents((current) =>
                editing
                  ? current.map((item) =>
                      item.id !== editing.masterId
                        ? item
                        : context.scope === 'occurrence' && item.recurrence
                          ? {
                              ...item,
                              recurrence: {
                                ...item.recurrence,
                                overrides: {
                                  ...item.recurrence.overrides,
                                  [editing.originalStart]: {
                                    title: draft.title,
                                    time: draft.time,
                                    resourceIds: draft.resourceIds,
                                  },
                                },
                              },
                            }
                          : { ...draft, id: item.id },
                    )
                  : [...current, { ...draft, id: crypto.randomUUID() }],
              );
              setFeedback(editing ? 'Evento atualizado.' : 'Evento criado.');
              closeEditor();
            }}
            onDelete={
              editing
                ? (_draft, context) => {
                    if (context.scope === 'following') {
                      const master = events.find((item) => item.id === editing.masterId)!;
                      const split = splitEventSeries(
                        getTemporal(),
                        master,
                        editing.originalStart,
                        crypto.randomUUID(),
                      );
                      setEvents((current) => [
                        ...current.filter((item) => item.id !== master.id),
                        ...(split.before ? [split.before] : []),
                      ]);
                      setFeedback('Este evento e os seguintes foram excluídos.');
                      closeEditor();
                      return;
                    }
                    setEvents((current) =>
                      context.scope === 'occurrence' && editing.event.recurrence
                        ? current.map((item) =>
                            item.id === editing.masterId
                              ? {
                                  ...item,
                                  recurrence: {
                                    ...item.recurrence,
                                    overrides: {
                                      ...item.recurrence?.overrides,
                                      [editing.originalStart]: {
                                        cancelled: true,
                                      },
                                    },
                                  },
                                }
                              : item,
                          )
                        : current.filter((item) => item.id !== editing.masterId),
                    );
                    setFeedback('Evento excluído.');
                    closeEditor();
                  }
                : undefined
            }
          />
        )}
      </dialog>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
