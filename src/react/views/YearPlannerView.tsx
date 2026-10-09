import { createElement, lazy, Suspense, useEffect, useId, useState } from 'react';
import { occurrenceKey } from '../../core/render/derive.js';
import type { EventOccurrence } from '../../core/index.js';
import type { CalendarView, MonthMoreInfo, ViewRenderContext } from '../viewTypes.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
import { occurrenceDays } from './layout/occurrenceDays.js';
import { formatDate } from './formatting/timeLabels.js';
import { usePageStickyHeaders } from './hooks/usePageStickyHeaders.js';
import { getViewLabels } from './formatting/viewLabels.js';

const MonthMorePopover = lazy(() =>
  import('./components/MonthMorePopover.js').then((module) => ({
    default: module.MonthMorePopover,
  })),
);

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
  const labels = getViewLabels(context.options.locale);
  const scrollRef = usePageStickyHeaders(context.options.locale, context.options.direction);
  const detailId = useId();
  const [moreInfo, setMoreInfo] = useState<MonthMoreInfo>();
  const closeDetail = () => {
    setMoreInfo(undefined);
    moreInfo?.anchor.focus({ preventScroll: true });
  };
  useEffect(() => setMoreInfo(undefined), [context.referenceDateISO]);
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
    <div ref={scrollRef} className="mc-hscroll mc-year-planner-scroll" data-mc-year-planner-scroll>
      <table className="mc-year-planner" data-mc-year-planner>
        <caption>
          {english
            ? 'Year overview. Activate a date to create an event; activate an event indicator to open it.'
            : 'Visão anual. Ative uma data para criar um evento; ative um indicador para abrir o evento.'}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="mc-year-planner-corner">
              {english ? 'Month' : 'Mês'}
            </th>
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
                            const direction = context.options.direction === 'rtl' ? -1 : 1;
                            const destinationDate =
                              event.key === 'ArrowRight'
                                ? date.add({ days: direction })
                                : event.key === 'ArrowLeft'
                                  ? date.add({ days: -direction })
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
                            {occurrence.event.title}
                          </button>
                        ))}
                        {items.length > 2 && (
                          <button
                            type="button"
                            className="mc-month-more"
                            aria-expanded={moreInfo?.dateISO === dateISO}
                            aria-controls={detailId}
                            aria-label={`${labels.moreEvents} ${items.length - 2} ${labels.events} ${labels.onDate} ${dateLabel}`}
                            onClick={(click) => {
                              if (moreInfo?.dateISO === dateISO) {
                                closeDetail();
                                return;
                              }
                              const anchor = click.currentTarget;
                              const info: MonthMoreInfo = {
                                dateISO,
                                occurrences: items,
                                hiddenOccurrences: items.slice(2),
                                anchor,
                                close: () => {
                                  setMoreInfo(undefined);
                                  anchor.focus({ preventScroll: true });
                                },
                                openView: (viewName) => {
                                  setMoreInfo(undefined);
                                  context.openDateView?.(dateISO, viewName);
                                },
                              };
                              if (context.onMonthMoreClick?.(info) === false) return;
                              if (context.options.monthMoreView) {
                                info.openView(context.options.monthMoreView);
                                return;
                              }
                              setMoreInfo(info);
                            }}
                          >
                            +{items.length - 2}
                            <span className="mc-month-more-label"> {labels.more}</span>
                          </button>
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
      {moreInfo && scrollRef.current && (
        <Suspense fallback={null}>
          <MonthMorePopover
            id={detailId}
            anchor={moreInfo.anchor}
            container={
              scrollRef.current.closest<HTMLElement>('[data-mc-root]') ?? scrollRef.current
            }
            label={formatDate({
              date: context.temporal.PlainDate.from(moreInfo.dateISO),
              locale: context.options.locale,
              options: { dateStyle: 'full' },
            })}
            locale={context.options.locale}
            onClose={closeDetail}
          >
            {context.renderMonthMore ? (
              context.renderMonthMore({
                ...moreInfo,
                occurrences: itemsByDate.get(moreInfo.dateISO) ?? [],
                hiddenOccurrences: (itemsByDate.get(moreInfo.dateISO) ?? []).slice(2),
              })
            ) : (
              <div className="mc-month-detail">
                {(itemsByDate.get(moreInfo.dateISO) ?? []).map((occurrence) => (
                  <button
                    type="button"
                    className="mc-month-popover-event"
                    key={occurrenceKey(occurrence)}
                    data-mc-month-detail-event={occurrenceKey(occurrence)}
                    onClick={() => {
                      closeDetail();
                      context.onEventClick?.(occurrence);
                    }}
                  >
                    {occurrence.event.title}
                  </button>
                ))}
              </div>
            )}
          </MonthMorePopover>
        </Suspense>
      )}
    </div>
  );
}

/** Standard annual planner; register it explicitly.
 * @remarks Português: Planejamento anual padrão; registre explicitamente
 */
export const yearPlannerView = createYearPlannerView();
