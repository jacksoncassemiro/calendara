/** @jsxImportSource react */
/** Month grid with continuous multi-day event segments.
 * @remarks Português: Grade mensal com segmentos contínuos de eventos de vários dias.
 */
import { occurrenceKey } from '../../core/render/derive.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
import { createElement, lazy, Suspense, useEffect, useId, useRef, useState, type JSX } from 'react';
import { hasAvailableTime } from '../../core/constraint/constraintEngine.js';
import type { EventOccurrence, TemporalLike } from '../../core/index.js';
import { occurrenceStart, resolveHour } from '../../core/index.js';
import { isNestedInteractiveTarget } from '../../core/interaction/interactiveTarget.js';
import type {
  CalendarView,
  MonthMoreInfo,
  ViewContext,
  ViewRange,
  ViewRenderContext,
} from '../viewTypes.js';
import { formatDate, formatDraftInterval, formatHourLabel } from './formatting/timeLabels.js';
import { getViewLabels } from './formatting/viewLabels.js';
import { occurrenceDays } from './layout/occurrenceDays.js';
import { packDateSpans } from './layout/spanLayout.js';
const MonthMorePopover = lazy(() =>
  import('./components/MonthMorePopover.js').then((module) => ({
    default: module.MonthMorePopover,
  })),
);

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

interface MonthChip {
  /** Stable occurrence or DOM identifier. @remarks Português: Identificador estável da ocorrência ou do DOM. */
  id: string;
  /** Original occurrence and event identity. @remarks Português: Ocorrência original e identidade do evento. */
  occurrence: EventOccurrence;
  /** Formatted event time; empty for all-day items. @remarks Português: Horário formatado; vazio para itens de dia inteiro. */
  timeLabel: string;
  /** Whether the event occupies dates rather than times. @remarks Português: Indica se o evento ocupa datas em vez de horários. */
  isAllDay: boolean;
  /** Start instant in epoch milliseconds, used for ordering. @remarks Português: Instante inicial em milissegundos desde época, usado para ordenação. */
  epochMs: number;
  /** Inclusive start in minutes since midnight. @remarks Português: Início inclusivo em minutos desde meia-noite. */
  startMin: number;
  /** First displayed date, YYYY-MM-DD. @remarks Português: Primeira data exibida, YYYY-MM-DD. */
  startDayISO: string;
  /** Last displayed date, inclusive, YYYY-MM-DD. @remarks Português: Última data exibida, inclusiva, YYYY-MM-DD. */
  endDayISO: string;
}

interface MonthSegment {
  /** Event represented by this week segment. @remarks Português: Evento representado por este segmento semanal. */
  chip: MonthChip;
  /** Zero-based starting day index within the week. @remarks Português: Índice inicial do dia na semana, começando em zero. */
  start: number;
  /** Number of visible dates covered. @remarks Português: Quantidade de datas visíveis cobertas. */
  span: number;
  /** Zero-based event row. @remarks Português: Linha do evento, começando em zero. */
  lane: number;
  /** Visible ISO dates covered by the segment. @remarks Português: Datas ISO visíveis cobertas pelo segmento. */
  dates: string[];
}

/** Pack week segments into continuous event rows. @remarks Português: Distribui segmentos semanais em linhas contínuas de eventos. */
function packWeek({
  days,
  chipsByDay,
}: {
  /** Week dates in display order. @remarks Português: Datas da semana na ordem exibida. */
  days: string[];
  /** Occurrence chips indexed by visible date. @remarks Português: Cartões de ocorrências por data visível. */
  chipsByDay: Map<string, MonthChip[]>;
}): MonthSegment[] {
  const chips = new Map<string, MonthChip>();
  for (const day of days) for (const chip of chipsByDay.get(day) ?? []) chips.set(chip.id, chip);
  const segments = [...chips.values()]
    .map((chip) => {
      const dates = days.filter((day) => day >= chip.startDayISO && day <= chip.endDayISO);
      return {
        chip,
        start: days.indexOf(dates[0]!),
        span: dates.length,
        lane: 0,
        dates,
      };
    })
    .sort(
      (a, b) =>
        Number(b.chip.isAllDay) - Number(a.chip.isAllDay) ||
        Number(b.span > 1) - Number(a.span > 1) ||
        a.start - b.start ||
        a.chip.epochMs - b.chip.epochMs,
    );
  return packDateSpans(segments);
}

