import type { EventOccurrence } from '../../core/index.js';
import type { ViewRenderContext } from './viewDef.js';

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
