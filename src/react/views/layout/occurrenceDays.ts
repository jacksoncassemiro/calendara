/** Visible occurrence dates and real resize boundaries. @remarks Português: Datas visíveis e limites reais para redimensionar. */
import type { EventOccurrence } from '../../../core/index.js';
import { resolveHour } from '../../../core/render/state.js';
import type { ViewRenderContext } from '../../viewTypes.js';

export interface OccurrenceDayInput {
  /** Expanded occurrence. @remarks Português: Ocorrência expandida. */
  occurrence: EventOccurrence;
  /** Target date, YYYY-MM-DD. @remarks Português: Data alvo, YYYY-MM-DD. */
  dayISO: string;
  /** Visible range and display time zone. @remarks Português: Período visível e fuso de exibição. */
  context: ViewRenderContext;
}

export function occurrenceEditableForDay({
  occurrence,
  dayISO,
  context,
}: OccurrenceDayInput): boolean {
  return (
    occurrence.event.editable !== false && occurrenceDays({ occurrence, context }).includes(dayISO)
  );
}

/** Visible dates intersecting the exclusive-end occurrence. @remarks Português: Datas visíveis que intersectam a ocorrência de fim exclusivo. */
export function occurrenceDays({
  occurrence,
  context,
}: {
  /** Occurrence with original event identity. @remarks Português: Ocorrência com identidade original do evento. */
  occurrence: EventOccurrence;
  /** Display zone and visible range. @remarks Português: Fuso de exibição e período visível. */
  context: ViewRenderContext;
}): string[] {
  const { temporal, options, range } = context;
  const { time } = occurrence.event;
  if (time.allDay) {
    return range.days
      .map((day) => day.toString())
      .filter((iso) => iso >= time.start.date! && iso < time.end.date!);
  }
  const start = temporal.PlainDateTime.from(time.start.dateTime!).toZonedDateTime(
    time.start.timeZone ?? options.timeZone,
  ).epochMilliseconds;
  const end = temporal.PlainDateTime.from(time.end.dateTime!).toZonedDateTime(
    time.end.timeZone ?? options.timeZone,
  ).epochMilliseconds;
  return range.days
    .filter((day) => {
      const dayStart = day.toZonedDateTime(options.timeZone).epochMilliseconds;
      const dayEnd = day.add({ days: 1 }).toZonedDateTime(options.timeZone).epochMilliseconds;
      return start < dayEnd && end > dayStart;
    })
    .map((day) => day.toString());
}

export function occurrenceEdges({ occurrence, dayISO, context }: OccurrenceDayInput): {
  start: boolean;
  end: boolean;
} {
  const { time } = occurrence.event;
  const { temporal, options } = context;
  if (time.allDay) {
    const lastOccupiedDayISO = temporal.PlainDate.from(time.end.date!)
      .subtract({ days: 1 })
      .toString();
    return { start: time.start.date === dayISO, end: lastOccupiedDayISO === dayISO };
  }

  const start = temporal.PlainDateTime.from(time.start.dateTime!)
    .toZonedDateTime(time.start.timeZone ?? options.timeZone)
    .withTimeZone(options.timeZone);
  const end = temporal.PlainDateTime.from(time.end.dateTime!)
    .toZonedDateTime(time.end.timeZone ?? options.timeZone)
    .withTimeZone(options.timeZone);
  const visibleStartMinute = resolveHour(options.startHour) * 60;
  const visibleEndMinute = resolveHour(options.endHour) * 60;
  const startsInVisibleDay =
    start.toPlainDate().toString() === dayISO &&
    start.hour * 60 + start.minute >= visibleStartMinute;
  const endsInVisibleDay =
    end.toPlainDate().toString() === dayISO && end.hour * 60 + end.minute <= visibleEndMinute;
  const endsAtNextMidnight =
    end.hour === 0 &&
    end.minute === 0 &&
    end.toPlainDate().subtract({ days: 1 }).toString() === dayISO &&
    visibleEndMinute === 1440;
  return { start: startsInVisibleDay, end: endsInVisibleDay || endsAtNextMidnight };
}
