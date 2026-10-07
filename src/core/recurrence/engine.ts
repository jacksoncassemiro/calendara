/**
 * Motor de recorrência RFC 5545 sobre Temporal — iterador por FREQ.
 * Porta e tipa `experiments/recurrence-validation/temporal-rrule-v2.mjs` (provado 23/23, incl. multi-ordinal),
 * generalizando BYSETPOS para lista e adicionando WKST explícito e janela (lazy).
 *
 * Opera em datas (PlainDate). A hora-do-dia e a timezone são compostas depois, no recurrence-set,
 * a partir do DTSTART do evento — isso mantém o iterador puro e simples, e o caminho timed/DST
 * é resolvido convertendo (data + hora + tz) → instante UTC na composição.
 */
import {
	createDateUtils,
	weekdayCodeToDayOfWeek,
	type DateUtils,
} from "../date/dateUtils.js";
import type { TemporalLike } from "../date/temporal.js";
import type { ByDayEntry, RRuleModel } from "../types/index.js";
import { validateRRuleModel } from './parser.js';
import { iterateCivilDates } from './civilIterator.js';

type PlainDate = InstanceType<TemporalLike["PlainDate"]>;

export interface ExpandOptions {
	/** Não emitir ocorrências antes desta data (inclusiva). */
	windowStart?: PlainDate;
	/** Parar quando a ocorrência passar desta data (inclusiva). Necessário p/ regras infinitas. */
	windowEnd?: PlainDate;
	/** Guarda anti-loop: máximo de períodos vazios consecutivos antes de abortar. */
	maxEmptyPeriods?: number;
	/** Work budget; exhaustion throws instead of silently returning an incomplete series. */
	maxPeriods?: number;
}

const DEFAULT_MAX_EMPTY_PERIODS = 2000;

function resolveByDay(model: RRuleModel): ByDayEntry[] {
	return model.byDay ?? [];
}

/**
 * Gera as datas (PlainDate) de uma regra a partir de `dtstart`.
 * `exDates` aqui são datas ('YYYY-MM-DD') a suprimir por igualdade de dia.
 */
export function* expandRule(
	temporal: TemporalLike,
	model: RRuleModel,
	dtstart: PlainDate,
	exDates: ReadonlySet<string> = new Set(),
	options: ExpandOptions = {},
): Generator<PlainDate> {
	// Expanded years/non-Gregorian inputs retain the established Temporal path.
	const dates = [dtstart, options.windowStart, options.windowEnd].filter(Boolean) as PlainDate[];
	if (dates.some(date => !/^\d{4}-/.test(date.toString()) || date.calendarId !== 'iso8601')) {
		if (model.byYearDay?.length) throw new RangeError('BYYEARDAY requires four-digit ISO Gregorian dates');
		yield* expandTemporalRule(temporal, model, dtstart, exDates, options);
		return;
	}
	for (const iso of iterateCivilDates(model, dtstart.toString(), {
		start: options.windowStart?.toString(), end: options.windowEnd?.toString(),
		maxPeriods: options.maxPeriods, maxEmptyPeriods: options.maxEmptyPeriods,
	})) if (!exDates.has(iso)) yield temporal.PlainDate.from(iso);
}

