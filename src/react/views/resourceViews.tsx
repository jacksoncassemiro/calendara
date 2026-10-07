/** @jsxImportSource react */
/**
 * Views orientadas a recurso (Fase 3B / Agenda Desvinculada):
 *  - Multiagenda (`createResourceDayView`): um dia, N colunas — uma por recurso (padrão Feegow/GestãoDS).
 *  - Timeline (`createTimelineView`): recursos em linhas, tempo no eixo X (padrão Syncfusion).
 *
 * Ambas: mesmo contrato `CalendarView`; respeitam capacity (lotação), buffers, múltiplos
 * `resourceIds` por evento e o toggle `options.visibleResourceIds`. Nenhuma regra de negócio (ADR-006).
 *
 * INTERAÇÃO. As duas publicam o contrato de superfície do InteractionEngine
 * (`data-mc-slot` + `data-mc-slot-date` + `data-mc-slot-resource`), declarando o próprio eixo de
 * tempo: `'y'` na Multiagenda (colunas verticais) e `'x'` na Timeline (faixas horizontais). A
 * DATA é sempre a data real do dia da view — o recurso viaja no atributo próprio, nunca embutido
 * na data, que o ConstraintEngine consome como data de calendário de verdade.
 */
import { createElement, type JSX } from 'react';
import type { CalendarView, ViewRange, ViewRenderContext } from './viewDef.js';
import type { TemporalLike } from '../../core/index.js';
import type { CalendarResource } from '../../core/index.js';
import type { InteractionDraft } from '../../core/index.js';
import {
  buildResourceColumns,
  type ResourceColumnData,
} from '../../core/index.js';
import { layoutDay, type GeoGrid } from '../../core/index.js';
import { formatDate, formatHourLabel } from './format.js';
import { occurrenceEditableForDay } from './occurrenceDays.js';
import { GUTTER_PX, toPx, segmentStyle } from './utils.js';
import { resolveHour } from '../../core/index.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

const RESOURCE_LABEL_PX = 120;
const TIMELINE_ROW_PX = 44;

/**
 * Fantasma que pertence a ESTA coluna/linha. Um rascunho sem `resourceId` veio de uma view de
 * data (o motor é um só, compartilhado) e não deve ser desenhado aqui.
 */
function draftForResource(
  draft: InteractionDraft | undefined,
  resourceId: string,
  dateISO: string,
): InteractionDraft | undefined {
  const belongsHere =
    draft !== undefined && !draft.allDay && draft.resourceId === resourceId && dateISO >= draft.dateISO && dateISO <= (draft.endDateISO ?? draft.dateISO);
  return belongsHere ? { ...draft, dateISO, startMin: dateISO === draft!.dateISO ? draft!.startMin : 0,
    endMin: dateISO === (draft!.endDateISO ?? draft!.dateISO) ? draft!.endMin : 1440 } : undefined;
}

/** Classe do fantasma (mesma convenção do TimeGrid). */
function draftClass(draft: InteractionDraft): string {
  const validity = draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid';
  return `mc-draft mc-draft-${draft.kind}${validity}`;
}

