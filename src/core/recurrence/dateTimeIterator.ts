import type { RRuleModel } from '../types/recurrence.js';
import { iterateCivilDates } from './civilIterator.js';

const DAY = 86400;
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const secondOf = (iso: string) => new Date(`${iso.slice(0, 19)}Z`).getTime() / 1000;
const isoOf = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 19);
const midnight = (date: string) => secondOf(`${date}T00:00:00`);
const atDate = ({ year, month, day }: { year: number; month: number; day: number }) => {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime() / 1000;
};

interface DateTimeInput {
  model: RRuleModel;
  start: string;
  lowerDate: string;
  upperDate?: string | undefined;
  accept: (iso: string) => boolean;
}

/** Expand local RFC date-times; invalid zoned starts are rejected before positions and COUNT.
 * @remarks Português: Expande datas e horários locais RFC; horários inválidos são rejeitados antes das posições e COUNT.
 */
export function* iterateLocalDateTimes({
  model,
  start,
  lowerDate,
  upperDate,
  accept,
}: DateTimeInput): Generator<string> {
  if (!/^\d{4}-/.test(start))
    throw new RangeError('[calendara] expansão com horário exige ano de quatro dígitos');
  const anchor = secondOf(start);
  const lower = midnight(lowerDate);
  const upper = upperDate ? midnight(upperDate) + DAY - 1 : Infinity;
  const initial = new Date(anchor * 1000);
  const interval = model.interval ?? 1;
  const intraday = ['SECONDLY', 'MINUTELY', 'HOURLY'].includes(model.freq);
  const unit =
    model.freq === 'SECONDLY'
      ? 1
      : model.freq === 'MINUTELY'
        ? 60
        : model.freq === 'HOURLY'
          ? 3600
          : model.freq === 'WEEKLY'
            ? 7 * DAY
            : DAY;
  const weekStart = WEEKDAYS.indexOf(model.weekStart ?? 'MO');
  let period =
    model.freq === 'YEARLY'
      ? atDate({ year: initial.getUTCFullYear(), month: 1, day: 1 })
      : model.freq === 'MONTHLY'
        ? atDate({ year: initial.getUTCFullYear(), month: initial.getUTCMonth() + 1, day: 1 })
        : model.freq === 'WEEKLY'
          ? midnight(start.slice(0, 10)) - ((initial.getUTCDay() - weekStart + 7) % 7) * DAY
          : Math.floor(anchor / unit) * unit;
  if (model.count === undefined && lower > period) {
    const target = new Date(lower * 1000);
    if (model.freq === 'YEARLY')
      period = atDate({
        year:
          initial.getUTCFullYear() +
          Math.floor((target.getUTCFullYear() - initial.getUTCFullYear()) / interval) * interval,
        month: 1,
        day: 1,
      });
    else if (model.freq === 'MONTHLY')
      period = atDate({
        year: initial.getUTCFullYear(),
        month:
          initial.getUTCMonth() +
          1 +
          Math.floor(
            ((target.getUTCFullYear() - initial.getUTCFullYear()) * 12 +
              target.getUTCMonth() -
              initial.getUTCMonth()) /
              interval,
          ) *
            interval,
        day: 1,
      });
    else period += Math.floor((lower - period) / (interval * unit)) * interval * unit;
  }
  const {
    count: _count,
    until: _until,
    bySetPos: _positions,
    byHour: _hours,
    byMinute: _minutes,
    bySecond: _seconds,
    ...dateModel
  } = model;
  const fraction = start.slice(19);
  let emitted = 0;
  let visited = 0;
  let cachedDay: number | undefined;
  let dayMatches = false;
  while (period <= upper) {
    if (++visited > 50000)
      throw new RangeError('[calendara] orçamento de expansão RRULE excedido; reduza a janela');
    const fields = new Date(period * 1000);
    const filteredUnit =
      intraday && model.byHour?.length && !model.byHour.includes(fields.getUTCHours())
        ? 3600
        : ['SECONDLY', 'MINUTELY'].includes(model.freq) &&
            model.byMinute?.length &&
            !model.byMinute.includes(fields.getUTCMinutes())
          ? 60
          : undefined;
    if (filteredUnit) {
      const next = (Math.floor(period / filteredUnit) + 1) * filteredUnit;
      period += Math.ceil((next - period) / (interval * unit)) * interval * unit;
      continue;
    }
    const end =
      model.freq === 'YEARLY'
        ? atDate({ year: fields.getUTCFullYear() + 1, month: 1, day: 1 })
        : model.freq === 'MONTHLY'
          ? atDate({ year: fields.getUTCFullYear(), month: fields.getUTCMonth() + 2, day: 1 })
          : period + unit;
    let dates: string[];
    if (intraday) {
      const day = Math.floor(period / DAY);
      if (day !== cachedDay) {
        cachedDay = day;
        const dateISO = isoOf(period).slice(0, 10);
        const { byYearDay, ...dailyFilters } = dateModel;
        dayMatches =
          [
            ...iterateCivilDates({
              model: { ...dailyFilters, freq: 'DAILY', interval: 1 },
              startDateISO: dateISO,
              window: { start: dateISO, end: dateISO },
            }),
          ].length > 0;
        if (dayMatches && byYearDay?.length) {
          const year = fields.getUTCFullYear();
          const yearDay = day - atDate({ year: year, month: 1, day: 1 }) / DAY + 1;
          const length =
            (atDate({ year: year + 1, month: 1, day: 1 }) -
              atDate({ year: year, month: 1, day: 1 })) /
            DAY;
          dayMatches = byYearDay.includes(yearDay) || byYearDay.includes(yearDay - length - 1);
        }
      }
      dates = dayMatches ? [isoOf(period).slice(0, 10)] : [];
    } else
      dates = [
        ...iterateCivilDates({
          model: dateModel,
          startDateISO: start.slice(0, 10),
          window: { start: isoOf(period).slice(0, 10), end: isoOf(end - 1).slice(0, 10) },
          includeBeforeStart: true,
        }),
      ];
    let candidates: number[] = [];
    let candidateVisits = 0;
    const hours =
      model.freq === 'HOURLY' || model.freq === 'MINUTELY' || model.freq === 'SECONDLY'
        ? [fields.getUTCHours()]
        : model.byHour?.length
          ? model.byHour
          : [initial.getUTCHours()];
    const minutes =
      model.freq === 'MINUTELY' || model.freq === 'SECONDLY'
        ? [fields.getUTCMinutes()]
        : model.byMinute?.length
          ? model.byMinute
          : [initial.getUTCMinutes()];
    const seconds =
      model.freq === 'SECONDLY'
        ? [fields.getUTCSeconds()]
        : model.bySecond?.length
          ? model.bySecond
          : [initial.getUTCSeconds()];
    for (const date of dates)
      for (const hour of hours)
        for (const minute of minutes)
          for (const second of seconds) {
            if (
              (model.byHour?.length && !model.byHour.includes(hour)) ||
              (model.byMinute?.length && !model.byMinute.includes(minute)) ||
              (model.bySecond?.length && !model.bySecond.includes(second))
            )
              continue;
            const value = midnight(date) + hour * 3600 + minute * 60 + second;
            if (value < period || value >= end) continue;
            if (++candidateVisits > 100000)
              throw new RangeError(
                '[calendara] período RRULE excede 100000 candidatos; reduza os filtros de horário',
              );
            if (accept(`${isoOf(value)}${fraction}`)) candidates.push(value);
          }
    candidates = [...new Set(candidates)].sort((a, b) => a - b);
    if (model.bySetPos?.length)
      candidates = [
        ...new Set(
          model.bySetPos
            .map(
              (position) => candidates[position > 0 ? position - 1 : candidates.length + position],
            )
            .filter((value): value is number => value !== undefined),
        ),
      ].sort((a, b) => a - b);
    for (const candidate of candidates) {
      if (candidate < anchor) continue;
      if (candidate > upper) return;
      emitted++;
      if (candidate >= lower) yield `${isoOf(candidate)}${fraction}`;
      if (emitted >= (model.count ?? Infinity)) return;
    }
    if (intraday && !dayMatches) {
      const nextDay = (Math.floor(period / DAY) + 1) * DAY;
      period += Math.ceil((nextDay - period) / (interval * unit)) * interval * unit;
      continue;
    }
    period =
      model.freq === 'YEARLY'
        ? atDate({ year: fields.getUTCFullYear() + interval, month: 1, day: 1 })
        : model.freq === 'MONTHLY'
          ? atDate({
              year: fields.getUTCFullYear(),
              month: fields.getUTCMonth() + 1 + interval,
              day: 1,
            })
          : period + interval * unit;
  }
}
