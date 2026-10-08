/** @jsxImportSource react */
/** Single-day resource columns. */
import { occurrenceKey } from '../../core/render/derive.js';
import { usePageStickyHeaders } from './hooks/usePageStickyHeaders.js';
import { getViewLabels } from './formatting/viewLabels.js';
import { isNestedInteractiveTarget } from '../../core/interaction/interactiveTarget.js';
import { applyDenseLayout, type DenseLayoutResult } from './layout/denseLayout.js';
import { EventOverflow } from './components/EventOverflow.js';
import { createElement, type JSX } from 'react';
import type { CalendarView, ViewRange, ViewRenderContext } from '../viewTypes.js';
import type { TemporalLike } from '../../core/index.js';
import type { CalendarResource } from '../../core/index.js';
import type { InteractionDraft } from '../../core/index.js';
import { buildResourceColumns, type ResourceColumnData } from '../../core/index.js';
import { layoutDay } from '../../core/index.js';
import {
  formatDate,
  formatHourLabel,
  timeLabelStep,
  formatDraftInterval,
} from './formatting/timeLabels.js';
import { occurrenceEditableForDay, occurrenceEdges } from './layout/occurrenceDays.js';
import {
  GUTTER_PX,
  toPx,
  segmentStyle,
  timedEventWidth,
  eventAccentStyle,
} from './layout/geometryStyles.js';
import { resolveHour } from '../../core/index.js';
import { SlotCells } from './components/SlotCells.js';
import {
  getResourceDraftSegment,
  getDraftClassName,
  createResourceGeometryGrid,
  ResourceAllDay,
} from './components/ResourcePresentation.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

// ---------------------------------------------------------------------------
// Multiagenda: um dia, N colunas por recurso.
// ---------------------------------------------------------------------------

/** Cria a view Multiagenda (colunas por recurso) para um único dia. */
export function createResourceDayView(
  resources: readonly CalendarResource[] = [],
  name = 'resources',
): CalendarView {
  return {
    name,
    label: 'Recursos',
    getRange(date: PlainDate): ViewRange {
      return { days: [date], startDate: date, endDate: date };
    },
    navigate(direction, date) {
      return direction === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 });
    },
    getTitle(range, context): string {
      return formatDate(range.startDate, context.options.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
    render(context: ViewRenderContext): JSX.Element {
      return createElement(ResourceGrid, { context, resources: context.resources ?? resources });
    },
  };
}

