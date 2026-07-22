/**
 * Constrói o GridVM (view model do time-grid) a partir do ViewRenderContext.
 * Extraído do CalendarApp para que Week/Day/NDays compartilhem exatamente o mesmo pipeline
 * (buildDays → geometria waterfall → rótulos → linha "agora") e o mesmo componente de render.
 */
import { buildDays } from '../render/derive.js';
import { layoutDay, type GeoGrid } from '../geometry/geometry.js';
import { formatDate, formatHourLabel } from './format.js';
import type { ViewRenderContext } from './viewDef.js';
import type { GridVM, DayColumnVM, EventVM, AllDayVM, DraftVM } from './viewModel.js';
import type { EventOccurrence } from '../types/event.js';

function occurrenceKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
}

export function buildTimeGridVM(context: ViewRenderContext, viewName: string): GridVM {
  const { temporal, options, range, occurrences, constraints, renderEvent } = context;

  const days = buildDays(
    temporal,
    range.days,
    occurrences,
    constraints,
    { startHour: options.startHour, endHour: options.endHour },
    options.timeZone,
  );

  const nowZoned = temporal.Instant.fromEpochMilliseconds(context.nowMs).toZonedDateTimeISO(
    options.timeZone,
  );
  const nowDayISO = nowZoned.toPlainDate().toString();
  const nowMinuteOfDay = nowZoned.hour * 60 + nowZoned.minute;
  const gridTopMin = options.startHour * 60;
  const gridBottomMin = options.endHour * 60;

  const geometryGrid: GeoGrid = {
    startHour: options.startHour,
    endHour: options.endHour,
    pxPerMinute: options.pxPerMinute,
    minEventMinutes: options.minEventMinutes,
    gutter: 0,
  };

  const columns: DayColumnVM[] = days.map((day) => {
    const placementById = new Map(day.timed.map((placement) => [placement.id, placement]));
    const blocks = layoutDay(day.timed, geometryGrid);

    const events: EventVM[] = blocks.map((block) => {
      const placement = placementById.get(block.id)!;
      const event = placement.occurrence.event;
      const timeLabel = formatHourLabel(placement.startMin, options.locale);
      const isEditable = event.editable !== false;
      const eventVM: EventVM = {
        id: block.id,
        block,
        title: event.title,
        timeLabel,
        startMin: placement.startMin,
        endMin: placement.endMin,
        editable: isEditable,
      };
      if (event.color !== undefined) eventVM.color = event.color;
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
      const allDayVM: AllDayVM = { id: occurrenceKey(occurrence), title: event.title };
      if (event.color !== undefined) allDayVM.color = event.color;
      if (renderEvent) {
        allDayVM.content = renderEvent({ occurrence, event, timeLabel: '', isAllDay: true });
      }
      return allDayVM;
    });

    const isToday = day.dateISO === nowDayISO;
    const nowWithinGrid = nowMinuteOfDay >= gridTopMin && nowMinuteOfDay <= gridBottomMin;
    const showNowLine = isToday && nowWithinGrid;
    return {
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
  for (let minute = gridTopMin; minute <= gridBottomMin; minute += options.slotMinutes) {
    hourLabels.push({ min: minute, label: formatHourLabel(minute, options.locale) });
  }

  const gridVM: GridVM = {
    viewName,
    startHour: options.startHour,
    endHour: options.endHour,
    pxPerMinute: options.pxPerMinute,
    slotMinutes: options.slotMinutes,
    hourLabels,
    columns,
  };

  const draft = context.draft;
  if (draft) {
    const draftDayVisible = columns.some((column) => column.dateISO === draft.dateISO);
    if (draftDayVisible) {
      const draftVM: DraftVM = {
        dateISO: draft.dateISO,
        startMin: draft.startMin,
        endMin: draft.endMin,
        kind: draft.kind,
        valid: draft.valid,
      };
      gridVM.draft = draftVM;
    }
  }

  return gridVM;
}
