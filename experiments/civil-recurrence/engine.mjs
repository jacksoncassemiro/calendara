/** Dependency-free experiment. Gregorian dates + Intl timezone projection, no Temporal.
 * Supported subset matches the current library's four frequencies and BY* fields.
 * Not a production replacement: see REPORT.md for DST ambiguity and validity limits.
 */
const DAY_MS = 86400000;
const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const formatters = new Map();
const offsetPattern = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function utcDate(year, month, day) {
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  return result;
}
function epochDay(iso) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const value = utcDate(year, month, day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso.slice(0, 10)) || value.toISOString().slice(0, 10) !== iso.slice(0, 10)) {
    throw new RangeError(`Invalid civil date: ${iso}`);
  }
  return value.getTime() / DAY_MS;
}
const isoDay = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);
function parts(day) {
  const value = new Date(day * DAY_MS);
  const year = value.getUTCFullYear();
  const month = value.getUTCMonth() + 1;
  const monthDays = utcDate(year, month + 1, 0).getUTCDate();
  const yearStart = utcDate(year, 1, 1).getTime() / DAY_MS;
  const yearDays = (utcDate(year + 1, 1, 1) - utcDate(year, 1, 1)) / DAY_MS;
  return { year, month, date: value.getUTCDate(), weekday: value.getUTCDay(), monthDays, yearDay: day - yearStart + 1, yearDays };
}
function normalizeUntil(value) {
  if (/^\d{8}(?:T\d{6}Z?)?$/.test(value)) {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return value.length === 8 ? date : `${date}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}${value.endsWith('Z') ? 'Z' : ''}`;
  }
  return value;
}
function ruleModel(input) {
  if (typeof input !== 'string') return input;
  const rule = input.split(/\r?\n/).find((line) => /^RRULE:/i.test(line)) ?? input;
  const model = {};
  for (const token of rule.replace(/^RRULE:/i, '').split(';')) {
    const [key, value] = token.split('=');
    switch (key.toUpperCase()) {
      case 'FREQ': model.freq = value; break;
      case 'INTERVAL': model.interval = Number(value); break;
      case 'COUNT': model.count = Number(value); break;
      case 'UNTIL': model.until = normalizeUntil(value); break;
      case 'WKST': model.weekStart = value; break;
      case 'BYMONTH': model.byMonth = value.split(',').map(Number); break;
      case 'BYMONTHDAY': model.byMonthDay = value.split(',').map(Number); break;
      case 'BYSETPOS': model.bySetPos = value.split(',').map(Number); break;
      case 'BYDAY': model.byDay = value.split(',').map((item) => {
        const match = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(item);
        if (!match) throw new RangeError(`Unsupported BYDAY ${item}`);
        return { weekday: match[2], ...(match[1] ? { ordinal: Number(match[1]) } : {}) };
      }); break;
      default: throw new RangeError(`Unsupported RRULE part ${key}`);
    }
  }
  return model;
}
function validateModel(model) {
  if (!FREQUENCIES.includes(model.freq)) throw new RangeError('Unsupported frequency');
  if (!Number.isSafeInteger(model.interval ?? 1) || (model.interval ?? 1) < 1) throw new RangeError('Invalid interval');
  if (model.count !== undefined && (!Number.isSafeInteger(model.count) || model.count < 1)) throw new RangeError('Invalid count');
}

