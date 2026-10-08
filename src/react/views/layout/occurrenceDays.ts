import type { EventOccurrence } from '../../../core/index.js';
import { resolveHour } from '../../../core/render/state.js';
import type { ViewRenderContext } from '../../viewTypes.js';

/** The interaction controller resolves the complete interval, including continuation days. */
export function occurrenceEditableForDay(
  occurrence: EventOccurrence,
  dayISO: string,
  context: ViewRenderContext,
): boolean {
  return occurrence.event.editable !== false && occurrenceDays(occurrence, context).includes(dayISO);
}

/** Visible dates intersecting the half-open event interval, in the display timezone. */
export function occurrenceDays(
  occurrence: EventOccurrence,
  context: ViewRenderContext,
): string[] {
  const { temporal, options, range } = context;
  const { time } = occurrence.event;
  if (time.allDay) {
    return range.days.map((day) => day.toString()).filter((iso) =>
      iso >= time.start.date! && iso < time.end.date!);
  }
  const start = temporal.PlainDateTime.from(time.start.dateTime!)
    .toZonedDateTime(time.start.timeZone ?? options.timeZone).epochMilliseconds;
  const end = temporal.PlainDateTime.from(time.end.dateTime!)
    .toZonedDateTime(time.end.timeZone ?? options.timeZone).epochMilliseconds;
  return range.days.filter((day) => {
    const dayStart = day.toZonedDateTime(options.timeZone).epochMilliseconds;
    const dayEnd = day.add({ days: 1 }).toZonedDateTime(options.timeZone).epochMilliseconds;
    return start < dayEnd && end > dayStart;
  }).map((day) => day.toString());
}

/** Resize handles only belong to the real, visible boundaries of the interval. */
export function occurrenceEdges(
  occurrence: EventOccurrence,
  dayISO: string,
  context: ViewRenderContext,
): { start: boolean; end: boolean } {
  const { time } = occurrence.event;
  const { temporal, options } = context;
  if (time.allDay) {
    const lastOccupiedDayISO = temporal.PlainDate.from(time.end.date!).subtract({ days: 1 }).toString();
    return { start: time.start.date === dayISO, end: lastOccupiedDayISO === dayISO };
  }

  const start = temporal.PlainDateTime.from(time.start.dateTime!)
    .toZonedDateTime(time.start.timeZone ?? options.timeZone).withTimeZone(options.timeZone);
  const end = temporal.PlainDateTime.from(time.end.dateTime!)
    .toZonedDateTime(time.end.timeZone ?? options.timeZone).withTimeZone(options.timeZone);
  const visibleStartMinute = resolveHour(options.startHour) * 60;
  const visibleEndMinute = resolveHour(options.endHour) * 60;
  const startsInVisibleDay = start.toPlainDate().toString() === dayISO
    && start.hour * 60 + start.minute >= visibleStartMinute;
  const endsInVisibleDay = end.toPlainDate().toString() === dayISO
    && end.hour * 60 + end.minute <= visibleEndMinute;
  const endsAtNextMidnight = end.hour === 0 && end.minute === 0
    && end.toPlainDate().subtract({ days: 1 }).toString() === dayISO
    && visibleEndMinute === 1440;
  return { start: startsInVisibleDay, end: endsInVisibleDay || endsAtNextMidnight };
}
