/** Gregorian RRULE date iterator. UTC Date is only a carrier of civil fields;
 * timezone/DST and event composition remain in recurrenceSet. No Temporal API. */
import type { RRuleModel } from '../types/recurrence.js';
import { validateRRuleModel } from './parser.js';
import { hasPossibleMonthDay } from './monthDayFilters.js';
const MILLISECONDS_PER_DAY = 86400000;
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function civilDayNumber(year: number, month: number, day: number): number {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime() / MILLISECONDS_PER_DAY;
}
function parseCivilDayNumber(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  const value = civilDayNumber(year!, month!, day!);
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
    monthDays: new Date(civilDayNumber(year, month + 1, 0) * MILLISECONDS_PER_DAY).getUTCDate(),
    yearDay: day - civilDayNumber(year, 1, 1) + 1,
    yearDays: civilDayNumber(year + 1, 1, 1) - civilDayNumber(year, 1, 1),
  };
}
export interface CivilWindow {
  start?: string;
  end?: string;
  maxPeriods?: number;
  maxEmptyPeriods?: number;
}
export function* iterateCivilDates(
  model: RRuleModel,
  startDateISO: string,
  window: CivilWindow = {},
): Generator<string> {
  validateRRuleModel(model);
  const start = parseCivilDayNumber(startDateISO),
    seriesStartFields = civilDateFields(start),
    interval = model.interval ?? 1;
  const windowStartDay = window.start ? parseCivilDayNumber(window.start) : start;
  const windowEndDay = Math.min(
    window.end ? parseCivilDayNumber(window.end) : Infinity,
    model.until ? parseCivilDayNumber(model.until.slice(0, 10)) : Infinity,
  );
  // Lazy consumers may stop after counting valid timezone-aware starts. The
  // period budget still bounds work when an unbounded consumer fails to stop.
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
  if (model.freq === 'YEARLY' && !byDay.length && !monthDays.length && !model.byYearDay?.length) {
    if (!months.length) months = [seriesStartFields.month];
    monthDays = [seriesStartFields.date];
  } else if (model.freq === 'MONTHLY' && !byDay.length && !monthDays.length)
    monthDays = [seriesStartFields.date];
  if (!hasPossibleMonthDay(months, monthDays)) return;
  const weekStart = WEEKDAY_CODES.indexOf(model.weekStart ?? 'MO');
  let periodStartDay =
    model.freq === 'YEARLY'
      ? civilDayNumber(seriesStartFields.year, 1, 1)
      : model.freq === 'MONTHLY'
        ? civilDayNumber(seriesStartFields.year, seriesStartFields.month, 1)
        : model.freq === 'WEEKLY'
          ? start - ((seriesStartFields.weekday - weekStart + 7) % 7)
          : start;
  if (model.count === undefined && windowStartDay > periodStartDay) {
    const target = civilDateFields(windowStartDay);
    if (model.freq === 'YEARLY')
      periodStartDay = civilDayNumber(
        seriesStartFields.year +
          Math.floor((target.year - seriesStartFields.year) / interval) * interval,
        1,
        1,
      );
    else if (model.freq === 'MONTHLY')
      periodStartDay = civilDayNumber(
        seriesStartFields.year,
        seriesStartFields.month +
          Math.floor(
            ((target.year - seriesStartFields.year) * 12 + target.month - seriesStartFields.month) /
              interval,
          ) *
            interval,
        1,
      );
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
  // DAILY without filters has exactly one candidate per period. Its rank is
  // arithmetic, so COUNT and exclusions remain correct without walking history.
  if (
    model.count !== undefined &&
    model.freq === 'DAILY' &&
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
      throw new RangeError('[meucalendario] orçamento de expansão RRULE excedido; reduza a janela');
    const periodFields = civilDateFields(periodStartDay);
    const end =
      model.freq === 'YEARLY'
        ? civilDayNumber(periodFields.year + 1, 1, 1)
        : model.freq === 'MONTHLY'
          ? civilDayNumber(periodFields.year, periodFields.month + 1, 1)
          : periodStartDay + (model.freq === 'WEEKLY' ? 7 : 1);
    let candidates: number[] = [];
    // Direct construction avoids scanning every day for explicit month-day rules.
    const days: number[] = [];
    if (monthDays.length && (model.freq === 'MONTHLY' || model.freq === 'YEARLY')) {
      for (const month of model.freq === 'MONTHLY'
        ? [periodFields.month]
        : months.length
          ? months
          : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        const length = civilDateFields(civilDayNumber(periodFields.year, month, 1)).monthDays;
        for (const requested of monthDays) {
          const day = requested > 0 ? requested : length + requested + 1;
          if (day >= 1 && day <= length) days.push(civilDayNumber(periodFields.year, month, day));
        }
      }
      days.sort((firstDay, secondDay) => firstDay - secondDay);
    } else for (let day = periodStartDay; day < end; day++) days.push(day);
    for (const day of new Set(days)) {
      const candidateFields = civilDateFields(day);
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
      if (day < start) continue;
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
        ? civilDayNumber(periodFields.year + interval, 1, 1)
        : model.freq === 'MONTHLY'
          ? civilDayNumber(periodFields.year, periodFields.month + interval, 1)
          : periodStartDay + interval * (model.freq === 'WEEKLY' ? 7 : 1);
  }
}