/** Dates returned as YYYY-MM-DD. window inclusive; EXDATE handled by event composition. */
export function expandCivilRule(input, dtStart, window = {}) {
  const model = ruleModel(input);
  validateModel(model);
  const start = epochDay(dtStart);
  const base = parts(start);
  const last = Math.min(window.end ? epochDay(window.end) : Infinity, model.until ? epochDay(model.until) : Infinity);
  const first = window.start ? epochDay(window.start) : start;
  if (!Number.isFinite(last) && model.count === undefined) throw new RangeError('Infinite rule requires window.end, COUNT or UNTIL');
  let months = model.byMonth ?? [];
  let monthDays = model.byMonthDay ?? [];
  const byDay = model.byDay ?? [];
  const interval = model.interval ?? 1;
  if (model.freq === 'YEARLY' && !byDay.length && !monthDays.length) {
    if (!months.length) months = [base.month];
    monthDays = [base.date];
  } else if (model.freq === 'MONTHLY' && !byDay.length && !monthDays.length) monthDays = [base.date];
  const weekStart = CODES.indexOf(model.weekStart ?? 'MO');
  let period = model.freq === 'YEARLY' ? utcDate(base.year, 1, 1).getTime() / DAY_MS
    : model.freq === 'MONTHLY' ? utcDate(base.year, base.month, 1).getTime() / DAY_MS
      : model.freq === 'WEEKLY' ? start - ((base.weekday - weekStart + 7) % 7) : start;
  const result = [];
  let count = 0;
  let empty = 0;
  while (period <= last) {
    const periodParts = parts(period);
    const end = model.freq === 'YEARLY' ? utcDate(periodParts.year + 1, 1, 1).getTime() / DAY_MS
      : model.freq === 'MONTHLY' ? utcDate(periodParts.year, periodParts.month + 1, 1).getTime() / DAY_MS
        : period + (model.freq === 'WEEKLY' ? 7 : 1);
    let candidates = [];
    for (let day = period; day < end; day++) {
      const candidate = parts(day);
      if (months.length && !months.includes(candidate.month)) continue;
      if (monthDays.length && !monthDays.includes(candidate.date) && !monthDays.includes(candidate.date - candidate.monthDays - 1)) continue;
      if (byDay.length) {
        const matching = byDay.some((entry) => {
          if (CODES.indexOf(entry.weekday) !== candidate.weekday) return false;
          if (entry.ordinal === undefined || !['YEARLY', 'MONTHLY'].includes(model.freq)) return true;
          const annualOrdinal = model.freq === 'YEARLY' && !months.length;
          const dayNumber = annualOrdinal ? candidate.yearDay : candidate.date;
          const days = annualOrdinal ? candidate.yearDays : candidate.monthDays;
          return entry.ordinal === Math.floor((dayNumber - 1) / 7) + 1 || entry.ordinal === -(Math.floor((days - dayNumber) / 7) + 1);
        });
        if (!matching) continue;
      } else if (model.freq === 'WEEKLY' && candidate.weekday !== base.weekday) continue;
      candidates.push(day);
    }
    if (model.bySetPos?.length) candidates = [...new Set(model.bySetPos.map((position) => candidates[position > 0 ? position - 1 : candidates.length + position]).filter((day) => day !== undefined))].sort((left, right) => left - right);
    for (const day of candidates) {
      if (day < start) continue;
      if (day > last) return result;
      count++;
      if (day >= first) result.push(isoDay(day));
      if (count >= (model.count ?? Infinity)) return result;
    }
    empty = candidates.length ? 0 : empty + 1;
    if (empty > 2000) return result; // parity with current engine guard, not full Gregorian-cycle proof
    period = model.freq === 'YEARLY' ? utcDate(periodParts.year + interval, 1, 1).getTime() / DAY_MS
      : model.freq === 'MONTHLY' ? utcDate(periodParts.year, periodParts.month + interval, 1).getTime() / DAY_MS
        : period + interval * (model.freq === 'WEEKLY' ? 7 : 1);
  }
  return result;
}