/** Month grid including adjacent dates. @remarks Português: Grade mensal incluindo datas adjacentes. */
export const monthView: CalendarView = {
  name: 'month',
  label: 'Mês',

  getRange(date: PlainDate, context: ViewContext): ViewRange {
    const { dateUtils, options } = context;
    const firstOfMonth = date.with({ day: 1 });
    const lastOfMonth = date.with({ day: date.daysInMonth });
    const gridStart = dateUtils.startOfWeek({ date: firstOfMonth, weekStart: options.weekStart });
    const gridEndExclusive = dateUtils
      .startOfWeek({ date: lastOfMonth, weekStart: options.weekStart })
      .add({ days: 7 });
    const days = dateUtils.eachDayOfRange({ start: gridStart, end: gridEndExclusive });
    return {
      days,
      startDate: gridStart,
      endDate: gridEndExclusive.subtract({ days: 1 }),
    };
  },

  navigate({ direction, date }) {
    const anchor = date.with({ day: 1 });
    return direction === 'next' ? anchor.add({ months: 1 }) : anchor.subtract({ months: 1 });
  },

  getTitle(range, context): string {
    // The third week identifies this month. PT: A terceira semana identifica o mês da grade.
    const middle = range.days[Math.floor(range.days.length / 2)] ?? range.startDate;
    return formatDate({
      date: middle,
      locale: context.options.locale,
      options: {
        month: 'long',
        year: 'numeric',
      },
    });
  },

  render(context: ViewRenderContext): JSX.Element {
    return createElement(MonthGrid, { context });
  },
};

