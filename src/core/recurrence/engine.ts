import { createDateUtils, weekdayCodeToDayOfWeek, type DateUtils } from '../date/dateUtils.js';
import type { TemporalLike } from '../date/temporal.js';
import type { ByDayEntry, RRuleModel } from '../types/index.js';
import { validateRRuleModel } from './parser.js';
import { iterateCivilDates } from './civilIterator.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Inclusive date limits and safety budgets for recurrence expansion.
 * @remarks Português: Limites inclusivos de data e limites de segurança da expansão recorrente.
 */
export interface ExpandOptions {
  /** Inclusive first date to emit.
   * @remarks Português: Primeira data inclusiva a emitir.
   */
  windowStart?: PlainDate;

  /** Inclusive last date to emit; bounds infinite rules.
   * @remarks Português: Última data inclusiva a emitir; limita regras infinitas.
   */
  windowEnd?: PlainDate;

  /** Maximum consecutive empty periods; default 2000.
   * @remarks Português: Máximo de períodos vazios consecutivos; padrão 2000.
   */
  maxEmptyPeriods?: number;

  /** Maximum visited periods; default 50000, exhaustion throws.
   * @remarks Português: Máximo de períodos visitados; padrão 50000, exceder lança erro.
   */
  maxPeriods?: number;
}

const DEFAULT_MAX_EMPTY_PERIODS = 2000;

function resolveByDay(model: RRuleModel): ByDayEntry[] {
  return model.byDay ?? [];
}

/** Named inputs for expandRule.
 * @remarks Português: Entradas nomeadas de expandRule.
 */
export interface ExpandRuleInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Validated structured recurrence filters.
   * @remarks Português: Filtros estruturados da recorrência validada.
   */
  model: RRuleModel;
  /** Original series anchor date.
   * @remarks Português: Data original da âncora da série.
   */
  dtstart: PlainDate;
  /** Excluded ISO dates; default empty.
   * @remarks Português: Datas ISO excluídas; padrão vazio.
   */
  exDates?: ReadonlySet<string> | undefined;
  /** Expansion window and safety budgets.
   * @remarks Português: Janela de expansão e limites de segurança.
   */
  options?: ExpandOptions | undefined;
}

/** Expand rule dates from DTSTART; date-only exclusions still count toward COUNT.
 * @remarks Português: Expande datas desde DTSTART; exclusões por data continuam contando para COUNT.
 */

export function* expandRule({
  temporal,
  model,
  dtstart,
  exDates = new Set(),
  options = {},
}: ExpandRuleInput): Generator<PlainDate> {
  const dates = [dtstart, options.windowStart, options.windowEnd].filter(Boolean) as PlainDate[];
  if (dates.some((date) => !/^\d{4}-/.test(date.toString()) || date.calendarId !== 'iso8601')) {
    if (model.byYearDay?.length)
      throw new RangeError('BYYEARDAY requires four-digit ISO Gregorian dates');
    yield* expandTemporalRule({
      temporal,
      model,
      dtstart,
      exDates,
      options,
    });
    return;
  }
  for (const iso of iterateCivilDates({
    model,
    startDateISO: dtstart.toString(),
    window: {
      start: options.windowStart?.toString(),
      end: options.windowEnd?.toString(),
      maxPeriods: options.maxPeriods,
      maxEmptyPeriods: options.maxEmptyPeriods,
    },
  }))
    if (!exDates.has(iso)) yield temporal.PlainDate.from(iso);
}

/** Named inputs for expandTemporalRule.
 * @remarks Português: Entradas nomeadas de expandTemporalRule.
 */
export interface ExpandTemporalRuleInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Validated structured recurrence filters.
   * @remarks Português: Filtros estruturados da recorrência validada.
   */
  model: RRuleModel;
  /** Original series anchor date.
   * @remarks Português: Data original da âncora da série.
   */
  dtstart: PlainDate;
  /** Excluded ISO dates; default empty.
   * @remarks Português: Datas ISO excluídas; padrão vazio.
   */
  exDates?: ReadonlySet<string> | undefined;
  /** Expansion window and safety budgets.
   * @remarks Português: Janela de expansão e limites de segurança.
   */
  options?: ExpandOptions | undefined;
}

/** Temporal reference iterator for exceptional calendars and differential validation.
 * @remarks Português: Iterador Temporal de referência para calendários excepcionais e validação diferencial.
 */

