import { lazy, Suspense, useEffect, useId, useRef, useState, type JSX } from 'react';
import { occurrenceKey, occurrenceStart } from '../../../core/index.js';
import { isNestedInteractiveTarget } from '../../../core/interaction/interactiveTarget.js';
import { formatDate, formatHourLabel } from '../formatting/timeLabels.js';
import type { DenseOverflowGroup } from '../layout/denseLayout.js';
import type { MonthMoreInfo, ViewRenderContext } from '../../viewTypes.js';
const Popover = lazy(() =>
  import('./MonthMorePopover.js').then((module) => ({
    default: module.MonthMorePopover,
  })),
);
export function EventOverflow({
  group,
  dateISO,
  resourceId,
  context,
  horizontalHeight,
}: {
  group: DenseOverflowGroup;
  dateISO: string;
  resourceId?: string;
  context: ViewRenderContext;
  horizontalHeight?: number;
}): JSX.Element {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [info, setInfo] = useState<MonthMoreInfo>();
  const close = () => setInfo(undefined);
  const occurrences = context.occurrences.filter((occurrence) =>
    group.hiddenIds.includes(occurrenceKey(occurrence)),
  );
  const identity = JSON.stringify(group.hiddenIds);
  useEffect(() => setInfo(undefined), [dateISO, resourceId, identity]);
  const currentInfo = info ? { ...info, occurrences, hiddenOccurrences: occurrences } : undefined;
  const root = anchor.current?.closest<HTMLElement>('[data-mc-root]');
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className="mc-event-more"
        data-mc-more
        style={
          horizontalHeight !== undefined
            ? {
                top: group.left * horizontalHeight,
                height: `calc(${group.width * horizontalHeight}px - var(--mc-event-gap, 8px))`,
                left: group.top,
                width: group.height,
                zIndex: 1000,
              }
            : {
                top: group.top,
                height: Math.max(24, group.height),
                left: `${group.left * 100}%`,
                width: `calc(${group.width * 100}% - min(var(--mc-event-gap, 8px), ${group.width * 25}%))`,
                zIndex: 1000,
              }
        }
        aria-label={`Mais ${occurrences.length} eventos em ${dateISO}`}
        aria-expanded={!!info}
        onClick={() => {
          const next: MonthMoreInfo = {
            dateISO,
            occurrences,
            hiddenOccurrences: occurrences,
            anchor: anchor.current!,
            close,
            openView: (view) => {
              close();
              context.openDateView?.(dateISO, view);
            },
          };
          if (context.onEventMoreClick?.(next) === false) return;
          if (context.options.eventMoreView) {
            next.openView(context.options.eventMoreView);
            return;
          }
          setInfo(next);
        }}
      >
        +{occurrences.length} mais
      </button>
      {currentInfo && occurrences.length > 0 && anchor.current && root && (
        <Suspense fallback={null}>
          <Popover
            id={id}
            anchor={anchor.current}
            container={root}
            label={formatDate(context.temporal.PlainDate.from(dateISO), context.options.locale, {
              dateStyle: 'full',
            })}
            onClose={close}
          >
            {context.renderEventMore ? (
              context.renderEventMore(currentInfo)
            ) : (
              <div className="mc-month-detail" data-mc-slot-resource={resourceId}>
                {occurrences.map((occurrence) => {
                  const start = occurrenceStart(
                    context.temporal,
                    occurrence,
                    context.options.timeZone,
                  );
                  const label = start.isAllDay
                    ? 'dia inteiro'
                    : formatHourLabel(start.minuteOfDay, context.options.locale);
                  return (
                    <div
                      key={occurrenceKey(occurrence)}
                      role="button"
                      tabIndex={0}
                      className="mc-month-popover-event"
                      data-mc-event-date={dateISO}
                      data-mc-event={occurrenceKey(occurrence)}
                      data-mc-start-min={start.minuteOfDay}
                      data-mc-end-min="0"
                      style={
                        context.draft?.eventId === occurrenceKey(occurrence)
                          ? { visibility: 'hidden' }
                          : undefined
                      }
                      data-mc-editable={occurrence.event.editable === false ? 'false' : 'true'}
                      onClick={(event) => {
                        if (isNestedInteractiveTarget(event.target, event.currentTarget)) return;
                        close();
                        if (event.detail === 0) context.onEventClick?.(occurrence);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          ['Enter', ' '].includes(event.key)
                        ) {
                          event.preventDefault();
                          close();
                          context.onEventClick?.(occurrence);
                        }
                      }}
                    >
                      {context.renderEvent ? (
                        context.renderEvent({
                          occurrence,
                          event: occurrence.event,
                          timeLabel: label,
                          isAllDay: start.isAllDay,
                        })
                      ) : (
                        <>
                          <span>{label}</span>
                          <span>{occurrence.event.title}</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Popover>
        </Suspense>
      )}
    </>
  );
}
