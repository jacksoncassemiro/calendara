/**
 * Constrói o GridVM (view model do time-grid) a partir do ViewRenderContext.
 * Extraído do CalendarApp para que Week/Day/NDays compartilhem exatamente o mesmo pipeline
 * (buildDays → geometria waterfall → rótulos → linha "agora") e o mesmo componente de render.
 */
import { applyDenseLayout } from '../layout/denseLayout.js';
import { buildDays, occurrenceKey } from '../../../core/index.js';
import { layoutDay, type GeoGrid } from '../../../core/index.js';
import { resolveHour } from '../../../core/index.js';
import { formatDate, formatHourLabel, timeLabelStep } from '../format.js';
import { occurrenceEditableForDay,occurrenceEdges } from '../layout/occurrenceDays.js';
import type { ViewRenderContext } from '../viewDef.js';
import type { GridVM, DayColumnVM, EventVM, AllDayVM, DraftVM } from './timeGridViewModel.js';

export function buildTimeGridVM(context: ViewRenderContext, viewName: string): GridVM {
  const { temporal, options, range, occurrences, constraints, renderEvent } = context;
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);

  const days = buildDays(
    temporal,
    range.days,
    occurrences,
    constraints,
    { startHour, endHour },
    options.timeZone,
  );

  const nowZoned = temporal.Instant.fromEpochMilliseconds(context.nowMs).toZonedDateTimeISO(
    options.timeZone,
  );
  const nowDayISO = nowZoned.toPlainDate().toString();
  const nowMinuteOfDay = nowZoned.hour * 60 + nowZoned.minute;
  const gridTopMin = startHour * 60;
  const gridBottomMin = endHour * 60;

  const geometryGrid: GeoGrid = {
    startHour,
    endHour,
    pxPerMinute: options.pxPerMinute,
    minEventMinutes: options.minEventMinutes,
    gutter: 0,
  };

  const columns: DayColumnVM[] = days.map((day) => {
    const placementById = new Map(day.timed.map((placement) => [placement.id, placement]));
    const density=applyDenseLayout(layoutDay(day.timed, geometryGrid),options.timedEventOverflow,options.eventMaxStack,options.minEventWidth,options.slotEventOverlap);
    const blocks = density.blocks;

    const events: EventVM[] = blocks.map((block) => {
      const placement = placementById.get(block.id)!;
      const event = placement.occurrence.event;
      const timeLabel = formatHourLabel(placement.startMin, options.locale);
      const isEditable = occurrenceEditableForDay(placement.occurrence, day.dateISO, context);
      const resizeEdges = occurrenceEdges(placement.occurrence, day.dateISO, context);
      const eventVM: EventVM = {
        id: block.id,
        block,
        title: event.title,
        timeLabel,
        startMin: placement.startMin,
        endMin: placement.endMin,
        editable: isEditable,
        resizeStart:resizeEdges.start,
        resizeEnd:resizeEdges.end,
      };
      if (event.color !== undefined) eventVM.color = event.color;
      if (context.onEventClick) eventVM.activate = () => context.onEventClick?.(placement.occurrence);
      if (renderEvent) {
        eventVM.content = renderEvent({
          occurrence: placement.occurrence,
          event,
          timeLabel,
          isAllDay: false,
        });
      }
      return eventVM;
    });

    const allDay: AllDayVM[] = day.allDay.map((occurrence) => {
      const event = occurrence.event;
      const allDayVM: AllDayVM = { id: occurrenceKey(occurrence), title: event.title, editable: event.editable !== false,
        startDate:event.time.start.date!,endDate:event.time.end.date! };
      if (event.color !== undefined) allDayVM.color = event.color;
      if (context.onEventClick) allDayVM.activate = () => context.onEventClick?.(occurrence);
      if (renderEvent) {
        allDayVM.content = renderEvent({ occurrence, event, timeLabel: '', isAllDay: true });
      }
      return allDayVM;
    });

    const isToday = day.dateISO === nowDayISO;
    const nowWithinGrid = nowMinuteOfDay >= gridTopMin && nowMinuteOfDay <= gridBottomMin;
    const showNowLine = isToday && nowWithinGrid;
    return {
      dayStyle:context.getDayStyle?.({dateISO:day.dateISO,viewName}),
      minWidth:density.minWidth,overflowGroups:density.groups,
      dateISO: day.dateISO,
      weekdayLabel: formatDate(day.date, options.locale, { weekday: 'short' }),
      dayLabel: formatDate(day.date, options.locale, { day: 'numeric' }),
      isToday,
      nonBusiness: day.nonBusiness,
      blocked: day.blocked,
      allDay,
      events,
      nowMinutes: showNowLine ? nowMinuteOfDay : null,
    };
  });

  const hourLabels: GridVM['hourLabels'] = [];
  for (let minute = gridTopMin; minute < gridBottomMin; minute += timeLabelStep(options)) {
    hourLabels.push({ min: minute, label: formatHourLabel(minute, options.locale) });
  }

  const uniformMinWidth=Math.max(0,...columns.map(column=>column.minWidth ?? 0));
  columns.forEach(column=>{column.minWidth=uniformMinWidth;});
  const gridVM: GridVM = {
    context,
    viewName,
    startHour,
    endHour,
    pxPerMinute: options.pxPerMinute,
    slotMinutes: options.slotMinutes,
    hourLabels,
    columns,
  };

  const draft = context.draft;
  if (draft) {
    const draftDayVisible = columns.some((column) => column.dateISO >= draft.dateISO && column.dateISO <= (draft.endDateISO ?? draft.dateISO));
    if (draftDayVisible) {
      const draftVM: DraftVM = {
        endDateISO: draft.endDateISO,
        allDay: draft.allDay,
        dateISO: draft.dateISO,
        startMin: draft.startMin,
        endMin: draft.endMin,
        eventId: draft.eventId,
        title: occurrences.find(occurrence=>occurrenceKey(occurrence)===draft.eventId)?.event.title,
        color: occurrences.find(occurrence=>occurrenceKey(occurrence)===draft.eventId)?.event.color,
        kind: draft.kind,
        valid: draft.valid,
      };
      gridVM.draft = draftVM;
    }
  }

  return gridVM;
}