function MonthGrid(props: {
  /** Resolved view data and consumer callbacks. @remarks Português: Dados resolvidos da view e callbacks do consumidor. */
  context: ViewRenderContext;
}): JSX.Element {
  const compactBreakpoint = props.context.options.monthCompactBreakpoint ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [selectedISO, setSelectedISO] = useState<string>();
  const [expandedISO, setExpandedISO] = useState<string>();
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const moreAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [moreInfo, setMoreInfo] = useState<MonthMoreInfo>();
  const detailId = useId();
  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const updateWidth = (width: number) => {
      if (width > 0) setCompact(compactBreakpoint !== false && width < compactBreakpoint);
    };
    const measure = () => updateWidth(element.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry) updateWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [compactBreakpoint]);
  const { temporal, options, range, occurrences, nowMs } = props.context;
  const labels = getViewLabels(options.locale);
  const visibleStartMin = resolveHour(options.startHour) * 60;
  const visibleEndMin = resolveHour(options.endHour) * 60;
  const unavailableDays = new Set(
    range.days
      .map((day) => day.toString())
      .filter(
        (date) =>
          !hasAvailableTime({
            constraints: props.context.constraints,
            date,
            startMin: visibleStartMin,
            endMin: visibleEndMin,
          }),
      ),
  );
  const referenceMonth = (range.days[Math.floor(range.days.length / 2)] ?? range.startDate).month;
  const todayISO = temporal.Instant.fromEpochMilliseconds(nowMs)
    .toZonedDateTimeISO(options.timeZone)
    .toPlainDate()
    .toString();

  const chipsByDay = new Map<string, MonthChip[]>();
  for (const occurrence of occurrences) {
    const start = occurrenceStart({
      temporal,
      occurrence,
      displayTimeZone: options.timeZone,
    });
    const endDayISO = occurrence.event.time.allDay
      ? temporal.PlainDate.from(occurrence.event.time.end.date!).subtract({ days: 1 }).toString()
      : temporal.PlainDateTime.from(occurrence.event.time.end.dateTime!)
          .toZonedDateTime(occurrence.event.time.end.timeZone ?? options.timeZone)
          .withTimeZone(options.timeZone)
          .subtract({ nanoseconds: 1 })
          .toPlainDate()
          .toString();
    for (const dayISO of occurrenceDays({ occurrence, context: props.context })) {
      const list = chipsByDay.get(dayISO) ?? [];
      list.push({
        id: occurrenceKey(occurrence),
        occurrence,
        isAllDay: start.isAllDay,
        epochMs: start.epochMs,
        startMin: start.minuteOfDay,
        startDayISO: start.dayISO,
        endDayISO,
        timeLabel: start.isAllDay
          ? ''
          : formatHourLabel({ minuteOfDay: start.minuteOfDay, locale: options.locale }),
      });
      chipsByDay.set(dayISO, list);
    }
  }
  for (const list of chipsByDay.values()) list.sort((left, right) => left.epochMs - right.epochMs);
  const selectedDay =
    range.days.find((day) => day.toString() === selectedISO) ??
    range.days.find((day) => day.toString() === props.context.referenceDateISO) ??
    range.days.find((day) => day.toString() === todayISO) ??
    range.days.find((day) => day.month === referenceMonth) ??
    range.startDate;
  const selectedChips = chipsByDay.get(selectedDay.toString()) ?? [];
  useEffect(() => {
    setSelectedISO(undefined);
    setExpandedISO(undefined);
    setMoreInfo(undefined);
  }, [range.startDate.toString(), props.context.referenceDateISO]);
  const showDetail = compact || expandedISO === selectedDay.toString();
  const maxEvents = options.monthMaxEvents === false ? Infinity : (options.monthMaxEvents ?? 3);
  const closeDetail = () => {
    setExpandedISO(undefined);
    moreAnchorRef.current?.focus({ preventScroll: true });
  };

  const weekdayHeaders = range.days.slice(0, 7).map((day) => ({
    key: day.toString(),
    label: formatDate({ date: day, locale: options.locale, options: { weekday: 'short' } }),
  }));

  const weeks: PlainDate[][] = [];
  for (let index = 0; index < range.days.length; index += 7) {
    weeks.push(range.days.slice(index, index + 7));
  }
  const weekSegments = weeks.map((week) =>
    packWeek({ days: week.map((day) => day.toString()), chipsByDay }),
  );
  const monthLaneCount = Math.max(0, ...weekSegments.flat().map((segment) => segment.lane + 1));
  const monthEventsHeight =
    Math.min(monthLaneCount, maxEvents) * 22 + (monthLaneCount > maxEvents ? 28 : 0);

  return (
    <div
      ref={rootRef}
      className={`mc-month${compact ? ' mc-month-compact' : ''}`}
      data-mc-view="month"
    >
      {compact && <p className="mc-month-legend">{labels.monthLegend}</p>}
      <div className="mc-month-weekdays" style={{ display: 'flex' }}>
        {weekdayHeaders.map((header) => (
          <div
            key={header.key}
            className="mc-month-weekday"
            style={{ flex: '1 1 0', textAlign: 'center' }}
          >
            {header.label}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => {
        const segments = weekSegments[weekIndex]!;
        const draft = props.context.draft;
        const draftEnd = draft?.endDateISO ?? draft?.dateISO;
        const draftDates = draft
          ? week
              .map((day) => day.toString())
              .filter(
                (date) =>
                  date >= draft.dateISO &&
                  (date < draftEnd! || (date === draftEnd && !draft.allDay && draft.endMin > 0)),
              )
          : [];
        const draftLane = Math.max(
          0,
          ...segments
            .filter((segment) => segment.dates.some((date) => draftDates.includes(date)))
            .map((segment) => segment.lane + 1),
        );
        const laneCount = Math.max(
          draftDates.length ? draftLane + 1 : 0,
          ...segments.map((segment) => segment.lane + 1),
        );
        const visibleLanes = Math.min(laneCount, maxEvents);
        return (
          <div key={week[0]!.toString()} className="mc-month-week" style={{ display: 'flex' }}>
            {week.map((day) => {
              const dayISO = day.toString();
              const chips = chipsByDay.get(dayISO) ?? [];
              const visibleSegments = segments.filter(
                (segment) => segment.start === week.indexOf(day) && segment.lane < maxEvents,
              );
              const hiddenCount = segments.filter(
                (segment) => segment.dates.includes(dayISO) && segment.lane >= maxEvents,
              ).length;
              const isToday = dayISO === todayISO;
              const outsideMonth = day.month !== referenceMonth;
              return (
                <div
                  key={dayISO}
                  className={
                    `mc-month-day${isToday ? ' mc-today' : ''}` +
                    (outsideMonth ? ' mc-outside-month' : '') +
                    (unavailableDays.has(dayISO) ? ' mc-unavailable' : '')
                  }
                  data-mc-month-day={dayISO}
                  data-mc-unavailable={unavailableDays.has(dayISO) ? 'true' : undefined}
                  title={
                    unavailableDays.has(dayISO)
                      ? 'Sem horários disponíveis na faixa exibida (regras gerais do calendário)'
                      : undefined
                  }
                  style={{
                    ...props.context.getDayStyle?.({
                      dateISO: dayISO,
                      viewName: 'month',
                    }),
                    flex: '1 1 0',
                  }}
                >
                  <DayHeaderContent
                    context={props.context}
                    dateISO={dayISO}
                    viewName="month"
                    isSelected={compact && dayISO === selectedDay.toString()}
                    defaultContent={
                      compact || props.context.onDateClick ? (
                        <button
                          type="button"
                          className="mc-month-daynum"
                          tabIndex={dayISO === selectedDay.toString() ? 0 : -1}
                          onKeyDown={(event) => {
                            const buttons = [
                              ...(rootRef.current?.querySelectorAll<HTMLButtonElement>(
                                'button.mc-month-daynum',
                              ) ?? []),
                            ];
                            const index = buttons.indexOf(event.currentTarget);
                            const direction =
                              getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
                            let next = index;
                            if (event.key === 'ArrowLeft') next -= direction;
                            else if (event.key === 'ArrowRight') next += direction;
                            else if (event.key === 'ArrowUp') next -= 7;
                            else if (event.key === 'ArrowDown') next += 7;
                            else if (event.key === 'Home')
                              next = event.ctrlKey ? 0 : index - (index % 7);
                            else if (event.key === 'End')
                              next = event.ctrlKey ? buttons.length - 1 : index - (index % 7) + 6;
                            else return;
                            event.preventDefault();
                            const target = buttons[Math.max(0, Math.min(buttons.length - 1, next))];
                            if (target) {
                              setSelectedISO(
                                target.closest<HTMLElement>('[data-mc-month-day]')!.dataset
                                  .mcMonthDay,
                              );
                              target.focus();
                              target.scrollIntoView?.({
                                block: 'nearest',
                                inline: 'nearest',
                              });
                            }
                          }}
                          aria-label={`${formatDate({ date: day, locale: options.locale, options: { dateStyle: 'full' } })}${compact ? `, ${chips.length} ${chips.length === 1 ? labels.event : labels.events}` : ''}${unavailableDays.has(dayISO) ? `, ${labels.unavailableRange}` : ''}`}
                          aria-pressed={compact ? dayISO === selectedDay.toString() : undefined}
                          aria-controls={compact ? detailId : undefined}
                          aria-current={isToday ? 'date' : undefined}
                          onClick={() => {
                            setSelectedISO(dayISO);
                            if (!compact) props.context.onDateClick?.(dayISO);
                          }}
                        >
                          {formatDate({
                            date: day,
                            locale: options.locale,
                            options: { day: 'numeric' },
                          })}
                        </button>
                      ) : (
                        <div
                          className="mc-month-daynum"
                          aria-current={isToday ? 'date' : undefined}
                        >
                          {formatDate({
                            date: day,
                            locale: options.locale,
                            options: { day: 'numeric' },
                          })}
                          {unavailableDays.has(dayISO) && (
                            <span className="mc-month-unavailable-note">
                              : sem horários disponíveis na faixa exibida
                            </span>
                          )}
                        </div>
                      )
                    }
                  />
                  <span className="mc-month-count" aria-hidden="true">
                    {chips.length || ''}
                  </span>
                  <div
                    className="mc-month-events"
                    style={{
                      position: 'relative',
                      height: Math.max(
                        maxEvents === Infinity ? visibleLanes * 22 : monthEventsHeight,
                        draftDates.length ? (draftLane + 1) * 22 : 0,
                      ),
                    }}
                  >
                    {draft && draftDates[0] === dayISO && (
                      <div
                        className={`mc-month-event mc-month-draft${draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid'}`}
                        data-mc-draft={draft.kind}
                        data-mc-draft-dates={draftDates.join(' ')}
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: draftLane * 22,
                          left: 0,
                          height: 20,
                          width: `calc(${draftDates.length * 100}% + ${draftDates.length - 1}px - 4px)`,
                          zIndex: 2,
                        }}
                      >
                        <span className="mc-draft-time">
                          {formatDraftInterval({ draft, locale: options.locale })}
                        </span>
                        {' · '}
                        <span className="mc-draft-title">
                          {draft.title ??
                            (draft.eventId
                              ? (occurrences.find(
                                  (occurrence) => occurrenceKey(occurrence) === draft.eventId,
                                )?.event.title ?? labels.newInterval)
                              : labels.newInterval)}
                        </span>
                        {!draft.valid && (
                          <span className="mc-draft-reason">{` · Indisponível: ${draft.reason}`}</span>
                        )}
                      </div>
                    )}
                    {visibleSegments.map(({ chip, span, lane, dates }) => (
                      <div
                        key={chip.id}
                        className={`mc-month-event${chip.isAllDay ? ' mc-allday' : ''}${span > 1 ? ' mc-month-span' : ''}${dayISO > chip.startDayISO ? ' mc-continues-before' : ''}${dates.at(-1)! < chip.endDayISO ? ' mc-continues-after' : ''}`}
                        data-mc-month-event={chip.id}
                        data-mc-month-dates={dates.join(' ')}
                        data-mc-event={chip.id}
                        data-mc-start-min={chip.startMin}
                        data-mc-end-min="0"
                        data-mc-editable={
                          chip.occurrence.event.editable === false ? 'false' : 'true'
                        }
                        role={props.context.onEventClick ? 'button' : undefined}
                        tabIndex={props.context.onEventClick ? 0 : undefined}
                        onClick={(event) => {
                          if (
                            !isNestedInteractiveTarget(event.target, event.currentTarget) &&
                            event.detail === 0
                          )
                            props.context.onEventClick?.(chip.occurrence);
                        }}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget || !props.context.onEventClick)
                            return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            props.context.onEventClick(chip.occurrence);
                          }
                        }}
                        title={chip.occurrence.event.title}
                        style={{
                          position: 'absolute',
                          top: lane * 22,
                          left: 0,
                          height: 20,
                          width: `calc(${span * 100}% + ${span - 1}px - 4px)`,
                          zIndex: 1,
                          ...(draft?.eventId === chip.id ? { visibility: 'hidden' as const } : {}),
                          ...(chip.occurrence.event.color
                            ? {
                                boxShadow: `inset 3px 0 0 ${chip.occurrence.event.color}`,
                              }
                            : {}),
                        }}
                      >
                        {props.context.renderEvent
                          ? props.context.renderEvent({
                              occurrence: chip.occurrence,
                              event: chip.occurrence.event,
                              timeLabel: chip.timeLabel,
                              isAllDay: chip.isAllDay,
                            })
                          : `${chip.timeLabel ? chip.timeLabel + ' ' : ''}${chip.occurrence.event.title}`}
                        {chip.occurrence.event.editable !== false &&
                          dayISO === chip.startDayISO && (
                            <span
                              className="mc-month-resize mc-resize-start"
                              data-mc-resize="start"
                              aria-hidden="true"
                            />
                          )}
                        {chip.occurrence.event.editable !== false &&
                          dates.at(-1) === chip.endDayISO && (
                            <span
                              className="mc-month-resize"
                              data-mc-resize="end"
                              aria-hidden="true"
                            />
                          )}
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        className="mc-month-more"
                        style={{ position: 'absolute', top: visibleLanes * 22 }}
                        aria-expanded={expandedISO === dayISO}
                        aria-controls={detailId}
                        aria-label={`${labels.moreEvents} ${hiddenCount} ${labels.events} ${labels.onDate} ${formatDate({ date: day, locale: options.locale, options: { dateStyle: 'full' } })}`}
                        onClick={(click) => {
                          if (expandedISO === dayISO) closeDetail();
                          else {
                            moreAnchorRef.current = click.currentTarget;
                            const info: MonthMoreInfo = {
                              dateISO: dayISO,
                              occurrences: chips.map((chip) => chip.occurrence),
                              hiddenOccurrences: segments
                                .filter(
                                  (segment) =>
                                    segment.dates.includes(dayISO) && segment.lane >= maxEvents,
                                )
                                .map((segment) => segment.chip.occurrence),
                              anchor: click.currentTarget,
                              close: closeDetail,
                              openView: (viewName) => {
                                closeDetail();
                                props.context.openDateView?.(dayISO, viewName);
                              },
                            };
                            if (props.context.onMonthMoreClick?.(info) === false) return;
                            if (options.monthMoreView) {
                              info.openView(options.monthMoreView);
                              return;
                            }
                            setMoreInfo(info);
                            setSelectedISO(dayISO);
                            setExpandedISO(dayISO);
                          }
                        }}
                      >
                        +{hiddenCount}
                        <span className="mc-month-more-label"> {labels.more}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {unavailableDays.size > 0 && (
        <p className="mc-month-availability-legend" data-mc-availability-legend>
          {labels.unavailableDays}
        </p>
      )}
      {showDetail &&
        (compact ? (
          <section
            id={detailId}
            className="mc-month-detail"
            aria-label={labels.selectedDayEvents}
            onKeyDown={(event) => {
              if (!compact && event.key === 'Escape') {
                event.preventDefault();
                closeDetail();
              }
            }}
          >
            <h3 ref={detailHeadingRef} tabIndex={-1} aria-live="polite">
              {formatDate({
                date: selectedDay,
                locale: options.locale,
                options: { dateStyle: 'full' },
              })}
            </h3>
            {selectedChips.length === 0 && <p className="mc-list-empty">{labels.noEventsDay}</p>}
            {selectedChips.map((chip) => (
              <div
                key={chip.id}
                className="mc-list-item"
                data-mc-month-detail-event={chip.id}
                role={props.context.onEventClick ? 'button' : undefined}
                tabIndex={props.context.onEventClick ? 0 : undefined}
                onClick={(event) => {
                  if (!isNestedInteractiveTarget(event.target, event.currentTarget))
                    props.context.onEventClick?.(chip.occurrence);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || !props.context.onEventClick) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.context.onEventClick(chip.occurrence);
                  }
                }}
              >
                {props.context.renderEvent ? (
                  props.context.renderEvent({
                    occurrence: chip.occurrence,
                    event: chip.occurrence.event,
                    timeLabel: chip.timeLabel,
                    isAllDay: chip.isAllDay,
                  })
                ) : (
                  <>
                    <span className="mc-list-time">
                      {chip.isAllDay ? labels.allDay : chip.timeLabel}
                    </span>
                    <span className="mc-list-title">{chip.occurrence.event.title}</span>
                  </>
                )}
              </div>
            ))}
            {props.context.onDateClick && (
              <button
                type="button"
                className="mc-view-btn"
                onClick={() => props.context.onDateClick?.(selectedDay.toString())}
              >
                {labels.createEventDay}
              </button>
            )}
          </section>
        ) : (
          moreInfo &&
          moreAnchorRef.current &&
          rootRef.current && (
            <Suspense fallback={null}>
              <MonthMorePopover
                id={detailId}
                anchor={moreAnchorRef.current}
                container={rootRef.current}
                label={formatDate({
                  date: selectedDay,
                  locale: options.locale,
                  options: {
                    dateStyle: 'full',
                  },
                })}
                onClose={closeDetail}
                locale={options.locale}
              >
                {props.context.renderMonthMore ? (
                  props.context.renderMonthMore({
                    ...moreInfo,
                    occurrences: selectedChips.map((chip) => chip.occurrence),
                    hiddenOccurrences: selectedChips
                      .filter((chip) =>
                        moreInfo.hiddenOccurrences.some(
                          (occurrence) => occurrenceKey(occurrence) === chip.id,
                        ),
                      )
                      .map((chip) => chip.occurrence),
                  })
                ) : (
                  <div className="mc-month-detail">
                    {selectedChips.map((chip) => (
                      <div
                        role="button"
                        tabIndex={0}
                        key={chip.id}
                        className="mc-month-popover-event"
                        style={
                          props.context.draft?.eventId === chip.id
                            ? { visibility: 'hidden' }
                            : undefined
                        }
                        data-mc-month-detail-event={chip.id}
                        data-mc-event-date={selectedDay.toString()}
                        data-mc-event={chip.id}
                        data-mc-start-min={chip.startMin}
                        data-mc-end-min="0"
                        data-mc-editable={
                          chip.occurrence.event.editable === false ? 'false' : 'true'
                        }
                        onClick={(event) => {
                          if (isNestedInteractiveTarget(event.target, event.currentTarget)) return;
                          closeDetail();
                          if (event.detail === 0) props.context.onEventClick?.(chip.occurrence);
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            ['Enter', ' '].includes(event.key)
                          ) {
                            event.preventDefault();
                            closeDetail();
                            props.context.onEventClick?.(chip.occurrence);
                          }
                        }}
                      >
                        {props.context.renderEvent ? (
                          props.context.renderEvent({
                            occurrence: chip.occurrence,
                            event: chip.occurrence.event,
                            timeLabel: chip.timeLabel,
                            isAllDay: chip.isAllDay,
                          })
                        ) : (
                          <>
                            <span>{chip.isAllDay ? labels.allDay : chip.timeLabel}</span>
                            <span>{chip.occurrence.event.title}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </MonthMorePopover>
            </Suspense>
          )
        ))}
    </div>
  );
}
