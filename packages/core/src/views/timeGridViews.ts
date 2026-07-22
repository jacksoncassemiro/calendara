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
    const start = range.startDate;
    const end = range.endDate;
    const sameMonth = start.year === end.year && start.month === end.month;
    if (sameMonth) {
      return `${start.day} – ${formatDate(end, locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    const startText = formatDate(start, locale, { day: 'numeric', month: 'short' });
    const endText = formatDate(end, locale, { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startText} – ${endText}`;
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
