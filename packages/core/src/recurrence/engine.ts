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

type PlainDate = InstanceType<TemporalLike["PlainDate"]>;

export interface ExpandOptions {
	/** Não emitir ocorrências antes desta data (inclusiva). */
	windowStart?: PlainDate;
	/** Parar quando a ocorrência passar desta data (inclusiva). Necessário p/ regras infinitas. */
	windowEnd?: PlainDate;
	/** Guarda anti-loop: máximo de períodos vazios consecutivos antes de abortar. */
	maxEmptyPeriods?: number;
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

	// Regras implícitas do RFC (quando nenhum BYxxx do nível é dado).
	let byMonth = model.byMonth ?? [];
	let byMonthDay = model.byMonthDay ?? [];
	let effectiveWeekdays = weekdayNumbers;

	if (
		frequency === "YEARLY" &&
		!byMonth.length &&
		!byDay.length &&
		!byMonthDay.length
	) {
		byMonth = [dtstart.month];
		byMonthDay = [dtstart.day];
	} else if (frequency === "MONTHLY" && !byMonthDay.length && !byDay.length) {
		byMonthDay = [dtstart.day];
	} else if (frequency === "WEEKLY" && !byDay.length) {
		effectiveWeekdays = [dtstart.dayOfWeek];
	}

	// Início do período.
	let periodStart: PlainDate;
	if (frequency === "MONTHLY") periodStart = dtstart.with({ day: 1 });
	else if (frequency === "YEARLY") periodStart = dtstart.with({ month: 1, day: 1 });
	else if (frequency === "WEEKLY") periodStart = dateUtils.startOfWeek(dtstart, weekStart);
	else periodStart = dtstart;

	let countedOccurrences = 0;
	let emptyPeriodStreak = 0;

	while (true) {
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

		if ((frequency === "MONTHLY" || frequency === "YEARLY") && hasOrdinals) {
			const months =
				frequency === "MONTHLY"
					? [periodStart.month]
					: Array.from({ length: 12 }, (_unused, offset) => offset + 1).filter(
							(month) => !byMonth.length || byMonth.includes(month),
						);
			for (const month of months) {
				for (const entry of byDay) {
					if (entry.ordinal === undefined) continue;
					const candidate = dateUtils.nthWeekdayInMonth(
						periodStart.year,
						month,
						weekdayCodeToDayOfWeek(entry.weekday),
						entry.ordinal,
					);
					if (candidate && temporal.PlainDate.compare(candidate, dtstart) >= 0) {
						candidates.push(candidate);
					}
				}
			}
		} else {
			let cursor = periodStart;
			while (temporal.PlainDate.compare(cursor, periodEnd) < 0) {
				if (temporal.PlainDate.compare(cursor, dtstart) >= 0) {
					let matches = true;
					if (byMonth.length && !byMonth.includes(cursor.month)) matches = false;
					if (effectiveWeekdays.length && !effectiveWeekdays.includes(cursor.dayOfWeek)) {
						matches = false;
					}
					if ((frequency === "MONTHLY" || frequency === "YEARLY") && byMonthDay.length) {
						const negativeDay = cursor.day - cursor.daysInMonth - 1; // -1 = último
						if (!byMonthDay.includes(cursor.day) && !byMonthDay.includes(negativeDay)) {
							matches = false;
						}
					}
					if (matches) candidates.push(cursor);
				}
				cursor = cursor.add({ days: 1 });
			}
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
			candidates = picked.sort((left, right) => temporal.PlainDate.compare(left, right));
		}

		let yieldedInPeriod = false;
		for (const candidate of candidates) {
			if (until && temporal.PlainDate.compare(candidate, until) > 0) return;
			if (options.windowEnd && temporal.PlainDate.compare(candidate, options.windowEnd) > 0) {
				return;
			}
			countedOccurrences++;
			if (!exDates.has(candidate.toString())) {
				if (
					!options.windowStart ||
					temporal.PlainDate.compare(candidate, options.windowStart) >= 0
				) {
					yield candidate;
					yieldedInPeriod = true;
				}
			}
			if (count !== null && countedOccurrences >= count) return;
		}

		periodStart = nextPeriodStart;
		if (yieldedInPeriod) emptyPeriodStreak = 0;
		else {
			emptyPeriodStreak++;
			if (emptyPeriodStreak > maxEmptyPeriods) return;
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
