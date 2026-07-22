/** @jsxImportSource preact */
/**
 * Views orientadas a recurso (Fase 3B / Agenda Desvinculada):
 *  - Multiagenda (`createResourceDayView`): um dia, N colunas — uma por recurso (padrão Feegow/GestãoDS).
 *  - Timeline (`createTimelineView`): recursos em linhas, tempo no eixo X (padrão Syncfusion).
 *
 * Ambas: mesmo contrato `CalendarView`; respeitam capacity (lotação), buffers, múltiplos
 * `resourceIds` por evento e o toggle `options.visibleResourceIds`. Nenhuma regra de negócio (ADR-006).
 */
import { h as createElement, type JSX } from 'preact';
import type { CalendarView, ViewRange, ViewRenderContext } from './viewDef.js';
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarResource } from '../types/resource.js';
import {
  buildResourceColumns,
  type ResourceColumnData,
} from '../render/resourceDerive.js';
import { layoutDay, type GeoGrid } from '../geometry/geometry.js';
import { formatDate, formatHourLabel } from './format.js';
import { GUTTER_PX, toPx, segmentStyle } from './utils.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

const RESOURCE_LABEL_PX = 120;
const TIMELINE_ROW_PX = 44;

function geometryGridOf(context: ViewRenderContext): GeoGrid {
  return {
    startHour: context.options.startHour,
    endHour: context.options.endHour,
    pxPerMinute: context.options.pxPerMinute,
    minEventMinutes: context.options.minEventMinutes,
    gutter: 0,
  };
}

// ---------------------------------------------------------------------------
// Multiagenda: um dia, N colunas por recurso.
// ---------------------------------------------------------------------------

/** Cria a view Multiagenda (colunas por recurso) para um único dia. */
export function createResourceDayView(
  resources: readonly CalendarResource[],
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
      return createElement(ResourceGrid, { context, resources });
    },
  };
}

function ResourceGrid(props: {
  context: ViewRenderContext;
  resources: readonly CalendarResource[];
}): JSX.Element {
  const { context, resources } = props;
  const { options, range } = context;
  const day = range.startDate;
  const gridTopMin = options.startHour * 60;
  const gridBottomMin = options.endHour * 60;
  const bodyHeight = (gridBottomMin - gridTopMin) * options.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number => (minuteOfDay - gridTopMin) * options.pxPerMinute;

  const columns = buildResourceColumns(
    context.temporal,
    resources,
    day,
    context.occurrences,
    context.constraints,
    { startHour: options.startHour, endHour: options.endHour },
    options.timeZone,
    options.visibleResourceIds,
  );

  const nowZoned = context.temporal.Instant.fromEpochMilliseconds(context.nowMs).toZonedDateTimeISO(
    options.timeZone,
  );
  const isToday = nowZoned.toPlainDate().toString() === day.toString();
  const nowMinuteOfDay = nowZoned.hour * 60 + nowZoned.minute;
  const nowWithinGrid = nowMinuteOfDay >= gridTopMin && nowMinuteOfDay <= gridBottomMin;
  const showNowLine = isToday && nowWithinGrid;

  const hourLabels: { minute: number; label: string }[] = [];
  for (let minute = gridTopMin; minute <= gridBottomMin; minute += options.slotMinutes) {
    hourLabels.push({ minute, label: formatHourLabel(minute, options.locale) });
  }

  return (
    <div class="mc-resources" data-mc-view="resources">
      <div class="mc-resource-header-row" style={{ display: 'flex' }}>
        <div class="mc-gutter-corner" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }} />
        {columns.map((column) => (
          <div
            key={column.resource.id}
            class={`mc-resource-header${column.overCapacity ? ' mc-over-capacity' : ''}`}
            data-mc-resource-header={column.resource.id}
            style={{ flex: '1 1 0', textAlign: 'center' }}
          >
            <span class="mc-resource-title">{column.resource.title}</span>
            {column.overCapacity && (
              <span class="mc-capacity-badge" data-mc-over-capacity>
                {column.maxConcurrency}/{column.resource.capacity ?? 1}
              </span>
            )}
          </div>
        ))}
      </div>

      <div class="mc-body" style={{ display: 'flex', position: 'relative' }}>
        <div
          class="mc-time-axis"
          style={{ width: toPx(GUTTER_PX), flex: '0 0 auto', position: 'relative', height: toPx(bodyHeight) }}
        >
          {hourLabels.map((hourLabel) => (
            <div
              key={hourLabel.minute}
              class="mc-hour-label"
              style={{ position: 'absolute', top: toPx(minuteToY(hourLabel.minute)), right: '4px' }}
            >
              {hourLabel.label}
            </div>
          ))}
        </div>

        {columns.map((column) => (
          <ResourceColumn
            key={column.resource.id}
            column={column}
            context={context}
            bodyHeight={bodyHeight}
            hourMinutes={hourLabels.map((hourLabel) => hourLabel.minute)}
            minuteToY={minuteToY}
            pxPerMinute={options.pxPerMinute}
            nowMinutes={showNowLine ? nowMinuteOfDay : null}
          />
        ))}
      </div>
    </div>
  );
}


