/**
 * Parser/serializer RRULE — string RFC 5545 ↔ RRuleModel canônico.
 * Suporta o modelo `byDay` com ordinal por entrada (2FR, 4FR, -1MO).
 */
import { WEEKDAY_CODES } from "../date/dateUtils.js";
import type {
	ByDayEntry,
	Frequency,
	RRuleModel,
	WeekdayCode,
} from "../types/index.js";

const FREQS: readonly Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const WEEKDAY_SET = new Set<string>(WEEKDAY_CODES);

function parseByDay(value: string): ByDayEntry[] {
	const out: ByDayEntry[] = [];
	for (const raw of value.split(",")) {
		const m = raw.trim().match(/^([+-]?\d+)?([A-Z]{2})$/);
		if (!m) continue;
		const code = m[2] as WeekdayCode;
		if (!WEEKDAY_SET.has(code)) continue;
		const entry: ByDayEntry = { weekday: code };
		if (m[1]) entry.ordinal = parseInt(m[1], 10);
		out.push(entry);
	}
	return out;
}

/** UNTIL do RFC pode ser 'YYYYMMDD' ou 'YYYYMMDDTHHMMSSZ'. Normaliza para ISO. */
function parseUntil(value: string): string {
	const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
	if (value.length <= 8) return date;
	const time = `${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
	return `${date}T${time}${value.endsWith("Z") ? "Z" : ""}`;
}

/**
 * Faz parse de uma string RRULE (com ou sem prefixo `RRULE:`) em RRuleModel.
 * Ignora linhas DTSTART/EXDATE/RDATE — essas vivem em `Recurrence`, não na regra.
 */
export function parseRRule(input: string): RRuleModel {
	let body = input.trim();
	// aceita bloco multi-linha; pega só a linha RRULE (ou a própria string se já for a regra)
	for (const line of body.split(/\r?\n/)) {
		const t = line.trim();
		if (/^RRULE:/i.test(t)) {
			body = t.replace(/^RRULE:/i, "");
			break;
		}
	}
	body = body.replace(/^RRULE:/i, "");

	const model: RRuleModel = { freq: "DAILY" };
	for (const part of body.split(";")) {
		const [kRaw, v] = part.split("=");
		if (!kRaw || v === undefined) continue;
		const k = kRaw.toUpperCase();
		switch (k) {
			case "FREQ": {
				const f = v.toUpperCase() as Frequency;
				if (FREQS.includes(f)) model.freq = f;
				break;
			}
			case "INTERVAL":
				model.interval = parseInt(v, 10);
				break;
			case "COUNT":
				model.count = parseInt(v, 10);
				break;
			case "UNTIL":
				model.until = parseUntil(v);
				break;
			case "BYDAY":
				model.byDay = parseByDay(v);
				break;
			case "BYMONTHDAY":
				model.byMonthDay = v.split(",").map((x) => parseInt(x, 10));
				break;
			case "BYMONTH":
				model.byMonth = v.split(",").map((x) => parseInt(x, 10));
				break;
			case "BYSETPOS":
				model.bySetPos = v.split(",").map((x) => parseInt(x, 10));
				break;
			case "WKST":
				if (WEEKDAY_SET.has(v.toUpperCase()))
					model.weekStart = v.toUpperCase() as WeekdayCode;
				break;
		}
	}
	return model;
}

function serializeByDay(entries: ByDayEntry[]): string {
	return entries
		.map((e) => `${e.ordinal !== undefined ? e.ordinal : ""}${e.weekday}`)
		.join(",");
}

function serializeUntil(iso: string): string {
	const date = iso.slice(0, 10).replace(/-/g, "");
	if (iso.length <= 10) return date;
	const time = iso.slice(11, 19).replace(/:/g, "");
	return `${date}T${time}${iso.endsWith("Z") ? "Z" : ""}`;
}

/** Serializa um RRuleModel de volta para a string RFC 5545 (sem o prefixo `RRULE:`). */
export function serializeRRule(model: RRuleModel): string {
	const parts: string[] = [`FREQ=${model.freq}`];
	if (model.interval !== undefined && model.interval !== 1)
		parts.push(`INTERVAL=${model.interval}`);
	if (model.count !== undefined) parts.push(`COUNT=${model.count}`);
	if (model.until !== undefined)
		parts.push(`UNTIL=${serializeUntil(model.until)}`);
	if (model.byMonth?.length) parts.push(`BYMONTH=${model.byMonth.join(",")}`);
	if (model.byMonthDay?.length)
		parts.push(`BYMONTHDAY=${model.byMonthDay.join(",")}`);
	if (model.byDay?.length) parts.push(`BYDAY=${serializeByDay(model.byDay)}`);
	if (model.bySetPos?.length)
		parts.push(`BYSETPOS=${model.bySetPos.join(",")}`);
	if (model.weekStart !== undefined && model.weekStart !== "MO")
		parts.push(`WKST=${model.weekStart}`);
	return parts.join(";");
}
