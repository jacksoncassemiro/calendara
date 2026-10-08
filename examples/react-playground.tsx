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
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './react-playground.css';
import { SiteHeader, type SiteLanguage, type SiteTheme } from './components/SiteHeader';

const TZ = 'America/Sao_Paulo';
const REF = '2026-10-07';
const englishViewLabels: Record<string, string> = {
  week: 'Week',
  day: 'Day',
  month: 'Month',
  list: 'Agenda',
  resources: 'Resources',
  timeline: 'Timeline',
  summary: 'Summary',
};
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
  const english = context.options.locale?.startsWith('en') ?? false;
  const t = (portuguese: string, englishText: string) => (english ? englishText : portuguese);
  const date = context.referenceDateISO ?? context.range.startDate.toString();
  const formatTime = (occurrence: EventOccurrence) => {
    if (occurrence.event.time.allDay) return t('Dia inteiro', 'All day');
    const eventTime = occurrence.event.time;
    const formatEndpoint = (dateTime: string, timeZone: string) => {
      const instant = context.temporal.PlainDateTime.from(dateTime)
        .toZonedDateTime(timeZone)
        .toInstant();
      return new Intl.DateTimeFormat(context.options.locale, {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: context.options.timeZone,
      }).format(new Date(Number(instant.epochMilliseconds)));
    };
    const startLabel = formatEndpoint(eventTime.start.dateTime!, eventTime.start.timeZone!);
    const endLabel = formatEndpoint(eventTime.end.dateTime!, eventTime.end.timeZone!);
    return `${startLabel} – ${endLabel}${eventTime.end.dateTime!.slice(0, 10) !== date ? t(' · dia seguinte', ' · following day') : ''}`;
  };
  const sorted = [...context.occurrences].sort((left, right) => {
    if (left.event.time.allDay !== right.event.time.allDay) return left.event.time.allDay ? -1 : 1;
    return (left.event.time.start.date ?? left.event.time.start.dateTime!).localeCompare(
      right.event.time.start.date ?? right.event.time.start.dateTime!,
    );
  });
  return (
    <div className="demo-summary">
      <div className="demo-summary-heading">
        <div>
          <h2>{t('Resumo do dia', 'Daily summary')}</h2>
          <p>
            {new Intl.DateTimeFormat(context.options.locale, {
              dateStyle: 'full',
              timeZone: 'UTC',
            }).format(new Date(`${date}T12:00:00Z`))}
          </p>
        </div>
        <button type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded
            ? t('Recolher eventos', 'Collapse events')
            : t('Mostrar eventos', 'Show events')}
        </button>
      </div>
      <p className="demo-summary-count">
        {context.occurrences.length}{' '}
        {t(
          'agendamentos neste dia. Abra um evento para editar seus detalhes.',
          'appointments today. Open an event to edit its details.',
        )}
      </p>
      {expanded && (
        <ul className="demo-summary-list">
          {sorted.map((occurrence) => (
            <li key={`${occurrence.masterId}@${occurrence.originalStart}`}>
              <time>{formatTime(occurrence)}</time>
              <button
                type="button"
                style={{ borderInlineStartColor: occurrence.event.color }}
                onClick={() => context.onEventClick?.(occurrence)}
              >
                <strong>{occurrence.event.title}</strong>
                <span>
                  {occurrence.event.resourceIds
                    ?.map(
                      (id) =>
                        context.resources?.find((resource) => resource.id === id)?.title ?? id,
                    )
                    .join(', ') || t('Sem sala atribuída', 'No room assigned')}
                  {occurrence.event.recurrence ? t(' · Recorrente', ' · Recurring') : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {expanded && !sorted.length && <p>{t('Nenhum evento neste dia.', 'No events today.')}</p>}
      <button type="button" onClick={() => context.onDateClick?.(date, 9 * 60)}>
        {t('Criar evento', 'Create event')}
      </button>
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

function OutsideEvent({ event, english }: { event: CalendarEvent; english: boolean }) {
  const drag = useCalendarDraggable(event);
  return (
    <button type="button" {...drag} className="demo-outside-event" style={{ touchAction: 'none' }}>
      <strong>{event.title}</strong>
      <span>{english ? 'Drag back into the calendar' : 'Arraste de volta para a agenda'}</span>
    </button>
  );
}

function App() {
  const query = new URLSearchParams(window.location.search);
  const [language, setLanguage] = useState<SiteLanguage>(
    query.get('lang') === 'en' ? 'en' : 'pt-BR',
  );
  const t = (portuguese: string, englishText: string) =>
    language === 'en' ? englishText : portuguese;
  const [theme, setTheme] = useState<SiteTheme>(() => {
    const requested = query.get('theme');
    if (requested === 'dark' || requested === 'light' || requested === 'system') return requested;
    try {
      const stored = localStorage.getItem('calendara-theme');
      return stored === 'dark' || stored === 'light' ? stored : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      (document.documentElement.dataset.theme =
        theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);
    apply();
    document.documentElement.lang = language;
    try {
      localStorage.setItem('calendara-theme', theme);
    } catch {
      /* Preferences are optional. */
    }
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme, language]);
  const localizedViews = useMemo(
    () =>
      views.map((view) => ({
        ...view,
        label:
          language === 'en'
            ? (englishViewLabels[view.name] ?? view.label.replace('dias', 'days'))
            : view.label,
        ...(view.name === 'summary'
          ? {
              getTitle: (range: ViewRenderContext['range']) =>
                new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'pt-BR', {
                  dateStyle: 'full',
                  timeZone: 'UTC',
                }).format(new Date(`${range.startDate.toString()}T12:00:00Z`)),
            }
          : {}),
      })),
    [language],
  );
  const { ref, api } = useCalendar();
  const { containerRef } = useCompactCalendar();
  // Width changes alter layout, not a view the user explicitly selected.
  const requestedView = query.get('view') === 'agenda' ? 'list' : query.get('view');
  const initialView = useRef(
    views.some((view) => view.name === requestedView)
      ? requestedView!
      : window.innerWidth < 640
        ? 'day'
        : 'week',
  );
  const scenario = query.get('scenario');
  const [events, setEvents] = useState(() => {
    const seedTitles = [
      'Initial consultation',
      'Weekly follow-up',
      'Conference · 3 days',
      'Overnight shift',
    ];
    const seeds = initialEvents.map((event, index) => ({
      ...event,
      title: language === 'en' ? (seedTitles[index] ?? event.title) : event.title,
    }));
    if (scenario !== 'overflow') return seeds;
    return [
      ...seeds,
      ...Array.from({ length: 5 }, (_, index): CalendarEvent => ({
        ...seeds[0]!,
        id: `overflow-${index}`,
        title: `${language === 'en' ? 'Concurrent appointment' : 'Agendamento simultâneo'} ${index + 1}`,
        resourceIds: [],
      })),
    ];
  });
  const externalEvent: CalendarEvent = {
    id: 'external-template',
    calendarId: 'agenda',
    title: t('Agendamento externo', 'External appointment'),
    time: {
      allDay: false,
      start: { dateTime: `${REF}T09:00:00`, timeZone: TZ },
      end: { dateTime: `${REF}T09:30:00`, timeZone: TZ },
    },
  };
  const externalDrag = useCalendarDraggable(externalEvent);
  const [outsideEvents, setOutsideEvents] = useState<CalendarEvent[]>([]);
  const [rejectNext, setRejectNext] = useState(false);
  const [feedback, setFeedback] = useState(
    t(
      'Selecione um horário livre ou abra um evento para editar.',
      'Select an available time or open an event to edit.',
    ),
  );
  useEffect(() => {
    setFeedback(
      language === 'en'
        ? 'Select an available time or open an event to edit.'
        : 'Selecione um horário livre ou abra um evento para editar.',
    );
  }, [language]);
  const [editing, setEditing] = useState<EventOccurrence | null>(null);
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
  const [visibleResource, setVisibleResource] = useState('');
  const [roomCapacity, setRoomCapacity] = useState(
    scenario === 'overflow' ? 'unlimited' : scenario === 'capacity' ? '4' : '1',
  );
  const [room1Capacity, setRoom1Capacity] = useState('inherit');
  const [room2Capacity, setRoom2Capacity] = useState('inherit');
  const activeResources = resources.map((resource) => {
    const own = resource.id === 'sala-1' ? room1Capacity : room2Capacity;
    return {
      ...resource,
      title: language === 'en' ? resource.title.replace('Sala', 'Room') : resource.title,
      ...(own === 'inherit'
        ? {}
        : { capacity: own === 'unlimited' ? (false as const) : Number(own) }),
    };
  });
  const [densityPolicy, setDensityPolicy] = useState<'shrink' | 'scroll' | 'more'>(
    scenario === 'overflow' ? 'more' : 'shrink',
  );
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
    setEditing(occurrence);
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
    const dayStart = Temporal.PlainDate.from(date).toPlainDateTime('00:00');
    setStart(dayStart.add({ minutes: minute }).toString().slice(0, 16));
    setEnd(dayStart.add({ minutes: endMinute }).toString().slice(0, 16));
    setSelection({ date, minute });
    setAllDay(false);
  };
  const rejectPendingSave = (message?: string) => {
    if (rejectNext) {
      setRejectNext(false);
      setFeedback(
        message ??
          t(
            'Gravação recusada: o horário original foi restaurado.',
            'Save rejected: the original time was restored.',
          ),
      );
      return true;
    }
    return false;
  };
  const commit = async (change: EventChange) => {
    if (rejectPendingSave()) return false;
    setEvents((current) => applyEventTimeChange(current, change));
    setFeedback(t('Horário atualizado nesta demonstração.', 'Time updated in this demo.'));
    return true;
  };
  const closeEditor = () => {
    setEditing(null);
    setSelection(null);
  };
  return (
    <>
      <SiteHeader
        language={language}
        theme={theme}
        homeHref={`../index.html?lang=${language === 'en' ? 'en' : 'pt'}&theme=${theme}`}
        onLanguageChange={(value) => {
          setLanguage(value);
          const url = new URL(window.location.href);
          url.searchParams.set('lang', value === 'en' ? 'en' : 'pt');
          window.history.replaceState(null, '', url);
        }}
        onThemeChange={(value) => {
          setTheme(value);
          const url = new URL(window.location.href);
          url.searchParams.set('theme', value);
          window.history.replaceState(null, '', url);
        }}
      />
      <main>
        <header className="demo-header">
          <div>
            <h1>{t('Experimente sua agenda', 'Try your calendar')}</h1>
            <p>
              {t(
                'Explore eventos, salas e recorrência no fuso de São Paulo.',
                'Explore events, rooms and recurrence in the São Paulo time zone.',
              )}
            </p>
          </div>
          <a
            className="demo-return"
            href={`../index.html?lang=${language === 'en' ? 'en' : 'pt'}&theme=${theme}`}
          >
            {t('Voltar à documentação', 'Back to documentation')}
          </a>
          <button type="button" onClick={() => api.setDate(REF)}>
            {t('Restaurar data de exemplo', 'Reset example date')}
          </button>
        </header>
        <p className="demo-project-note">
          {t(
            'Projeto pessoal e experimental desenvolvido com assistência do OpenAI Codex. Os dados desta demonstração ficam em memória.',
            'Personal, experimental project developed with OpenAI Codex assistance. Demo data stays in memory.',
          )}
        </p>
        {scenario && (
          <p className="demo-scenario">
            {scenario === 'overflow'
              ? t(
                  'Cenário: vários eventos às 09h. Compare Comprimir, Sobreposição parcial e Agrupar em +mais; abra o popover para ver os eventos ocultos.',
                  'Scenario: several events at 09:00. Compare side-by-side, partial overlap and +more; open the popover to see hidden events.',
                )
              : scenario === 'capacity'
                ? t(
                    'Cenário: capacidade padrão de quatro agendamentos. Defina uma capacidade própria para cada sala e compare os bloqueios ao mover eventos.',
                    'Scenario: default capacity of four appointments. Set an override for each room and compare validation when moving events.',
                  )
                : scenario === 'recurrence'
                  ? t(
                      'Cenário: abra Retorno semanal para editar uma ocorrência, os eventos seguintes ou a série. A opção Toda a série habilita os campos de repetição.',
                      'Scenario: open Weekly follow-up to edit one occurrence, following events or the series. Entire series enables recurrence fields.',
                    )
                  : t(
                      'Cenário: use o painel lateral para arrastar eventos de fora para a agenda e da agenda para a área externa.',
                      'Scenario: use the side panel to drag events into the calendar and out into the external area.',
                    )}
          </p>
        )}
        <div className="demo-tools-heading">
          <h2>{t('Configurar a demonstração', 'Configure the demo')}</h2>
          <p>
            {t(
              'Altere as regras e compare a apresentação na agenda abaixo.',
              'Change the rules and compare the calendar below.',
            )}
          </p>
        </div>
        <section
          className="demo-tools"
          aria-label={t('Controles da demonstração', 'Demo controls')}
        >
          <label>
            <input
              type="checkbox"
              checked={rejectNext}
              onChange={(event) => setRejectNext(event.target.checked)}
            />{' '}
            {t('Recusar próxima gravação', 'Reject next save')}
          </label>
          <label>
            <input
              type="checkbox"
              checked={businessHoursEnabled}
              onChange={(event) => setBusinessHoursEnabled(event.target.checked)}
            />{' '}
            {t('Aplicar restrições de horário', 'Apply availability restrictions')}
          </label>
          <label>
            {t('Capacidade padrão', 'Default capacity')}
            <select
              aria-label={t('Capacidade padrão', 'Default capacity')}
              value={roomCapacity}
              onChange={(event) => setRoomCapacity(event.target.value)}
            >
              <option value={1}>{t('1 simultâneo', '1 concurrent')}</option>
              <option value={4}>{t('4 simultâneos', '4 concurrent')}</option>
              <option value={10}>{t('10 simultâneos', '10 concurrent')}</option>
              <option value="unlimited">{t('Sem limite', 'Unlimited')}</option>
            </select>
          </label>
          <label>
            {t('Capacidade Sala 1', 'Room 1 capacity')}
            <select
              aria-label={t('Capacidade Sala 1', 'Room 1 capacity')}
              value={room1Capacity}
              onChange={(event) => setRoom1Capacity(event.target.value)}
            >
              <option value="inherit">{t('Usar padrão', 'Inherit default')}</option>
              <option value="1">{t('1 simultâneo', '1 concurrent')}</option>
              <option value="4">{t('4 simultâneos', '4 concurrent')}</option>
              <option value="unlimited">{t('Sem limite', 'Unlimited')}</option>
            </select>
          </label>
          <label>
            {t('Capacidade Sala 2', 'Room 2 capacity')}
            <select
              aria-label={t('Capacidade Sala 2', 'Room 2 capacity')}
              value={room2Capacity}
              onChange={(event) => setRoom2Capacity(event.target.value)}
            >
              <option value="inherit">{t('Usar padrão', 'Inherit default')}</option>
              <option value="1">{t('1 simultâneo', '1 concurrent')}</option>
              <option value="4">{t('4 simultâneos', '4 concurrent')}</option>
              <option value="unlimited">{t('Sem limite', 'Unlimited')}</option>
            </select>
          </label>
          <label>
            {t('Eventos próximos', 'Concurrent events')}
            <select
              aria-label={t('Eventos próximos', 'Concurrent events')}
              value={densityPolicy}
              onChange={(event) => setDensityPolicy(event.target.value as typeof densityPolicy)}
            >
              <option value="shrink">{t('Comprimir', 'Side by side')}</option>
              <option value="scroll">{t('Ampliar e rolar', 'Expand and scroll')}</option>
              <option value="more">{t('Agrupar em +mais', 'Group in +more')}</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={slotEventOverlap}
              onChange={(event) => setSlotEventOverlap(event.target.checked)}
            />{' '}
            {t('Sobreposição parcial de eventos', 'Partial event overlap')}
          </label>
          <label>
            {t('Recurso visível', 'Visible resource')}
            <select
              value={visibleResource}
              onChange={(event) => setVisibleResource(event.target.value)}
            >
              <option value="">{t('Todos os recursos', 'All resources')}</option>
              {activeResources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.title}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => setMounted((value) => !value)}>
            {mounted
              ? t('Desmontar calendário', 'Unmount calendar')
              : t('Montar calendário', 'Mount calendar')}
          </button>
          <label>
            {t('Duração do slot', 'Slot duration')}
            <select
              aria-label={t('Duração do slot', 'Slot duration')}
              value={slotMinutes}
              onChange={(event) => setSlotMinutes(Number(event.target.value))}
            >
              <option value={15}>{t('15 minutos', '15 minutes')}</option>
              <option value={30}>{t('30 minutos', '30 minutes')}</option>
              <option value={60}>{t('60 minutos', '60 minutes')}</option>
            </select>
          </label>
          <label>
            {t('Tamanho do slot', 'Slot size')}
            <select
              aria-label={t('Tamanho do slot', 'Slot size')}
              value={timeScale}
              onChange={(event) => setTimeScale(Number(event.target.value))}
            >
              <option value={1}>{t('30 px por slot', '30 px per slot')}</option>
              <option value={1.5}>{t('45 px por slot', '45 px per slot')}</option>
              <option value={2}>{t('60 px por slot', '60 px per slot')}</option>
            </select>
          </label>
          <label>
            {t('Intervalo dos rótulos', 'Label interval')}
            <select
              aria-label={t('Intervalo dos rótulos', 'Label interval')}
              value={labelInterval}
              onChange={(event) => setLabelInterval(Number(event.target.value))}
            >
              <option value={0}>{t('Automático', 'Automatic')}</option>
              <option value={15}>{t('A cada 15 minutos', 'Every 15 minutes')}</option>
              <option value={30}>{t('A cada 30 minutos', 'Every 30 minutes')}</option>
              <option value={60}>{t('A cada hora', 'Every hour')}</option>
            </select>
          </label>
          <label>
            {t('Ver mais', 'More events')}
            <select value={moreBehavior} onChange={(event) => setMoreBehavior(event.target.value)}>
              <option value="popover">{t('Popover padrão', 'Default popover')}</option>
              <option value="custom">
                {t('Conteúdo React personalizado', 'Custom React content')}
              </option>
              <option value="day">{t('Abrir view Dia', 'Open day view')}</option>
            </select>
          </label>
        </section>
        <p className="demo-note" aria-label={t('Configuração do eixo', 'Time axis configuration')}>
          <code>
            slotMinutes: {slotMinutes} · pxPerMinute:{' '}
            {Number(((timeScale * 30) / slotMinutes).toFixed(3))} · timeLabelInterval:{' '}
            {labelInterval || t('automático', 'automatic')}
          </code>
        </p>
        <p className="demo-availability-legend">
          <span className="demo-buffer-key" aria-hidden="true" />
          {t(
            'Preparo: 15 minutos após eventos da Sala 1; acompanha o evento.',
            'Preparation: 15 minutes after Room 1 events; moves with the event.',
          )}
          <span className="demo-blocked-key" aria-hidden="true" />
          {t(
            'Bloqueios fixos permanecem no horário definido.',
            'Fixed blocks stay at their configured time.',
          )}
        </p>
        <p className="demo-feedback" role="status">
          {feedback}
        </p>
        <section aria-label={t('Arrasto externo', 'External drag')} className="demo-controls">
          <h2>{t('Arrastar entre áreas', 'Drag between areas')}</h2>
          <p>
            {t(
              'Arraste o modelo para um horário. Para retirar um evento, solte na área abaixo. Em séries, apenas esta ocorrência sai.',
              'Drag the template to a time. To move an event out, drop it below. For a series, only this occurrence leaves.',
            )}
          </p>
          <button type="button" {...externalDrag} style={{ touchAction: 'none' }}>
            {t(
              'Arrastar agendamento externo · 30 minutos',
              'Drag external appointment · 30 minutes',
            )}
          </button>
          <div data-demo-drop-zone>
            <span>
              {t(
                'Área externa: solte aqui para receber a ação de saída',
                'External area: drop here to receive the exit action',
              )}
            </span>
            {outsideEvents.map((event) => (
              <OutsideEvent key={event.id} event={event} english={language === 'en'} />
            ))}
          </div>
        </section>
        <section ref={containerRef} className="demo-calendar" aria-label={t('Agenda', 'Agenda')}>
          {mounted ? (
            <Calendar
              apiRef={ref}
              initialDate={REF}
              initialView={initialView.current}
              events={events}
              options={{
                ...options,
                locale: language === 'en' ? 'en-US' : 'pt-BR',
                defaultResourceCapacity:
                  roomCapacity === 'unlimited' ? false : Number(roomCapacity),
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
              constraints={
                businessHoursEnabled
                  ? {
                      ...constraints,
                      blocked: constraints.blocked.map((blocked) => ({
                        ...blocked,
                        description: t('Almoço', 'Lunch'),
                      })),
                    }
                  : {}
              }
              resources={activeResources}
              views={localizedViews}
              renderMonthMore={
                moreBehavior === 'custom'
                  ? (info) => (
                      <div className="demo-more-custom">
                        <p>
                          {info.occurrences.length} {t('eventos nesta data', 'events on this date')}
                        </p>
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
                          {t('Abrir agenda do dia', 'Open day calendar')}
                        </button>
                      </div>
                    )
                  : undefined
              }
              onEventDrop={commit}
              onExternalEventDrop={(change) => {
                if (
                  rejectPendingSave(
                    t(
                      'Gravação recusada: o agendamento externo não foi inserido.',
                      'Save rejected: the external appointment was not inserted.',
                    ),
                  )
                )
                  return;
                setEvents((current) => [...current, { ...change.event, id: crypto.randomUUID() }]);
                setOutsideEvents((current) =>
                  current.filter((event) => event.id !== change.event.id),
                );
                setFeedback(
                  t(
                    'Agendamento externo recebido e salvo nesta demonstração.',
                    'External appointment received and saved in this demo.',
                  ),
                );
              }}
              onEventDropOutside={({ occurrence, target }) => {
                if (target?.closest('[data-demo-drop-zone]')) {
                  if (
                    rejectPendingSave(
                      t(
                        'Gravação recusada: o evento continua na agenda.',
                        'Save rejected: the event remains in the calendar.',
                      ),
                    )
                  )
                    return;
                  setOutsideEvents((current) => [
                    ...current,
                    { ...occurrence.event, recurrence: undefined, id: crypto.randomUUID() },
                  ]);
                  setEvents((current) =>
                    current.flatMap((event) => {
                      if (event.id !== occurrence.masterId) return [event];
                      if (!event.recurrence) return [];
                      return [
                        {
                          ...event,
                          recurrence: {
                            ...event.recurrence,
                            overrides: {
                              ...event.recurrence.overrides,
                              [occurrence.originalStart]: { cancelled: true },
                            },
                          },
                        },
                      ];
                    }),
                  );
                  setFeedback(
                    `${occurrence.event.title}: ${t('removido da agenda e enviado para a área externa.', 'removed from the calendar and sent to the external area.')}`,
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
                    ? t(
                        'Alteração recusada: o intervalo atravessa um bloqueio. Desative “Aplicar restrições de horário” para experimentar livremente.',
                        'Change rejected: the interval crosses a blocked time. Disable availability restrictions to explore freely.',
                      )
                    : info.reason === 'outside-business-hours'
                      ? t(
                          'Alteração recusada: o intervalo ultrapassa o expediente. Desative “Aplicar restrições de horário” para experimentar livremente.',
                          'Change rejected: the interval falls outside business hours. Disable availability restrictions to explore freely.',
                        )
                      : info.reason === 'over-capacity'
                        ? t(
                            'Alteração recusada: capacidade da sala excedida (limite configurado por sala).',
                            'Change rejected: room capacity exceeded (configured per room).',
                          )
                        : info.reason === 'buffer-conflict'
                          ? t(
                              'Alteração recusada: conflito com os 15 minutos de preparação da Sala 1.',
                              'Change rejected: conflict with Room 1’s 15-minute preparation buffer.',
                            )
                          : `${t('Alteração recusada', 'Change rejected')}: ${info.reason}.`,
                )
              }
              onClickBlocked={(info) =>
                setFeedback(
                  info.reason === 'outside-business-hours'
                    ? t(
                        'Horário indisponível: fora do expediente (segunda a sexta, 08h–20h).',
                        'Unavailable time: outside business hours (Monday–Friday, 08:00–20:00).',
                      )
                    : info.reason === 'blocked'
                      ? t(
                          'Horário indisponível: intervalo bloqueado.',
                          'Unavailable time: blocked interval.',
                        )
                      : info.reason === 'over-capacity'
                        ? t(
                            'Horário indisponível: capacidade da sala excedida (limite configurado por sala).',
                            'Unavailable time: room capacity exceeded (configured per room).',
                          )
                        : info.reason === 'buffer-conflict'
                          ? t(
                              'Horário indisponível: conflito com a preparação de 15 minutos da Sala 1.',
                              'Unavailable time: conflict with Room 1’s 15-minute preparation buffer.',
                            )
                          : `${t('Horário indisponível', 'Unavailable time')}: ${info.reason}.`,
                )
              }
            />
          ) : (
            <p>
              {t(
                'Calendário desmontado. Use “Montar calendário” para continuar.',
                'Calendar unmounted. Select “Mount calendar” to continue.',
              )}
            </p>
          )}
        </section>
        <p className="demo-note">
          {t(
            'Os dados ficam em memória. Arraste ou redimensione o intervalo completo; abra o editor para reagendar por teclado ou no celular.',
            'Data stays in memory. Drag or resize the full interval; open the editor to reschedule with a keyboard or on mobile.',
          )}
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
          <h2 id="editor-title">
            {editing ? t('Editar evento', 'Edit event') : t('Criar evento', 'Create event')}
          </h2>
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
              locale={language}
              onCancel={closeEditor}
              validate={(draft) => {
                const evaluation = api.evaluateEvent(draft, editing ?? undefined);
                if (!evaluation.valid)
                  return `${t('Horário ou recurso indisponível', 'Unavailable time or resource')}: ${evaluation.reason}.`;
              }}
              onSave={(draft, context) => {
                if (
                  rejectPendingSave(
                    t(
                      'Gravação recusada: os dados anteriores foram preservados.',
                      'Save rejected: the previous event data was preserved.',
                    ),
                  )
                )
                  return false;
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
                  setFeedback(
                    t(
                      'Este evento e os seguintes foram atualizados.',
                      'This and following events were updated.',
                    ),
                  );
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
                setFeedback(
                  editing
                    ? t('Evento atualizado.', 'Event updated.')
                    : t('Evento criado.', 'Event created.'),
                );
                closeEditor();
              }}
              onDelete={
                editing
                  ? (_draft, context) => {
                      if (
                        rejectPendingSave(
                          t(
                            'Exclusão recusada: o evento foi preservado.',
                            'Deletion rejected: the event was preserved.',
                          ),
                        )
                      )
                        return false;
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
                        setFeedback(
                          t(
                            'Este evento e os seguintes foram excluídos.',
                            'This and following events were deleted.',
                          ),
                        );
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
                      setFeedback(t('Evento excluído.', 'Event deleted.'));
                      closeEditor();
                    }
                  : undefined
              }
            />
          )}
        </dialog>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