function ResourceColumn(props: {
  column: ResourceColumnData;
  context: ViewRenderContext;
  bodyHeight: number;
  hourMinutes: number[];
  minuteToY: (minuteOfDay: number) => number;
  pxPerMinute: number;
  nowMinutes: number | null;
}): JSX.Element {
  const { column, context, bodyHeight, hourMinutes, minuteToY, pxPerMinute, nowMinutes } = props;
  const placementById = new Map(column.day.timed.map((placement) => [placement.id, placement]));
  const blocks = layoutDay(column.day.timed, geometryGridOf(context));

  return (
    <div
      class={`mc-resource-col${column.overCapacity ? ' mc-over-capacity' : ''}`}
      data-mc-resource={column.resource.id}
      style={{ flex: '1 1 0', position: 'relative', height: toPx(bodyHeight) }}
    >
      {column.day.nonBusiness.map((segment, index) => (
        <div
          key={`nonbusiness-${index}`}
          class="mc-nonbusiness"
          data-mc-nonbusiness
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}
      {column.bufferSegments.map((segment, index) => (
        <div
          key={`buffer-${index}`}
          class="mc-buffer"
          data-mc-buffer
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}
      {column.day.blocked.map((segment, index) => (
        <div
          key={`blocked-${index}`}
          class="mc-blocked"
          data-mc-blocked
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}
      {hourMinutes.map((minute) => (
        <div
          key={`hourline-${minute}`}
          class="mc-hour-line"
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(minute)) }}
        />
      ))}
      {blocks.map((block) => {
        const placement = placementById.get(block.id)!;
        const event = placement.occurrence.event;
        const timeLabel = formatHourLabel(placement.startMin, context.options.locale);
        return (
          <div
            key={block.id}
            class="mc-event"
            data-mc-event={block.id}
            title={event.title}
            style={{
              position: 'absolute',
              top: toPx(block.top),
              height: toPx(block.height),
              left: `${block.left * 100}%`,
              width: `${block.width * 100}%`,
              ...(event.color ? { backgroundColor: event.color } : {}),
            }}
          >
            {context.renderEvent
              ? context.renderEvent({ occurrence: placement.occurrence, event, timeLabel, isAllDay: false })
              : createElement('span', { class: 'mc-event-title' }, `${timeLabel} ${event.title}`)}
          </div>
        );
      })}
      {nowMinutes !== null && (
        <div
          class="mc-now-line"
          data-mc-now
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(nowMinutes)) }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline: recursos em linhas, tempo no eixo X.
// ---------------------------------------------------------------------------

/** Cria a view Timeline (recursos em linhas, tempo no eixo X) para um único dia. */
export function createTimelineView(
  resources: readonly CalendarResource[],
  name = 'timeline',
): CalendarView {
  return {
    name,
    label: 'Linha do tempo',
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
      return createElement(Timeline, { context, resources });
    },
  };
}

/** Empacota os eventos de uma linha em "faixas" (lanes) para não se sobreporem verticalmente. */
function assignLanes(placements: { id: string; startMin: number; endMin: number }[]): Map<string, number> {
  const sorted = [...placements].sort((first, second) => first.startMin - second.startMin);
  const laneEnds: number[] = [];
  const laneByEvent = new Map<string, number>();
  for (const placement of sorted) {
    let assignedLane = -1;
    for (let laneIndex = 0; laneIndex < laneEnds.length; laneIndex++) {
      const laneIsFree = (laneEnds[laneIndex] ?? -Infinity) <= placement.startMin;
      if (laneIsFree) {
        assignedLane = laneIndex;
        break;
      }
    }
    const needsNewLane = assignedLane === -1;
    if (needsNewLane) {
      assignedLane = laneEnds.length;
      laneEnds.push(placement.endMin);
    } else {
      laneEnds[assignedLane] = placement.endMin;
    }
    laneByEvent.set(placement.id, assignedLane);
  }
  return laneByEvent;
}

function Timeline(props: {
  context: ViewRenderContext;
  resources: readonly CalendarResource[];
}): JSX.Element {
  const { context, resources } = props;
  const { options, range } = context;
  const day = range.startDate;
  const gridStartMin = options.startHour * 60;
  const gridEndMin = options.endHour * 60;
  const trackWidth = (gridEndMin - gridStartMin) * options.pxPerMinute;
  const minuteToX = (minuteOfDay: number): number => (minuteOfDay - gridStartMin) * options.pxPerMinute;

  const columns = buildResourceColumns(
    context.temporal,
    resources,
    day,
    context.occurrences,
    context.constraints,
    { startHour: options.startHour, endHour: options.endHour },
    options.timeZone,
    options.visibleResourceIds,
  );

  const hourLabels: { minute: number; label: string }[] = [];
  for (let minute = gridStartMin; minute <= gridEndMin; minute += options.slotMinutes) {
    hourLabels.push({ minute, label: formatHourLabel(minute, options.locale) });
  }

  return (
    <div class="mc-timeline" data-mc-view="timeline">
      <div class="mc-timeline-header" style={{ display: 'flex' }}>
        <div class="mc-timeline-corner" style={{ width: toPx(RESOURCE_LABEL_PX), flex: '0 0 auto' }} />
        <div class="mc-timeline-axis" style={{ position: 'relative', width: toPx(trackWidth), flex: '0 0 auto' }}>
          {hourLabels.map((hourLabel) => (
            <span
              key={hourLabel.minute}
              class="mc-timeline-hour"
              style={{ position: 'absolute', left: toPx(minuteToX(hourLabel.minute)) }}
            >
              {hourLabel.label}
            </span>
          ))}
        </div>
      </div>

      {columns.map((column) => {
        const lanes = assignLanes(
          column.day.timed.map((placement) => ({
            id: placement.id,
            startMin: placement.startMin,
            endMin: placement.endMin,
          })),
        );
        const laneCount = Math.max(1, ...[...lanes.values()].map((lane) => lane + 1));
        const rowHeight = laneCount * TIMELINE_ROW_PX;
        const placementById = new Map(column.day.timed.map((placement) => [placement.id, placement]));
        return (
          <div
            key={column.resource.id}
            class={`mc-timeline-row${column.overCapacity ? ' mc-over-capacity' : ''}`}
            data-mc-timeline-row={column.resource.id}
            style={{ display: 'flex', minHeight: toPx(rowHeight) }}
          >
            <div
              class="mc-timeline-label"
              style={{ width: toPx(RESOURCE_LABEL_PX), flex: '0 0 auto' }}
            >
              {column.resource.title}
            </div>
            <div
              class="mc-timeline-track"
              style={{ position: 'relative', width: toPx(trackWidth), flex: '0 0 auto', height: toPx(rowHeight) }}
            >
              {[...lanes.entries()].map(([eventId, lane]) => {
                const placement = placementById.get(eventId)!;
                const event = placement.occurrence.event;
                const left = minuteToX(Math.max(placement.startMin, gridStartMin));
                const clippedEnd = Math.min(placement.endMin, gridEndMin);
                const width = Math.max(0, clippedEnd - Math.max(placement.startMin, gridStartMin)) * options.pxPerMinute;
                return (
                  <div
                    key={eventId}
                    class="mc-event"
                    data-mc-event={eventId}
                    title={event.title}
                    style={{
                      position: 'absolute',
                      left: toPx(left),
                      width: toPx(width),
                      top: toPx(lane * TIMELINE_ROW_PX),
                      height: toPx(TIMELINE_ROW_PX - 4),
                      ...(event.color ? { backgroundColor: event.color } : {}),
                    }}
                  >
                    {event.title}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
