/** @jsxImportSource react */
/** Single-day resource columns.
 * @remarks Português: Colunas por recurso em um único dia
 */
import { occurrenceKey } from '../../core/render/derive.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
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

/** Configurable date/resource columns.
 * @remarks Português: Colunas configuráveis de datas e recursos.
 */
export interface ResourceViewInput {
  /** Fallback resources; context resources take precedence.
   * @remarks Português: Recursos padrão; os recursos do contexto têm precedência.
   */
  resources?: readonly CalendarResource[];
  /** Number of visible days; default 1.
   * @remarks Português: Quantidade de dias visíveis; padrão 1.
   */
  days?: number;
  /** Start at the reference date or its week boundary; default date.
   * @remarks Português: Começa na data de referência ou início da semana; padrão date.
   */
  alignment?: 'date' | 'week';
  /** Outer column grouping; default date.
   * @remarks Português: Agrupamento externo das colunas; padrão date.
   */
  groupBy?: 'date' | 'resource';
  /** Unique registered view name; default resources.
   * @remarks Português: Nome único da view registrada; padrão resources.
   */
  name?: string;
  /** Navigation label; default Recursos.
   * @remarks Português: Rótulo de navegação; padrão Recursos.
   */
  label?: string;
}

/** Create vertical resource columns for a configurable date range.
 * @remarks Português: Cria colunas verticais por recurso em um período configurável.
 */
export function createResourceView({
  resources = [],
  days: totalDays = 1,
  alignment = 'date',
  groupBy = 'date',
  name = 'resources',
  label = 'Recursos',
}: ResourceViewInput = {}): CalendarView {
  if (!Number.isSafeInteger(totalDays) || totalDays < 1 || totalDays > 366)
    throw new RangeError('Resource view days must be an integer from 1 to 366.');
  return {
    name,
    label,
    getRange(date, context): ViewRange {
      const start =
        alignment === 'week'
          ? context.dateUtils.startOfWeek({ date, weekStart: context.options.weekStart })
          : date;
      const days = context.dateUtils.eachDayOfRange({ start, end: start.add({ days: totalDays }) });
      return { days, startDate: start, endDate: days[days.length - 1]! };
    },
    navigate({ direction, date }) {
      return direction === 'next'
        ? date.add({ days: totalDays })
        : date.subtract({ days: totalDays });
    },
    getTitle(range, context) {
      const format = (date: PlainDate) =>
        formatDate({
          date,
          locale: context.options.locale,
          options: { day: 'numeric', month: 'long', year: 'numeric' },
        });
      return totalDays === 1
        ? formatDate({
            date: range.startDate,
            locale: context.options.locale,
            options: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
          })
        : `${format(range.startDate)} – ${format(range.endDate)}`;
    },
    render(context) {
      return createElement(ResourceGrid, {
        context,
        resources: context.resources ?? resources,
        groupBy,
      });
    },
  };
}

/** Create single-day resource columns.
 * @remarks Português: Cria colunas por recurso para um único dia
 */
export function createResourceDayView(
  resources: readonly CalendarResource[] = [],
  name = 'resources',
): CalendarView {
  return createResourceView({ resources, name });
}

