import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CodeBlock } from './components/CodeBlock';
import {
  Calendar,
  CalendarEventEditor,
  applyEventTimeChange,
  createNDaysView,
  createReactView,
  createResourceDayView,
  createTimelineView,
  createResourceView,
  createResourceTimelineView,
  yearView,
  quarterView,
  yearPlannerView,
  dayAgendaView,
  dayView,
  weekView,
  monthView,
  listView,
  useCalendar,
  useCalendarDraggable,
  useCalendarHistory,
  importICalendar,
  exportICalendar,
  ensureTemporal,
  type CalendarEvent,
  type CalendarProps,
  type EventChange,
  type EventOccurrence,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';
import './react-playground.css';
import './feature-examples.css';
import { SiteHeader, type SiteLanguage, type SiteTheme } from './components/SiteHeader';
import { demos } from './demos/catalog';
import { Summary } from './demos/Summary';

const referenceDate = '2026-10-07';
const timeZone = 'UTC';
const rooms = [
  { id: 'room', title: 'Room / Sala', capacity: 2 },
  { id: 'open', title: 'Open / Livre', capacity: false as const },
];
const treeResources = [
  { id: 'site', title: 'Building / Prédio' },
  ...Array.from({ length: 120 }, (_, index) => ({
    id: index === 0 ? 'room' : `room-${index}`,
    title: `Room / Sala ${index + 1}`,
    parentId: 'site',
    capacity: 2,
  })),
];

function appointment({
  id,
  date = referenceDate,
  start = '09:00',
  end = '10:00',
}: {
  id: string;
  date?: string;
  start?: string;
  end?: string;
}): CalendarEvent {
  return {
    id,
    calendarId: 'example',
    title: `Appointment / Agendamento ${id}`,
    resourceIds: ['room'],
    time: {
      allDay: false,
      start: { dateTime: `${date}T${start}`, timeZone },
      end: { dateTime: `${date}T${end}`, timeZone },
    },
  };
}

function seedEvents(demoId: string): CalendarEvent[] {
  const first = appointment({ id: 'A' });
  if (demoId === 'recurrence') return [{ ...first, recurrence: { rule: 'FREQ=DAILY;COUNT=5' } }];
  if (demoId === 'overflow')
    return Array.from({ length: 5 }, (_, index) =>
      appointment({
        id: String(index),
        date: referenceDate,
        start: `09:${index * 10 < 10 ? '0' : ''}${index * 10}`,
        end: '11:00',
      }),
    );
  const seeds = [first, appointment({ id: 'B', date: '2026-10-08', start: '11:00', end: '11:30' })];
  if (demoId === 'month')
    seeds.push(
      appointment({ id: 'C', date: referenceDate, start: '10:00', end: '11:00' }),
      appointment({ id: 'D', date: referenceDate, start: '11:00', end: '12:00' }),
      appointment({ id: 'E', date: referenceDate, start: '12:00', end: '13:00' }),
    );
  return seeds;
}

function TransferCard({ event }: { event: CalendarEvent }) {
  const draggable = useCalendarDraggable(event);
  return (
    <button {...draggable} style={{ touchAction: 'none' }}>
      {event.title}
    </button>
  );
}

function Demo({ id, language }: { id: string; language: SiteLanguage }) {
  const definition = demos.find((demo) => demo.id === id)!;
  const english = language === 'en';
  const t = (portuguese: string, translated: string) => (english ? translated : portuguese);
  const [localEvents, setEvents] = useState(() => seedEvents(id));
  const [reject, setReject] = useState(false);
  const [rtl, setRtl] = useState(false);
  const [icsText, setIcsText] = useState(
    'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Calendara//Demo//EN\r\nBEGIN:VEVENT\r\nUID:imported\r\nDTSTAMP:20261007T080000Z\r\nDTSTART:20261007T100000Z\r\nDTEND:20261007T110000Z\r\nSUMMARY:Imported event / Evento importado\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n',
  );
  const [status, setStatus] = useState('');
  const history = useCalendarHistory({
    initialEvents: seedEvents(id),
    limit: 20,
    persist: async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 200));
      if (reject) throw new Error(t('Gravação recusada.', 'Save rejected.'));
    },
  });
  const events = id === 'history' ? history.events : localEvents;
  const [editing, setEditing] = useState<EventOccurrence>();
  const [title, setTitle] = useState('');
  const [width, setWidth] = useState(1000);
  const [monthIndicators, setMonthIndicators] = useState(false);
  const [dateStatuses, setDateStatuses] = useState<
    Record<string, 'free' | 'near' | 'full' | 'unavailable'>
  >({
    '2026-10-08': 'near',
  });
  const dateStatusLabels = {
    free: t('Livre', 'Available'),
    near: t('Quase cheio', 'Almost full'),
    full: t('Cheio', 'Full'),
    unavailable: t('Indisponível', 'Unavailable'),
  };
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [archived, setArchived] = useState<CalendarEvent[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const { ref: apiRef, api } = useCalendar();
  const views = useMemo(() => {
    const registry = [
      weekView,
      dayView,
      monthView,
      listView,
      createResourceDayView(),
      createTimelineView(),
      createResourceTimelineView({
        name: 'timeline-tree',
        duration: 'week',
        hierarchy: true,
        virtualization: { height: 360, overscan: 3 },
        dayWidth: 180,
      }),
      createResourceView({
        days: 7,
        alignment: 'week',
        groupBy: 'resource',
        name: 'resource-week',
      }),
      createResourceTimelineView({
        duration: 'week',
        name: 'timeline-week',
        groupBy: (resource) => (resource.id === 'room' ? 'Rooms / Salas' : 'Open / Livre'),
      }),
      createResourceTimelineView({
        duration: 'month',
        name: 'timeline-month',
        groupBy: (resource) => (resource.id === 'room' ? 'Rooms / Salas' : 'Open / Livre'),
      }),
      yearView,
      quarterView,
      yearPlannerView,
      dayAgendaView,
      createNDaysView(3, 'three-days'),
      createReactView({ name: 'summary', label: english ? 'Summary' : 'Resumo' }, Summary),
    ];
    const selected = registry.filter(
      (view) =>
        view.name === definition.view ||
        (id === 'week' && view.name === 'day') ||
        (id === 'month' && view.name === 'day'),
    );
    const englishLabels: Record<string, string> = {
      week: 'Week',
      day: 'Day',
      month: 'Month',
      list: 'Agenda',
      resources: 'Resources',
      timeline: 'Timeline',
      year: 'Year',
      quarter: 'Quarter',
      'year-planner': 'Year planner',
      'day-agenda': 'Day agenda',
      'resource-week': 'Resources · week',
      'timeline-week': 'Timeline · week',
      'timeline-month': 'Timeline · month',
      'three-days': '3 days',
      summary: 'Summary',
    };
    return [
      selected.find((view) => view.name === definition.view)!,
      ...selected.filter((view) => view.name !== definition.view),
    ].map((view) => ({
      ...view,
      label: english
        ? (englishLabels[view.name] ?? view.label)
        : ((
            {
              year: 'Ano',
              quarter: 'Trimestre',
              'year-planner': 'Planejamento anual',
              'day-agenda': 'Agenda do dia',
              'resource-week': 'Recursos · semana',
              'timeline-week': 'Timeline · semana',
              'timeline-month': 'Timeline · mês',
            } as Record<string, string>
          )[view.name] ?? view.label),
    }));
  }, [definition.view, id, english]);
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setMeasuredWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const commit = async (change: EventChange) => {
    if (id === 'history') {
      try {
        const accepted = await history.commit(
          applyEventTimeChange({ events: history.events, change }),
        );
        if (!accepted) return false;
        setStatus(t('Alteração salva no histórico local.', 'Change saved to local history.'));
      } catch (error) {
        setStatus(String(error));
        return false;
      }
      return;
    }
    if (reject) {
      setStatus(t('Gravação recusada; gesto revertido.', 'Save rejected; gesture reverted.'));
      return false;
    }
    setEvents((current) => applyEventTimeChange({ events: current, change }));
    setStatus(t('Alteração salva em memória.', 'Change saved in memory.'));
  };
  const source = useMemo<CalendarProps['eventSource']>(
    () =>
      id === 'source'
        ? async (_range, { signal }) => {
            await new Promise<void>((resolve, reject) => {
              const timer = window.setTimeout(resolve, 350);
              signal.addEventListener(
                'abort',
                () => {
                  window.clearTimeout(timer);
                  reject(new DOMException('Aborted', 'AbortError'));
                },
                { once: true },
              );
            });
            return seedEvents(id);
          }
        : undefined,
    [id],
  );
  const customForm = id === 'custom-editor';
  const demoOptions: Partial<import('@jacksoncassemiro/calendara').CalendarOptions> = {
    timeZone,
    locale: language,
    startHour: 8,
    endHour: 14,
    pxPerMinute: 1.5,
    slotMinutes: 30,
    timeLabelInterval: 60,
    nowMs: Date.parse('2026-10-08T12:00:00Z'),
    ...definition.options,
    ...(id === 'month' ? { monthCompactBreakpoint: monthIndicators ? 480 : false } : {}),
    ...(id === 'timeline-tree' ? { direction: rtl ? ('rtl' as const) : ('ltr' as const) } : {}),
  };
  const extendedDemo = [
    'resource-week',
    'timeline-week',
    'timeline-month',
    'year',
    'quarter',
    'year-planner',
    'day-agenda',
    'print',
  ].includes(id);
  return (
    <>
      <section
        className="focused-controls"
        aria-label={t('Tamanho do contêiner', 'Container size')}
      >
        <label>
          {t('Largura solicitada', 'Requested width')}{' '}
          <input
            aria-label={t('Largura do calendário', 'Calendar width')}
            type="range"
            min="280"
            max="1600"
            step="10"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        {[
          { width: 360, label: t('Celular', 'Phone') },
          { width: 768, label: 'Tablet' },
          { width: 1200, label: 'Desktop' },
        ].map((preset) => (
          <button key={preset.width} onClick={() => setWidth(preset.width)}>
            {preset.label} · {preset.width} px
          </button>
        ))}
        <output>
          {t('Largura real', 'Actual width')}: {measuredWidth}px
        </output>
        {id === 'month' && (
          <label>
            <input
              aria-label={t('Indicadores e lista', 'Indicators and list')}
              type="checkbox"
              checked={monthIndicators}
              onChange={(event) => setMonthIndicators(event.target.checked)}
            />{' '}
            {t(
              'Indicadores e lista abaixo de 480px (opcional)',
              'Indicators and list below 480px (optional)',
            )}
          </label>
        )}
        <p>
          {t(
            'A largura é limitada pelo espaço disponível. Arraste o canto inferior direito para testar o contêiner; não é uma emulação de dispositivo.',
            'Width is capped by available space. Drag the lower-right corner to test the container; this is not device emulation.',
          )}
        </p>
        {(id === 'persistence' || id === 'history') && (
          <label>
            <input
              type="checkbox"
              checked={reject}
              onChange={(event) => setReject(event.target.checked)}
            />{' '}
            {t('Recusar gravação', 'Reject save')}
          </label>
        )}
        {id === 'day-style' && (
          <button
            onClick={async () => {
              await new Promise((resolve) => window.setTimeout(resolve, 150));
              setDateStatuses({
                '2026-10-06': 'free',
                '2026-10-07': 'near',
                '2026-10-08': 'full',
                '2026-10-09': 'unavailable',
              });
              setStatus(
                t(
                  'Resposta de API simulada aplicada; cores não bloqueiam horários.',
                  'Simulated API response applied; colors do not block slots.',
                ),
              );
            }}
          >
            {t('Simular resposta da API', 'Simulate API response')}
          </button>
        )}
      </section>
      {id === 'history' && (
        <section className="focused-controls" aria-label={t('Histórico local', 'Local history')}>
          <button
            disabled={history.pending}
            onClick={() => {
              void history
                .commit([
                  ...history.events,
                  appointment({ id: crypto.randomUUID(), start: '12:00', end: '12:30' }),
                ])
                .catch((error) => setStatus(String(error)));
            }}
          >
            {t('Adicionar evento', 'Add event')}
          </button>
          <button
            disabled={!history.canUndo}
            onClick={() => {
              void history.undo().catch((error) => setStatus(String(error)));
            }}
          >
            {t('Desfazer', 'Undo')}
          </button>
          <button
            disabled={!history.canRedo}
            onClick={() => {
              void history.redo().catch((error) => setStatus(String(error)));
            }}
          >
            {t('Refazer', 'Redo')}
          </button>
          <button
            disabled={history.pending}
            onClick={() => {
              history.replaceEvents(seedEvents(id));
              setStatus(
                t('Dados recarregados; histórico limpo.', 'Events reloaded; history cleared.'),
              );
            }}
          >
            {t('Recarregar eventos', 'Reload events')}
          </button>
          <p>
            {t(
              'Persistência simulada de 200 ms. Recusar preserva os eventos e o histórico; não há undo no servidor.',
              'Simulated 200 ms persistence. Rejection retains events and history; this does not undo server transactions.',
            )}
          </p>
        </section>
      )}
      {id === 'ics' && (
        <section className="focused-controls" aria-label={t('Intercâmbio ICS', 'ICS interchange')}>
          <label style={{ width: '100%' }}>
            {t('Texto ICS', 'ICS text')}
            <textarea
              aria-label={t('Texto ICS', 'ICS text')}
              rows={8}
              style={{ width: '100%' }}
              value={icsText}
              onChange={(event) => setIcsText(event.target.value)}
            />
          </label>
          <button
            onClick={async () => {
              try {
                const result = importICalendar({
                  text: icsText,
                  calendarId: 'example',
                  temporal: await ensureTemporal(),
                });
                setEvents(result.events);
                setStatus(JSON.stringify(result.diagnostics, null, 2));
              } catch (error) {
                setStatus(String(error));
              }
            }}
          >
            {t('Importar ICS', 'Import ICS')}
          </button>
          <button
            onClick={async () => {
              try {
                const result = exportICalendar({
                  events,
                  temporal: await ensureTemporal(),
                  timestamp: new Date().toISOString(),
                });
                setIcsText(result.text);
                setStatus(JSON.stringify(result.diagnostics, null, 2));
              } catch (error) {
                setStatus(String(error));
              }
            }}
          >
            {t('Exportar ICS', 'Export ICS')}
          </button>
          <button
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([icsText], { type: 'text/calendar;charset=utf-8' }),
              );
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = 'calendara-demo.ics';
              anchor.click();
              window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            {t('Baixar texto ICS', 'Download ICS text')}
          </button>
          <p>
            {t(
              'Importação estrita de VEVENT. Confira os diagnósticos; não representa todo o RFC 5545.',
              'Strict VEVENT import. Inspect diagnostics; this does not cover the whole RFC 5545.',
            )}
          </p>
        </section>
      )}
      {id === 'timeline-tree' && (
        <section className="focused-controls">
          <label>
            <input
              type="checkbox"
              checked={rtl}
              onChange={(event) => setRtl(event.target.checked)}
            />{' '}
            {t('Direção RTL', 'RTL direction')}
          </label>
          <p>
            {t(
              '120 salas aninhadas. Role verticalmente e recolha o prédio; somente linhas de recursos são virtualizadas.',
              '120 nested rooms. Scroll vertically and collapse the building; only resource rows are virtualized.',
            )}
          </p>
        </section>
      )}
      {id === 'print' && (
        <button
          type="button"
          onClick={() => api.print({ title: 'Calendar / Agenda', orientation: 'landscape' })}
        >
          {t('Imprimir / salvar PDF', 'Print / save PDF')}
        </button>
      )}
      <div className="focused-resizer" ref={containerRef} style={{ width }}>
        <Calendar
          apiRef={apiRef}
          views={views}
          initialView={definition.view}
          initialDate={referenceDate}
          events={source ? undefined : events}
          eventSource={source}
          resources={id === 'timeline-tree' ? treeResources : rooms}
          options={demoOptions}
          constraints={
            id === 'resources'
              ? {
                  blocked: [
                    { date: referenceDate, scope: 'time', startTime: '12:00', endTime: '13:00' },
                  ],
                }
              : undefined
          }
          onEventDrop={commit}
          onEventResize={commit}
          onEventClick={(occurrence) => {
            if (id === 'history') {
              setStatus(occurrence.event.title);
              return;
            }
            if (id === 'recurrence') {
              setStatus(JSON.stringify(occurrence.event.recurrence, null, 2));
              return;
            }
            setEditing(occurrence);
            setTitle(occurrence.event.title);
          }}
          onLoadingChange={(loading) => {
            if (id === 'source')
              setStatus(
                loading
                  ? t('Carregando fonte simulada…', 'Loading simulated source…')
                  : t('Fonte simulada carregada.', 'Simulated source loaded.'),
              );
          }}
          onError={(error) => setStatus(String(error))}
          onDropBlocked={(info) => setStatus(`${t('Recusado', 'Rejected')}: ${info.reason}`)}
          onClickBlocked={(info) =>
            setStatus(`${t('Indisponível', 'Unavailable')}: ${info.reason}`)
          }
          renderEvent={
            id === 'custom-render'
              ? ({ event, timeLabel }) => (
                  <strong>
                    {timeLabel} · {event.title}
                  </strong>
                )
              : undefined
          }
          customToolbar={
            id === 'custom-toolbar'
              ? ({ title, goPrev, goNext }) => (
                  <nav className="focused-toolbar">
                    <button onClick={goPrev} aria-label={t('Anterior', 'Previous')}>
                      ←
                    </button>
                    <strong>{title}</strong>
                    <button onClick={goNext} aria-label={t('Próximo', 'Next')}>
                      →
                    </button>
                  </nav>
                )
              : undefined
          }
          getDayStyle={
            id === 'day-style'
              ? ({ dateISO }) =>
                  dateStatuses[dateISO]
                    ? {
                        backgroundColor: `var(--demo-day-${dateStatuses[dateISO]}-bg)`,
                        color: `var(--demo-day-${dateStatuses[dateISO]}-fg)`,
                        '--mc-color-muted': `var(--demo-day-${dateStatuses[dateISO]}-fg)`,
                        '--mc-color-btn-active-bg': `var(--demo-day-${dateStatuses[dateISO]}-fg)`,
                      }
                    : undefined
              : undefined
          }
          renderDayHeader={
            id === 'day-style'
              ? ({ dateISO, defaultContent }) => (
                  <>
                    {defaultContent}
                    {dateStatuses[dateISO] && (
                      <small className="focused-day-status" data-day-status={dateStatuses[dateISO]}>
                        {dateStatuses[dateISO] === 'unavailable' && (
                          <span aria-hidden="true">⊘ </span>
                        )}
                        {dateStatusLabels[dateStatuses[dateISO]!]}
                      </small>
                    )}
                  </>
                )
              : undefined
          }
          onExternalEventDrop={
            id === 'external-drag'
              ? ({ event }) => {
                  setEvents((current) => [...current, { ...event, id: crypto.randomUUID() }]);
                  setArchived((current) => current.filter((item) => item.id !== event.id));
                  setStatus(t('Evento recebido.', 'Event received.'));
                }
              : undefined
          }
          onEventDropOutside={
            id === 'external-drag'
              ? ({ occurrence, target }) => {
                  if (!target?.closest('[data-focused-archive]')) return;
                  setEvents((current) =>
                    current.filter((event) => event.id !== occurrence.masterId),
                  );
                  setArchived((current) => [
                    ...current,
                    { ...occurrence.event, recurrence: undefined, id: crypto.randomUUID() },
                  ]);
                  setStatus(t('Evento transferido.', 'Event transferred.'));
                }
              : undefined
          }
        />
      </div>
      {id === 'external-drag' && (
        <aside className="focused-controls">
          <TransferCard event={appointment({ id: 'Template' })} />
          <div data-focused-archive className="focused-archive">
            {t(
              'Solte aqui para retirar da agenda; arraste um cartão de volta.',
              'Drop here to remove from the calendar; drag a card back.',
            )}
            {archived.map((event) => (
              <TransferCard key={event.id} event={event} />
            ))}
          </div>
        </aside>
      )}
      {editing && customForm && (
        <form
          className="focused-controls"
          onSubmit={(event) => {
            event.preventDefault();
            const candidate = { ...editing.event, title };
            const result = api.evaluateEvent(candidate, editing);
            if (!result.valid) {
              setStatus(result.reason);
              return;
            }
            setEvents((current) =>
              current.map((item) => (item.id === editing.masterId ? candidate : item)),
            );
            setEditing(undefined);
          }}
        >
          <label>
            {t('Seu formulário: título', 'Your form: title')}
            <input required value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <button>{t('Salvar', 'Save')}</button>
          <button type="button" onClick={() => setEditing(undefined)}>
            {t('Cancelar', 'Cancel')}
          </button>
        </form>
      )}
      {editing && !customForm && (
        <div className="demo-editor focused-controls">
          <CalendarEventEditor
            event={editing.event}
            occurrence={editing}
            resources={rooms}
            timeZone={timeZone}
            locale={id === 'editor-language' ? 'es-ES' : language}
            messages={
              id === 'editor-language'
                ? {
                    fields: { title: 'Título de la cita', start: 'Inicio', end: 'Fin' },
                    actions: { save: 'Guardar', cancel: 'Cancelar' },
                    feedback: { saveFailed: 'No se pudo guardar' },
                  }
                : undefined
            }
            onCancel={() => setEditing(undefined)}
            validate={(candidate) => {
              const result = api.evaluateEvent(candidate, editing);
              return result.valid ? undefined : result.reason;
            }}
            onSave={(candidate) => {
              setEvents((current) =>
                current.map((item) => (item.id === editing.masterId ? candidate : item)),
              );
              setEditing(undefined);
            }}
          />
        </div>
      )}
      <pre role="status" className="focused-status">
        {status ||
          t(
            'Dados em memória. Clique em um evento para explorar.',
            'Data is in memory. Click an event to explore.',
          )}
      </pre>
      {id === 'recurrence' && (
        <p>
          {t(
            'Clique numa ocorrência para inspecionar sua regra. Para editar escopo, frequência e exceções, abra o exemplo completo.',
            'Click an occurrence to inspect its rule. To edit scope, frequency and exceptions, open the full example.',
          )}{' '}
          <a href={`./react.html?scenario=recurrence&view=day&lang=${language}`}>
            {t('Editor de recorrência', 'Recurrence editor')}
          </a>
        </p>
      )}
      <details open>
        <summary>{t('Código do recurso', 'Feature code')}</summary>
        <CodeBlock locale={language}>
          {extendedDemo
            ? 'const demoOptions = ' +
              JSON.stringify(demoOptions, null, 2) +
              ';\n' +
              definition.code
            : id === 'month'
              ? definition.code.replace(
                  'indicators ? 480 : false',
                  String(demoOptions.monthCompactBreakpoint),
                )
              : definition.code}
        </CodeBlock>
        <h3>
          {t('Configuração aplicada nesta demonstração', 'Configuration applied in this demo')}
        </h3>
        <CodeBlock locale={language} language="json">
          {JSON.stringify(
            {
              views: views.map((view) => view.name),
              initialView: definition.view,
              initialDate: referenceDate,
              options: demoOptions,
              ...(id === 'day-style' ? { dateStatuses } : {}),
            },
            null,
            2,
          )}
        </CodeBlock>
        <p>
          {t(
            'Trecho de integração. A fonte completa contém imports, dados e callbacks.',
            'Integration snippet. The complete source contains imports, data and callbacks.',
          )}{' '}
          <a href="https://github.com/jacksoncassemiro/calendara/blob/main/examples/feature-examples.tsx">
            GitHub
          </a>
        </p>
      </details>
    </>
  );
}

