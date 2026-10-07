/** @jsxImportSource react */
/**
 * MonthView — grade de mês (day grid). Semanas em linhas, dias em células; eventos aparecem como
 * "chips" ordenados por horário. Implementa o mesmo contrato `CalendarView` (registrável/custom).
 */
import { createElement, useEffect, useId, useRef, useState, type JSX } from 'react';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from './viewDef.js';
import type { TemporalLike } from '../../core/index.js';
import type { EventOccurrence } from '../../core/index.js';
import { occurrenceStart } from '../../core/index.js';
import { formatDate, formatHourLabel } from './format.js';
import { occurrenceDays } from './occurrenceDays.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

interface MonthChip {
  id: string;
  occurrence: EventOccurrence;
  timeLabel: string;
  isAllDay: boolean;
  epochMs: number;
}

function chipKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
}

export const monthView: CalendarView = {
  name: 'month',
  label: 'Mês',

  getRange(date: PlainDate, context: ViewContext): ViewRange {
    const { dateUtils, options } = context;
    const firstOfMonth = date.with({ day: 1 });
    const lastOfMonth = date.with({ day: date.daysInMonth });
    const gridStart = dateUtils.startOfWeek(firstOfMonth, options.weekStart);
    const gridEndExclusive = dateUtils.startOfWeek(lastOfMonth, options.weekStart).add({ days: 7 });
    const days = dateUtils.eachDayOfRange(gridStart, gridEndExclusive);
    return { days, startDate: gridStart, endDate: gridEndExclusive.subtract({ days: 1 }) };
  },

  navigate(direction, date) {
    const anchor = date.with({ day: 1 });
    return direction === 'next' ? anchor.add({ months: 1 }) : anchor.subtract({ months: 1 });
  },

  getTitle(range, context): string {
    // A data de referência do mês está na 3ª semana (evita o mês anterior no começo da grade).
    const middle = range.days[Math.floor(range.days.length / 2)] ?? range.startDate;
    return formatDate(middle, context.options.locale, { month: 'long', year: 'numeric' });
  },

  render(context: ViewRenderContext): JSX.Element {
    return createElement(MonthGrid, { context });
  },
};

