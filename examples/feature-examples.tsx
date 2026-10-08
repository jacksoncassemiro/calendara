import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Calendar,
  CalendarEventEditor,
  applyEventTimeChange,
  createNDaysView,
  createReactView,
  createResourceDayView,
  createTimelineView,
  dayView,
  weekView,
  monthView,
  listView,
  useCalendar,
  useCalendarDraggable,
  type CalendarEvent,
  type CalendarProps,
  type EventChange,
  type EventOccurrence,
  type ViewRenderContext,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';
import './react-playground.css';
import './feature-examples.css';
import { SiteHeader, type SiteLanguage, type SiteTheme } from './components/SiteHeader';
import { demos } from './demos/catalog';

const referenceDate = '2026-10-07';
const timeZone = 'UTC';
const rooms = [
  { id: 'room', title: 'Room / Sala', capacity: 2 },
  { id: 'open', title: 'Open / Livre', capacity: false as const },
];

function appointment(
  id: string,
  date = referenceDate,
  start = '09:00',
  end = '10:00',
): CalendarEvent {
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
  const first = appointment('A');
  if (demoId === 'recurrence') return [{ ...first, recurrence: { rule: 'FREQ=DAILY;COUNT=5' } }];
  if (demoId === 'overflow')
    return Array.from({ length: 5 }, (_, index) =>
      appointment(
        String(index),
        referenceDate,
        `09:${index * 10 < 10 ? '0' : ''}${index * 10}`,
        '11:00',
      ),
    );
  const seeds = [first, appointment('B', '2026-10-08', '11:00', '11:30')];
  if (demoId === 'month')
    seeds.push(
      appointment('C', referenceDate, '10:00', '11:00'),
      appointment('D', referenceDate, '11:00', '12:00'),
      appointment('E', referenceDate, '12:00', '13:00'),
    );
  return seeds;
}

function Summary(context: ViewRenderContext) {
  return (
    <section className="focused-summary">
      <h2>{context.referenceDateISO}</h2>
      <ul>
        {context.occurrences.map((occurrence) => (
          <li key={`${occurrence.masterId}-${occurrence.originalStart}`}>
            <button onClick={() => context.onEventClick?.(occurrence)}>
              {occurrence.event.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
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
  const [events, setEvents] = useState(() => seedEvents(id));
  const [reject, setReject] = useState(false);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<EventOccurrence>();
  const [title, setTitle] = useState('');
  const [width, setWidth] = useState(1000);
  const [monthIndicators, setMonthIndicators] = useState(false);
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
      createNDaysView(3, 'three-days'),
      createReactView({ name: 'summary', label: english ? 'Summary' : 'Resumo' }, Summary),
    ];
    return registry.filter(
      (view) =>
        view.name === definition.view ||
        (id === 'week' && view.name === 'day') ||
        (id === 'month' && view.name === 'day'),
    );
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
    if (reject) {
      setStatus(t('Gravação recusada; gesto revertido.', 'Save rejected; gesture reverted.'));
      return false;
    }
    setEvents((current) => applyEventTimeChange(current, change));
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
        {id === 'persistence' && (
          <label>
            <input
              type="checkbox"
              checked={reject}
              onChange={(event) => setReject(event.target.checked)}
            />{' '}
            {t('Recusar gravação', 'Reject save')}
          </label>
        )}
      </section>
      <div className="focused-resizer" ref={containerRef} style={{ width }}>
        <Calendar
          apiRef={apiRef}
          views={views}
          initialView={definition.view}
          initialDate={referenceDate}
          events={source ? undefined : events}
          eventSource={source}
          resources={rooms}
          options={{
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
          }}
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
                  dateISO === '2026-10-08' ? { backgroundColor: '#d8efe3' } : undefined
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
          <TransferCard event={appointment('Template')} />
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
            locale={language}
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
        <pre className="focused-code">
          <code>{definition.code}</code>
        </pre>
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
