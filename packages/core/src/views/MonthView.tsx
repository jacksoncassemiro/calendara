/**
 * MonthView — grade de mês (day grid). Semanas em linhas, dias em células; eventos aparecem como
 * "chips" ordenados por horário. Implementa o mesmo contrato `CalendarView` (registrável/custom).
 */
import { h as createElement, type JSX } from 'preact';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from './viewDef.js';
import type { TemporalLike } from '../date/temporal.js';
import type { EventOccurrence } from '../types/event.js';
import { occurrenceStart } from '../render/derive.js';
import { formatDate, formatHourLabel } from './format.js';

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
    const list = chipsByDay.get(start.dayISO) ?? [];
    list.push({
      id: chipKey(occurrence),
      occurrence,
      isAllDay: start.isAllDay,
      epochMs: start.epochMs,
      timeLabel: start.isAllDay ? '' : formatHourLabel(start.minuteOfDay, options.locale),
    });
    chipsByDay.set(start.dayISO, list);
  }
  for (const list of chipsByDay.values()) list.sort((left, right) => left.epochMs - right.epochMs);

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
    <div class="mc-month" data-mc-view="month">
      <div class="mc-month-weekdays" style={{ display: 'flex' }}>
        {weekdayHeaders.map((header) => (
          <div key={header.key} class="mc-month-weekday" style={{ flex: '1 1 0', textAlign: 'center' }}>
            {header.label}
          </div>
        ))}
      </div>

      {weeks.map((week) => (
        <div key={week[0]!.toString()} class="mc-month-week" style={{ display: 'flex' }}>
          {week.map((day) => {
            const dayISO = day.toString();
            const chips = chipsByDay.get(dayISO) ?? [];
            const isToday = dayISO === todayISO;
            const outsideMonth = day.month !== referenceMonth;
            return (
              <div
                key={dayISO}
                class={
                  `mc-month-day${isToday ? ' mc-today' : ''}` +
                  (outsideMonth ? ' mc-outside-month' : '')
                }
                data-mc-month-day={dayISO}
                style={{ flex: '1 1 0' }}
              >
                <div class="mc-month-daynum">{formatDate(day, options.locale, { day: 'numeric' })}</div>
                <div class="mc-month-events">
                  {chips.map((chip) => (
                    <div
                      key={chip.id}
                      class={`mc-month-event${chip.isAllDay ? ' mc-allday' : ''}`}
                      data-mc-month-event={chip.id}
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
    </div>
  );
}