function ResourceGrid(props: {
  /** Resolved view data and consumer callbacks.
   * @remarks Português: Dados resolvidos da view e callbacks do consumidor
   */
  context: ViewRenderContext;
  /** Resources rendered in this view.
   * @remarks Português: Recursos renderizados nesta view
   */
  resources: readonly CalendarResource[];
  /** Outer header grouping.
   * @remarks Português: Agrupamento externo do cabeçalho
   */
  groupBy: 'date' | 'resource';
}): JSX.Element {
  const scrollRef = usePageStickyHeaders(
    props.context.options.locale,
    props.context.options.direction,
  );
  const { context, resources, groupBy } = props;
  const { options, range } = context;
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);
  const gridTopMin = startHour * 60;
  const gridBottomMin = endHour * 60;
  const bodyHeight = (gridBottomMin - gridTopMin) * options.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number =>
    (minuteOfDay - gridTopMin) * options.pxPerMinute;

  const dateColumns = range.days.flatMap((day) =>
    buildResourceColumns({
      temporal: context.temporal,
      resources,
      day,
      occurrences: context.resourceBufferOccurrences ?? context.occurrences,
      globalConstraints: context.constraints,
      grid: { startHour, endHour },
      displayTimeZone: options.timeZone,
      visibleResourceIds: options.visibleResourceIds,
      defaultCapacity: options.defaultResourceCapacity,
    }),
  );
  const columns =
    groupBy === 'resource'
      ? [...dateColumns].sort(
          (first, second) =>
            resources.indexOf(first.resource) - resources.indexOf(second.resource) ||
            first.day.dateISO.localeCompare(second.day.dateISO),
        )
      : dateColumns;
  const multiday = range.days.length > 1;
  const groupKey = (column: ResourceColumnData) =>
    groupBy === 'date' ? column.day.dateISO : column.resource.id;
  const groups: { key: string; column: ResourceColumnData; count: number }[] = [];
  for (const column of columns) {
    const previous = groups[groups.length - 1];
    if (previous?.key === groupKey(column)) previous.count++;
    else groups.push({ key: groupKey(column), column, count: 1 });
  }

  const densities = columns.map((column) =>
    applyDenseLayout({
      blocks: layoutDay({ items: column.day.timed, grid: createResourceGeometryGrid(context) }),
      policy: options.timedEventOverflow,
      maxStack: options.eventMaxStack,
      minEventWidth: options.minEventWidth,
      slotEventOverlap: options.slotEventOverlap,
    }),
  );
  const columnMinWidth = Math.max(
    multiday ? 140 : 0,
    ...densities.map((density) => density.minWidth),
  );
  const nowZoned = context.temporal.Instant.fromEpochMilliseconds(context.nowMs).toZonedDateTimeISO(
    options.timeZone,
  );
  const todayISO = nowZoned.toPlainDate().toString();
  const nowMinuteOfDay = nowZoned.hour * 60 + nowZoned.minute;
  const nowWithinGrid = nowMinuteOfDay >= gridTopMin && nowMinuteOfDay <= gridBottomMin;

  const hourLabels: {
    /** Label position in minutes since midnight.
     * @remarks Português: Posição do rótulo em minutos desde meia-noite
     */
    minute: number;
    /** Display text.
     * @remarks Português: Texto exibido
     */
    label: string;
  }[] = [];
  for (let minute = gridTopMin; minute < gridBottomMin; minute += timeLabelStep({ options })) {
    hourLabels.push({
      minute,
      label: formatHourLabel({ minuteOfDay: minute, locale: options.locale }),
    });
  }

  return (
    <div className="mc-resources" data-mc-view="resources">
      <div ref={scrollRef} className="mc-hscroll" data-mc-hscroll>
        <div
          className="mc-resource-header-row"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          {multiday && (
            <div className="mc-resource-group-row" style={{ display: 'flex' }}>
              <div
                className="mc-gutter-corner"
                style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}
              />
              {groups.map((group) => (
                <div
                  key={group.key}
                  data-mc-resource-group={group.key}
                  className="mc-resource-group"
                  style={{ flex: `${group.count} 1 0`, minWidth: group.count * columnMinWidth }}
                >
                  {groupBy === 'resource'
                    ? group.column.resource.title
                    : formatDate({
                        date: group.column.day.date,
                        locale: options.locale,
                        options: { weekday: 'short', day: 'numeric', month: 'short' },
                      })}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex' }}>
            <div
              className="mc-gutter-corner"
              style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}
            />
            {columns.map((column) => (
              <div
                key={`${column.day.dateISO}:${column.resource.id}`}
                className={`mc-resource-header${column.overCapacity ? ' mc-over-capacity' : ''}`}
                data-mc-resource-header={column.resource.id}
                data-mc-resource-header-date={column.day.dateISO}
                style={{
                  ...context.getDayStyle?.({
                    dateISO: column.day.dateISO,
                    viewName: context.viewName ?? 'resources',
                    resourceId: column.resource.id,
                  }),
                  flex: '1 1 0',
                  textAlign: 'center',
                  minWidth: columnMinWidth || undefined,
                }}
              >
                <DayHeaderContent
                  context={context}
                  dateISO={column.day.dateISO}
                  viewName={context.viewName ?? 'resources'}
                  resourceId={column.resource.id}
                  defaultContent={
                    <span className="mc-resource-title">
                      {multiday && groupBy === 'resource'
                        ? formatDate({
                            date: column.day.date,
                            locale: options.locale,
                            options: { weekday: 'short', day: 'numeric' },
                          })
                        : column.resource.title}
                    </span>
                  }
                />
                {column.overCapacity && (
                  <span className="mc-capacity-badge" data-mc-over-capacity>
                    {column.maxConcurrency}/{column.capacity ?? 1}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {columns.some((column) => column.day.allDay.length > 0) && (
          <div className="mc-resource-allday-row" style={{ display: 'flex' }}>
            <div className="mc-allday-label" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}>
              {getViewLabels(options.locale).allDay}
            </div>
            {columns.map((column) => (
              <div
                key={`${column.day.dateISO}:${column.resource.id}`}
                style={{ flex: '1 1 0', minWidth: columnMinWidth || undefined }}
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
                  insetInlineEnd: '4px',
                }}
              >
                {hourLabel.label}
              </div>
            ))}
          </div>

          {columns.map((column, columnIndex) => {
            const columnDraft = getResourceDraftSegment({
              draft: context.draft,
              resourceId: column.resource.id,
              dateISO: column.day.dateISO,
            });
            return (
              <ResourceColumn
                key={`${column.day.dateISO}:${column.resource.id}`}
                column={column}
                density={densities[columnIndex]!}
                first={column === columns[0]}
                context={context}
                bodyHeight={bodyHeight}
                hourMinutes={hourLabels.map((hourLabel) => hourLabel.minute)}
                minuteToY={minuteToY}
                pxPerMinute={options.pxPerMinute}
                nowMinutes={
                  column.day.dateISO === todayISO && nowWithinGrid ? nowMinuteOfDay : null
                }
                minWidth={columnMinWidth}
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
  /** Allow initial keyboard focus in this column.
   * @remarks Português: Permite o foco inicial por teclado nesta coluna
   */
  first: boolean;
  /** Resolved event and availability data for the column.
   * @remarks Português: Dados resolvidos dos eventos e disponibilidade da coluna
   */
  column: ResourceColumnData;
  /** Event geometry after applying the density policy.
   * @remarks Português: Geometria dos eventos após aplicar a política de densidade
   */
  density: DenseLayoutResult;
  /** Resolved view data and consumer callbacks.
   * @remarks Português: Dados resolvidos da view e callbacks do consumidor
   */
  context: ViewRenderContext;
  /** Time-grid body height in pixels.
   * @remarks Português: Altura do corpo da grade horária em pixels
   */
  bodyHeight: number;
  /** Visible grid-line positions in minutes since midnight.
   * @remarks Português: Posições das linhas visíveis em minutos desde meia-noite
   */
  hourMinutes: number[];
  /** Convert minutes since midnight to vertical pixels.
   * @remarks Português: Converte minutos desde meia-noite em pixels verticais
   */
  minuteToY: (minuteOfDay: number) => number;
  /** Pixels per minute along the time axis.
   * @remarks Português: Pixels por minuto no eixo de tempo
   */
  pxPerMinute: number;
  /** Current minute of day, or null outside this column.
   * @remarks Português: Minuto atual do dia, ou null fora desta coluna
   */
  nowMinutes: number | null;
  /** Gesture preview for this column.
   * @remarks Português: Prévia do gesto nesta coluna
   */
  draft?: InteractionDraft;
  /** Minimum column width in CSS pixels.
   * @remarks Português: Largura mínima da coluna em pixels CSS
   */
  minWidth: number;
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
        minWidth: Math.max(density.minWidth, props.minWidth) || undefined,
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
          style={segmentStyle({ segment, minuteToY, pxPerMinute })}
        />
      ))}
      {column.bufferSegments.map((segment, index) => (
        <div
          key={`buffer-${index}`}
          className="mc-buffer"
          data-mc-buffer
          style={segmentStyle({ segment, minuteToY, pxPerMinute })}
        />
      ))}
      {column.day.blocked.map((segment, index) => (
        <div
          key={`blocked-${index}`}
          className="mc-blocked"
          data-mc-blocked
          style={segmentStyle({ segment, minuteToY, pxPerMinute })}
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
        const timeLabel = formatHourLabel({
          minuteOfDay: placement.startMin,
          locale: context.options.locale,
        });
        const editable = occurrenceEditableForDay({
          occurrence: placement.occurrence,
          dayISO: column.day.dateISO,
          context,
        });
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
              // InteractionEngine owns pointer clicks. PT: InteractionEngine trata cliques de ponteiro.
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
              insetInlineStart: `${block.left * 100}%`,
              width: timedEventWidth({ block, overlap: context.options.slotEventOverlap }),
              zIndex: block.column + 1,
              touchAction: 'auto',
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
              occurrenceEdges({
                occurrence: placement.occurrence,
                dayISO: column.day.dateISO,
                context,
              }).start && (
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
            {editable &&
              occurrenceEdges({
                occurrence: placement.occurrence,
                dayISO: column.day.dateISO,
                context,
              }).end && (
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
            {formatDraftInterval({ draft: context.draft ?? draft, locale: context.options.locale })}
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