/** Reference backend retained for differential verification and exceptional date ranges. */
export function* expandTemporalRule(
	temporal: TemporalLike,
	model: RRuleModel,
	dtstart: PlainDate,
	exDates: ReadonlySet<string> = new Set(),
	options: ExpandOptions = {},
): Generator<PlainDate> {
	validateRRuleModel(model);
	const maxPeriods = options.maxPeriods ?? 50000;
	if (!Number.isSafeInteger(maxPeriods) || maxPeriods <= 0) throw new RangeError('[meucalendario] maxPeriods inválido');
	let visitedPeriods = 0;
	const dateUtils: DateUtils = createDateUtils(temporal);
	const frequency = model.freq;
	const interval = model.interval && model.interval > 0 ? model.interval : 1;
	const count = model.count ?? null;
	const until = model.until ? temporal.PlainDate.from(model.until.slice(0, 10)) : null;
	const weekStart = model.weekStart ?? "MO";
	const maxEmptyPeriods = options.maxEmptyPeriods ?? DEFAULT_MAX_EMPTY_PERIODS;

	const byDay = resolveByDay(model);
	const hasOrdinals = byDay.some((entry) => entry.ordinal !== undefined);
	const weekdayNumbers = byDay.map((entry) => weekdayCodeToDayOfWeek(entry.weekday));
	const bySetPos = model.bySetPos ?? [];
	// Even leap February cannot contain day 30. Prove these empty intersections
	// before scanning thousands of years of periods on the UI thread.
	if (model.byMonth?.length && model.byMonthDay?.length) {
		const longestMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
		const possible = model.byMonth.some(month => model.byMonthDay!.some(day => Math.abs(day) <= longestMonth[month - 1]!));
		if (!possible) return;
	}

	// Regras implícitas do RFC (quando nenhum BYxxx do nível é dado).
	let byMonth = model.byMonth ?? [];
	let byMonthDay = model.byMonthDay ?? [];
	let effectiveWeekdays = weekdayNumbers;

	const yearlyNeedsImplicitDate =
		frequency === "YEARLY" && !byDay.length && !byMonthDay.length;
	const monthlyNeedsImplicitDay =
		frequency === "MONTHLY" && !byMonthDay.length && !byDay.length;
	const weeklyNeedsImplicitWeekday = frequency === "WEEKLY" && !byDay.length;

	if (yearlyNeedsImplicitDate) {
		byMonth = byMonth.length ? byMonth : [dtstart.month];
		byMonthDay = [dtstart.day];
	} else if (monthlyNeedsImplicitDay) {
		byMonthDay = [dtstart.day];
	} else if (weeklyNeedsImplicitWeekday) {
		effectiveWeekdays = [dtstart.dayOfWeek];
	}

	// Início do período.
	let periodStart: PlainDate;
	if (frequency === "MONTHLY") periodStart = dtstart.with({ day: 1 });
	else if (frequency === "YEARLY") periodStart = dtstart.with({ month: 1, day: 1 });
	else if (frequency === "WEEKLY") periodStart = dateUtils.startOfWeek(dtstart, weekStart);
	else periodStart = dtstart;

	// Without COUNT, earlier periods cannot affect membership or BYSETPOS in the
	// current period. Jump whole frequency periods, preserving the DTSTART phase.
	const canSeekWindow = count === null && options.windowStart !== undefined &&
		temporal.PlainDate.compare(options.windowStart, periodStart) > 0;
	if (canSeekWindow) {
		const target = options.windowStart!;
		let periodsToSkip: number;
		if (frequency === 'YEARLY') periodsToSkip = Math.floor((target.year - periodStart.year) / interval);
		else if (frequency === 'MONTHLY') periodsToSkip = Math.floor(((target.year - periodStart.year) * 12 + target.month - periodStart.month) / interval);
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
		const pastWindow = options.windowEnd !== undefined && temporal.PlainDate.compare(periodStart, options.windowEnd) > 0;
		const pastRuleEnd = until !== null && temporal.PlainDate.compare(periodStart, until) > 0;
		if (pastWindow || pastRuleEnd) return;
		if (++visitedPeriods > maxPeriods) throw new RangeError('[meucalendario] orçamento de expansão RRULE excedido; reduza a janela');
		let periodEnd: PlainDate;
		let nextPeriodStart: PlainDate;
		switch (frequency) {
			case "DAILY":
				periodEnd = periodStart.add({ days: 1 });
				nextPeriodStart = periodStart.add({ days: interval });
				break;
			case "WEEKLY":
				periodEnd = periodStart.add({ weeks: 1 });
				nextPeriodStart = periodStart.add({ weeks: interval });
				break;
			case "MONTHLY":
				periodEnd = periodStart.add({ months: 1 });
				nextPeriodStart = periodStart.add({ months: interval });
				break;
			case "YEARLY":
			default:
				periodEnd = periodStart.add({ years: 1 });
				nextPeriodStart = periodStart.add({ years: interval });
				break;
		}

		let candidates: PlainDate[] = [];

		const isMonthlyOrYearly = frequency === "MONTHLY" || frequency === "YEARLY";
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
							const ordinalInYear = frequency === "YEARLY" && !byMonth.length;
							const dayNumber = ordinalInYear ? cursor.dayOfYear : cursor.day;
							const periodDays = ordinalInYear ? cursor.daysInYear : cursor.daysInMonth;
							const positiveOrdinal = Math.floor((dayNumber - 1) / 7) + 1;
							const negativeOrdinal = -(Math.floor((periodDays - dayNumber) / 7) + 1);
							return entry.ordinal === positiveOrdinal || entry.ordinal === negativeOrdinal;
						});
					}
					const checksMonthDay = byMonthDay.length > 0;
					const negativeDay = cursor.day - cursor.daysInMonth - 1; // -1 = último dia do mês
					const monthDayAllowed =
						!checksMonthDay ||
						byMonthDay.includes(cursor.day) ||
						byMonthDay.includes(negativeDay);
					const matchesRule = monthAllowed && weekdayAllowed && monthDayAllowed;
					if (matchesRule) candidates.push(cursor);
				cursor = cursor.add({ days: 1 });
			}

		// dedup + sort
		const seenKeys = new Set<string>();
		candidates = candidates
			.filter((candidate) => {
				const key = candidate.toString();
				if (seenKeys.has(key)) return false;
				seenKeys.add(key);
				return true;
			})
			.sort((left, right) => temporal.PlainDate.compare(left, right));

		// BYSETPOS (lista) sobre o conjunto do período
		if (bySetPos.length) {
			const picked: PlainDate[] = [];
			for (const position of bySetPos) {
				const index = position > 0 ? position - 1 : candidates.length + position;
				const item = candidates[index];
				if (item) picked.push(item);
			}
			candidates = [...new Map(picked.map((date) => [date.toString(), date])).values()]
				.sort((left, right) => temporal.PlainDate.compare(left, right));
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

/** Coleta helper com teto de segurança. */
export function expandRuleAll(
	temporal: TemporalLike,
	model: RRuleModel,
	dtstart: PlainDate,
	exDates: ReadonlySet<string> = new Set(),
	maxResults = 1000,
	options: ExpandOptions = {},
): PlainDate[] {
	const results: PlainDate[] = [];
	for (const date of expandRule(temporal, model, dtstart, exDates, options)) {
		results.push(date);
		if (results.length >= maxResults) break;
	}
	return results;
}
