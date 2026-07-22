/**
 * Views internas de time-grid: Week (7 dias a partir do início da semana) e Day (1 dia).
 * Ambas usam o MESMO componente de render; só mudam range/navegação/título.
 */
import type { TimeGridViewDef, ViewContext, ViewRange } from './viewDef.js';
import type { TemporalLike } from '../date/temporal.js';
import { formatDate } from './format.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export const weekView: TimeGridViewDef = {
  name: 'week',
  label: 'Semana',
  getRange(date: PlainDate, ctx: ViewContext): ViewRange {
    const start = ctx.dateUtils.startOfWeek(date, ctx.options.weekStart);
    const end = start.add({ days: 6 });
    const days = ctx.dateUtils.eachDayOfRange(start, start.add({ days: 7 }));
    return { days, startDate: start, endDate: end };
  },
  navigate(dir, date) {
    return dir === 'next' ? date.add({ days: 7 }) : date.subtract({ days: 7 });
  },
  getTitle(range, ctx): string {
    const { locale } = ctx.options;
    const s = range.startDate;
    const e = range.endDate;
    const sameMonth = s.year === e.year && s.month === e.month;
    if (sameMonth) {
      return `${s.day} – ${formatDate(e, locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    const sTxt = formatDate(s, locale, { day: 'numeric', month: 'short' });
    const eTxt = formatDate(e, locale, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${sTxt} – ${eTxt}`;
  },
};

export const dayView: TimeGridViewDef = {
  name: 'day',
  label: 'Dia',
  getRange(date: PlainDate): ViewRange {
    return { days: [date], startDate: date, endDate: date };
  },
  navigate(dir, date) {
    return dir === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 });
  },
  getTitle(range, ctx): string {
    return formatDate(range.startDate, ctx.options.locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  },
};

export const BUILTIN_VIEWS: readonly TimeGridViewDef[] = [weekView, dayView];
