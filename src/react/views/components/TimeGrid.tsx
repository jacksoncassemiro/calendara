/** @jsxImportSource react */
/** Render the time-grid model; inline styles provide required geometry.
 * @remarks Português: Renderiza o modelo da grade horária; estilos inline definem a geometria necessária.
 */
import type { JSX } from 'react';
import type { ViewRenderContext } from '../../viewTypes.js';
import type { GridVM, DayColumnVM, DraftVM } from '../models/timeGridViewModel.js';
import { GUTTER_PX, toPx, segmentStyle, timedEventWidth } from '../layout/geometryStyles.js';
import { usePageStickyHeaders } from '../hooks/usePageStickyHeaders.js';
import { DayHeaderContent } from './DayHeaderContent.js';
import { EventOverflow } from './EventOverflow.js';
import { formatDraftInterval } from '../formatting/timeLabels.js';
import { getViewLabels } from '../formatting/viewLabels.js';
import { isNestedInteractiveTarget } from '../../../core/interaction/interactiveTarget.js';
import { SlotCells } from './SlotCells.js';
import { packDateSpans } from '../layout/spanLayout.js';
import { calendarDayOffset } from '../../../core/interaction/model.js';

/** Render the resolved day columns and shared time axis.
 * @remarks Português: Renderiza colunas de dias resolvidas e eixo horário compartilhado.
 */