function geometryGridOf(context: ViewRenderContext): GeoGrid {
  return {
    startHour: resolveHour(context.options.startHour),
    endHour: resolveHour(context.options.endHour),
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
      return createElement(ResourceGrid, { context, resources: context.resources ?? resources });
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
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);
  const gridTopMin = startHour * 60;
  const gridBottomMin = endHour * 60;
  const bodyHeight = (gridBottomMin - gridTopMin) * options.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number => (minuteOfDay - gridTopMin) * options.pxPerMinute;

  const columns = buildResourceColumns(
    context.temporal,
    resources,
    day,
    context.occurrences,
    context.constraints,
    { startHour, endHour },
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
    <div className="mc-resources" data-mc-view="resources">
      {/* Scroller horizontal ÚNICO (cabeçalho + corpo): em tela estreita as colunas de recurso
          ganham piso de largura (`--mc-resource-min-width`) e o grid rola na horizontal — os dois
          precisam rolar juntos, senão o nome do recurso desalinha da coluna. Só estrutura. */}
      <div className="mc-hscroll" data-mc-hscroll>
        <div className="mc-resource-header-row" style={{ display: 'flex' }}>
          <div className="mc-gutter-corner" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }} />
          {columns.map((column) => (
            <div
              key={column.resource.id}
              className={`mc-resource-header${column.overCapacity ? ' mc-over-capacity' : ''}`}
              data-mc-resource-header={column.resource.id}
              style={{ flex: '1 1 0', textAlign: 'center' }}
            >
              <span className="mc-resource-title">{column.resource.title}</span>
              {column.overCapacity && (
                <span className="mc-capacity-badge" data-mc-over-capacity>
                  {column.maxConcurrency}/{column.resource.capacity ?? 1}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mc-body" style={{ display: 'flex', position: 'relative' }}>
          <div
            className="mc-time-axis"
            style={{ width: toPx(GUTTER_PX), flex: '0 0 auto', position: 'relative', height: toPx(bodyHeight) }}
          >
            {hourLabels.map((hourLabel) => (
              <div
                key={hourLabel.minute}
                className="mc-hour-label"
                style={{ position: 'absolute', top: toPx(minuteToY(hourLabel.minute)), right: '4px' }}
              >
                {hourLabel.label}
              </div>
            ))}
          </div>

          {columns.map((column) => {
            const columnDraft = draftForResource(context.draft, column.resource.id, column.day.dateISO);
            return (
              <ResourceColumn
                key={column.resource.id}
                column={column}
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
  column: ResourceColumnData;
  context: ViewRenderContext;
  bodyHeight: number;
  hourMinutes: number[];
  minuteToY: (minuteOfDay: number) => number;
  pxPerMinute: number;
  nowMinutes: number | null;
  draft?: InteractionDraft;
}): JSX.Element {
  const { column, context, bodyHeight, hourMinutes, minuteToY, pxPerMinute, nowMinutes, draft } = props;
  const placementById = new Map(column.day.timed.map((placement) => [placement.id, placement]));
  const blocks = layoutDay(column.day.timed, geometryGridOf(context));

  return (
    <div
      className={`mc-resource-col${column.overCapacity ? ' mc-over-capacity' : ''}`}
      data-mc-resource={column.resource.id}
      data-mc-slot="y"
      data-mc-slot-date={column.day.dateISO}
      data-mc-slot-resource={column.resource.id}
      style={{ flex: '1 1 0', position: 'relative', height: toPx(bodyHeight), touchAction: 'pan-x pan-y' }}
    >
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
        const editable = occurrenceEditableForDay(placement.occurrence, column.day.dateISO, context);
        return (
          <div
            key={block.id}
            className={`mc-event${editable ? ' mc-editable' : ''}`}
            data-mc-event={block.id}
            role={context.onEventClick ? 'button' : undefined}
            tabIndex={context.onEventClick ? 0 : undefined}
            aria-label={`${timeLabel} ${event.title}`}
            onClick={(clickEvent) => {
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
              width: `${block.width * 100}%`,
              ...(editable ? { touchAction: 'none' } : {}),
              ...(event.color ? { borderLeft: `3px solid ${event.color}` } : {}),
            }}
          >
            {context.renderEvent
              ? context.renderEvent({ occurrence: placement.occurrence, event, timeLabel, isAllDay: false })
              : createElement('span', { className: 'mc-event-title' }, `${timeLabel} ${event.title}`)}
            {editable && (
              <div
                className="mc-resize-handle"
                data-mc-resize
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
      {draft && (
        <div
          className={draftClass(draft)}
          data-mc-draft={draft.kind}
          data-mc-draft-valid={draft.valid ? 'true' : 'false'}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: toPx(minuteToY(draft.startMin)),
            height: toPx((draft.endMin - draft.startMin) * pxPerMinute),
            pointerEvents: 'none',
          }}
        />
      )}
      {nowMinutes !== null && (
        <div
          className="mc-now-line"
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
      return createElement(Timeline, { context, resources: context.resources ?? resources });
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
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);
  const gridStartMin = startHour * 60;
  const gridEndMin = endHour * 60;
  const trackWidth = (gridEndMin - gridStartMin) * options.pxPerMinute;
  const minuteToX = (minuteOfDay: number): number => (minuteOfDay - gridStartMin) * options.pxPerMinute;

  const columns = buildResourceColumns(
    context.temporal,
    resources,
    day,
    context.occurrences,
    context.constraints,
    { startHour, endHour },
    options.timeZone,
    options.visibleResourceIds,
  );

  const hourLabels: { minute: number; label: string }[] = [];
  for (let minute = gridStartMin; minute <= gridEndMin; minute += options.slotMinutes) {
    hourLabels.push({ minute, label: formatHourLabel(minute, options.locale) });
  }

  return (
    <div className="mc-timeline" data-mc-view="timeline">
      {/* Scroller horizontal ÚNICO (cabeçalho + todas as linhas). A Timeline JÁ nasce mais larga
          que um celular — a trilha tem largura explícita (janela × pxPerMinute) —, então aqui o
          scroll não depende de breakpoint: vale em qualquer largura. Só estrutura. */}
      <div className="mc-hscroll" data-mc-hscroll>
        <div className="mc-timeline-header" style={{ display: 'flex' }}>
          <div className="mc-timeline-corner" style={{ width: toPx(RESOURCE_LABEL_PX), flex: '0 0 auto' }} />
          <div className="mc-timeline-axis" style={{ position: 'relative', width: toPx(trackWidth), flex: '0 0 auto' }}>
            {hourLabels.map((hourLabel) => (
              <span
                key={hourLabel.minute}
                className="mc-timeline-hour"
                style={{ position: 'absolute', left: toPx(minuteToX(hourLabel.minute)) }}
              >
                {hourLabel.label}
              </span>
            ))}
          </div>
        </div>

        {columns.map((column) => {
          const lanes = assignLanes(
            column.day.timed.filter((placement) => placement.startMin < gridEndMin && placement.endMin > gridStartMin).map((placement) => ({
              id: placement.id,
              startMin: placement.startMin,
              endMin: placement.endMin,
            })),
          );
          const laneCount = Math.max(1, ...[...lanes.values()].map((lane) => lane + 1));
          const rowHeight = laneCount * TIMELINE_ROW_PX;
          const placementById = new Map(column.day.timed.map((placement) => [placement.id, placement]));
          const rowDraft = draftForResource(context.draft, column.resource.id, column.day.dateISO);
          return (
            <div
              key={column.resource.id}
              className={`mc-timeline-row${column.overCapacity ? ' mc-over-capacity' : ''}`}
              data-mc-timeline-row={column.resource.id}
              style={{ display: 'flex', minHeight: toPx(rowHeight) }}
            >
              <div
                className="mc-timeline-label"
                style={{ width: toPx(RESOURCE_LABEL_PX), flex: '0 0 auto' }}
              >
                {column.resource.title}
              </div>
              <div
                className="mc-timeline-track"
                data-mc-slot="x"
                data-mc-slot-date={column.day.dateISO}
                data-mc-slot-resource={column.resource.id}
                style={{
                  position: 'relative',
                  width: toPx(trackWidth),
                  flex: '0 0 auto',
                  height: toPx(rowHeight),
                  touchAction: 'pan-x pan-y',
                }}
              >
                {[...lanes.entries()].map(([eventId, lane]) => {
                  const placement = placementById.get(eventId)!;
                  const event = placement.occurrence.event;
                  const timeLabel = formatHourLabel(placement.startMin, options.locale);
                  const left = minuteToX(Math.max(placement.startMin, gridStartMin));
                  const clippedEnd = Math.min(placement.endMin, gridEndMin);
                  const width = Math.max(0, clippedEnd - Math.max(placement.startMin, gridStartMin)) * options.pxPerMinute;
                  const editable = occurrenceEditableForDay(placement.occurrence, column.day.dateISO, context);
                  return (
                    <div
                      key={eventId}
                      className={`mc-event${editable ? ' mc-editable' : ''}`}
                      data-mc-event={eventId}
                      role={context.onEventClick ? 'button' : undefined}
                      tabIndex={context.onEventClick ? 0 : undefined}
                      aria-label={`${timeLabel} ${event.title}`}
                      onClick={(clickEvent) => {
                        if (clickEvent.detail === 0) context.onEventClick?.(placement.occurrence);
                      }}
                      onKeyDown={(keyEvent) => {
                        if (keyEvent.target !== keyEvent.currentTarget || !context.onEventClick) return;
                        if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                          keyEvent.preventDefault();
                          context.onEventClick(placement.occurrence);
                        }
                      }}
                      // Minutos REAIS da ocorrência (não os recortados ao grid): são a origem do
                      // gesto, e recortar aqui faria o evento "encolher" ao ser arrastado.
                      data-mc-start-min={placement.startMin}
                      data-mc-end-min={placement.endMin}
                      data-mc-editable={editable ? 'true' : 'false'}
                      title={event.title}
                      style={{
                        position: 'absolute',
                        left: toPx(left),
                        width: toPx(width),
                        top: toPx(lane * TIMELINE_ROW_PX),
                        height: toPx(TIMELINE_ROW_PX - 4),
                        ...(editable ? { touchAction: 'none' } : {}),
                        ...(event.color ? { borderLeft: `3px solid ${event.color}` } : {}),
                      }}
                    >
                      {context.renderEvent
                        ? context.renderEvent({ occurrence: placement.occurrence, event, timeLabel, isAllDay: false })
                        : event.title}
                      {/* Alça na borda DIREITA: aqui o tempo cresce no eixo X. */}
                      {editable && (
                        <div
                          className="mc-resize-handle"
                          data-mc-resize
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            right: 0,
                            width: '6px',
                            cursor: 'ew-resize',
                            touchAction: 'none',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
                {rowDraft && (
                  <div
                    className={draftClass(rowDraft)}
                    data-mc-draft={rowDraft.kind}
                    data-mc-draft-valid={rowDraft.valid ? 'true' : 'false'}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: toPx(minuteToX(rowDraft.startMin)),
                      width: toPx((rowDraft.endMin - rowDraft.startMin) * options.pxPerMinute),
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
