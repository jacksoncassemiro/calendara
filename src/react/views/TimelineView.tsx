/** @jsxImportSource react */
/** Daily and period resource timelines.
 * @remarks Português: Timelines de recursos diárias e por período
 */
import { occurrenceKey } from '../../core/render/derive.js';
import { DayHeaderContent } from './components/DayHeaderContent.js';
import { usePageStickyHeaders } from './hooks/usePageStickyHeaders.js';
import { getViewLabels } from './formatting/viewLabels.js';
import { isNestedInteractiveTarget } from '../../core/interaction/interactiveTarget.js';
import { applyDenseLayout } from './layout/denseLayout.js';
import { EventOverflow } from './components/EventOverflow.js';
import { createElement, useState, type JSX } from 'react';
import type { CalendarView, ViewRange, ViewRenderContext } from '../viewTypes.js';
import type { TemporalLike } from '../../core/index.js';
import type { CalendarResource } from '../../core/index.js';
import { buildResourceColumns } from '../../core/index.js';
import { layoutDay } from '../../core/index.js';
import {
  formatDate,
  formatHourLabel,
  timeLabelStep,
  formatDraftInterval,
} from './formatting/timeLabels.js';
import { occurrenceEditableForDay, occurrenceEdges } from './layout/occurrenceDays.js';
import { toPx, eventAccentStyle } from './layout/geometryStyles.js';
import { resolveHour } from '../../core/index.js';
import { SlotCells } from './components/SlotCells.js';
import {
  getResourceDraftSegment,
  getDraftClassName,
  createResourceGeometryGrid,
  ResourceAllDay,
} from './components/ResourcePresentation.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

const RESOURCE_LABEL_WIDTH_PX = 120;
const PERIOD_ALL_DAY_WIDTH_PX = 64;
const TIMELINE_ROW_HEIGHT_PX = 44;

/** Create resource rows with horizontal time.
 * @remarks Português: Cria linhas de recursos com tempo horizontal
 */
export function createTimelineView(
  resources: readonly CalendarResource[] = [],
  name = 'timeline',
): CalendarView {
  return {
    name,
    label: 'Linha do tempo',
    getRange(date: PlainDate): ViewRange {
      return { days: [date], startDate: date, endDate: date };
    },
    navigate({ direction, date }) {
      return direction === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 });
    },
    getTitle(range, context): string {
      return formatDate({
        date: range.startDate,
        locale: context.options.locale,
        options: {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        },
      });
    },
    render(context: ViewRenderContext): JSX.Element {
      return createElement(Timeline, { context, resources: context.resources ?? resources });
    },
  };
}

