/**
 * DateUtils — utilitários puros sobre Temporal.
 *
 * Design: FÁBRICA que recebe o namespace Temporal por injeção (`createDateUtils(Temporal)`),
 * o que mantém tudo puro/testável e evita estado global. O core injeta o Temporal já resolvido
 * (nativo ou polyfill) após `ensureTemporal()`.
 */
import type { TemporalLike } from './temporal.js';
import type { WeekdayCode } from '../types/datetime.js';

/** Ordem RFC 5545: MO..SU == Temporal dayOfWeek 1..7. */
export const WEEKDAY_CODES: readonly WeekdayCode[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const CODE_TO_DOW: Record<WeekdayCode, number> = {
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
  return CODE_TO_DOW[code];
}

/** Converte dayOfWeek Temporal (1..7) em código (MO..SU). */
export function dayOfWeekToCode(dow: number): WeekdayCode {
  const code = WEEKDAY_CODES[dow - 1];
  if (!code) throw new RangeError(`dayOfWeek inválido: ${dow}`);
  return code;
}

/** Converte 0=domingo..6=sábado (convenção JS/BusinessHours) em dayOfWeek Temporal (1..7). */
export function jsWeekdayToDayOfWeek(js: number): number {
  return js === 0 ? 7 : js;
}

/** Converte dayOfWeek Temporal (1..7) em 0=domingo..6=sábado (convenção JS). */
export function dayOfWeekToJs(dow: number): number {
  return dow === 7 ? 0 : dow;
}

export interface DateUtils {
  readonly T: TemporalLike;
  toPlainDate(iso: string): InstanceType<TemporalLike['PlainDate']>;
  toPlainDateTime(iso: string): InstanceType<TemporalLike['PlainDateTime']>;
  compareDate(
    a: InstanceType<TemporalLike['PlainDate']>,
    b: InstanceType<TemporalLike['PlainDate']>,
  ): number;
  isSameDay(
    a: InstanceType<TemporalLike['PlainDate']>,
    b: InstanceType<TemporalLike['PlainDate']>,
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
    dt: InstanceType<TemporalLike['PlainDateTime']>,
    timeZone: string,
  ): number;
}

export function createDateUtils(T: TemporalLike): DateUtils {
  const toPlainDate = (iso: string) => T.PlainDate.from(iso.slice(0, 10));

  const toPlainDateTime = (iso: string) => T.PlainDateTime.from(iso);

  const compareDate = (
    a: InstanceType<TemporalLike['PlainDate']>,
    b: InstanceType<TemporalLike['PlainDate']>,
  ) => T.PlainDate.compare(a, b);

  const isSameDay = (
    a: InstanceType<TemporalLike['PlainDate']>,
    b: InstanceType<TemporalLike['PlainDate']>,
  ) => T.PlainDate.compare(a, b) === 0;

  const startOfWeek = (
    date: InstanceType<TemporalLike['PlainDate']>,
    weekStart: WeekdayCode = 'MO',
  ) => {
    const startDow = weekdayCodeToDayOfWeek(weekStart);
    const diff = (date.dayOfWeek - startDow + 7) % 7;
    return date.subtract({ days: diff });
  };

  const eachDayOfRange = (
    start: InstanceType<TemporalLike['PlainDate']>,
    end: InstanceType<TemporalLike['PlainDate']>,
  ) => {
    const out: InstanceType<TemporalLike['PlainDate']>[] = [];
    let it = start;
    while (T.PlainDate.compare(it, end) < 0) {
      out.push(it);
      it = it.add({ days: 1 });
    }
    return out;
  };

  const nthWeekdayInMonth = (
    year: number,
    month: number,
    dayOfWeek: number,
    ordinal: number,
  ) => {
    const first = T.PlainDate.from({ year, month, day: 1 });
    const dim = first.daysInMonth;
    const matches: InstanceType<TemporalLike['PlainDate']>[] = [];
    for (let d = 1; d <= dim; d++) {
      const pd = first.with({ day: d });
      if (pd.dayOfWeek === dayOfWeek) matches.push(pd);
    }
    if (ordinal > 0) return matches[ordinal - 1] ?? null;
    if (ordinal < 0) return matches[matches.length + ordinal] ?? null;
    return null;
  };

  const epochMsInZone = (
    dt: InstanceType<TemporalLike['PlainDateTime']>,
    timeZone: string,
  ) => {
    const zdt = dt.toZonedDateTime(timeZone);
    return Number(zdt.epochMilliseconds);
  };

  return {
    T,
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
