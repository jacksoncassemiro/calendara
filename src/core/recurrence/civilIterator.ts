import type { RRuleModel } from '../types/recurrence.js';
import { validateRRuleModel } from './parser.js';
import { hasPossibleMonthDay } from './monthDayFilters.js';
const MILLISECONDS_PER_DAY = 86400000;
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function civilDayNumber({
  year,
  month,
  day,
}: {
  /** Calendar year. @remarks Português: Ano do calendário. */
  year: number;
  /** Calendar month, 1..12. @remarks Português: Mês do calendário, 1..12. */
  month: number;
  /** Day of the month. @remarks Português: Dia do mês. */
  day: number;
}): number {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime() / MILLISECONDS_PER_DAY;
}
function parseCivilDayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  const value = civilDayNumber({ year: year!, month: month!, day: day! });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    new Date(value * MILLISECONDS_PER_DAY).toISOString().slice(0, 10) !== iso
  )
    throw new RangeError('Invalid civil date');
  return value;
}
function civilDateFields(day: number) {
  const value = new Date(day * MILLISECONDS_PER_DAY);
  const year = value.getUTCFullYear(),
    month = value.getUTCMonth() + 1;
  return {
    year,
    month,
    date: value.getUTCDate(),
    weekday: value.getUTCDay(),
    monthDays: new Date(
      civilDayNumber({ year, month: month + 1, day: 0 }) * MILLISECONDS_PER_DAY,
    ).getUTCDate(),
    yearDay: day - civilDayNumber({ year, month: 1, day: 1 }) + 1,
    yearDays:
      civilDayNumber({ year: year + 1, month: 1, day: 1 }) -
      civilDayNumber({ year, month: 1, day: 1 }),
  };
}
function weekYearStart(year: number, weekStart: number): number {
  const januaryFourth = civilDayNumber({ year, month: 1, day: 4 });
  const weekday = new Date(januaryFourth * MILLISECONDS_PER_DAY).getUTCDay();
  return januaryFourth - ((weekday - weekStart + 7) % 7);
}
function matchesWeekNumber({
  day,
  year,
  weekStart,
  numbers,
}: {
  day: number;
  year: number;
  weekStart: number;
  numbers: number[];
}): boolean {
  let first = weekYearStart(year, weekStart);
  let next = weekYearStart(year + 1, weekStart);
  if (day < first) {
    next = first;
    first = weekYearStart(year - 1, weekStart);
  } else if (day >= next) {
    first = next;
    next = weekYearStart(year + 2, weekStart);
  }
  const number = Math.floor((day - first) / 7) + 1;
  return numbers.includes(number) || numbers.includes(number - (next - first) / 7 - 1);
}
/** Inclusive ISO date window and recurrence expansion budgets.
 * @remarks Português: Janela inclusiva de datas ISO e limites de trabalho da expansão recorrente.
 */
export interface CivilWindow {
  /** Inclusive first ISO date; omitted uses the series anchor.
   * @remarks Português: Primeira data ISO inclusiva; ausente usa a âncora da série.
   */
  start?: string;
  /** Inclusive last ISO date; required to bound infinite rules.
   * @remarks Português: Última data ISO inclusiva; necessária para limitar regras infinitas.
   */
  end?: string;
  /** Maximum visited periods; default 50000, exhaustion throws.
   * @remarks Português: Máximo de períodos visitados; padrão 50000, exceder lança erro.
   */
  maxPeriods?: number;
  /** Maximum consecutive empty periods; default 2000.
   * @remarks Português: Máximo de períodos vazios consecutivos; padrão 2000.
   */
  maxEmptyPeriods?: number;
}
/** Named inputs for iterateCivilDates.
 * @remarks Português: Entradas nomeadas de iterateCivilDates.
 */
export interface IterateCivilDatesInput {
  /** Validated structured recurrence filters.
   * @remarks Português: Filtros estruturados da recorrência validada.
   */
  model: RRuleModel;
  /** Series anchor date in YYYY-MM-DD.
   * @remarks Português: Data âncora da série em YYYY-MM-DD.
   */
  startDateISO: string;
  /** Expansion bounds and iteration budgets; omitted uses defaults.
   * @remarks Português: Limites de expansão e iteração; ausente usa padrões.
   */
  window?: CivilWindow | undefined;
  /** Reject invalid local dates before BYSETPOS and COUNT; omitted accepts every civil date.
   * @remarks Português: Rejeita datas locais inválidas antes de BYSETPOS e COUNT; ausente aceita todas.
   */
  acceptDate?: (dateISO: string) => boolean;
  /** Include initial-period dates before DTSTART for time-level positional selection.
   * @remarks Português: Inclui datas anteriores ao início no primeiro período para seleção por horário.
   */
  includeBeforeStart?: boolean;
}

