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

const DEFAULT_MAX_EMPTY = 2000;

function resolveByDay(model: RRuleModel): ByDayEntry[] {
	return model.byDay ?? [];
}

/**
 * Gera as datas (PlainDate) de uma regra a partir de `dtstart`.
 * `exDates` aqui são datas ('YYYY-MM-DD') a suprimir por igualdade de dia.
 */
export function* expandRule(
	T: TemporalLike,
	model: RRuleModel,
	dtstart: PlainDate,
	exDates: ReadonlySet<string> = new Set(),
	opts: ExpandOptions = {},
): Generator<PlainDate> {
	const du: DateUtils = createDateUtils(T);
	const freq = model.freq;
	const interval = model.interval && model.interval > 0 ? model.interval : 1;
	const count = model.count ?? null;
	const until = model.until ? T.PlainDate.from(model.until.slice(0, 10)) : null;
	const weekStart = model.weekStart ?? "MO";
	const maxEmpty = opts.maxEmptyPeriods ?? DEFAULT_MAX_EMPTY;

	const byDay = resolveByDay(model);
	const hasOrdinals = byDay.some((e) => e.ordinal !== undefined);
	const weekdaySet = byDay.map((e) => weekdayCodeToDayOfWeek(e.weekday));
	const bySetPos = model.bySetPos ?? [];

	// Regras implícitas do RFC (quando nenhum BYxxx do nível é dado).
	let byMonth = model.byMonth ?? [];
	let byMonthDay = model.byMonthDay ?? [];
	let effWeekdays = weekdaySet;

	if (
		freq === "YEARLY" &&
		!byMonth.length &&
		!byDay.length &&
		!byMonthDay.length
	) {
		byMonth = [dtstart.month];
		byMonthDay = [dtstart.day];
	} else if (freq === "MONTHLY" && !byMonthDay.length && !byDay.length) {
		byMonthDay = [dtstart.day];
	} else if (freq === "WEEKLY" && !byDay.length) {
		effWeekdays = [dtstart.dayOfWeek];
	}

	// Início do período.
	let ps: PlainDate;
	if (freq === "MONTHLY") ps = dtstart.with({ day: 1 });
	else if (freq === "YEARLY") ps = dtstart.with({ month: 1, day: 1 });
	else if (freq === "WEEKLY") ps = du.startOfWeek(dtstart, weekStart);
	else ps = dtstart;

	let occ = 0;
	let empty = 0;

	while (true) {
		let pe: PlainDate;
		let nps: PlainDate;
		switch (freq) {
			case "DAILY":
				pe = ps.add({ days: 1 });
				nps = ps.add({ days: interval });
				break;
			case "WEEKLY":
				pe = ps.add({ weeks: 1 });
				nps = ps.add({ weeks: interval });
				break;
			case "MONTHLY":
				pe = ps.add({ months: 1 });
				nps = ps.add({ months: interval });
				break;
			case "YEARLY":
			default:
				pe = ps.add({ years: 1 });
				nps = ps.add({ years: interval });
				break;
		}

		let cand: PlainDate[] = [];

		if ((freq === "MONTHLY" || freq === "YEARLY") && hasOrdinals) {
			const months =
				freq === "MONTHLY"
					? [ps.month]
					: Array.from({ length: 12 }, (_, i) => i + 1).filter(
							(m) => !byMonth.length || byMonth.includes(m),
						);
			for (const m of months) {
				for (const e of byDay) {
					if (e.ordinal === undefined) continue;
					const pd = du.nthWeekdayInMonth(
						ps.year,
						m,
						weekdayCodeToDayOfWeek(e.weekday),
						e.ordinal,
					);
					if (pd && T.PlainDate.compare(pd, dtstart) >= 0) cand.push(pd);
				}
			}
		} else {
			let it = ps;
			while (T.PlainDate.compare(it, pe) < 0) {
				if (T.PlainDate.compare(it, dtstart) >= 0) {
					let ok = true;
					if (byMonth.length && !byMonth.includes(it.month)) ok = false;
					if (effWeekdays.length && !effWeekdays.includes(it.dayOfWeek))
						ok = false;
					if ((freq === "MONTHLY" || freq === "YEARLY") && byMonthDay.length) {
						const neg = it.day - it.daysInMonth - 1; // -1 = último
						if (!byMonthDay.includes(it.day) && !byMonthDay.includes(neg))
							ok = false;
					}
					if (ok) cand.push(it);
				}
				it = it.add({ days: 1 });
			}
		}

		// dedup + sort
		const seen = new Set<string>();
		cand = cand
			.filter((pd) => {
				const k = pd.toString();
				if (seen.has(k)) return false;
				seen.add(k);
				return true;
			})
			.sort((a, b) => T.PlainDate.compare(a, b));

		// BYSETPOS (lista) sobre o conjunto do período
		if (bySetPos.length) {
			const picked: PlainDate[] = [];
			for (const p of bySetPos) {
				const idx = p > 0 ? p - 1 : cand.length + p;
				const item = cand[idx];
				if (item) picked.push(item);
			}
			cand = picked.sort((a, b) => T.PlainDate.compare(a, b));
		}

		let yielded = false;
		for (const c of cand) {
			if (until && T.PlainDate.compare(c, until) > 0) return;
			if (opts.windowEnd && T.PlainDate.compare(c, opts.windowEnd) > 0) return;
			occ++;
			if (!exDates.has(c.toString())) {
				if (
					!opts.windowStart ||
					T.PlainDate.compare(c, opts.windowStart) >= 0
				) {
					yield c;
					yielded = true;
				}
			}
			if (count !== null && occ >= count) return;
		}

		ps = nps;
		if (yielded) empty = 0;
		else {
			empty++;
			if (empty > maxEmpty) return;
		}
	}
}

/** Coleta helper com teto de segurança. */
export function expandRuleAll(
	T: TemporalLike,
	model: RRuleModel,
	dtstart: PlainDate,
	exDates: ReadonlySet<string> = new Set(),
	max = 1000,
	opts: ExpandOptions = {},
): PlainDate[] {
	const out: PlainDate[] = [];
	for (const d of expandRule(T, model, dtstart, exDates, opts)) {
		out.push(d);
		if (out.length >= max) break;
	}
	return out;
}