function MonthGrid(props: { context: ViewRenderContext }): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [selectedISO, setSelectedISO] = useState<string>();
  const detailId = useId();
  useEffect(() => {
    const element = rootRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width <= 640);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { temporal, options, range, occurrences, nowMs } = props.context;
  const referenceMonth =
    (range.days[Math.floor(range.days.length / 2)] ?? range.startDate).month;
  const todayISO = temporal.Instant.fromEpochMilliseconds(nowMs)
    .toZonedDateTimeISO(options.timeZone)
    .toPlainDate()
    .toString();

  // Agrupa ocorrências por dia de exibição, ordenadas por instante de início.
  const chipsByDay = new Map<string, MonthChip[]>();
  for (const occurrence of occurrences) {
    const start = occurrenceStart(temporal, occurrence, options.timeZone);
    for (const dayISO of occurrenceDays(occurrence, props.context)) {
    const list = chipsByDay.get(dayISO) ?? [];
    list.push({
      id: chipKey(occurrence),
      occurrence,
      isAllDay: start.isAllDay,
      epochMs: start.epochMs,
      timeLabel: start.isAllDay ? '' : formatHourLabel(dayISO === start.dayISO ? start.minuteOfDay : 0, options.locale),
    });
    chipsByDay.set(dayISO, list);
    }
  }
  for (const list of chipsByDay.values()) list.sort((left, right) => left.epochMs - right.epochMs);
  const selectedDay = range.days.find((day) => day.toString() === selectedISO)
    ?? range.days.find((day) => day.toString() === todayISO)
    ?? range.days.find((day) => day.month === referenceMonth)
    ?? range.startDate;
  const selectedChips = chipsByDay.get(selectedDay.toString()) ?? [];

  // Nomes dos dias da semana (a partir do primeiro dia da grade).
  const weekdayHeaders = range.days.slice(0, 7).map((day) => ({
    key: day.toString(),
    label: formatDate(day, options.locale, { weekday: 'short' }),
  }));

  // Fatiar em semanas de 7.
  const weeks: PlainDate[][] = [];
  for (let index = 0; index < range.days.length; index += 7) {
    weeks.push(range.days.slice(index, index + 7));
  }

  return (
    <div ref={rootRef} className={`mc-month${compact ? ' mc-month-compact' : ''}`} data-mc-view="month">
      <div className="mc-month-weekdays" style={{ display: 'flex' }}>
        {weekdayHeaders.map((header) => (
          <div key={header.key} className="mc-month-weekday" style={{ flex: '1 1 0', textAlign: 'center' }}>
            {header.label}
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week[0]!.toString()} className="mc-month-week" style={{ display: 'flex' }}>
          {week.map((day) => {
            const dayISO = day.toString();
            const chips = chipsByDay.get(dayISO) ?? [];
            const isToday = dayISO === todayISO;
            const outsideMonth = day.month !== referenceMonth;
            return (
              <div
                key={dayISO}
                className={
                  `mc-month-day${isToday ? ' mc-today' : ''}` +
                  (outsideMonth ? ' mc-outside-month' : '')
                }
                data-mc-month-day={dayISO}
                style={{ flex: '1 1 0' }}
              >
                {compact || props.context.onDateClick ? (
                  <button type="button" className="mc-month-daynum"
                    aria-label={`${formatDate(day, options.locale, { dateStyle: 'full' })}${compact ? `, ${chips.length} eventos` : ''}`}
                    aria-pressed={compact ? dayISO === selectedDay.toString() : undefined}
                    aria-controls={compact ? detailId : undefined}
                    aria-current={isToday ? 'date' : undefined}
                    onClick={() => {
                      setSelectedISO(dayISO);
                      if (!compact) props.context.onDateClick?.(dayISO);
                    }}>
                    {formatDate(day, options.locale, { day: 'numeric' })}
                  </button>
                ) : (
                  <div className="mc-month-daynum" aria-current={isToday ? 'date' : undefined}>
                    {formatDate(day, options.locale, { day: 'numeric' })}
                  </div>
                )}
                <span className="mc-month-count" aria-hidden="true">{chips.length ? `${chips.length}` : ''}</span>
                <div className="mc-month-events">
                  {chips.map((chip) => (
                    <div
                      key={chip.id}
                      className={`mc-month-event${chip.isAllDay ? ' mc-allday' : ''}`}
                      data-mc-month-event={chip.id}
                      role={props.context.onEventClick ? 'button' : undefined}
                      tabIndex={props.context.onEventClick ? 0 : undefined}
                      onClick={() => props.context.onEventClick?.(chip.occurrence)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget || !props.context.onEventClick) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          props.context.onEventClick(chip.occurrence);
                        }
                      }}
                      title={chip.occurrence.event.title}
                      style={
                        chip.occurrence.event.color
                          ? { borderLeft: `3px solid ${chip.occurrence.event.color}` }
                          : undefined
                      }
                    >
                      {props.context.renderEvent
                        ? props.context.renderEvent({
                            occurrence: chip.occurrence,
                            event: chip.occurrence.event,
                            timeLabel: chip.timeLabel,
                            isAllDay: chip.isAllDay,
                          })
                        : `${chip.timeLabel ? chip.timeLabel + ' ' : ''}${chip.occurrence.event.title}`}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {compact && (
        <section id={detailId} className="mc-month-detail" aria-label="Eventos do dia selecionado">
          <h3 aria-live="polite">{formatDate(selectedDay, options.locale, { dateStyle: 'full' })}</h3>
          {selectedChips.length === 0 && <p className="mc-list-empty">Nenhum evento neste dia.</p>}
          {selectedChips.map((chip) => (
            <div key={chip.id} className="mc-list-item"
              data-mc-month-detail-event={chip.id}
              role={props.context.onEventClick ? 'button' : undefined}
              tabIndex={props.context.onEventClick ? 0 : undefined}
              onClick={() => props.context.onEventClick?.(chip.occurrence)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || !props.context.onEventClick) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  props.context.onEventClick(chip.occurrence);
                }
              }}>
              {props.context.renderEvent
                ? props.context.renderEvent({ occurrence: chip.occurrence, event: chip.occurrence.event, timeLabel: chip.timeLabel, isAllDay: chip.isAllDay })
                : <><span className="mc-list-time">{chip.isAllDay ? 'dia inteiro' : chip.timeLabel}</span><span className="mc-list-title">{chip.occurrence.event.title}</span></>}
            </div>
          ))}
          {props.context.onDateClick && <button type="button" className="mc-view-btn"
            onClick={() => props.context.onDateClick?.(selectedDay.toString())}>Criar evento neste dia</button>}
        </section>
      )}
    </div>
  );
}