/** Iterate Gregorian RRULE dates; timezone and occurrence exceptions are applied separately.
 * @remarks Português: Itera datas gregorianas RRULE; fuso e exceções de ocorrência são aplicados separadamente.
 */

export function* iterateCivilDates({
  model,
  startDateISO,
  window = {},
  acceptDate,
  includeBeforeStart = false,
}: IterateCivilDatesInput): Generator<string> {
  validateRRuleModel(model);
  if (
    ['SECONDLY', 'MINUTELY', 'HOURLY'].includes(model.freq) ||
    model.byHour?.length ||
    model.byMinute?.length ||
    model.bySecond?.length
  )
    throw new RangeError('[calendara] regras com horário exigem expansão de evento com horário');
  const start = parseCivilDayNumber(startDateISO),
    seriesStartFields = civilDateFields(start),
    interval = model.interval ?? 1;
  const windowStartDay = window.start ? parseCivilDayNumber(window.start) : start;
  const windowEndDay = Math.min(
    window.end ? parseCivilDayNumber(window.end) : Infinity,
    model.until ? parseCivilDayNumber(model.until.slice(0, 10)) : Infinity,
  );

  const maxPeriods = window.maxPeriods ?? 50000,
    maxEmptyPeriods = window.maxEmptyPeriods ?? 2000;
  if (
    !Number.isSafeInteger(maxPeriods) ||
    maxPeriods <= 0 ||
    !Number.isSafeInteger(maxEmptyPeriods) ||
    maxEmptyPeriods <= 0
  )
    throw new RangeError('Invalid expansion budget');
  let months = model.byMonth ?? [],
    monthDays = model.byMonthDay ?? [];
  const byDay = model.byDay ?? [];
  if (
    model.freq === 'YEARLY' &&
    !byDay.length &&
    !monthDays.length &&
    !model.byYearDay?.length &&
    !model.byWeekNo?.length
  ) {
    if (!months.length) months = [seriesStartFields.month];
    monthDays = [seriesStartFields.date];
  } else if (model.freq === 'MONTHLY' && !byDay.length && !monthDays.length)
    monthDays = [seriesStartFields.date];
  if (!hasPossibleMonthDay({ months, monthDays })) return;
  const weekStart = WEEKDAY_CODES.indexOf(model.weekStart ?? 'MO');
  let periodStartDay =
    model.freq === 'YEARLY'
      ? civilDayNumber({ year: seriesStartFields.year, month: 1, day: 1 })
      : model.freq === 'MONTHLY'
        ? civilDayNumber({ year: seriesStartFields.year, month: seriesStartFields.month, day: 1 })
        : model.freq === 'WEEKLY'
          ? start - ((seriesStartFields.weekday - weekStart + 7) % 7)
          : start;
  if (model.count === undefined && windowStartDay > periodStartDay) {
    const target = civilDateFields(windowStartDay);
    if (model.freq === 'YEARLY')
      periodStartDay = civilDayNumber({
        year:
          seriesStartFields.year +
          Math.floor((target.year - seriesStartFields.year) / interval) * interval,
        month: 1,
        day: 1,
      });
    else if (model.freq === 'MONTHLY')
      periodStartDay = civilDayNumber({
        year: seriesStartFields.year,
        month:
          seriesStartFields.month +
          Math.floor(
            ((target.year - seriesStartFields.year) * 12 + target.month - seriesStartFields.month) /
              interval,
          ) *
            interval,
        day: 1,
      });
    else
      periodStartDay +=
        Math.floor(
          (windowStartDay - periodStartDay) / (interval * (model.freq === 'WEEKLY' ? 7 : 1)),
        ) *
        interval *
        (model.freq === 'WEEKLY' ? 7 : 1);
  }
  let occurrenceCount = 0,
    visitedPeriods = 0,
    consecutiveEmptyPeriods = 0;

  if (
    model.count !== undefined &&
    model.freq === 'DAILY' &&
    !acceptDate &&
    windowStartDay > periodStartDay &&
    !byDay.length &&
    !months.length &&
    !monthDays.length &&
    !model.bySetPos?.length
  ) {
    const skipped = Math.floor((windowStartDay - periodStartDay) / interval);
    if (skipped >= model.count) return;
    periodStartDay += skipped * interval;
    occurrenceCount = skipped;
  }
  while (periodStartDay <= windowEndDay) {
    if (++visitedPeriods > maxPeriods)
      throw new RangeError('[calendara] orçamento de expansão RRULE excedido; reduza a janela');
    const periodFields = civilDateFields(periodStartDay);
    const end =
      model.freq === 'YEARLY'
        ? civilDayNumber({ year: periodFields.year + 1, month: 1, day: 1 })
        : model.freq === 'MONTHLY'
          ? civilDayNumber({ year: periodFields.year, month: periodFields.month + 1, day: 1 })
          : periodStartDay + (model.freq === 'WEEKLY' ? 7 : 1);
    let candidates: number[] = [];

    const days: number[] = [];
    if (monthDays.length && (model.freq === 'MONTHLY' || model.freq === 'YEARLY')) {
      for (const month of model.freq === 'MONTHLY'
        ? [periodFields.month]
        : months.length
          ? months
          : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        const length = civilDateFields(
          civilDayNumber({ year: periodFields.year, month, day: 1 }),
        ).monthDays;
        for (const requested of monthDays) {
          const day = requested > 0 ? requested : length + requested + 1;
          if (day >= 1 && day <= length)
            days.push(civilDayNumber({ year: periodFields.year, month, day }));
        }
      }
      days.sort((firstDay, secondDay) => firstDay - secondDay);
    } else for (let day = periodStartDay; day < end; day++) days.push(day);
    for (const day of new Set(days)) {
      const candidateFields = civilDateFields(day);
      if (
        model.byWeekNo?.length &&
        !matchesWeekNumber({
          day: day,
          year: candidateFields.year,
          weekStart: weekStart,
          numbers: model.byWeekNo,
        })
      )
        continue;
      if (
        model.byYearDay?.length &&
        !model.byYearDay.includes(candidateFields.yearDay) &&
        !model.byYearDay.includes(candidateFields.yearDay - candidateFields.yearDays - 1)
      )
        continue;
      if (months.length && !months.includes(candidateFields.month)) continue;
      if (
        monthDays.length &&
        !monthDays.includes(candidateFields.date) &&
        !monthDays.includes(candidateFields.date - candidateFields.monthDays - 1)
      )
        continue;
      if (
        byDay.length &&
        !byDay.some((entry) => {
          if (WEEKDAY_CODES.indexOf(entry.weekday) !== candidateFields.weekday) return false;
          if (entry.ordinal === undefined || !['YEARLY', 'MONTHLY'].includes(model.freq))
            return true;
          const usesYearOrdinal = model.freq === 'YEARLY' && !months.length;
          const ordinalDay = usesYearOrdinal ? candidateFields.yearDay : candidateFields.date;
          const ordinalPeriodDays = usesYearOrdinal
            ? candidateFields.yearDays
            : candidateFields.monthDays;
          return (
            entry.ordinal === Math.floor((ordinalDay - 1) / 7) + 1 ||
            entry.ordinal === -(Math.floor((ordinalPeriodDays - ordinalDay) / 7) + 1)
          );
        })
      )
        continue;
      if (
        !byDay.length &&
        model.freq === 'WEEKLY' &&
        candidateFields.weekday !== seriesStartFields.weekday
      )
        continue;
      if (
        acceptDate &&
        !acceptDate(new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, 10))
      )
        continue;
      candidates.push(day);
    }
    if (model.bySetPos?.length)
      candidates = [
        ...new Set(
          model.bySetPos
            .map((pos) => candidates[pos > 0 ? pos - 1 : candidates.length + pos])
            .filter((day): day is number => day !== undefined),
        ),
      ].sort((firstDay, secondDay) => firstDay - secondDay);
    for (const day of candidates) {
      if (day < start && !includeBeforeStart) continue;
      if (day > windowEndDay) return;
      occurrenceCount++;
      if (day >= windowStartDay)
        yield new Date(day * MILLISECONDS_PER_DAY).toISOString().slice(0, 10);
      if (occurrenceCount >= (model.count ?? Infinity)) return;
    }
    consecutiveEmptyPeriods = candidates.length ? 0 : consecutiveEmptyPeriods + 1;
    if (consecutiveEmptyPeriods > maxEmptyPeriods)
      throw new RangeError('RRULE empty period budget exceeded');
    periodStartDay =
      model.freq === 'YEARLY'
        ? civilDayNumber({ year: periodFields.year + interval, month: 1, day: 1 })
        : model.freq === 'MONTHLY'
          ? civilDayNumber({
              year: periodFields.year,
              month: periodFields.month + interval,
              day: 1,
            })
          : periodStartDay + interval * (model.freq === 'WEEKLY' ? 7 : 1);
  }
}
