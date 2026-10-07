/**
 * DateUtils — utilitários puros sobre Temporal.
 *
 * Design: FÁBRICA que recebe o namespace Temporal por injeção (`createDateUtils(temporal)`),
 * o que mantém tudo puro/testável e evita estado global. O core injeta o Temporal já resolvido
 * (nativo ou polyfill) após `ensureTemporal()`.
 */
import type { TemporalLike } from './temporal.js';
import type { WeekdayCode } from '../types/datetime.js';

/** Ordem RFC 5545: MO..SU == Temporal dayOfWeek 1..7. */
export const WEEKDAY_CODES: readonly WeekdayCode[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const CODE_TO_DAY_OF_WEEK: Record<WeekdayCode, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

/** Converte código de weekday (MO..SU) em dayOfWeek Temporal (1..7). */
export function weekdayCodeToDayOfWeek(code: WeekdayCode): number {
  return CODE_TO_DAY_OF_WEEK[code];
}

/** Converte dayOfWeek Temporal (1..7) em código (MO..SU). */
export function dayOfWeekToCode(dayOfWeek: number): WeekdayCode {
  const code = WEEKDAY_CODES[dayOfWeek - 1];
  if (!code) throw new RangeError(`dayOfWeek inválido: ${dayOfWeek}`);
  return code;
}

/** Converte 0=domingo..6=sábado (convenção JS/BusinessHours) em dayOfWeek Temporal (1..7). */
export function jsWeekdayToDayOfWeek(jsWeekday: number): number {
  return jsWeekday === 0 ? 7 : jsWeekday;
}

/** Converte dayOfWeek Temporal (1..7) em 0=domingo..6=sábado (convenção JS). */
export function dayOfWeekToJs(dayOfWeek: number): number {
  return dayOfWeek === 7 ? 0 : dayOfWeek;
}

export interface DateUtils {
  readonly temporal: TemporalLike;
  toPlainDate(iso: string): InstanceType<TemporalLike['PlainDate']>;
  toPlainDateTime(iso: string): InstanceType<TemporalLike['PlainDateTime']>;
  compareDate(
    first: InstanceType<TemporalLike['PlainDate']>,
    second: InstanceType<TemporalLike['PlainDate']>,
  ): number;
  isSameDay(
    first: InstanceType<TemporalLike['PlainDate']>,
    second: InstanceType<TemporalLike['PlainDate']>,
  ): boolean;
  /** Início da semana contendo `date`, respeitando `weekStart` (default MO). */
  startOfWeek(
    date: InstanceType<TemporalLike['PlainDate']>,
    weekStart?: WeekdayCode,
  ): InstanceType<TemporalLike['PlainDate']>;
  /** Lista [start, end) de PlainDate, dia a dia. */
  eachDayOfRange(
    start: InstanceType<TemporalLike['PlainDate']>,
    end: InstanceType<TemporalLike['PlainDate']>,
  ): InstanceType<TemporalLike['PlainDate']>[];
  /** N-ésimo weekday do mês (ordinal>0 do começo; ordinal<0 do fim). null se não existir. */
  nthWeekdayInMonth(
    year: number,
    month: number,
    dayOfWeek: number,
    ordinal: number,
  ): InstanceType<TemporalLike['PlainDate']> | null;
  /** Instante UTC (epoch ms) de um PlainDateTime numa timezone — para comparar em DST. */
  epochMsInZone(
    dateTime: InstanceType<TemporalLike['PlainDateTime']>,
    timeZone: string,
  ): number;
}

export function createDateUtils(temporal: TemporalLike): DateUtils {
  const toPlainDate = (iso: string) => temporal.PlainDate.from(iso.slice(0, 10));

  const toPlainDateTime = (iso: string) => temporal.PlainDateTime.from(iso);

  const compareDate = (
    first: InstanceType<TemporalLike['PlainDate']>,
    second: InstanceType<TemporalLike['PlainDate']>,
  ) => temporal.PlainDate.compare(first, second);

  const isSameDay = (
    first: InstanceType<TemporalLike['PlainDate']>,
    second: InstanceType<TemporalLike['PlainDate']>,
  ) => temporal.PlainDate.compare(first, second) === 0;

  const startOfWeek = (
    date: InstanceType<TemporalLike['PlainDate']>,
    weekStart: WeekdayCode = 'MO',
  ) => {
    const startDayOfWeek = weekdayCodeToDayOfWeek(weekStart);
    const daysToSubtract = (date.dayOfWeek - startDayOfWeek + 7) % 7;
    return date.subtract({ days: daysToSubtract });
  };

  const eachDayOfRange = (
    start: InstanceType<TemporalLike['PlainDate']>,
    end: InstanceType<TemporalLike['PlainDate']>,
  ) => {
    const days: InstanceType<TemporalLike['PlainDate']>[] = [];
    let cursor = start;
    while (temporal.PlainDate.compare(cursor, end) < 0) {
      days.push(cursor);
      cursor = cursor.add({ days: 1 });
    }
    return days;
  };

  const nthWeekdayInMonth = (
    year: number,
    month: number,
    dayOfWeek: number,
    ordinal: number,
  ) => {
    const firstOfMonth = temporal.PlainDate.from({ year, month, day: 1 });
    const daysInMonth = firstOfMonth.daysInMonth;
    const matches: InstanceType<TemporalLike['PlainDate']>[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const candidate = firstOfMonth.with({ day });
      if (candidate.dayOfWeek === dayOfWeek) matches.push(candidate);
    }
    if (ordinal > 0) return matches[ordinal - 1] ?? null;
    if (ordinal < 0) return matches[matches.length + ordinal] ?? null;
    return null;
  };

  const epochMsInZone = (
    dateTime: InstanceType<TemporalLike['PlainDateTime']>,
    timeZone: string,
  ) => {
    const zonedDateTime = dateTime.toZonedDateTime(timeZone);
    return Number(zonedDateTime.epochMilliseconds);
  };

  return {
    temporal,
    toPlainDate,
    toPlainDateTime,
    compareDate,
    isSameDay,
    startOfWeek,
    eachDayOfRange,
    nthWeekdayInMonth,
    epochMsInZone,
  };
}
