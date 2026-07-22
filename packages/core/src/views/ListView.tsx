/** @jsxImportSource preact */
/**
 * ListView (Agenda) — lista cronológica das ocorrências no range visível, agrupadas por dia.
 * Mesmo contrato `CalendarView`. Range alinhado à semana (paridade com a Week) por padrão,
 * configurável via `createListView(spanDays)`.
 */
import { h as createElement, type JSX } from 'preact';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from './viewDef.js';
import type { TemporalLike } from '../date/temporal.js';
import type { EventOccurrence } from '../types/event.js';
import { occurrenceStart } from '../render/derive.js';
import { formatDate, formatHourLabel } from './format.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

interface AgendaItem {
  id: string;
  occurrence: EventOccurrence;
  timeLabel: string;
  isAllDay: boolean;
  epochMs: number;
}

function itemKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
}

/** Cria uma agenda que cobre `spanDays` dias, alinhada ao início da semana. */
export function createListView(spanDays = 7, name = 'list'): CalendarView {
  const totalDays = Math.max(1, Math.floor(spanDays));
  return {
    name,
    label: 'Agenda',

    getRange(date: PlainDate, context: ViewContext): ViewRange {
      const start = context.dateUtils.startOfWeek(date, context.options.weekStart);
      const days = context.dateUtils.eachDayOfRange(start, start.add({ days: totalDays }));
      return { days, startDate: start, endDate: start.add({ days: totalDays - 1 }) };
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
    const list = itemsByDay.get(start.dayISO) ?? [];
    list.push({
      id: itemKey(occurrence),
      occurrence,
      isAllDay: start.isAllDay,
      epochMs: start.epochMs,
      timeLabel: start.isAllDay ? 'dia inteiro' : formatHourLabel(start.minuteOfDay, options.locale),
    });
    itemsByDay.set(start.dayISO, list);
  }
  for (const list of itemsByDay.values()) list.sort((left, right) => left.epochMs - right.epochMs);

  const daysWithItems = range.days.filter((day) => itemsByDay.has(day.toString()));

  if (daysWithItems.length === 0) {
    return (
      <div class="mc-list mc-list-empty" data-mc-view="list" data-mc-list-empty>
        Nenhum evento neste período.
      </div>
    );
  }

  return (
    <div class="mc-list" data-mc-view="list">
      {daysWithItems.map((day) => {
        const dayISO = day.toString();
        const items = itemsByDay.get(dayISO)!;
        return (
          <div key={dayISO} class="mc-list-day" data-mc-list-day={dayISO}>
            <div class="mc-list-day-header">
              {formatDate(day, options.locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                class="mc-list-item"
                data-mc-list-item={item.id}
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
                    <span class="mc-list-time">{item.timeLabel}</span>
                    <span class="mc-list-title">{item.occurrence.event.title}</span>
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
