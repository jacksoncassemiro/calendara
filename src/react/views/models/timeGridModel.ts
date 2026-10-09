/** Prepare date columns and interaction geometry. @remarks Português: Prepara colunas de datas e geometria de interação. */
import { applyDenseLayout } from '../layout/denseLayout.js';
import { buildDays, occurrenceKey } from '../../../core/index.js';
import { layoutDay, type GeoGrid } from '../../../core/index.js';
import { resolveHour } from '../../../core/index.js';
import { formatDate, formatHourLabel, timeLabelStep } from '../formatting/timeLabels.js';
import { occurrenceEditableForDay, occurrenceEdges } from '../layout/occurrenceDays.js';
import type { ViewRenderContext } from '../../viewTypes.js';
import type { GridVM, DayColumnVM, EventVM, AllDayVM, DraftVM } from './timeGridViewModel.js';

/** Resolve a time-grid presentation model. @remarks Português: Resolve o modelo de apresentação da grade horária. */
export function buildTimeGridVM({
  context,
  viewName,
}: {
  /** Resolved data and rendering callbacks. @remarks Português: Dados resolvidos e callbacks de renderização. */
  context: ViewRenderContext;
  /** Registered view requesting the model. @remarks Português: View registrada que solicita o modelo. */
  viewName: string;
}): GridVM {
  const { temporal, options, range, occurrences, constraints, renderEvent } = context;
  const startHour = resolveHour(options.startHour);
  const endHour = resolveHour(options.endHour);

  const days = buildDays({
    temporal,
    days: range.days,
    occurrences,
    constraints,
    grid: { startHour, endHour },
    displayTimeZone: options.timeZone,
  });

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
    const density = applyDenseLayout({
      blocks: layoutDay({ items: day.timed, grid: geometryGrid }),
      policy: options.timedEventOverflow,
      maxStack: options.eventMaxStack,
      minEventWidth: options.minEventWidth,
      slotEventOverlap: options.slotEventOverlap,
    });
    const blocks = density.blocks;

    const events: EventVM[] = blocks.map((block) => {
      const placement = placementById.get(block.id)!;
      const event = placement.occurrence.event;
      const timeLabel = formatHourLabel({
        minuteOfDay: placement.startMin,
        locale: options.locale,
      });
      const isEditable = occurrenceEditableForDay({
        occurrence: placement.occurrence,
        dayISO: day.dateISO,
        context,
      });
      const resizeEdges = occurrenceEdges({
        occurrence: placement.occurrence,
        dayISO: day.dateISO,
        context,
      });
      const eventVM: EventVM = {
        id: block.id,
        block,
        title: event.title,
        timeLabel,
        startMin: placement.startMin,
        endMin: placement.endMin,
        editable: isEditable,
        resizeStart: resizeEdges.start,
        resizeEnd: resizeEdges.end,
      };
      if (event.color !== undefined) eventVM.color = event.color;
      if (context.onEventClick)
        eventVM.activate = () => context.onEventClick?.(placement.occurrence);
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
      const allDayVM: AllDayVM = {
        id: occurrenceKey(occurrence),
        title: event.title,
        editable: event.editable !== false,
        startDate: event.time.start.date!,
        endDate: event.time.end.date!,
      };
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
      dayStyle: context.getDayStyle?.({ dateISO: day.dateISO, viewName }),
      minWidth: density.minWidth,
      overflowGroups: density.groups,
      dateISO: day.dateISO,
      weekdayLabel: formatDate({
        date: day.date,
        locale: options.locale,
        options: { weekday: 'short' },
      }),
      dayLabel: formatDate({ date: day.date, locale: options.locale, options: { day: 'numeric' } }),
      isToday,
      nonBusiness: day.nonBusiness,
      blocked: day.blocked,
      allDay,
      events,
      nowMinutes: showNowLine ? nowMinuteOfDay : null,
    };
  });

  const hourLabels: GridVM['hourLabels'] = [];
  for (let minute = gridTopMin; minute < gridBottomMin; minute += timeLabelStep({ options })) {
    hourLabels.push({
      min: minute,
      label: formatHourLabel({ minuteOfDay: minute, locale: options.locale }),
    });
  }

  const uniformMinWidth = Math.max(0, ...columns.map((column) => column.minWidth ?? 0));
  columns.forEach((column) => {
    column.minWidth = uniformMinWidth;
  });
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
    const draftDayVisible = columns.some(
      (column) =>
        column.dateISO >= draft.dateISO && column.dateISO <= (draft.endDateISO ?? draft.dateISO),
    );
    if (draftDayVisible) {
      const draftVM: DraftVM = {
        endDateISO: draft.endDateISO,
        allDay: draft.allDay,
        dateISO: draft.dateISO,
        startMin: draft.startMin,
        endMin: draft.endMin,
        eventId: draft.eventId,
        title:
          draft.title ??
          occurrences.find((occurrence) => occurrenceKey(occurrence) === draft.eventId)?.event
            .title,
        color:
          draft.color ??
          occurrences.find((occurrence) => occurrenceKey(occurrence) === draft.eventId)?.event
            .color,
        kind: draft.kind,
        valid: draft.valid,
      };
      gridVM.draft = draftVM;
    }
  }

  return gridVM;
}