function wallClock(iso, zone) {
  if (!offsetPattern.test(iso)) return new Date(`${iso}Z`).toISOString().slice(0, -1);
  const timeZone = zone ?? 'UTC';
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    formatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(formatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  const milliseconds = new Date(iso).getUTCMilliseconds();
  return `${values.year.padStart(4, '0')}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}.${String(milliseconds).padStart(3, '0')}`;
}
const trimFraction = (iso) => iso.endsWith('.000') ? iso.slice(0, -4) : iso;

/** EventOccurrence[] compatible with existing wall-clock CalendarEvent fields. */
export function expandCivilEvent(event, window = {}) {
  const shape = event.time;
  const zone = shape.start.timeZone;
  const start = shape.allDay ? shape.start.date : trimFraction(wallClock(shape.start.dateTime, zone));
  const end = shape.allDay ? (shape.end.date ?? isoDay(epochDay(start) + 1)) : trimFraction(wallClock(shape.end.dateTime, zone));
  const duration = shape.allDay ? Math.max(1, epochDay(end) - epochDay(start)) : new Date(`${end}Z`) - new Date(`${start}Z`);
  function timeAt(value) {
    const originalStart = shape.allDay ? value.slice(0, 10) : trimFraction(wallClock(value.length === 10 ? `${value}T${start.slice(11)}` : value, zone));
    const endValue = shape.allDay ? isoDay(epochDay(originalStart) + duration) : trimFraction(new Date(new Date(`${originalStart}Z`).getTime() + duration).toISOString().slice(0, -1));
    const metadata = zone ? { timeZone: zone } : {};
    return { originalStart, time: { allDay: shape.allDay, start: { [shape.allDay ? 'date' : 'dateTime']: originalStart, ...metadata }, end: { [shape.allDay ? 'date' : 'dateTime']: endValue, ...metadata } } };
  }
  const recurrence = event.recurrence;
  const recurring = !!recurrence?.rule || !!recurrence?.rDates?.length;
  const model = recurrence?.rule ? ruleModel(recurrence.rule) : null;
  const localUntil = model?.until && !shape.allDay && model.until.length > 10 ? trimFraction(wallClock(model.until, zone)) : null;
  const normalized = model && localUntil ? { ...model, until: localUntil.slice(0, 10) } : model;
  const dates = model ? expandCivilRule(normalized, start.slice(0, 10), window) : recurring ? [] : [start.slice(0, 10)];
  const times = new Map();
  const excludedDates = new Set((recurrence?.exDates ?? []).filter((value) => value.length === 10));
  const excludedStarts = new Set((recurrence?.exDates ?? []).filter((value) => value.length > 10).map((value) => shape.allDay ? value.slice(0, 10) : trimFraction(wallClock(value, zone))));
  function insert(value, ruleOccurrence = false, bypassWindow = false) {
    const item = timeAt(value);
    const date = item.originalStart.slice(0, 10);
    if (excludedDates.has(date) || excludedStarts.has(item.originalStart)) return;
    if (ruleOccurrence && localUntil && item.originalStart > localUntil) return;
    if (!bypassWindow && ((window.start && date < window.start) || (window.end && date > window.end))) return;
    times.set(item.originalStart, item);
  }
  for (const date of dates) insert(date, true);
  for (const value of recurrence?.rDates ?? []) insert(value);
  for (const [key, override] of Object.entries(recurrence?.overrides ?? {})) {
    if (override.cancelled || !override.time) continue;
    const date = key.slice(0, 10);
    const movedStart = override.time.allDay ? override.time.start.date : override.time.start.dateTime.slice(0, 10);
    const movedEnd = override.time.allDay ? override.time.end.date : override.time.end.dateTime.slice(0, 10);
    if ((window.end && movedStart > window.end) || (window.start && movedEnd < window.start)) continue;
    const matchingRDate = recurrence.rDates?.find((value) => timeAt(value).originalStart === key || value === key);
    const isRuleDate = normalized && expandCivilRule(normalized, start.slice(0, 10), { start: date, end: date }).includes(date);
    const validRuleKey = key === date || key === timeAt(date).originalStart;
    if (matchingRDate) insert(matchingRDate, false, true);
    else if (isRuleDate && validRuleKey) insert(date, true, true);
  }
  return [...times.values()].sort((left, right) => left.originalStart.localeCompare(right.originalStart)).flatMap((item) => {
    const override = recurrence?.overrides?.[item.originalStart] ?? recurrence?.overrides?.[item.originalStart.slice(0, 10)];
    if (override?.cancelled) return [];
    return [{ event: { ...event, ...override, time: override?.time ?? item.time }, masterId: event.id, originalStart: item.originalStart, isMaster: item.originalStart === start }];
  });
}
