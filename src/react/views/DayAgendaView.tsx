import { createElement } from 'react';
import { occurrenceKey, occurrenceStart } from '../../core/index.js';
import type { CalendarView, ViewRenderContext } from '../viewTypes.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
import { occurrenceDays } from './layout/occurrenceDays.js';
import { formatDate, formatHourLabel } from './formatting/timeLabels.js';
import { isNestedInteractiveTarget } from '../../core/interaction/interactiveTarget.js';

/** Chronological one-day agenda with event and resource summaries. @remarks Português: Agenda cronológica diária com resumo de eventos e recursos. */
export const dayAgendaView: CalendarView = {
  name: 'day-agenda',
  label: 'Day agenda',
  getRange(date) {
    return { days: [date], startDate: date, endDate: date };
  },
  navigate({ direction, date }) {
    return date.add({ days: direction === 'next' ? 1 : -1 });
  },
  getTitle(range, context) {
    return formatDate({
      date: range.startDate,
      locale: context.options.locale,
      options: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    });
  },
  render(context) {
    return createElement(DayAgenda, { context });
  },
};

function DayAgenda({
  context,
}: {
  /** Shared controller data and callbacks. @remarks Português: Dados compartilhados do controlador e callbacks. */
  context: ViewRenderContext;
}) {
  const date = context.range.startDate;
  const dateISO = date.toString();
  const english = context.options.locale.startsWith('en');
  const t = (englishText: string, portuguese: string) => (english ? englishText : portuguese);
  const items = context.occurrences
    .filter((occurrence) => occurrenceDays({ occurrence, context }).includes(dateISO))
    .map((occurrence) => ({
      occurrence,
      start: occurrenceStart({
        temporal: context.temporal,
        occurrence,
        displayTimeZone: context.options.timeZone,
      }),
    }))
    .sort(
      (left, right) =>
        Number(right.start.isAllDay) - Number(left.start.isAllDay) ||
        left.start.epochMs - right.start.epochMs,
    );
  const resources = new Set(items.flatMap((item) => item.occurrence.event.resourceIds ?? []));
  return (
    <section
      className="mc-day-agenda"
      data-mc-day-agenda
      style={context.getDayStyle?.({ dateISO, viewName: context.viewName ?? 'day-agenda' })}
    >
      <header className="mc-day-agenda-header">
        <h2>
          <DayHeaderContent
            context={context}
            dateISO={dateISO}
            viewName={context.viewName ?? 'day-agenda'}
            defaultContent={formatDate({
              date,
              locale: context.options.locale,
              options: { weekday: 'long', day: 'numeric', month: 'long' },
            })}
          />
        </h2>
        <p>
          {items.length} {t('events', 'eventos')} · {resources.size} {t('resources', 'recursos')}
        </p>
        {context.onDateClick && (
          <button
            type="button"
            className="mc-day-agenda-create"
            onClick={() => context.onDateClick?.(dateISO)}
          >
            {t('Create event', 'Criar evento')}
          </button>
        )}
      </header>
      {items.length === 0 ? (
        <p className="mc-day-agenda-empty">
          {t('No events on this date.', 'Nenhum evento nesta data.')}
        </p>
      ) : (
        <ol className="mc-day-agenda-events">
          {items.map(({ occurrence, start }) => {
            const event = occurrence.event;
            const timeLabel = start.isAllDay
              ? t('All day', 'Dia inteiro')
              : start.dayISO < dateISO
                ? t('Continues', 'Continua')
                : formatHourLabel({
                    minuteOfDay: start.minuteOfDay,
                    locale: context.options.locale,
                  });
            const resourceNames = (event.resourceIds ?? [])
              .map((id) => context.resources?.find((resource) => resource.id === id)?.title ?? id)
              .join(', ');
            return (
              <li
                key={occurrenceKey(occurrence)}
                className="mc-day-agenda-item"
                style={event.color ? { borderInlineStartColor: event.color } : undefined}
              >
                <span className="mc-day-agenda-time">{timeLabel}</span>
                <div
                  className="mc-day-agenda-event"
                  data-mc-agenda-occurrence={occurrenceKey(occurrence)}
                  role={context.onEventClick ? 'button' : undefined}
                  tabIndex={context.onEventClick ? 0 : undefined}
                  onClick={(event) => {
                    if (!isNestedInteractiveTarget(event.target, event.currentTarget))
                      context.onEventClick?.(occurrence);
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.target === event.currentTarget &&
                      (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      context.onEventClick?.(occurrence);
                    }
                  }}
                >
                  {context.renderEvent ? (
                    context.renderEvent({
                      event,
                      occurrence,
                      timeLabel: start.isAllDay ? '' : timeLabel,
                      isAllDay: start.isAllDay,
                    })
                  ) : (
                    <>
                      <strong>{event.title}</strong>
                      {resourceNames && <small>{resourceNames}</small>}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
