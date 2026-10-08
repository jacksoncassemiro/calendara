import { RRuleTemporal } from 'rrule-temporal';
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, RRuleModel } from '../types/index.js';
import type { ExpandWindow } from './recurrenceSet.js';
import { hasPossibleMonthDay } from './monthDayFilters.js';
interface RuleStartsInput {
  /** Date/time implementation used for zoned expansion.
   * @remarks Português: Implementação usada para expandir no fuso da série.
   */
  temporal: TemporalLike;
  /** Series anchor and all-day or timed representation.
   * @remarks Português: Evento que define o início e o tipo de horário da série.
   */
  event: CalendarEvent;
  /** Parsed RRULE filters, excluding calendar exceptions.
   * @remarks Português: Filtros da regra interpretada, sem exceções do calendário.
   */
  model: RRuleModel;
  /** Inclusive ISO date bounds; omitted bounds use DTSTART or the rule limit.
   * @remarks Português: Datas ISO inclusivas; limites ausentes usam o início ou limite da regra.
   */
  window: ExpandWindow;
}

/** Expand RRULE starts; exceptions and occurrence identity belong to recurrenceSet.
 * @remarks Português: Expande inícios da regra na janela inclusiva; não aplica exceções.
 */
export function ruleStarts({ temporal, event, model, window }: RuleStartsInput): string[] {
  const allDay = event.time.allDay;
  if (!hasPossibleMonthDay(model.byMonth ?? [], model.byMonthDay ?? [])) return [];
  const zone = allDay ? 'UTC' : (event.time.start.timeZone ?? 'UTC');
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
      until = temporal.PlainDate.from(model.until.slice(0, 10))
        .toPlainDateTime('23:59:59.999999999')
        .toZonedDateTime(zone);
    } else if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(model.until)) {
      until = temporal.Instant.from(model.until).toZonedDateTimeISO(zone);
    } else until = temporal.PlainDateTime.from(model.until).toZonedDateTime(zone);
  }
  const rule = new RRuleTemporal({
    dtstart: input(anchor),
    freq: model.freq,
    interval: model.interval,
    count: model.count,
    until: until ? input(until) : undefined,
    byDay: model.byDay?.map((entry) => `${entry.ordinal ?? ''}${entry.weekday}`),
    byMonth: model.byMonth,
    byMonthDay: model.byMonthDay,
    byYearDay: model.byYearDay,
    bySetPos: model.bySetPos,
    wkst: model.weekStart,
    cache: false,
    maxIterations: 50000,
    maxCandidateEvaluations: 1000000,
  });
  const midnight = (date: string) =>
    temporal.PlainDate.from(date).toPlainDateTime('00:00').toZonedDateTime(zone);
  const lower = window.start ? midnight(window.start) : anchor;
  const upper = window.end
    ? midnight(window.end).add({ days: 1 }).subtract({ nanoseconds: 1 })
    : undefined;
  if (upper && upper.epochNanoseconds < lower.epochNanoseconds) return [];
  const values = upper ? rule.between(input(lower), input(upper), true) : rule.all();
  return values
    .filter((value) => value.epochNanoseconds >= lower.epochNanoseconds)
    .map((value) => (allDay ? value.toPlainDate().toString() : value.toPlainDateTime().toString()));
}