export function* expandTemporalRule({
  temporal,
  model,
  dtstart,
  exDates = new Set(),
  options = {},
}: ExpandTemporalRuleInput): Generator<PlainDate> {
  validateRRuleModel(model);
  const maxPeriods = options.maxPeriods ?? 50000;
  if (!Number.isSafeInteger(maxPeriods) || maxPeriods <= 0)
    throw new RangeError('[calendara] maxPeriods inválido');
  let visitedPeriods = 0;
  const dateUtils: DateUtils = createDateUtils(temporal);
  const frequency = model.freq;
  const interval = model.interval && model.interval > 0 ? model.interval : 1;
  const count = model.count ?? null;
  const until = model.until ? temporal.PlainDate.from(model.until.slice(0, 10)) : null;
  const weekStart = model.weekStart ?? 'MO';
  const maxEmptyPeriods = options.maxEmptyPeriods ?? DEFAULT_MAX_EMPTY_PERIODS;

  const byDay = resolveByDay(model);
  const hasOrdinals = byDay.some((entry) => entry.ordinal !== undefined);
  const weekdayNumbers = byDay.map((entry) => weekdayCodeToDayOfWeek(entry.weekday));
  const bySetPos = model.bySetPos ?? [];
  if (model.byMonth?.length && model.byMonthDay?.length) {
    const longestMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const possible = model.byMonth.some((month) =>
      model.byMonthDay!.some((day) => Math.abs(day) <= longestMonth[month - 1]!),
    );
    if (!possible) return;
  }

  let byMonth = model.byMonth ?? [];
  let byMonthDay = model.byMonthDay ?? [];
  let effectiveWeekdays = weekdayNumbers;

  const yearlyNeedsImplicitDate = frequency === 'YEARLY' && !byDay.length && !byMonthDay.length;
  const monthlyNeedsImplicitDay = frequency === 'MONTHLY' && !byMonthDay.length && !byDay.length;
  const weeklyNeedsImplicitWeekday = frequency === 'WEEKLY' && !byDay.length;

  if (yearlyNeedsImplicitDate) {
    byMonth = byMonth.length ? byMonth : [dtstart.month];
    byMonthDay = [dtstart.day];
  } else if (monthlyNeedsImplicitDay) {
    byMonthDay = [dtstart.day];
  } else if (weeklyNeedsImplicitWeekday) {
    effectiveWeekdays = [dtstart.dayOfWeek];
  }

  let periodStart: PlainDate;
  if (frequency === 'MONTHLY') periodStart = dtstart.with({ day: 1 });
  else if (frequency === 'YEARLY') periodStart = dtstart.with({ month: 1, day: 1 });
  else if (frequency === 'WEEKLY')
    periodStart = dateUtils.startOfWeek({ date: dtstart, weekStart });
  else periodStart = dtstart;

  const canSeekWindow =
    count === null &&
    options.windowStart !== undefined &&
    temporal.PlainDate.compare(options.windowStart, periodStart) > 0;
  if (canSeekWindow) {
    const target = options.windowStart!;
    let periodsToSkip: number;
    if (frequency === 'YEARLY')
      periodsToSkip = Math.floor((target.year - periodStart.year) / interval);
    else if (frequency === 'MONTHLY')
      periodsToSkip = Math.floor(
        ((target.year - periodStart.year) * 12 + target.month - periodStart.month) / interval,
      );
    else {
      const elapsedDays = target.since(periodStart, { largestUnit: 'days' }).days;
      periodsToSkip = Math.floor(elapsedDays / (interval * (frequency === 'WEEKLY' ? 7 : 1)));
    }
    const units = periodsToSkip * interval;
    if (frequency === 'YEARLY') periodStart = periodStart.add({ years: units });
    else if (frequency === 'MONTHLY') periodStart = periodStart.add({ months: units });
    else if (frequency === 'WEEKLY') periodStart = periodStart.add({ weeks: units });
    else periodStart = periodStart.add({ days: units });
  }

  let countedOccurrences = 0;
  let emptyPeriodStreak = 0;

  while (true) {
    const pastWindow =
      options.windowEnd !== undefined &&
      temporal.PlainDate.compare(periodStart, options.windowEnd) > 0;
    const pastRuleEnd = until !== null && temporal.PlainDate.compare(periodStart, until) > 0;
    if (pastWindow || pastRuleEnd) return;
    if (++visitedPeriods > maxPeriods)
      throw new RangeError('[calendara] orçamento de expansão RRULE excedido; reduza a janela');
    let periodEnd: PlainDate;
    let nextPeriodStart: PlainDate;
    switch (frequency) {
      case 'DAILY':
        periodEnd = periodStart.add({ days: 1 });
        nextPeriodStart = periodStart.add({ days: interval });
        break;
      case 'WEEKLY':
        periodEnd = periodStart.add({ weeks: 1 });
        nextPeriodStart = periodStart.add({ weeks: interval });
        break;
      case 'MONTHLY':
        periodEnd = periodStart.add({ months: 1 });
        nextPeriodStart = periodStart.add({ months: interval });
        break;
      case 'YEARLY':
      default:
        periodEnd = periodStart.add({ years: 1 });
        nextPeriodStart = periodStart.add({ years: interval });
        break;
    }

    let candidates: PlainDate[] = [];

    const isMonthlyOrYearly = frequency === 'MONTHLY' || frequency === 'YEARLY';
    const usesOrdinalWeekdays = isMonthlyOrYearly && hasOrdinals;

    let cursor = periodStart;
    while (temporal.PlainDate.compare(cursor, periodEnd) < 0) {
      const monthAllowed = !byMonth.length || byMonth.includes(cursor.month);
      let weekdayAllowed =
        !effectiveWeekdays.length || effectiveWeekdays.includes(cursor.dayOfWeek);
      if (usesOrdinalWeekdays) {
        weekdayAllowed = byDay.some((entry) => {
          const matchingWeekday = weekdayCodeToDayOfWeek(entry.weekday) === cursor.dayOfWeek;
          if (!matchingWeekday) return false;
          if (entry.ordinal === undefined) return true;
          const ordinalInYear = frequency === 'YEARLY' && !byMonth.length;
          const dayNumber = ordinalInYear ? cursor.dayOfYear : cursor.day;
          const periodDays = ordinalInYear ? cursor.daysInYear : cursor.daysInMonth;
          const positiveOrdinal = Math.floor((dayNumber - 1) / 7) + 1;
          const negativeOrdinal = -(Math.floor((periodDays - dayNumber) / 7) + 1);
          return entry.ordinal === positiveOrdinal || entry.ordinal === negativeOrdinal;
        });
      }
      const checksMonthDay = byMonthDay.length > 0;
      const negativeDay = cursor.day - cursor.daysInMonth - 1; // -1 denotes the last day. / PT: -1 indica o último dia.
      const monthDayAllowed =
        !checksMonthDay || byMonthDay.includes(cursor.day) || byMonthDay.includes(negativeDay);
      const matchesRule = monthAllowed && weekdayAllowed && monthDayAllowed;
      if (matchesRule) candidates.push(cursor);
      cursor = cursor.add({ days: 1 });
    }

    const seenKeys = new Set<string>();
    candidates = candidates
      .filter((candidate) => {
        const key = candidate.toString();
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((left, right) => temporal.PlainDate.compare(left, right));

    if (bySetPos.length) {
      const picked: PlainDate[] = [];
      for (const position of bySetPos) {
        const index = position > 0 ? position - 1 : candidates.length + position;
        const item = candidates[index];
        if (item) picked.push(item);
      }
      candidates = [...new Map(picked.map((date) => [date.toString(), date])).values()].sort(
        (left, right) => temporal.PlainDate.compare(left, right),
      );
    }

    const hasCandidates = candidates.length > 0;
    for (const candidate of candidates) {
      const beforeSeriesStart = temporal.PlainDate.compare(candidate, dtstart) < 0;
      if (beforeSeriesStart) continue;
      const pastUntil = until !== null && temporal.PlainDate.compare(candidate, until) > 0;
      if (pastUntil) return;
      const pastWindowEnd =
        options.windowEnd !== undefined &&
        temporal.PlainDate.compare(candidate, options.windowEnd) > 0;
      if (pastWindowEnd) return;

      countedOccurrences++;

      const isExcluded = exDates.has(candidate.toString());
      const beforeWindowStart =
        options.windowStart !== undefined &&
        temporal.PlainDate.compare(candidate, options.windowStart) < 0;
      const shouldEmit = !isExcluded && !beforeWindowStart;
      if (shouldEmit) {
        yield candidate;
      }

      const reachedCount = count !== null && countedOccurrences >= count;
      if (reachedCount) return;
    }

    periodStart = nextPeriodStart;
    if (hasCandidates) {
      emptyPeriodStreak = 0;
    } else {
      emptyPeriodStreak++;
      const exceededEmptyStreak = emptyPeriodStreak > maxEmptyPeriods;
      if (exceededEmptyStreak) return;
    }
  }
}

/** Named inputs for expandRuleAll.
 * @remarks Português: Entradas nomeadas de expandRuleAll.
 */
export interface ExpandRuleAllInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Validated structured recurrence filters.
   * @remarks Português: Filtros estruturados da recorrência validada.
   */
  model: RRuleModel;
  /** Original series anchor date.
   * @remarks Português: Data original da âncora da série.
   */
  dtstart: PlainDate;
  /** Excluded ISO dates; default empty.
   * @remarks Português: Datas ISO excluídas; padrão vazio.
   */
  exDates?: ReadonlySet<string> | undefined;
  /** Maximum collected dates; default 1000.
   * @remarks Português: Máximo de datas coletadas; padrão 1000.
   */
  maxResults?: number | undefined;
  /** Expansion window and safety budgets.
   * @remarks Português: Janela de expansão e limites de segurança.
   */
  options?: ExpandOptions | undefined;
}

/** Collect rule dates with a bounded result limit.
 * @remarks Português: Coleta datas da regra com limite de resultados.
 */

export function expandRuleAll({
  temporal,
  model,
  dtstart,
  exDates = new Set(),
  maxResults = 1000,
  options = {},
}: ExpandRuleAllInput): PlainDate[] {
  const results: PlainDate[] = [];
  for (const date of expandRule({
    temporal,
    model,
    dtstart,
    exDates,
    options,
  })) {
    results.push(date);
    if (results.length >= maxResults) break;
  }
  return results;
}
