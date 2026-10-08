/**
 * Views internas de time-grid: Week (7 dias), Day (1 dia) e NDays (N dias configurável).
 * Todas compartilham o MESMO componente (`TimeGrid`) e o mesmo builder (`buildTimeGridVM`);
 * só mudam range/navegação/título.
 */
import { createElement } from 'react';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from '../viewTypes.js';
import type { TemporalLike } from '../../core/index.js';
import { formatDate } from './formatting/timeLabels.js';
import { TimeGrid } from './components/TimeGrid.js';
import { buildTimeGridVM } from './models/timeGridModel.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Título "12 – 18 de julho de 2026" para um range de dias. */
function rangeTitle(range: ViewRange, context: ViewContext): string {
  const { locale } = context.options;
  const start = range.startDate;
  const end = range.endDate;
  if (start.equals(end)) {
    return formatDate(start, locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  const sameMonth = start.year === end.year && start.month === end.month;
  if (sameMonth) {
    return `${start.day} – ${formatDate(end, locale, { day: 'numeric', month: 'long', year: 'numeric' })}`;
  }
  const startText = formatDate(start, locale, { day: 'numeric', month: 'short' });
  const endText = formatDate(end, locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startText} – ${endText}`;
}

function renderTimeGrid(name: string) {
  return (context: ViewRenderContext) =>
    createElement(TimeGrid, { vm: buildTimeGridVM(context, name) });
}

export const weekView: CalendarView = {
  name: 'week',
  label: 'Semana',
  getRange(date: PlainDate, context: ViewContext): ViewRange {
    const start = context.dateUtils.startOfWeek(date, context.options.weekStart);
    const days = context.dateUtils.eachDayOfRange(start, start.add({ days: 7 }));
    return { days, startDate: start, endDate: start.add({ days: 6 }) };
  },
  navigate(direction, date) {
    return direction === 'next' ? date.add({ days: 7 }) : date.subtract({ days: 7 });
  },
  getTitle: rangeTitle,
  render: renderTimeGrid('week'),
};

export const dayView: CalendarView = {
  name: 'day',
  label: 'Dia',
  getRange(date: PlainDate): ViewRange {
    return { days: [date], startDate: date, endDate: date };
  },
  navigate(direction, date) {
    return direction === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 });
  },
  getTitle: rangeTitle,
  render: renderTimeGrid('day'),
};

/** Cria uma view de N dias corridos a partir da data de referência (ex.: escala de 3 dias úteis). */
export function createNDaysView(dayCount: number, name = `ndays-${dayCount}`): CalendarView {
  if (!Number.isFinite(dayCount) || dayCount < 1) {
    throw new RangeError('dayCount must be a finite number greater than or equal to 1');
  }
  const totalDays = Math.floor(dayCount);
  return {
    name,
    label: `${totalDays} dias`,
    getRange(date: PlainDate, context: ViewContext): ViewRange {
      const days = context.dateUtils.eachDayOfRange(date, date.add({ days: totalDays }));
      return { days, startDate: date, endDate: date.add({ days: totalDays - 1 }) };
    },
    navigate(direction, date) {
      return direction === 'next'
        ? date.add({ days: totalDays })
        : date.subtract({ days: totalDays });
    },
    getTitle: rangeTitle,
    render: renderTimeGrid(name),
  };
}

export const BUILTIN_TIME_GRID_VIEWS: readonly CalendarView[] = [weekView, dayView];
