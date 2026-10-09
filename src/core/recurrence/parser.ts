import { WEEKDAY_CODES } from '../date/dateUtils.js';
import type { ByDayEntry, Frequency, RRuleModel, WeekdayCode } from '../types/index.js';

const FREQUENCIES: readonly Frequency[] = [
  'SECONDLY',
  'MINUTELY',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
];
const WEEKDAY_CODE_SET = new Set<string>(WEEKDAY_CODES);

const DEFAULT_INTERVAL = 1;
const DEFAULT_WEEK_START = 'MO';

function integer(value: string): number {
  if (!/^[+-]?\d+$/.test(value))
    throw new RangeError(`[calendara] inteiro RRULE inválido: ${value}`);
  const result = Number(value);
  if (!Number.isSafeInteger(result))
    throw new RangeError('[calendara] inteiro RRULE fora da faixa segura');
  return result;
}

/** Reject malformed or unsupported recurrence fields.
 * @remarks Português: Rejeita campos de recorrência inválidos ou não suportados.
 */
export function validateRRuleModel(model: RRuleModel): void {
  if (!FREQUENCIES.includes(model.freq)) throw new RangeError('[calendara] FREQ não suportada');
  const supportedFields = new Set([
    'freq',
    'interval',
    'count',
    'until',
    'byMonth',
    'byMonthDay',
    'bySetPos',
    'byYearDay',
    'byWeekNo',
    'byDay',
    'weekStart',
    'byHour',
    'byMinute',
    'bySecond',
  ]);
  for (const field of Object.keys(model)) {
    if (!supportedFields.has(field))
      throw new RangeError(`[calendara] campo RRULE não suportado: ${field}`);
  }
  if (model.count !== undefined && model.until !== undefined)
    throw new RangeError('[calendara] COUNT e UNTIL são mutuamente exclusivos');
  for (const value of [model.interval, model.count]) {
    if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0))
      throw new RangeError('[calendara] COUNT/INTERVAL devem ser inteiros positivos');
  }
  for (const [values, bound] of [
    [model.byMonth, 12],
    [model.byMonthDay, 31],
    [model.bySetPos, 366],
    [model.byYearDay, 366],
    [model.byWeekNo, 53],
  ] as const) {
    if (
      values &&
      (values.length > 366 ||
        values.some(
          (value) => !Number.isSafeInteger(value) || value === 0 || Math.abs(value) > bound,
        ))
    )
      throw new RangeError('[calendara] filtro RRULE inválido');
  }
  if (model.byMonth?.some((value) => value < 1))
    throw new RangeError('[calendara] BYMONTH inválido');
  for (const [values, maximum, name] of [
    [model.byHour, 23, 'BYHOUR'],
    [model.byMinute, 59, 'BYMINUTE'],
    [model.bySecond, 59, 'BYSECOND'],
  ] as const) {
    if (
      values &&
      (values.length > maximum + 1 ||
        values.some((value) => !Number.isSafeInteger(value) || value < 0 || value > maximum))
    )
      throw new RangeError(`[calendara] ${name} inválido; segundos intercalares não suportados`);
  }
  if (model.byYearDay?.length && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(model.freq))
    throw new RangeError('[calendara] BYYEARDAY exige YEARLY ou frequência intradiária');
  if (model.byWeekNo?.length && model.freq !== 'YEARLY')
    throw new RangeError('[calendara] BYWEEKNO exige YEARLY');
  if (model.byMonthDay?.length && model.freq === 'WEEKLY')
    throw new RangeError('[calendara] BYMONTHDAY não é permitido com WEEKLY');
  if (
    model.bySetPos?.length &&
    ![
      model.byMonth,
      model.byMonthDay,
      model.byYearDay,
      model.byWeekNo,
      model.byDay,
      model.byHour,
      model.byMinute,
      model.bySecond,
    ].some((values) => values?.length)
  )
    throw new RangeError('[calendara] BYSETPOS exige outro filtro BYxxx');
  if (
    model.byDay &&
    (model.byDay.length > 366 ||
      model.byDay.some(
        (entry) =>
          !WEEKDAY_CODE_SET.has(entry.weekday) ||
          (entry.ordinal !== undefined &&
            (!Number.isSafeInteger(entry.ordinal) ||
              entry.ordinal === 0 ||
              Math.abs(entry.ordinal) > 53)),
      ))
  )
    throw new RangeError('[calendara] BYDAY inválido');
  if (
    model.byDay?.some((entry) => entry.ordinal !== undefined) &&
    (!['MONTHLY', 'YEARLY'].includes(model.freq) || model.byWeekNo?.length)
  )
    throw new RangeError('[calendara] BYDAY ordinal exige MONTHLY ou YEARLY sem BYWEEKNO');
  if (model.weekStart !== undefined && !WEEKDAY_CODE_SET.has(model.weekStart))
    throw new RangeError('[calendara] WKST inválido');
  if (
    model.until !== undefined &&
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})?)?$/.test(model.until)
  )
    throw new RangeError('[calendara] UNTIL inválido');
}

function parseByDay(value: string): ByDayEntry[] {
  const entries: ByDayEntry[] = [];
  for (const rawToken of value.split(',')) {
    const match = rawToken
      .trim()
      .toUpperCase()
      .match(/^([+-]?\d+)?([A-Z]{2})$/);
    if (!match) throw new RangeError('[calendara] BYDAY inválido');
    const code = match[2] as WeekdayCode;
    if (!WEEKDAY_CODE_SET.has(code)) throw new RangeError('[calendara] BYDAY inválido');
    const entry: ByDayEntry = { weekday: code };
    if (match[1]) entry.ordinal = integer(match[1]);
    entries.push(entry);
  }
  return entries;
}

