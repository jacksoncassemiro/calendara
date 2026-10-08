/** @jsxImportSource react */
/**
 * ListView (Agenda) — lista cronológica das ocorrências no range visível, agrupadas por dia.
 * Mesmo contrato `CalendarView`. Range alinhado à semana (paridade com a Week) por padrão,
 * configurável via `createListView(spanDays)`.
 */
import { occurrenceKey } from '../../core/render/derive.js';
import { createElement, type JSX } from 'react';
import type { EventOccurrence, TemporalLike } from '../../core/index.js';
import { occurrenceStart } from '../../core/index.js';
import { isNestedInteractiveTarget } from '../../core/interaction/interactiveTarget.js';
import { formatDate, formatHourLabel } from './formatting/timeLabels.js';
import { occurrenceDays } from './layout/occurrenceDays.js';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from '../viewTypes.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

interface AgendaItem {
  id: string;
  occurrence: EventOccurrence;
  timeLabel: string;
  isAllDay: boolean;
  epochMs: number;
}

/** Agenda semanal alinhada à semana; spans customizados começam na data de referência. */
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
        totalDays === 7 ? context.dateUtils.startOfWeek(date, context.options.weekStart) : date;
      const days = context.dateUtils.eachDayOfRange(start, start.add({ days: totalDays }));
      return {
        days,
        startDate: start,
        endDate: start.add({ days: totalDays - 1 }),
      };
    },

    navigate(direction, date) {
      return direction === 'next'
        ? date.add({ days: totalDays })
        : date.subtract({ days: totalDays });
    },

    getTitle(range, context): string {
      const startText = formatDate(range.startDate, context.options.locale, {
        day: 'numeric',
        month: 'short',
      });
      const endText = formatDate(range.endDate, context.options.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return `${startText} – ${endText}`;
    },

    render(context: ViewRenderContext): JSX.Element {
      return createElement(AgendaList, { context });
    },
  };
}

export const listView: CalendarView = createListView(7);

function AgendaList(props: { context: ViewRenderContext }): JSX.Element {
  const { temporal, options, range, occurrences } = props.context;

  const itemsByDay = new Map<string, AgendaItem[]>();
  for (const occurrence of occurrences) {
    const start = occurrenceStart(temporal, occurrence, options.timeZone);
    for (const dayISO of occurrenceDays(occurrence, props.context)) {
      const list = itemsByDay.get(dayISO) ?? [];
      list.push({
        id: occurrenceKey(occurrence),
        occurrence,
        isAllDay: start.isAllDay,
        epochMs: start.epochMs,
        timeLabel: start.isAllDay
          ? 'dia inteiro'
          : formatHourLabel(dayISO === start.dayISO ? start.minuteOfDay : 0, options.locale),
      });
      itemsByDay.set(dayISO, list);
    }
  }
  for (const list of itemsByDay.values()) list.sort((left, right) => left.epochMs - right.epochMs);

  const daysWithItems = range.days.filter((day) => itemsByDay.has(day.toString()));

  if (daysWithItems.length === 0) {
    return (
      <div className="mc-list mc-list-empty" data-mc-view="list" data-mc-list-empty>
        Nenhum evento neste período.
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
              {formatDate(day, options.locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className="mc-list-item"
                data-mc-list-item={item.id}
                role={props.context.onEventClick ? 'button' : undefined}
                tabIndex={props.context.onEventClick ? 0 : undefined}
                onClick={(event) => {
                  if (!isNestedInteractiveTarget(event.target, event.currentTarget))
                    props.context.onEventClick?.(item.occurrence);
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget || !props.context.onEventClick) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.context.onEventClick(item.occurrence);
                  }
                }}
                style={
                  item.occurrence.event.color
                    ? { borderLeft: `3px solid ${item.occurrence.event.color}` }
                    : undefined
                }
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
