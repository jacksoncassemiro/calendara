import { RRuleTemporal } from 'rrule-temporal';
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, RRuleModel } from '../types/index.js';
import type { ExpandWindow } from './recurrenceSet.js';

/** RRULE only: calendar exceptions and occurrence identity stay in recurrenceSet. */
export function ruleStarts(temporal: TemporalLike, event: CalendarEvent, model: RRuleModel,
  window: ExpandWindow): string[] {
  const allDay = event.time.allDay;
  const monthLengths = [31,29,31,30,31,30,31,31,30,31,30,31];
  if (model.byMonth?.length && model.byMonthDay?.length && model.byMonth.every(month =>
    model.byMonthDay!.every(day => Math.abs(day) > monthLengths[month - 1]!))) return [];
  const zone = allDay ? 'UTC' : event.time.start.timeZone ?? 'UTC';
  const start = allDay ? `${event.time.start.date}T00:00:00` : event.time.start.dateTime!;
  const plain = temporal.PlainDateTime.from(start);
  const anchor = plain.toZonedDateTime(zone);
  // Explicit DTSTART is shifted by the upstream library in gaps. Reject rather
  // than silently move the entire series to another wall-clock hour.
  if (temporal.PlainDateTime.compare(plain, anchor.toPlainDateTime()) !== 0) {
    throw new RangeError('[meucalendario] início da série contém horário local inexistente');
  }
  const input = (value: typeof anchor) => ({ timeZoneId: zone, toString: () => value.toString() });
  let until: typeof anchor | undefined;
  if (model.until) {
    if (allDay || model.until.length === 10) {
      until = temporal.PlainDate.from(model.until.slice(0,10)).toPlainDateTime('23:59:59.999999999').toZonedDateTime(zone);
    } else if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(model.until)) {
      until = temporal.Instant.from(model.until).toZonedDateTimeISO(zone);
    } else until = temporal.PlainDateTime.from(model.until).toZonedDateTime(zone);
  }
  const rule = new RRuleTemporal({
    dtstart: input(anchor), freq: model.freq, interval: model.interval, count: model.count,
    until: until ? input(until) : undefined, byDay: model.byDay?.map(entry => `${entry.ordinal ?? ''}${entry.weekday}`),
    byMonth: model.byMonth, byMonthDay: model.byMonthDay, byYearDay: model.byYearDay,
    bySetPos: model.bySetPos, wkst: model.weekStart, cache: false,
    maxIterations: 50000, maxCandidateEvaluations: 1000000,
  });
  const midnight = (date: string) => temporal.PlainDate.from(date).toPlainDateTime('00:00').toZonedDateTime(zone);
  const lower = window.start ? midnight(window.start) : anchor;
  const upper = window.end ? midnight(window.end).add({ days: 1 }).subtract({ nanoseconds: 1 }) : undefined;
  if (upper && upper.epochNanoseconds < lower.epochNanoseconds) return [];
  const values = upper ? rule.between(input(lower), input(upper), true) : rule.all();
  return values.filter(value => value.epochNanoseconds >= lower.epochNanoseconds)
    .map(value => allDay ? value.toPlainDate().toString() : value.toPlainDateTime().toString());
}