function ResourceGrid(props: {
  context: ViewRenderContext;
  resources: readonly CalendarResource[];
}): JSX.Element {
  const scrollRef = usePageStickyHeaders();
  const { context, resources } = props;
  const { options, range } = context;
  const day = range.startDate;
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);
  const gridTopMin = startHour * 60;
  const gridBottomMin = endHour * 60;
  const bodyHeight = (gridBottomMin - gridTopMin) * options.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number =>
    (minuteOfDay - gridTopMin) * options.pxPerMinute;

  const columns = buildResourceColumns(
    context.temporal,
    resources,
    day,
    context.resourceBufferOccurrences ?? context.occurrences,
    context.constraints,
    { startHour, endHour },
    options.timeZone,
    options.visibleResourceIds,
    options.defaultResourceCapacity,
  );

  const densities = columns.map((column) =>
    applyDenseLayout(
      layoutDay(column.day.timed, createResourceGeometryGrid(context)),
      options.timedEventOverflow,
      options.eventMaxStack,
      options.minEventWidth,
      options.slotEventOverlap,
    ),
  );
  const nowZoned = context.temporal.Instant.fromEpochMilliseconds(context.nowMs).toZonedDateTimeISO(
    options.timeZone,
  );
  const isToday = nowZoned.toPlainDate().toString() === day.toString();
  const nowMinuteOfDay = nowZoned.hour * 60 + nowZoned.minute;
  const nowWithinGrid = nowMinuteOfDay >= gridTopMin && nowMinuteOfDay <= gridBottomMin;
  const showNowLine = isToday && nowWithinGrid;

  const hourLabels: { minute: number; label: string }[] = [];
  for (let minute = gridTopMin; minute < gridBottomMin; minute += timeLabelStep(options)) {
    hourLabels.push({ minute, label: formatHourLabel(minute, options.locale) });
  }

  return (
    <div className="mc-resources" data-mc-view="resources">
      {/* Scroller horizontal ÚNICO (cabeçalho + corpo): em tela estreita as colunas de recurso
          ganham piso de largura (`--mc-resource-min-width`) e o grid rola na horizontal — os dois
          precisam rolar juntos, senão o nome do recurso desalinha da coluna. Só estrutura. */}
      <div ref={scrollRef} className="mc-hscroll" data-mc-hscroll>
        <div className="mc-resource-header-row" style={{ display: 'flex' }}>
          <div className="mc-gutter-corner" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }} />
          {columns.map((column, columnIndex) => (
            <div
              key={column.resource.id}
              className={`mc-resource-header${column.overCapacity ? ' mc-over-capacity' : ''}`}
              data-mc-resource-header={column.resource.id}
              style={{
                flex: '1 1 0',
                textAlign: 'center',
                minWidth: densities[columnIndex]?.minWidth || undefined,
              }}
            >
              <span className="mc-resource-title">{column.resource.title}</span>
              {column.overCapacity && (
                <span className="mc-capacity-badge" data-mc-over-capacity>
                  {column.maxConcurrency}/{column.capacity ?? 1}
                </span>
              )}
            </div>
          ))}
        </div>

        {columns.some((column) => column.day.allDay.length > 0) && (
          <div className="mc-resource-allday-row" style={{ display: 'flex' }}>
            <div style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}>Dia inteiro</div>
            {columns.map((column, columnIndex) => (
              <div
                key={column.resource.id}
                style={{ flex: '1 1 0', minWidth: densities[columnIndex]?.minWidth || undefined }}
              >
                <ResourceAllDay column={column} context={context} />
              </div>
            ))}
          </div>
        )}
        <div className="mc-body" style={{ display: 'flex', position: 'relative' }}>
          <div
            className="mc-time-axis"
            style={{
              width: toPx(GUTTER_PX),
              flex: '0 0 auto',
              position: 'relative',
              height: toPx(bodyHeight),
            }}
          >
            {hourLabels.map((hourLabel) => (
              <div
                key={hourLabel.minute}
                className="mc-hour-label"
                style={{
                  position: 'absolute',
                  top: toPx(minuteToY(hourLabel.minute)),
                  right: '4px',
                }}
              >
                {hourLabel.label}
              </div>
            ))}
          </div>

          {columns.map((column, columnIndex) => {
            const columnDraft = getResourceDraftSegment(
              context.draft,
              column.resource.id,
              column.day.dateISO,
            );
            return (
              <ResourceColumn
                key={column.resource.id}
                column={column}
                density={densities[columnIndex]!}
                first={column === columns[0]}
                context={context}
                bodyHeight={bodyHeight}
                hourMinutes={hourLabels.map((hourLabel) => hourLabel.minute)}
                minuteToY={minuteToY}
                pxPerMinute={options.pxPerMinute}
                nowMinutes={showNowLine ? nowMinuteOfDay : null}
                {...(columnDraft ? { draft: columnDraft } : {})}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ResourceColumn(props: {
  first: boolean;
  column: ResourceColumnData;
  density: DenseLayoutResult;
  context: ViewRenderContext;
  bodyHeight: number;
  hourMinutes: number[];
  minuteToY: (minuteOfDay: number) => number;
  pxPerMinute: number;
  nowMinutes: number | null;
  draft?: InteractionDraft;
}): JSX.Element {
  const {
    column,
    context,
    bodyHeight,
    hourMinutes,
    minuteToY,
    pxPerMinute,
    nowMinutes,
    draft,
    density,
  } = props;
  const placementById = new Map(column.day.timed.map((placement) => [placement.id, placement]));
  const blocks = density.blocks;

  return (
    <div
      className={`mc-resource-col${column.overCapacity ? ' mc-over-capacity' : ''}`}
      data-mc-resource={column.resource.id}
      data-mc-slot="y"
      data-mc-slot-date={column.day.dateISO}
      data-mc-slot-resource={column.resource.id}
      style={{
        ...context.getDayStyle?.({
          dateISO: column.day.dateISO,
          viewName: context.viewName ?? 'resources',
          resourceId: column.resource.id,
        }),
        flex: '1 1 0',
        minWidth: density.minWidth || undefined,
        position: 'relative',
        height: toPx(bodyHeight),
        touchAction: 'pan-x pan-y',
      }}
    >
      <SlotCells
        dateISO={column.day.dateISO}
        resourceId={column.resource.id}
        first={props.first}
        startMin={resolveHour(context.options.startHour) * 60}
        endMin={resolveHour(context.options.endHour) * 60}
        slotMinutes={context.options.slotMinutes}
        pxPerMinute={pxPerMinute}
        locale={context.options.locale}
      />
      {column.day.nonBusiness.map((segment, index) => (
        <div
          key={`nonbusiness-${index}`}
          className="mc-nonbusiness"
          data-mc-nonbusiness
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}
      {column.bufferSegments.map((segment, index) => (
        <div
          key={`buffer-${index}`}
          className="mc-buffer"
          data-mc-buffer
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}
      {column.day.blocked.map((segment, index) => (
        <div
          key={`blocked-${index}`}
          className="mc-blocked"
          data-mc-blocked
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}
      {hourMinutes.map((minute) => (
        <div
          key={`hourline-${minute}`}
          className="mc-hour-line"
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(minute)) }}
        />
      ))}
      {blocks.map((block) => {
        const placement = placementById.get(block.id)!;
        const event = placement.occurrence.event;
        const timeLabel = formatHourLabel(placement.startMin, context.options.locale);
        const editable = occurrenceEditableForDay(
          placement.occurrence,
          column.day.dateISO,
          context,
        );
        return (
          <div
            key={block.id}
            className={`mc-event${editable ? ' mc-editable' : ''}`}
            data-mc-event={block.id}
            role={context.onEventClick ? 'button' : undefined}
            tabIndex={context.onEventClick ? 0 : undefined}
            aria-label={`${timeLabel} ${event.title}`}
            onClick={(clickEvent) => {
              if (isNestedInteractiveTarget(clickEvent.target, clickEvent.currentTarget)) return;
              // Pointer clicks are dispatched by InteractionEngine; assistive clicks have no pointer.
              if (clickEvent.detail === 0) context.onEventClick?.(placement.occurrence);
            }}
            onKeyDown={(keyEvent) => {
              if (keyEvent.target !== keyEvent.currentTarget || !context.onEventClick) return;
              if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                keyEvent.preventDefault();
                context.onEventClick(placement.occurrence);
              }
            }}
            data-mc-start-min={placement.startMin}
            data-mc-end-min={placement.endMin}
            data-mc-editable={editable ? 'true' : 'false'}
            title={event.title}
            style={{
              position: 'absolute',
              top: toPx(block.top),
              height: toPx(block.height),
              left: `${block.left * 100}%`,
              width: timedEventWidth(block, context.options.slotEventOverlap),
              zIndex: block.column + 1,
              ...(editable ? { touchAction: 'none' } : {}),
              ...(context.draft?.eventId === block.id ? { visibility: 'hidden' as const } : {}),
              ...eventAccentStyle(event.color),
            }}
          >
            <div className="mc-event-content">
              {context.renderEvent
                ? context.renderEvent({
                    occurrence: placement.occurrence,
                    event,
                    timeLabel,
                    isAllDay: false,
                  })
                : createElement(
                    'span',
                    { className: 'mc-event-title' },
                    `${timeLabel} ${event.title}`,
                  )}
            </div>
            {editable &&
              occurrenceEdges(placement.occurrence, column.day.dateISO, context).start && (
                <div
                  className="mc-resize-handle mc-resize-start"
                  data-mc-resize="start"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 6,
                    cursor: 'ns-resize',
                    touchAction: 'none',
                  }}
                />
              )}
            {editable && occurrenceEdges(placement.occurrence, column.day.dateISO, context).end && (
              <div
                className="mc-resize-handle"
                data-mc-resize="end"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '6px',
                  cursor: 'ns-resize',
                  touchAction: 'none',
                }}
              />
            )}
          </div>
        );
      })}
      {density.groups.map((group, index) => (
        <EventOverflow
          key={index}
          group={group}
          dateISO={column.day.dateISO}
          resourceId={column.resource.id}
          context={context}
        />
      ))}
      {draft && (
        <div
          className={getDraftClassName(draft)}
          data-mc-draft={draft.kind}
          aria-hidden="true"
          data-mc-draft-valid={draft.valid ? 'true' : 'false'}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: toPx(minuteToY(draft.startMin)),
            height: toPx((draft.endMin - draft.startMin) * pxPerMinute),
            pointerEvents: 'none',
            zIndex: 10000,
          }}
        >
          <span className="mc-draft-time">
            {formatDraftInterval(context.draft ?? draft, context.options.locale)}
          </span>
          {' · '}
          <span className="mc-draft-title">
            {context.draft?.title ??
              context.occurrences.find((occurrence) => occurrenceKey(occurrence) === draft.eventId)
                ?.event.title ??
              getViewLabels(context.options.locale).newInterval}
          </span>
        </div>
      )}
      {nowMinutes !== null && (
        <div
          className="mc-now-line"
          data-mc-now
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: toPx(minuteToY(nowMinutes)),
            zIndex: 10001,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