export function TimeGrid(props: {
  /** Resolved time-grid presentation model. @remarks Português: Modelo resolvido de apresentação da grade horária. */
  vm: GridVM;
}): JSX.Element {
  const scrollRef = usePageStickyHeaders(
    props.vm.context?.options.locale,
    props.vm.context?.options.direction,
  );
  const vm = props.vm;
  const labels = getViewLabels(vm.context?.options.locale);
  const gridTopMin = vm.startHour * 60;
  const bodyHeight = (vm.endHour - vm.startHour) * 60 * vm.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number => (minuteOfDay - gridTopMin) * vm.pxPerMinute;
  const uniqueAllDay = new Map(
    vm.columns.flatMap((column) => column.allDay.map((event) => [event.id, event] as const)),
  );
  const allDaySegments = packDateSpans(
    [...uniqueAllDay.values()]
      .map((event) => {
        const dates = vm.columns
          .filter((column) => column.allDay.some((item) => item.id === event.id))
          .map((column) => column.dateISO);
        return {
          event,
          dates,
          start: vm.columns.findIndex((column) => column.dateISO === dates[0]),
          span: dates.length,
        };
      })
      .sort((a, b) => a.start - b.start || b.span - a.span),
  );
  const allDayDraftDates = vm.draft?.allDay
    ? vm.columns
        .map((column) => column.dateISO)
        .filter((date) => date >= vm.draft!.dateISO && date < vm.draft!.endDateISO!)
    : [];
  const allDayHeight = Math.max(1, ...allDaySegments.map((segment) => segment.lane + 1)) * 26;

  return (
    <div className="mc-timegrid" data-mc-view={vm.viewName}>
      <div ref={scrollRef} className="mc-hscroll" data-mc-hscroll>
        <div className="mc-header-row" style={{ display: 'flex' }}>
          <div className="mc-gutter-corner" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }} />
          {vm.columns.map((column) => (
            <div
              key={column.dateISO}
              className={`mc-day-header${column.isToday ? ' mc-today' : ''}`}
              data-mc-day-header={column.dateISO}
              style={{
                ...column.dayStyle,
                flex: '1 1 0',
                textAlign: 'center',
                minWidth: column.minWidth || undefined,
              }}
            >
              <DayHeaderContent
                context={vm.context}
                dateISO={column.dateISO}
                viewName={vm.viewName}
                defaultContent={
                  <>
                    <div className="mc-weekday">{column.weekdayLabel}</div>
                    <div className="mc-daynum">{column.dayLabel}</div>
                  </>
                }
              />
            </div>
          ))}
        </div>
        <div className="mc-allday-row" data-mc-allday style={{ display: 'flex' }}>
          <div
            className="mc-gutter-label mc-allday-label"
            style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}
          >
            {labels.allDay}
          </div>
          {vm.columns.map((column) => (
            <div
              key={column.dateISO}
              className="mc-allday-cell"
              data-mc-allday-cell={column.dateISO}
              style={{
                flex: '1 1 0',
                position: 'relative',
                height: allDayHeight,
                minWidth: column.minWidth || undefined,
              }}
            >
              {vm.draft?.allDay && column.dateISO === allDayDraftDates[0] && (
                <div
                  className={`mc-allday-event mc-draft${vm.draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid'}`}
                  data-mc-draft={vm.draft.kind}
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `calc(${allDayDraftDates.length * 100}% - 4px)`,
                    height: 22,
                    pointerEvents: 'none',
                    zIndex: 10000,
                  }}
                >
                  <span className="mc-draft-time">
                    {formatDraftInterval({ draft: vm.draft, locale: vm.context?.options.locale })}
                  </span>
                  {' · '}
                  <span className="mc-draft-title">{vm.draft.title ?? labels.newInterval}</span>
                </div>
              )}
              {allDaySegments
                .filter((segment) => segment.dates[0] === column.dateISO)
                .map(({ event: allDayEvent, dates, span, lane }) => (
                  <div
                    key={allDayEvent.id}
                    className="mc-allday-event"
                    data-mc-allday-event={allDayEvent.id}
                    data-mc-allday-dates={dates.join(' ')}
                    data-mc-event={allDayEvent.id}
                    data-mc-editable={allDayEvent.editable ? 'true' : 'false'}
                    data-mc-start-min="0"
                    data-mc-end-min="0"
                    role={allDayEvent.activate ? 'button' : undefined}
                    tabIndex={allDayEvent.activate ? 0 : undefined}
                    onClick={(event) => {
                      if (
                        !isNestedInteractiveTarget(event.target, event.currentTarget) &&
                        event.detail === 0
                      )
                        allDayEvent.activate?.();
                    }}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget || !allDayEvent.activate) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        allDayEvent.activate();
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: lane * 26,
                      left: 0,
                      height: 22,
                      width: `calc(${span * 100}% - 4px)`,
                      zIndex: 1,
                      ...(vm.draft?.eventId === allDayEvent.id
                        ? { visibility: 'hidden' as const }
                        : {}),
                      ...(allDayEvent.color
                        ? { boxShadow: `inset 3px 0 0 ${allDayEvent.color}` }
                        : {}),
                    }}
                    title={allDayEvent.title}
                  >
                    {allDayEvent.content ?? allDayEvent.title}
                    {allDayEvent.editable &&
                      (!allDayEvent.startDate || dates[0] === allDayEvent.startDate) && (
                        <span
                          className="mc-allday-resize mc-resize-start"
                          data-mc-resize="start"
                          aria-hidden="true"
                        />
                      )}
                    {allDayEvent.editable &&
                      (!allDayEvent.endDate ||
                        calendarDayOffset(dates.at(-1)!, allDayEvent.endDate) === 1) && (
                        <span
                          className="mc-allday-resize"
                          data-mc-resize="end"
                          aria-hidden="true"
                        />
                      )}
                  </div>
                ))}
            </div>
          ))}
        </div>
        <div className="mc-body" data-mc-body style={{ display: 'flex', position: 'relative' }}>
          <div
            className="mc-time-axis"
            style={{
              width: toPx(GUTTER_PX),
              flex: '0 0 auto',
              position: 'relative',
              height: toPx(bodyHeight),
            }}
          >
            {vm.hourLabels.map((hourLabel) => (
              <div
                key={hourLabel.min}
                className="mc-hour-label"
                style={{
                  position: 'absolute',
                  top: toPx(minuteToY(hourLabel.min)),
                  insetInlineEnd: '4px',
                }}
              >
                {hourLabel.label}
              </div>
            ))}
          </div>
          {vm.columns.map((column) => {
            const fullDraft = vm.draft;
            const columnDraft =
              fullDraft &&
              !fullDraft.allDay &&
              column.dateISO >= fullDraft.dateISO &&
              column.dateISO <= (fullDraft.endDateISO ?? fullDraft.dateISO)
                ? {
                    ...fullDraft,
                    dateISO: column.dateISO,
                    startMin:
                      column.dateISO === fullDraft.dateISO ? fullDraft.startMin : vm.startHour * 60,
                    endMin:
                      column.dateISO === (fullDraft.endDateISO ?? fullDraft.dateISO)
                        ? fullDraft.endMin
                        : vm.endHour * 60,
                  }
                : undefined;
            return (
              <DayColumn
                key={column.dateISO}
                activeEventId={vm.draft?.eventId}
                context={vm.context}
                column={column}
                first={column === vm.columns[0]}
                startMin={gridTopMin}
                endMin={vm.endHour * 60}
                slotMinutes={vm.slotMinutes}
                bodyHeight={bodyHeight}
                hourMinutes={vm.hourLabels.map((hourLabel) => hourLabel.min)}
                minuteToY={minuteToY}
                pxPerMinute={vm.pxPerMinute}
                draft={columnDraft}
                fullDraft={vm.draft}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayColumn(props: {
  /** Original occurrence key of the active gesture. @remarks Português: Chave da ocorrência original do gesto ativo. */
  activeEventId?: string;
  /** Resolved view data and consumer callbacks. @remarks Português: Dados resolvidos da view e callbacks do consumidor. */
  context?: ViewRenderContext;
  /** Resolved event and availability data for the column. @remarks Português: Dados resolvidos dos eventos e disponibilidade da coluna. */
  column: DayColumnVM;
  /** Allow initial keyboard focus in this column. @remarks Português: Permite o foco inicial por teclado nesta coluna. */
  first: boolean;
  /** Inclusive start in minutes since midnight. @remarks Português: Início inclusivo em minutos desde meia-noite. */
  startMin: number;
  /** Exclusive end in minutes since midnight. @remarks Português: Fim exclusivo em minutos desde meia-noite. */
  endMin: number;
  /** Minutes represented by each background slot. @remarks Português: Minutos representados por cada slot de fundo. */
  slotMinutes: number;
  /** Time-grid body height in pixels. @remarks Português: Altura do corpo da grade horária em pixels. */
  bodyHeight: number;
  /** Visible grid-line positions in minutes since midnight. @remarks Português: Posições das linhas visíveis em minutos desde meia-noite. */
  hourMinutes: number[];
  /** Convert minutes since midnight to vertical pixels. @remarks Português: Converte minutos desde meia-noite em pixels verticais. */
  minuteToY: (minuteOfDay: number) => number;
  /** Pixels per minute along the time axis. @remarks Português: Pixels por minuto no eixo de tempo. */
  pxPerMinute: number;
  /** Gesture preview for this column. @remarks Português: Prévia do gesto nesta coluna. */
  draft?: DraftVM;
  /** Full gesture interval before clipping to the column. @remarks Português: Intervalo completo do gesto antes do recorte para a coluna. */
  fullDraft?: DraftVM;
}): JSX.Element {
  const { column, bodyHeight, hourMinutes, minuteToY, pxPerMinute, draft } = props;
  const labels = getViewLabels(props.context?.options.locale);
  return (
    <div
      className={`mc-day-col${column.isToday ? ' mc-today' : ''}`}
      data-mc-day={column.dateISO}
      style={{
        ...column.dayStyle,
        flex: '1 1 0',
        minWidth: column.minWidth || undefined,
        position: 'relative',
        height: toPx(bodyHeight),
        touchAction: 'pan-x pan-y',
      }}
    >
      {column.nonBusiness.map((segment, index) => (
        <div
          key={`nonbusiness-${index}`}
          className="mc-nonbusiness"
          data-mc-nonbusiness
          style={segmentStyle({ segment, minuteToY, pxPerMinute })}
        />
      ))}
      {column.blocked.map((segment, index) => (
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
      <SlotCells
        dateISO={column.dateISO}
        first={props.first}
        startMin={props.startMin}
        endMin={props.endMin}
        slotMinutes={props.slotMinutes}
        pxPerMinute={pxPerMinute}
      />
      {column.events.map((eventItem) => (
        <div
          key={eventItem.id}
          className={`mc-event${eventItem.editable ? ' mc-editable' : ''}`}
          data-mc-event={eventItem.id}
          role={eventItem.activate ? 'button' : undefined}
          tabIndex={eventItem.activate ? 0 : undefined}
          aria-label={`${eventItem.timeLabel} ${eventItem.title}`}
          onClick={(clickEvent) => {
            if (isNestedInteractiveTarget(clickEvent.target, clickEvent.currentTarget)) return;
            if (clickEvent.detail === 0) eventItem.activate?.();
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !eventItem.activate) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              eventItem.activate();
            }
          }}
          data-mc-start-min={eventItem.startMin}
          data-mc-end-min={eventItem.endMin}
          data-mc-editable={eventItem.editable ? 'true' : 'false'}
          title={eventItem.title}
          style={{
            position: 'absolute',
            top: toPx(eventItem.block.top),
            height: toPx(eventItem.block.height),
            insetInlineStart: `${eventItem.block.left * 100}%`,
            width: timedEventWidth({
              block: eventItem.block,
              overlap: props.context?.options.slotEventOverlap,
            }),
            zIndex: eventItem.block.column + 1,
            touchAction: 'auto',
            ...(props.activeEventId === eventItem.id ? { visibility: 'hidden' as const } : {}),
            ...(eventItem.color
              ? {
                  boxShadow: `inset 3px 0 0 ${eventItem.color}, inset 0 0 0 1px var(--mc-color-event-border)`,
                }
              : {}),
          }}
        >
          <div className="mc-event-content">
            {eventItem.content ?? (
              <>
                <span className="mc-event-time">{eventItem.timeLabel}</span>
                <span className="mc-event-title">{eventItem.title}</span>
              </>
            )}
          </div>
          {eventItem.editable && eventItem.resizeStart !== false && (
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
          {eventItem.editable && eventItem.resizeEnd !== false && (
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
      ))}

      {props.context &&
        column.overflowGroups?.map((group, index) => (
          <EventOverflow
            key={index}
            group={group}
            dateISO={column.dateISO}
            context={props.context!}
          />
        ))}
      {draft && (
        <div
          className={`mc-draft mc-draft-${draft.kind}${draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid'}`}
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
            {formatDraftInterval({
              draft: props.fullDraft ?? draft,
              locale: props.context?.options.locale,
            })}
          </span>
          {' · '}
          <span className="mc-draft-title">
            {draft.title ?? (draft.kind === 'select' ? labels.newInterval : labels.changingEvent)}
          </span>
        </div>
      )}
      {column.nowMinutes !== null && (
        <div
          className="mc-now-line"
          data-mc-now
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: toPx(minuteToY(column.nowMinutes)),
            zIndex: 10001,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
