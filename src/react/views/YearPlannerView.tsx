import { createElement } from 'react';
import type { EventOccurrence } from '../../core/index.js';
import type { CalendarView, ViewRenderContext } from '../viewTypes.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
import { occurrenceDays } from './layout/occurrenceDays.js';
import { formatDate } from './formatting/timeLabels.js';

/** Year planner configuration.
 * @remarks Português: Configuração do planejamento anual
 */
export interface YearPlannerViewOptions {
  /** Unique identifier; default year-planner.
   * @remarks Português: Identificador único; padrão year-planner
   */
  name?: string;
  /** Selector label; default Year planner.
   * @remarks Português: Rótulo do seletor; padrão Year planner
   */
  label?: string;
}

/** Overview with months as rows and dates as columns; event indicators open the consumer flow.
 * @remarks Português: Visão com meses em linhas e datas em colunas; indicadores abrem o fluxo do consumidor
 */
export function createYearPlannerView({
  name = 'year-planner',
  label = 'Year planner',
}: YearPlannerViewOptions = {}): CalendarView {
  return {
    name,
    label,
    getRange(date, context) {
      const startDate = date.with({ month: 1, day: 1 });
      const end = startDate.add({ years: 1 });
      return {
        startDate,
        endDate: end.subtract({ days: 1 }),
        days: context.dateUtils.eachDayOfRange({ start: startDate, end }),
      };
    },
    navigate({ direction, date }) {
      return date.with({ month: 1, day: 1 }).add({ years: direction === 'next' ? 1 : -1 });
    },
    getTitle(range) {
      return String(range.startDate.year);
    },
    render(context) {
      return createElement(YearPlanner, { context });
    },
  };
}

function YearPlanner({
  context,
}: {
  /** Shared controller data and callbacks.
   * @remarks Português: Dados compartilhados do controlador e callbacks
   */
  context: ViewRenderContext;
}) {
  const english = context.options.locale.startsWith('en');
  const itemsByDate = new Map<string, EventOccurrence[]>();
  for (const occurrence of context.occurrences)
    for (const dateISO of occurrenceDays({ occurrence, context })) {
      const items = itemsByDate.get(dateISO) ?? [];
      items.push(occurrence);
      itemsByDate.set(dateISO, items);
    }
  const months = Array.from({ length: 12 }, (_, index) =>
    context.range.startDate.with({ month: index + 1, day: 1 }),
  );
  const todayISO = context.temporal.Instant.fromEpochMilliseconds(context.nowMs)
    .toZonedDateTimeISO(context.options.timeZone)
    .toPlainDate()
    .toString();
  return (
    <div className="mc-year-planner-scroll" data-mc-year-planner-scroll>
      <table className="mc-year-planner" data-mc-year-planner>
        <caption>
          {english
            ? 'Year overview. Activate a date to create an event; activate an event indicator to open it.'
            : 'Visão anual. Ative uma data para criar um evento; ative um indicador para abrir o evento.'}
        </caption>
        <thead>
          <tr>
            <th scope="col">{english ? 'Month' : 'Mês'}</th>
            {Array.from({ length: 31 }, (_, index) => (
              <th key={index} scope="col">
                {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month}>
              <th scope="row">
                {formatDate({
                  date: month,
                  locale: context.options.locale,
                  options: { month: 'short' },
                })}
              </th>
              {Array.from({ length: 31 }, (_, index) => {
                if (index >= month.daysInMonth)
                  return (
                    <td
                      key={index}
                      className="mc-year-planner-outside"
                      aria-label={english ? 'No date' : 'Sem data'}
                    />
                  );
                const date = month.with({ day: index + 1 });
                const dateISO = date.toString();
                const items = itemsByDate.get(dateISO) ?? [];
                const dateLabel = formatDate({
                  date,
                  locale: context.options.locale,
                  options: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
                });
                return (
                  <td
                    key={index}
                    data-mc-year-planner-date={dateISO}
                    style={context.getDayStyle?.({
                      dateISO,
                      viewName: context.viewName ?? 'year-planner',
                    })}
                  >
                    <DayHeaderContent
                      context={context}
                      dateISO={dateISO}
                      viewName={context.viewName ?? 'year-planner'}
                      defaultContent={
                        <button
                          type="button"
                          className="mc-year-planner-date"
                          aria-current={dateISO === todayISO ? 'date' : undefined}
                          aria-label={dateLabel}
                          onClick={() => context.onDateClick?.(dateISO)}
                          onKeyDown={(event) => {
                            const destinationDate =
                              event.key === 'ArrowRight'
                                ? date.add({ days: 1 })
                                : event.key === 'ArrowLeft'
                                  ? date.subtract({ days: 1 })
                                  : event.key === 'ArrowDown'
                                    ? date.add({ months: 1 })
                                    : event.key === 'ArrowUp'
                                      ? date.subtract({ months: 1 })
                                      : undefined;
                            if (!destinationDate) return;
                            const destination = destinationDate.toString();
                            const next = event.currentTarget
                              .closest('table')
                              ?.querySelector<HTMLButtonElement>(
                                `[data-mc-year-planner-date="${destination}"] .mc-year-planner-date`,
                              );
                            if (next) {
                              event.preventDefault();
                              next.focus();
                              next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
                            }
                          }}
                        >
                          {date.day}
                        </button>
                      }
                    />
                    {items.length > 0 && (
                      <div
                        className="mc-year-planner-indicators"
                        aria-label={`${items.length} ${english ? 'events' : 'eventos'}`}
                      >
                        {items.slice(0, 2).map((occurrence) => (
                          <button
                            key={`${occurrence.masterId}:${occurrence.originalStart}`}
                            type="button"
                            className="mc-year-planner-event"
                            aria-label={occurrence.event.title}
                            title={occurrence.event.title}
                            style={
                              occurrence.event.color
                                ? { backgroundColor: occurrence.event.color }
                                : undefined
                            }
                            onClick={() => context.onEventClick?.(occurrence)}
                          >
                            <span className="mc-sr-only">{occurrence.event.title}</span>
                          </button>
                        ))}
                        {items.length > 2 && (
                          <details className="mc-year-planner-more">
                            <summary
                              aria-label={`${items.length - 2} ${english ? 'more events' : 'eventos adicionais'}`}
                            >
                              +{items.length - 2}
                            </summary>
                            <div className="mc-year-planner-overflow">
                              {items.slice(2).map((occurrence) => (
                                <button
                                  type="button"
                                  key={`${occurrence.masterId}:${occurrence.originalStart}`}
                                  onClick={() => context.onEventClick?.(occurrence)}
                                >
                                  {occurrence.event.title}
                                </button>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Standard annual planner; register it explicitly.
 * @remarks Português: Planejamento anual padrão; registre explicitamente
 */
export const yearPlannerView = createYearPlannerView();
