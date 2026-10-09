/** @jsxImportSource react */
/** Chronological agenda grouped by visible date.
 * @remarks Português: Agenda cronológica agrupada por data visível.
 */
import { occurrenceKey } from '../../core/render/derive.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
import { createElement, type JSX } from 'react';
import type { EventOccurrence, TemporalLike } from '../../core/index.js';
import { occurrenceStart } from '../../core/index.js';
import { isNestedInteractiveTarget } from '../../core/interaction/interactiveTarget.js';
import { formatDate, formatHourLabel } from './formatting/timeLabels.js';
import { getViewLabels } from './formatting/viewLabels.js';
import { occurrenceDays } from './layout/occurrenceDays.js';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from '../viewTypes.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

interface AgendaItem {
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
}

/** Default seven-day agenda aligns to the week; other lengths start at the reference date. @remarks Português: Agenda padrão de sete dias alinha à semana; outros períodos iniciam na data de referência. */
export function createListView(spanDays = 7, name = 'list'): CalendarView {
  if (!Number.isFinite(spanDays) || spanDays < 1) {
    throw new RangeError('spanDays must be a finite number greater than or equal to 1');
  }
  const totalDays = Math.floor(spanDays);
  return {
    name,
    label: 'Agenda',

    getRange(date: PlainDate, context: ViewContext): ViewRange {
      const start =
        totalDays === 7
          ? context.dateUtils.startOfWeek({ date, weekStart: context.options.weekStart })
          : date;
      const days = context.dateUtils.eachDayOfRange({
        start,
        end: start.add({ days: totalDays }),
      });
      return {
        days,
        startDate: start,
        endDate: start.add({ days: totalDays - 1 }),
      };
    },

    navigate({ direction, date }) {
      return direction === 'next'
        ? date.add({ days: totalDays })
        : date.subtract({ days: totalDays });
    },

    getTitle(range, context): string {
      const startText = formatDate({
        date: range.startDate,
        locale: context.options.locale,
        options: {
          day: 'numeric',
          month: 'short',
        },
      });
      const endText = formatDate({
        date: range.endDate,
        locale: context.options.locale,
        options: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      });
      return `${startText} – ${endText}`;
    },

    render(context: ViewRenderContext): JSX.Element {
      return createElement(AgendaList, { context });
    },
  };
}

/** Standard week-aligned chronological agenda. @remarks Português: Agenda cronológica padrão alinhada à semana. */
export const listView: CalendarView = createListView(7);

function AgendaList(props: {
  /** Resolved view data and consumer callbacks. @remarks Português: Dados resolvidos da view e callbacks do consumidor. */
  context: ViewRenderContext;
}): JSX.Element {
  const { temporal, options, range, occurrences } = props.context;
  const labels = getViewLabels(options.locale);

  const itemsByDay = new Map<string, AgendaItem[]>();
  for (const occurrence of occurrences) {
    const start = occurrenceStart({
      temporal,
      occurrence,
      displayTimeZone: options.timeZone,
    });
    for (const dayISO of occurrenceDays({ occurrence, context: props.context })) {
      const list = itemsByDay.get(dayISO) ?? [];
      list.push({
        id: occurrenceKey(occurrence),
        occurrence,
        isAllDay: start.isAllDay,
        epochMs: start.epochMs,
        timeLabel: start.isAllDay
          ? labels.allDay
          : formatHourLabel({
              minuteOfDay: dayISO === start.dayISO ? start.minuteOfDay : 0,
              locale: options.locale,
            }),
      });
      itemsByDay.set(dayISO, list);
    }
  }
  for (const list of itemsByDay.values()) list.sort((left, right) => left.epochMs - right.epochMs);

  const daysWithItems = range.days.filter((day) => itemsByDay.has(day.toString()));

  if (daysWithItems.length === 0) {
    return (
      <div className="mc-list mc-list-empty" data-mc-view="list" data-mc-list-empty>
        {labels.noEventsPeriod}
      </div>
    );
  }

  return (
    <div className="mc-list" data-mc-view="list">
      {daysWithItems.map((day) => {
        const dayISO = day.toString();
        const items = itemsByDay.get(dayISO)!;
        return (
          <div
            key={dayISO}
            className="mc-list-day"
            data-mc-list-day={dayISO}
            style={props.context.getDayStyle?.({
              dateISO: dayISO,
              viewName: props.context.viewName ?? 'list',
            })}
          >
            <div className="mc-list-day-header">
              <DayHeaderContent
                context={props.context}
                dateISO={dayISO}
                viewName={props.context.viewName ?? 'list'}
                defaultContent={formatDate({
                  date: day,
                  locale: options.locale,
                  options: {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  },
                })}
              />
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="mc-list-item"
                data-mc-list-item={item.id}
                data-mc-event={item.id}
                data-mc-event-date={dayISO}
                data-mc-editable={item.occurrence.event.editable !== false ? 'true' : 'false'}
                data-mc-drag-source
                role={props.context.onEventClick ? 'button' : undefined}
                tabIndex={props.context.onEventClick ? 0 : undefined}
                onClick={(event) => {
                  if (
                    event.detail === 0 &&
                    !isNestedInteractiveTarget(event.target, event.currentTarget)
                  )
                    props.context.onEventClick?.(item.occurrence);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || !props.context.onEventClick) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.context.onEventClick(item.occurrence);
                  }
                }}
                style={{
                  ...(item.occurrence.event.color
                    ? { borderLeft: `3px solid ${item.occurrence.event.color}` }
                    : {}),
                }}
              >
                {props.context.renderEvent ? (
                  props.context.renderEvent({
                    occurrence: item.occurrence,
                    event: item.occurrence.event,
                    timeLabel: item.isAllDay ? '' : item.timeLabel,
                    isAllDay: item.isAllDay,
                  })
                ) : (
                  <>
                    <span className="mc-list-time">{item.timeLabel}</span>
                    <span className="mc-list-title">{item.occurrence.event.title}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