function parseUntil(value: string): string {
  value = value.toUpperCase();
  if (!/^\d{8}(?:T\d{6}Z?)?$/.test(value)) throw new RangeError('[calendara] UNTIL inválido');
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (value.length <= 8) return date;
  const time = `${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}`;
  return `${date}T${time}${value.endsWith('Z') ? 'Z' : ''}`;
}

/** Parse an RRULE with an optional prefix; date additions and exclusions belong to Recurrence.
 * @remarks Português: Lê RRULE com prefixo opcional; inclusões e exclusões de datas pertencem a Recurrence.
 */
export function parseRRule(input: string): RRuleModel {
  if (input.length > 4096) throw new RangeError('[calendara] RRULE excede 4096 caracteres');
  let body = input.trim();
  for (const line of body.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (/^RRULE:/i.test(trimmedLine)) {
      body = trimmedLine.replace(/^RRULE:/i, '');
      break;
    }
  }
  body = body.replace(/^RRULE:/i, '');

  const model: RRuleModel = { freq: 'DAILY' };
  const seen = new Set<string>();
  for (const part of body.split(';')) {
    const [rawKey, value] = part.split('=');
    if (!rawKey || value === undefined || part.split('=').length !== 2)
      throw new RangeError('[calendara] RRULE inválida');
    const key = rawKey.toUpperCase();
    if (seen.has(key)) throw new RangeError(`[calendara] campo RRULE duplicado: ${key}`);
    seen.add(key);
    switch (key) {
      case 'FREQ': {
        const frequency = value.toUpperCase() as Frequency;
        if (!FREQUENCIES.includes(frequency))
          throw new RangeError(`[calendara] FREQ não suportada: ${frequency}`);
        model.freq = frequency;
        break;
      }
      case 'INTERVAL':
        model.interval = integer(value);
        break;
      case 'COUNT':
        model.count = integer(value);
        break;
      case 'UNTIL':
        model.until = parseUntil(value);
        break;
      case 'BYDAY':
        model.byDay = parseByDay(value);
        break;
      case 'BYMONTHDAY':
        model.byMonthDay = value.split(',').map(integer);
        break;
      case 'BYMONTH':
        model.byMonth = value.split(',').map(integer);
        break;
      case 'BYSETPOS':
        model.bySetPos = value.split(',').map(integer);
        break;
      case 'WKST':
        if (WEEKDAY_CODE_SET.has(value.toUpperCase())) {
          model.weekStart = value.toUpperCase() as WeekdayCode;
        } else throw new RangeError('[calendara] WKST inválido');
        break;
      case 'BYYEARDAY':
        model.byYearDay = value.split(',').map(integer);
        break;
      case 'BYWEEKNO':
        model.byWeekNo = value.split(',').map(integer);
        break;
      case 'BYHOUR':
        model.byHour = value.split(',').map(integer);
        break;
      case 'BYMINUTE':
        model.byMinute = value.split(',').map(integer);
        break;
      case 'BYSECOND':
        model.bySecond = value.split(',').map(integer);
        break;
      default:
        throw new RangeError(`[calendara] campo RRULE não suportado: ${key}`);
    }
  }
  if (!seen.has('FREQ')) throw new RangeError('[calendara] RRULE exige FREQ');
  validateRRuleModel(model);
  return model;
}

function serializeByDay(entries: ByDayEntry[]): string {
  return entries
    .map((entry) => `${entry.ordinal !== undefined ? entry.ordinal : ''}${entry.weekday}`)
    .join(',');
}

function serializeUntil(iso: string): string {
  if (/[+-]\d{2}:\d{2}$/.test(iso)) iso = new Date(iso).toISOString();
  const date = iso.slice(0, 10).replace(/-/g, '');
  if (iso.length <= 10) return date;
  const time = iso.slice(11, 19).replace(/:/g, '');
  return `${date}T${time}${iso.endsWith('Z') ? 'Z' : ''}`;
}

/** Serialize supported rule fields without the RRULE prefix.
 * @remarks Português: Serializa os campos suportados sem o prefixo RRULE.
 */
export function serializeRRule(model: RRuleModel): string {
  validateRRuleModel(model);
  const parts: string[] = [`FREQ=${model.freq}`];
  const hasCustomInterval = model.interval !== undefined && model.interval !== DEFAULT_INTERVAL;
  if (hasCustomInterval) parts.push(`INTERVAL=${model.interval}`);
  if (model.count !== undefined) parts.push(`COUNT=${model.count}`);
  if (model.until !== undefined) parts.push(`UNTIL=${serializeUntil(model.until)}`);
  if (model.byMonth?.length) parts.push(`BYMONTH=${model.byMonth.join(',')}`);
  if (model.byYearDay?.length) parts.push(`BYYEARDAY=${model.byYearDay.join(',')}`);
  if (model.byWeekNo?.length) parts.push(`BYWEEKNO=${model.byWeekNo.join(',')}`);
  if (model.byHour?.length) parts.push(`BYHOUR=${model.byHour.join(',')}`);
  if (model.byMinute?.length) parts.push(`BYMINUTE=${model.byMinute.join(',')}`);
  if (model.bySecond?.length) parts.push(`BYSECOND=${model.bySecond.join(',')}`);
  if (model.byMonthDay?.length) parts.push(`BYMONTHDAY=${model.byMonthDay.join(',')}`);
  if (model.byDay?.length) parts.push(`BYDAY=${serializeByDay(model.byDay)}`);
  if (model.bySetPos?.length) parts.push(`BYSETPOS=${model.bySetPos.join(',')}`);
  const hasCustomWeekStart =
    model.weekStart !== undefined && model.weekStart !== DEFAULT_WEEK_START;
  if (hasCustomWeekStart) parts.push(`WKST=${model.weekStart}`);
  return parts.join(';');
}
