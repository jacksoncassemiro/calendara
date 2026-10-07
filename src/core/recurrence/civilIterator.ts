/** Gregorian RRULE date iterator. UTC Date is only a carrier of civil fields;
 * timezone/DST and event composition remain in recurrenceSet. No Temporal API. */
import type { RRuleModel } from '../types/recurrence.js';
import { validateRRuleModel } from './parser.js';

const DAY = 86400000;
const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function utc(year: number, month: number, day: number): number {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime() / DAY;
}
function parse(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  const value = utc(year!, month!, day!);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || new Date(value * DAY).toISOString().slice(0, 10) !== iso) throw new RangeError('Invalid civil date');
  return value;
}
function parts(day: number) {
  const value = new Date(day * DAY);
  const year = value.getUTCFullYear(), month = value.getUTCMonth() + 1;
  return { year, month, date: value.getUTCDate(), weekday: value.getUTCDay(),
    monthDays: new Date(utc(year, month + 1, 0) * DAY).getUTCDate(),
    yearDay: day - utc(year, 1, 1) + 1, yearDays: utc(year + 1, 1, 1) - utc(year, 1, 1) };
}
export interface CivilWindow { start?: string; end?: string; maxPeriods?: number; maxEmptyPeriods?: number }
export function* iterateCivilDates(model: RRuleModel, dtStart: string, window: CivilWindow = {}): Generator<string> {
  validateRRuleModel(model);
  const start = parse(dtStart), base = parts(start), interval = model.interval ?? 1;
  const first = window.start ? parse(window.start) : start;
  const last = Math.min(window.end ? parse(window.end) : Infinity, model.until ? parse(model.until.slice(0, 10)) : Infinity);
  // Lazy consumers may stop after counting valid timezone-aware starts. The
  // period budget still bounds work when an unbounded consumer fails to stop.
  const budget = window.maxPeriods ?? 50000, emptyBudget = window.maxEmptyPeriods ?? 2000;
  if (!Number.isSafeInteger(budget) || budget <= 0 || !Number.isSafeInteger(emptyBudget) || emptyBudget <= 0) throw new RangeError('Invalid expansion budget');
  let months = model.byMonth ?? [], monthDays = model.byMonthDay ?? [];
  const byDay = model.byDay ?? [];
  if (model.freq === 'YEARLY' && !byDay.length && !monthDays.length && !model.byYearDay?.length) {
    if (!months.length) months = [base.month];
    monthDays = [base.date];
  } else if (model.freq === 'MONTHLY' && !byDay.length && !monthDays.length) monthDays = [base.date];
  if (months.length && monthDays.length && !months.some(month => monthDays.some(day => Math.abs(day) <= [31,29,31,30,31,30,31,31,30,31,30,31][month - 1]!))) return;
  const weekStart = codes.indexOf(model.weekStart ?? 'MO');
  let period = model.freq === 'YEARLY' ? utc(base.year, 1, 1) : model.freq === 'MONTHLY' ? utc(base.year, base.month, 1)
    : model.freq === 'WEEKLY' ? start - (base.weekday - weekStart + 7) % 7 : start;
  if (model.count === undefined && first > period) {
    const target = parts(first);
    if (model.freq === 'YEARLY') period = utc(base.year + Math.floor((target.year - base.year) / interval) * interval, 1, 1);
    else if (model.freq === 'MONTHLY') period = utc(base.year, base.month + Math.floor(((target.year - base.year) * 12 + target.month - base.month) / interval) * interval, 1);
    else period += Math.floor((first - period) / (interval * (model.freq === 'WEEKLY' ? 7 : 1))) * interval * (model.freq === 'WEEKLY' ? 7 : 1);
  }
  let count = 0, visited = 0, empty = 0;
  while (period <= last) {
    if (++visited > budget) throw new RangeError('[meucalendario] orçamento de expansão RRULE excedido; reduza a janela');
    const p = parts(period);
    const end = model.freq === 'YEARLY' ? utc(p.year + 1, 1, 1) : model.freq === 'MONTHLY' ? utc(p.year, p.month + 1, 1) : period + (model.freq === 'WEEKLY' ? 7 : 1);
    let candidates: number[] = [];
    // Direct construction avoids scanning every day for explicit month-day rules.
    const days: number[] = [];
    if (monthDays.length && (model.freq === 'MONTHLY' || model.freq === 'YEARLY')) {
      for (const month of model.freq === 'MONTHLY' ? [p.month] : months.length ? months : [1,2,3,4,5,6,7,8,9,10,11,12]) {
        const length = parts(utc(p.year, month, 1)).monthDays;
        for (const requested of monthDays) {
          const day = requested > 0 ? requested : length + requested + 1;
          if (day >= 1 && day <= length) days.push(utc(p.year, month, day));
        }
      }
      days.sort((a,b) => a-b);
    } else for (let day = period; day < end; day++) days.push(day);
    for (const day of new Set(days)) {
      const c = parts(day);
      if (model.byYearDay?.length && !model.byYearDay.includes(c.yearDay) && !model.byYearDay.includes(c.yearDay - c.yearDays - 1)) continue;
      if (months.length && !months.includes(c.month)) continue;
      if (monthDays.length && !monthDays.includes(c.date) && !monthDays.includes(c.date - c.monthDays - 1)) continue;
      if (byDay.length && !byDay.some(entry => {
        if (codes.indexOf(entry.weekday) !== c.weekday) return false;
        if (entry.ordinal === undefined || !['YEARLY','MONTHLY'].includes(model.freq)) return true;
        const annual = model.freq === 'YEARLY' && !months.length;
        const number = annual ? c.yearDay : c.date, length = annual ? c.yearDays : c.monthDays;
        return entry.ordinal === Math.floor((number - 1) / 7) + 1 || entry.ordinal === -(Math.floor((length - number) / 7) + 1);
      })) continue;
      if (!byDay.length && model.freq === 'WEEKLY' && c.weekday !== base.weekday) continue;
      candidates.push(day);
    }
    if (model.bySetPos?.length) candidates = [...new Set(model.bySetPos.map(pos => candidates[pos > 0 ? pos - 1 : candidates.length + pos]).filter((day): day is number => day !== undefined))].sort((a,b) => a-b);
    for (const day of candidates) {
      if (day < start) continue;
      if (day > last) return;
      count++;
      if (day >= first) yield new Date(day * DAY).toISOString().slice(0, 10);
      if (count >= (model.count ?? Infinity)) return;
    }
    empty = candidates.length ? 0 : empty + 1;
    if (empty > emptyBudget) throw new RangeError('RRULE empty period budget exceeded');
    period = model.freq === 'YEARLY' ? utc(p.year + interval, 1, 1) : model.freq === 'MONTHLY' ? utc(p.year, p.month + interval, 1) : period + interval * (model.freq === 'WEEKLY' ? 7 : 1);
  }
}
