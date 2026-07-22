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

const FREQUENCIES: readonly Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];
const WEEKDAY_CODE_SET = new Set<string>(WEEKDAY_CODES);
/** Defaults do RFC 5545 — omitidos na serialização quando o valor é o padrão. */
const DEFAULT_INTERVAL = 1;
const DEFAULT_WEEK_START = "MO";

function parseByDay(value: string): ByDayEntry[] {
	const entries: ByDayEntry[] = [];
	for (const rawToken of value.split(",")) {
		const match = rawToken.trim().match(/^([+-]?\d+)?([A-Z]{2})$/);
		if (!match) continue;
		const code = match[2] as WeekdayCode;
		if (!WEEKDAY_CODE_SET.has(code)) continue;
		const entry: ByDayEntry = { weekday: code };
		if (match[1]) entry.ordinal = parseInt(match[1], 10);
		entries.push(entry);
	}
	return entries;
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
		const trimmedLine = line.trim();
		if (/^RRULE:/i.test(trimmedLine)) {
			body = trimmedLine.replace(/^RRULE:/i, "");
			break;
		}
	}
	body = body.replace(/^RRULE:/i, "");

	const model: RRuleModel = { freq: "DAILY" };
	for (const part of body.split(";")) {
		const [rawKey, value] = part.split("=");
		if (!rawKey || value === undefined) continue;
		const key = rawKey.toUpperCase();
		switch (key) {
			case "FREQ": {
				const frequency = value.toUpperCase() as Frequency;
				if (FREQUENCIES.includes(frequency)) model.freq = frequency;
				break;
			}
			case "INTERVAL":
				model.interval = parseInt(value, 10);
				break;
			case "COUNT":
				model.count = parseInt(value, 10);
				break;
			case "UNTIL":
				model.until = parseUntil(value);
				break;
			case "BYDAY":
				model.byDay = parseByDay(value);
				break;
			case "BYMONTHDAY":
				model.byMonthDay = value.split(",").map((token) => parseInt(token, 10));
				break;
			case "BYMONTH":
				model.byMonth = value.split(",").map((token) => parseInt(token, 10));
				break;
			case "BYSETPOS":
				model.bySetPos = value.split(",").map((token) => parseInt(token, 10));
				break;
			case "WKST":
				if (WEEKDAY_CODE_SET.has(value.toUpperCase())) {
					model.weekStart = value.toUpperCase() as WeekdayCode;
				}
				break;
		}
	}
	return model;
}

function serializeByDay(entries: ByDayEntry[]): string {
	return entries
		.map((entry) => `${entry.ordinal !== undefined ? entry.ordinal : ""}${entry.weekday}`)
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
	const hasCustomInterval = model.interval !== undefined && model.interval !== DEFAULT_INTERVAL;
	if (hasCustomInterval) parts.push(`INTERVAL=${model.interval}`);
	if (model.count !== undefined) parts.push(`COUNT=${model.count}`);
	if (model.until !== undefined) parts.push(`UNTIL=${serializeUntil(model.until)}`);
	if (model.byMonth?.length) parts.push(`BYMONTH=${model.byMonth.join(",")}`);
	if (model.byMonthDay?.length) parts.push(`BYMONTHDAY=${model.byMonthDay.join(",")}`);
	if (model.byDay?.length) parts.push(`BYDAY=${serializeByDay(model.byDay)}`);
	if (model.bySetPos?.length) parts.push(`BYSETPOS=${model.bySetPos.join(",")}`);
	const hasCustomWeekStart =
		model.weekStart !== undefined && model.weekStart !== DEFAULT_WEEK_START;
	if (hasCustomWeekStart) parts.push(`WKST=${model.weekStart}`);
	return parts.join(";");
}
