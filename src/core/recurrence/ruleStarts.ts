import { iterateCivilDates } from './civilIterator.js';
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, RRuleModel } from '../types/index.js';
import type { ExpandWindow } from './recurrenceSet.js';
import { hasPossibleMonthDay } from './monthDayFilters.js';
import { iterateLocalDateTimes } from './dateTimeIterator.js';
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
  const intraday = ['SECONDLY', 'MINUTELY', 'HOURLY'].includes(model.freq);
  if (allDay && intraday)
    throw new RangeError('[calendara] frequência intradiária exige evento com horário');
  if (allDay) model = { ...model, byHour: undefined, byMinute: undefined, bySecond: undefined };
  const zone = allDay ? 'UTC' : (event.time.start.timeZone ?? 'UTC');
  const start = allDay ? `${event.time.start.date}T00:00:00` : event.time.start.dateTime!;
  const plain = temporal.PlainDateTime.from(start);
  const anchor = plain.toZonedDateTime(zone);
  if (temporal.PlainDateTime.compare(plain, anchor.toPlainDateTime()) !== 0) {
    throw new RangeError('[calendara] início da série contém horário local inexistente');
  }
  if (!hasPossibleMonthDay({ months: model.byMonth ?? [], monthDays: model.byMonthDay ?? [] }))
    return [];
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
  const midnight = (date: string) =>
    temporal.PlainDate.from(date).toPlainDateTime('00:00').toZonedDateTime(zone);
  const lower = window.start ? midnight(window.start) : anchor;
  const upper = window.end
    ? midnight(window.end).add({ days: 1 }).subtract({ nanoseconds: 1 })
    : undefined;
  if (upper && upper.epochNanoseconds < lower.epochNanoseconds) return [];
  const seriesTime = plain.toPlainTime();
  const zonedStartOnDate = (dateISO: string) =>
    temporal.PlainDate.from(dateISO).toPlainDateTime(seriesTime).toZonedDateTime(zone);
  const values: string[] = [];
  if (intraday || model.byHour?.length || model.byMinute?.length || model.bySecond?.length) {
    const lastDate = [upper?.toPlainDate().toString(), until?.toPlainDate().toString()]
      .filter((date): date is string => date !== undefined)
      .sort()[0];
    for (const iso of iterateLocalDateTimes({
      model,
      start: plain.toString(),
      lowerDate: lower.toPlainDate().toString(),
      upperDate: lastDate,
      accept: (iso) => {
        const candidate = temporal.PlainDateTime.from(iso);
        return (
          temporal.PlainDateTime.compare(
            candidate,
            candidate.toZonedDateTime(zone).toPlainDateTime(),
          ) === 0
        );
      },
    })) {
      const value = temporal.PlainDateTime.from(iso).toZonedDateTime(zone);
      if (until && value.epochNanoseconds > until.epochNanoseconds) break;
      if (upper && value.epochNanoseconds > upper.epochNanoseconds) break;
      if (value.epochNanoseconds < lower.epochNanoseconds) continue;
      values.push(value.toPlainDateTime().toString());
    }
    return values;
  }
  for (const dateISO of iterateCivilDates({
    model: { ...model, until: until?.toPlainDate().toString() },
    startDateISO: plain.toPlainDate().toString(),
    window: {
      start: lower.toPlainDate().toString(),
      end: upper?.toPlainDate().toString(),
      maxPeriods: 50000,
      maxEmptyPeriods: 2000,
    },
    acceptDate: allDay
      ? undefined
      : (dateISO) => {
          const candidate = temporal.PlainDate.from(dateISO).toPlainDateTime(seriesTime);
          return (
            temporal.PlainDateTime.compare(
              candidate,
              zonedStartOnDate(dateISO).toPlainDateTime(),
            ) === 0
          );
        },
  })) {
    const value = zonedStartOnDate(dateISO);
    if (until && value.epochNanoseconds > until.epochNanoseconds) break;
    if (upper && value.epochNanoseconds > upper.epochNanoseconds) break;
    if (value.epochNanoseconds < lower.epochNanoseconds) continue;
    values.push(allDay ? dateISO : value.toPlainDateTime().toString());
  }
  return values;
}