function TimelineTimeAxis({
  options,
}: {
  /** Visible hours, scale and label spacing. @remarks Português: Horários visíveis, escala e espaçamento dos rótulos. */
  options: ViewRenderContext['options'];
}): JSX.Element {
  const gridStartMin = resolveHour(options.startHour) * 60;
  const gridEndMin = resolveHour(options.endHour) * 60;
  const trackWidth = (gridEndMin - gridStartMin) * options.pxPerMinute;
  const minuteToX = (minuteOfDay: number): number =>
    (minuteOfDay - gridStartMin) * options.pxPerMinute;
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
  const labelStep = timeLabelStep({ options, horizontal: true });
  for (let minute = gridStartMin; minute < gridEndMin; minute += labelStep) {
    hourLabels.push({
      minute,
      label: formatHourLabel({ minuteOfDay: minute, locale: options.locale }),
    });
  }

  const labelRows = Math.min(
    hourLabels.length,
    Math.max(1, Math.ceil(60 / (labelStep * options.pxPerMinute))),
  );

  return (
    <div
      className="mc-timeline-axis"
      style={{
        position: 'relative',
        width: toPx(trackWidth),
        height: toPx(Math.max(30, labelRows * 20 + 8)),
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      {hourLabels.map((hourLabel, labelIndex) => (
        <span
          key={hourLabel.minute}
          className="mc-timeline-hour"
          style={{
            position: 'absolute',
            top: toPx(4 + (labelIndex % labelRows) * 20),
            left: toPx(minuteToX(hourLabel.minute)),
            whiteSpace: 'nowrap',
          }}
        >
          {hourLabel.label}
        </span>
      ))}
    </div>
  );
}

function Timeline(props: {
  /** Resolved view data and consumer callbacks.
   * @remarks Português: Dados resolvidos da view e callbacks do consumidor
   */
  context: ViewRenderContext;
  /** Resources rendered in this view.
   * @remarks Português: Recursos renderizados nesta view
   */
  resources: readonly CalendarResource[];
  /** Embedded dated track without a nested scrollport.
   * @remarks Português: Faixa de data sem scroll interno
   */
  embedded?: boolean;
  /** Aligned resource row heights in pixels.
   * @remarks Português: Alturas alinhadas das linhas em pixels
   */
  rowHeights?: ReadonlyMap<string, number>;
}): JSX.Element {
  const scrollRef = usePageStickyHeaders(props.context.options.locale);
  const { context, resources } = props;
  const { options, range } = context;
  const day = range.startDate;
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);
  const gridStartMin = startHour * 60;
  const gridEndMin = endHour * 60;
  const trackWidth = (gridEndMin - gridStartMin) * options.pxPerMinute;
  const minuteToX = (minuteOfDay: number): number =>
    (minuteOfDay - gridStartMin) * options.pxPerMinute;
  const now = context.temporal.Instant.fromEpochMilliseconds(context.nowMs).toZonedDateTimeISO(
    options.timeZone,
  );
  const nowMinute = now.hour * 60 + now.minute;
  const showNow =
    now.toPlainDate().toString() === day.toString() &&
    nowMinute >= gridStartMin &&
    nowMinute <= gridEndMin;

  const columns = buildResourceColumns({
    temporal: context.temporal,
    resources,
    day,
    occurrences: context.resourceBufferOccurrences ?? context.occurrences,
    globalConstraints: context.constraints,
    grid: { startHour, endHour },
    displayTimeZone: options.timeZone,
    visibleResourceIds: options.visibleResourceIds,
    defaultCapacity: options.defaultResourceCapacity,
  });

  return (
    <div className="mc-timeline" data-mc-view="timeline">
      <div
        ref={props.embedded ? undefined : scrollRef}
        className={props.embedded ? 'mc-timeline-period-day' : 'mc-hscroll'}
        data-mc-hscroll={props.embedded ? undefined : true}
      >
        {!props.embedded && (
          <div className="mc-timeline-header" style={{ display: 'flex' }}>
            <div
              className="mc-timeline-corner"
              style={{ width: toPx(RESOURCE_LABEL_WIDTH_PX), flex: '0 0 auto' }}
            />
            <TimelineTimeAxis options={options} />
          </div>
        )}

        <div className="mc-timeline-rows" style={{ position: 'relative' }}>
          {columns.map((column) => {
            const placementById = new Map(
              column.day.timed.map((placement) => [placement.id, placement]),
            );
            const density = applyDenseLayout({
              blocks: layoutDay({
                items: column.day.timed,
                grid: createResourceGeometryGrid(context),
              }).map((block) => ({
                ...block,
                left: block.column / block.columns,
                width: 1 / block.columns,
              })),
              policy: options.timedEventOverflow === 'more' ? 'more' : 'shrink',
              maxStack: options.eventMaxStack,
            });
            const visibleLaneCount = Math.max(
              1,
              ...density.blocks.map((block) => block.columns),
              ...density.groups.map(() => options.eventMaxStack ?? 3),
            );
            const timedHeight = visibleLaneCount * TIMELINE_ROW_HEIGHT_PX;
            const rowHeight = Math.max(
              props.rowHeights?.get(column.resource.id) ?? 0,
              timedHeight,
              28 +
                (column.day.allDay.length +
                  (context.draft?.allDay && context.draft.resourceId === column.resource.id
                    ? 1
                    : 0)) *
                  28,
            );
            const rowDraft = getResourceDraftSegment({
              draft: context.draft,
              resourceId: column.resource.id,
              dateISO: column.day.dateISO,
            });
            return (
              <div
                key={column.resource.id}
                className={`mc-timeline-row${column.overCapacity ? ' mc-over-capacity' : ''}`}
                data-mc-timeline-row={column.resource.id}
                style={{
                  ...context.getDayStyle?.({
                    dateISO: column.day.dateISO,
                    viewName: context.viewName ?? 'timeline',
                    resourceId: column.resource.id,
                  }),
                  display: 'flex',
                  minHeight: toPx(rowHeight),
                }}
              >
                <div
                  className="mc-timeline-label"
                  style={{
                    ...context.getDayStyle?.({
                      dateISO: column.day.dateISO,
                      viewName: context.viewName ?? 'timeline',
                      resourceId: column.resource.id,
                    }),
                    width: toPx(props.embedded ? PERIOD_ALL_DAY_WIDTH_PX : RESOURCE_LABEL_WIDTH_PX),
                    flex: '0 0 auto',
                  }}
                >
                  {!props.embedded && (
                    <DayHeaderContent
                      context={context}
                      dateISO={column.day.dateISO}
                      viewName={context.viewName ?? 'timeline'}
                      resourceId={column.resource.id}
                      defaultContent={column.resource.title}
                    />
                  )}
                  <ResourceAllDay column={column} context={context} />
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
                  <SlotCells
                    dateISO={column.day.dateISO}
                    resourceId={column.resource.id}
                    first={column === columns[0]}
                    startMin={gridStartMin}
                    endMin={gridEndMin}
                    slotMinutes={options.slotMinutes}
                    pxPerMinute={options.pxPerMinute}
                    locale={options.locale}
                    horizontal
                  />
                  {[
                    {
                      segments: column.day.nonBusiness,
                      className: 'mc-nonbusiness',
                      attribute: 'data-mc-nonbusiness',
                    },
                    {
                      segments: column.bufferSegments,
                      className: 'mc-buffer',
                      attribute: 'data-mc-buffer',
                    },
                    {
                      segments: column.day.blocked,
                      className: 'mc-blocked',
                      attribute: 'data-mc-blocked',
                    },
                  ].flatMap(({ segments, className, attribute }) =>
                    segments.map((segment, index) => (
                      <div
                        key={`${className}-${index}`}
                        className={className}
                        {...{ [attribute]: true }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: toPx(minuteToX(segment.startMin)),
                          width: toPx((segment.endMin - segment.startMin) * options.pxPerMinute),
                        }}
                      />
                    )),
                  )}
                  {density.blocks.map((block) => {
                    const eventId = block.id;
                    const placement = placementById.get(eventId)!;
                    const event = placement.occurrence.event;
                    const timeLabel = formatHourLabel({
                      minuteOfDay: placement.startMin,
                      locale: options.locale,
                    });
                    const left = minuteToX(Math.max(placement.startMin, gridStartMin));
                    const clippedEnd = Math.min(
                      gridEndMin,
                      Math.max(
                        placement.endMin,
                        Math.max(placement.startMin, gridStartMin) + options.minEventMinutes,
                      ),
                    );
                    const width =
                      Math.max(0, clippedEnd - Math.max(placement.startMin, gridStartMin)) *
                      options.pxPerMinute;
                    const editable = occurrenceEditableForDay({
                      occurrence: placement.occurrence,
                      dayISO: column.day.dateISO,
                      context,
                    });
                    return (
                      <div
                        key={eventId}
                        className={`mc-event${editable ? ' mc-editable' : ''}`}
                        data-mc-event={eventId}
                        role={context.onEventClick ? 'button' : undefined}
                        tabIndex={context.onEventClick ? 0 : undefined}
                        aria-label={`${timeLabel} ${event.title}`}
                        onClick={(clickEvent) => {
                          if (
                            isNestedInteractiveTarget(clickEvent.target, clickEvent.currentTarget)
                          )
                            return;
                          if (clickEvent.detail === 0) context.onEventClick?.(placement.occurrence);
                        }}
                        onKeyDown={(keyEvent) => {
                          if (keyEvent.target !== keyEvent.currentTarget || !context.onEventClick)
                            return;
                          if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                            keyEvent.preventDefault();
                            context.onEventClick(placement.occurrence);
                          }
                        }}
                        // Preserve original minutes when dragging clipped events. PT: Preserva minutos originais ao mover eventos recortados.
                        data-mc-start-min={placement.startMin}
                        data-mc-end-min={placement.endMin}
                        data-mc-editable={editable ? 'true' : 'false'}
                        title={event.title}
                        style={{
                          position: 'absolute',
                          left: toPx(left),
                          width: toPx(width),
                          top: toPx(block.column * TIMELINE_ROW_HEIGHT_PX),
                          height: `calc(${TIMELINE_ROW_HEIGHT_PX}px - var(--mc-event-gap, 8px))`,
                          zIndex: block.column + 1,
                          touchAction: 'auto',
                          ...(context.draft?.eventId === eventId
                            ? { visibility: 'hidden' as const }
                            : {}),
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
                            : event.title}
                        </div>
                        {editable &&
                          occurrenceEdges({
                            occurrence: placement.occurrence,
                            dayISO: column.day.dateISO,
                            context,
                          }).start && (
                            <span
                              className="mc-resize-handle mc-resize-start"
                              data-mc-resize="start"
                              style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: 0,
                                width: 6,
                                cursor: 'ew-resize',
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

                  {density.groups.map((group, index) => (
                    <EventOverflow
                      key={index}
                      group={group}
                      dateISO={column.day.dateISO}
                      resourceId={column.resource.id}
                      context={context}
                      horizontalHeight={timedHeight}
                    />
                  ))}
                  {rowDraft && (
                    <div
                      className={getDraftClassName(rowDraft)}
                      data-mc-draft={rowDraft.kind}
                      aria-hidden="true"
                      data-mc-draft-valid={rowDraft.valid ? 'true' : 'false'}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: toPx(minuteToX(rowDraft.startMin)),
                        width: toPx((rowDraft.endMin - rowDraft.startMin) * options.pxPerMinute),
                        pointerEvents: 'none',
                        zIndex: 10000,
                      }}
                    >
                      <span className="mc-draft-time">
                        {formatDraftInterval({
                          draft: context.draft ?? rowDraft,
                          locale: options.locale,
                        })}
                      </span>
                      {' · '}
                      <span className="mc-draft-title">
                        {context.draft?.title ??
                          context.occurrences.find(
                            (occurrence) => occurrenceKey(occurrence) === rowDraft.eventId,
                          )?.event.title ??
                          getViewLabels(options.locale).newInterval}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {showNow && (
            <div
              className="mc-now-line mc-timeline-now"
              data-mc-now
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: toPx(RESOURCE_LABEL_WIDTH_PX + minuteToX(nowMinute)),
                pointerEvents: 'none',
                zIndex: 10001,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Resource timeline period and grouping configuration.
 * @remarks Português: Configuração de período e grupos da timeline por recursos
 */
export interface ResourceTimelineConfig {
  /** Fallback resources; context.resources takes precedence.
   * @remarks Português: Recursos padrão; context.resources tem prioridade
   */
  resources?: readonly CalendarResource[];
  /** Civil period; default day.
   * @remarks Português: Período civil; padrão day
   */
  duration?: 'day' | 'week' | 'month';
  /** Unique registration name; default resource-timeline plus duration.
   * @remarks Português: Nome único; padrão resource-timeline com o período
   */
  name?: string;
  /** Toolbar label; default Resource timeline.
   * @remarks Português: Rótulo da toolbar; padrão Resource timeline
   */
  label?: string;
  /** Consumer group name for each resource.
   * @remarks Português: Nome de grupo definido pelo consumidor para cada recurso
   */
  groupBy?: (resource: CalendarResource) => string;
  /** Initially collapsed groups; default none.
   * @remarks Português: Grupos inicialmente recolhidos; padrão nenhum
   */
  collapsedGroups?: readonly string[];
  /** Day width in pixels, minimum 180; default 720/week or 480/month.
   * @remarks Português: Largura do dia em pixels, mínimo 180; padrão 720/semana ou 480/mês
   */
  dayWidth?: number;
  /** Explicit resource slice, after filtering and ordering; not scroll virtualization.
   * @remarks Português: Recorte explícito após filtrar e ordenar; não é virtualização do scroll
   */
  resourceWindow?: {
    /** Zero-based first resource.
     * @remarks Português: Primeiro recurso, base zero
     */
    start: number;
    /** Maximum resource rows.
     * @remarks Português: Máximo de linhas de recursos
     */
    count: number;
  };
}

/** Create daily, weekly or monthly resource tracks.
 * @remarks Português: Cria faixas diárias, semanais ou mensais por recurso
 */
export function createResourceTimelineView(config: ResourceTimelineConfig = {}): CalendarView {
  const duration = config.duration ?? 'day';
  if (
    config.dayWidth !== undefined &&
    (!Number.isFinite(config.dayWidth) || config.dayWidth < 180)
  ) {
    throw new RangeError('[calendara] timeline dayWidth must be at least 180 finite pixels');
  }
  if (
    config.resourceWindow &&
    (!Number.isInteger(config.resourceWindow.start) ||
      config.resourceWindow.start < 0 ||
      !Number.isInteger(config.resourceWindow.count) ||
      config.resourceWindow.count < 0)
  ) {
    throw new RangeError(
      '[calendara] timeline resourceWindow requires nonnegative integer start/count',
    );
  }
  return {
    name: config.name ?? `resource-timeline-${duration}`,
    label: config.label ?? 'Resource timeline',
    getRange(date, context) {
      const start =
        duration === 'month'
          ? date.with({ day: 1 })
          : duration === 'week'
            ? context.dateUtils.startOfWeek({ date, weekStart: context.options.weekStart })
            : date;
      const count = duration === 'month' ? start.daysInMonth : duration === 'week' ? 7 : 1;
      const days = Array.from({ length: count }, (_, index) => start.add({ days: index }));
      return { days, startDate: start, endDate: days[count - 1]! };
    },
    navigate({ direction, date }) {
      const amount = direction === 'next' ? 1 : -1;
      return duration === 'month'
        ? date.with({ day: 1 }).add({ months: amount })
        : date.add({ days: amount * (duration === 'week' ? 7 : 1) });
    },
    getTitle(range, context) {
      const options =
        duration === 'month'
          ? { month: 'long' as const, year: 'numeric' as const }
          : { day: 'numeric' as const, month: 'short' as const, year: 'numeric' as const };
      const start = formatDate({ date: range.startDate, locale: context.options.locale, options });
      return duration !== 'week'
        ? start
        : start +
            ' – ' +
            formatDate({ date: range.endDate, locale: context.options.locale, options });
    },
    render(context) {
      return createElement(ResourceTimelinePeriod, { context, config });
    },
  };
}

function ResourceTimelinePeriod({
  context,
  config,
}: {
  /** Resolved calendar data.
   * @remarks Português: Dados resolvidos do calendário
   */
  context: ViewRenderContext;
  /** Consumer period, grouping and window choices.
   * @remarks Português: Escolhas do consumidor para período, grupos e recorte
   */
  config: ResourceTimelineConfig;
}): JSX.Element {
  const scrollRef = usePageStickyHeaders(context.options.locale);
  const [collapsed, setCollapsed] = useState(() => new Set(config.collapsedGroups ?? []));
  const resources = [...(context.resources ?? config.resources ?? [])]
    .filter(
      (resource) =>
        !context.options.visibleResourceIds ||
        context.options.visibleResourceIds.includes(resource.id),
    )
    .sort((first, second) => (first.order ?? 0) - (second.order ?? 0));
  const selected = config.resourceWindow
    ? resources.slice(
        Math.max(0, config.resourceWindow.start),
        Math.max(0, config.resourceWindow.start) + Math.max(0, config.resourceWindow.count),
      )
    : resources;
  const groups = new Map<string, CalendarResource[]>();
  selected.forEach((resource) => {
    const name = config.groupBy?.(resource) ?? '';
    const group = groups.get(name) ?? [];
    group.push(resource);
    groups.set(name, group);
  });
  const startHour = resolveHour(context.options.startHour);
  const endHour = resolveHour(context.options.endHour);
  const dayWidth = Math.max(180, config.dayWidth ?? (config.duration === 'month' ? 480 : 720));
  const dayOptions = {
    ...context.options,
    pxPerMinute: (dayWidth - PERIOD_ALL_DAY_WIDTH_PX) / ((endHour - startHour) * 60),
  };
  const days = context.range.days;
  const rowHeights = new Map<string, number>();
  days.forEach((day) => {
    const columns = buildResourceColumns({
      temporal: context.temporal,
      resources: selected,
      day,
      occurrences: context.resourceBufferOccurrences ?? context.occurrences,
      globalConstraints: context.constraints,
      grid: { startHour, endHour },
      displayTimeZone: context.options.timeZone,
      visibleResourceIds: context.options.visibleResourceIds,
      defaultCapacity: context.options.defaultResourceCapacity,
    });
    columns.forEach((column) => {
      const blocks = layoutDay({
        items: column.day.timed,
        grid: createResourceGeometryGrid(context),
      });
      const laneCount = Math.max(1, ...blocks.map((block) => block.columns));
      const limit =
        context.options.timedEventOverflow === 'more'
          ? Math.min(laneCount, context.options.eventMaxStack ?? 3)
          : laneCount;
      const allDayCount =
        column.day.allDay.length +
        (context.draft?.allDay && context.draft.resourceId === column.resource.id ? 1 : 0);
      rowHeights.set(
        column.resource.id,
        Math.max(
          rowHeights.get(column.resource.id) ?? 0,
          limit * TIMELINE_ROW_HEIGHT_PX,
          28 + allDayCount * 28,
        ),
      );
    });
  });
  return (
    <div
      className="mc-resource-timeline-period"
      data-mc-view={context.viewName ?? 'resource-timeline'}
    >
      <div ref={scrollRef} className="mc-hscroll" data-mc-hscroll>
        <div
          className="mc-timeline-header mc-period-date-header"
          style={{ display: 'flex', width: RESOURCE_LABEL_WIDTH_PX + days.length * dayWidth }}
        >
          <div
            className="mc-timeline-corner"
            style={{ width: RESOURCE_LABEL_WIDTH_PX, flexShrink: 0 }}
          />
          {days.map((day) => (
            <div
              key={day.toString()}
              data-mc-timeline-date={day.toString()}
              style={{
                ...context.getDayStyle?.({
                  dateISO: day.toString(),
                  viewName: context.viewName ?? 'resource-timeline',
                }),
                width: dayWidth,
                flexShrink: 0,
              }}
            >
              <div className="mc-period-date-title">
                <DayHeaderContent
                  context={context}
                  dateISO={day.toString()}
                  viewName={context.viewName ?? 'resource-timeline'}
                  defaultContent={formatDate({
                    date: day,
                    locale: context.options.locale,
                    options: { weekday: 'short', day: 'numeric', month: 'short' },
                  })}
                />
              </div>
              <div className="mc-period-time-header" style={{ display: 'flex' }}>
                <div
                  className="mc-period-allday-heading"
                  style={{ width: PERIOD_ALL_DAY_WIDTH_PX, flex: '0 0 auto' }}
                >
                  {getViewLabels(context.options.locale).allDay}
                </div>
                <TimelineTimeAxis options={dayOptions} />
              </div>
            </div>
          ))}
        </div>
        {[...groups].map(([name, members]) => (
          <section
            key={name}
            data-mc-resource-group={name}
            style={{ width: RESOURCE_LABEL_WIDTH_PX + days.length * dayWidth }}
          >
            {config.groupBy && (
              <button
                type="button"
                className="mc-resource-group-toggle"
                aria-expanded={!collapsed.has(name)}
                onClick={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (next.has(name)) next.delete(name);
                    else next.add(name);
                    return next;
                  })
                }
              >
                {name} · {members.length}
              </button>
            )}
            {!collapsed.has(name) && (
              <div style={{ display: 'flex' }}>
                <div
                  className="mc-period-resource-labels"
                  style={{ width: RESOURCE_LABEL_WIDTH_PX, flexShrink: 0 }}
                >
                  {members.map((resource) => (
                    <div
                      key={resource.id}
                      data-mc-period-resource={resource.id}
                      style={{ height: rowHeights.get(resource.id) }}
                    >
                      {resource.title}
                    </div>
                  ))}
                </div>
                {days.map((day) => (
                  <div key={day.toString()} style={{ width: dayWidth, flexShrink: 0 }}>
                    <Timeline
                      resources={members}
                      embedded
                      rowHeights={rowHeights}
                      context={{
                        ...context,
                        options: dayOptions,
                        range: { days: [day], startDate: day, endDate: day },
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
