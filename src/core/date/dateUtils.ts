import type { TemporalLike } from './temporal.js';
import type { WeekdayCode } from '../types/datetime.js';

/** RFC weekdays ordered Monday through Sunday.
 * @remarks Português: Dias RFC ordenados de segunda-feira a domingo.
 */
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

/** Convert an RFC weekday to Temporal numbering, 1..7.
 * @remarks Português: Converte dia RFC para a numeração Temporal, 1..7.
 */
export function weekdayCodeToDayOfWeek(code: WeekdayCode): number {
  return CODE_TO_DAY_OF_WEEK[code];
}

/** Convert Temporal weekday numbering, 1..7, to an RFC code.
 * @remarks Português: Converte dia Temporal, 1..7, para código RFC.
 */
export function dayOfWeekToCode(dayOfWeek: number): WeekdayCode {
  const code = WEEKDAY_CODES[dayOfWeek - 1];
  if (!code) throw new RangeError(`dayOfWeek inválido: ${dayOfWeek}`);
  return code;
}

/** Convert JS weekdays, 0..6, to Temporal weekdays, 1..7.
 * @remarks Português: Converte dias JS, 0..6, para dias Temporal, 1..7.
 */
export function jsWeekdayToDayOfWeek(jsWeekday: number): number {
  return jsWeekday === 0 ? 7 : jsWeekday;
}

/** Convert Temporal weekdays, 1..7, to JS weekdays, 0..6.
 * @remarks Português: Converte dias Temporal, 1..7, para dias JS, 0..6.
 */
export function dayOfWeekToJs(dayOfWeek: number): number {
  return dayOfWeek === 7 ? 0 : dayOfWeek;
}

type PlainDate = InstanceType<TemporalLike['PlainDate']>;
type PlainDateTime = InstanceType<TemporalLike['PlainDateTime']>;

/** Week boundary inputs.
 * @remarks Português: Entradas para o início da semana.
 */
export interface StartOfWeekInput {
  /** Date whose containing week is requested.
   * @remarks Português: Data cuja semana será consultada.
   */
  date: PlainDate;
  /** First weekday; default MO.
   * @remarks Português: Primeiro dia da semana; padrão MO.
   */
  weekStart?: WeekdayCode;
}

/** Half-open calendar date interval.
 * @remarks Português: Intervalo de datas com fim exclusivo.
 */
export interface DateRangeInput {
  /** Inclusive first date.
   * @remarks Português: Primeira data inclusiva.
   */
  start: PlainDate;
  /** Exclusive last date.
   * @remarks Português: Última data exclusiva.
   */
  end: PlainDate;
}

/** Signed weekday position within a month.
 * @remarks Português: Posição de dia da semana dentro do mês.
 */
export interface NthWeekdayInMonthInput {
  /** Calendar year.
   * @remarks Português: Ano do calendário.
   */
  year: number;
  /** Calendar month, 1..12.
   * @remarks Português: Mês do calendário, 1..12.
   */
  month: number;
  /** Temporal weekday, 1 is Monday and 7 is Sunday.
   * @remarks Português: Dia Temporal, 1 é segunda e 7 é domingo.
   */
  dayOfWeek: number;
  /** Positive from the beginning, negative from the end; zero matches nothing.
   * @remarks Português: Positivo desde o início, negativo desde o fim; zero não seleciona.
   */
  ordinal: number;
}

/** Local date/time and its interpretation zone.
 * @remarks Português: Data e horário locais e seu fuso de interpretação.
 */
export interface ZonedDateTimeInput {
  /** Local date/time without an offset.
   * @remarks Português: Data e horário locais sem offset.
   */
  dateTime: PlainDateTime;
  /** IANA timezone interpreting the local value.
   * @remarks Português: Fuso IANA que interpreta o valor local.
   */
  timeZone: string;
}

/** Date operations using an injected Temporal implementation.
 * @remarks Português: Operações de data com implementação Temporal injetada.
 */
export interface DateUtils {
  /** Injected native or polyfilled Temporal namespace.
   * @remarks Português: Namespace Temporal nativo ou polyfill injetado.
   */
  readonly temporal: TemporalLike;
  /** Parse an ISO date, ignoring a supplied time suffix.
   * @remarks Português: Lê uma data ISO, ignorando sufixo de horário fornecido.
   */
  toPlainDate(iso: string): InstanceType<TemporalLike['PlainDate']>;
  /** Parse a local ISO date and time without timezone conversion.
   * @remarks Português: Lê data e horário ISO locais, sem conversão de fuso.
   */
  toPlainDateTime(iso: string): InstanceType<TemporalLike['PlainDateTime']>;
  /** Compare calendar dates, returning their chronological order.
   * @remarks Português: Compara datas do calendário e retorna sua ordem cronológica.
   */
  compareDate(
    first: InstanceType<TemporalLike['PlainDate']>,
    second: InstanceType<TemporalLike['PlainDate']>,
  ): number;
  /** Whether both values represent the same calendar date.
   * @remarks Português: Indica se ambos os valores representam a mesma data.
   */
  isSameDay(
    first: InstanceType<TemporalLike['PlainDate']>,
    second: InstanceType<TemporalLike['PlainDate']>,
  ): boolean;

  /** First day of the containing week; weekStart defaults to MO.
   * @remarks Português: Primeiro dia da semana correspondente; weekStart usa MO por padrão.
   */
  startOfWeek(input: StartOfWeekInput): InstanceType<TemporalLike['PlainDate']>;

  /** List dates in the half-open range [start, end).
   * @remarks Português: Lista datas no intervalo de fim exclusivo [start, end).
   */
  eachDayOfRange(input: DateRangeInput): InstanceType<TemporalLike['PlainDate']>[];

  /** Find a signed weekday ordinal; null when it does not exist.
   * @remarks Português: Busca posição de dia da semana, positiva ou negativa; null quando inexistente.
   */
  nthWeekdayInMonth(input: NthWeekdayInMonthInput): InstanceType<TemporalLike['PlainDate']> | null;

  /** Convert local time to epoch milliseconds in the supplied IANA zone.
   * @remarks Português: Converte horário local para milissegundos desde epoch no fuso IANA fornecido.
   */
  epochMsInZone(input: ZonedDateTimeInput): number;
}

/** Create date utilities using the supplied Temporal implementation.
 * @remarks Português: Cria utilitários de data com a implementação Temporal fornecida.
 */
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

  function startOfWeek({ date, weekStart = 'MO' }: StartOfWeekInput): PlainDate {
    const startDayOfWeek = weekdayCodeToDayOfWeek(weekStart);
    const daysToSubtract = (date.dayOfWeek - startDayOfWeek + 7) % 7;
    return date.subtract({ days: daysToSubtract });
  }

  function eachDayOfRange({ start, end }: DateRangeInput): PlainDate[] {
    const days: InstanceType<TemporalLike['PlainDate']>[] = [];
    let cursor = start;
    while (temporal.PlainDate.compare(cursor, end) < 0) {
      days.push(cursor);
      cursor = cursor.add({ days: 1 });
    }
    return days;
  }

  function nthWeekdayInMonth({
    year,
    month,
    dayOfWeek,
    ordinal,
  }: NthWeekdayInMonthInput): PlainDate | null {
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
  }

  function epochMsInZone({ dateTime, timeZone }: ZonedDateTimeInput): number {
    const zonedDateTime = dateTime.toZonedDateTime(timeZone);
    return Number(zonedDateTime.epochMilliseconds);
  }

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