function FocusedExamples() {
  const query = new URLSearchParams(location.search);
  const requestedDemo = query.get('demo');
  const id = demos.some((demo) => demo.id === requestedDemo) ? requestedDemo! : 'month';
  const definition = demos.find((demo) => demo.id === id)!;
  const [language, setLanguage] = useState<SiteLanguage>(
    query.get('lang') === 'en' ? 'en' : 'pt-BR',
  );
  const [theme, setTheme] = useState<SiteTheme>(
    (query.get('theme') || localStorage.getItem('calendara-theme') || 'system') as SiteTheme,
  );
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    localStorage.setItem('calendara-theme', theme);
    document.documentElement.lang = language;
    return () => media.removeEventListener('change', apply);
  }, [theme, language]);
  return (
    <>
      <SiteHeader
        language={language}
        theme={theme}
        homeHref={`../index.html?lang=${language}&theme=${theme}`}
        onLanguageChange={setLanguage}
        onThemeChange={setTheme}
      />
      <main className="focused-main">
        <h1>{definition.title[language === 'en' ? 1 : 0]}</h1>
        <p>
          <a href={`./react.html?lang=${language}&theme=${theme}`}>
            {language === 'en' ? 'General playground' : 'Playground geral'}
          </a>
        </p>
        <nav
          className="focused-catalog"
          aria-label={language === 'en' ? 'Focused examples' : 'Exemplos focados'}
        >
          {demos.map((demo) => (
            <a
              key={demo.id}
              aria-current={demo.id === id ? 'page' : undefined}
              href={`?demo=${demo.id}&lang=${language}&theme=${theme}`}
            >
              {demo.title[language === 'en' ? 1 : 0]}
            </a>
          ))}
        </nav>
        <Demo key={id} id={id} language={language} />
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<FocusedExamples />);
