/** Week, day and custom-length views share the time grid.
 * @remarks Português: Views de semana, dia e período personalizado compartilham a grade horária.
 */
import { createElement } from 'react';
import type { CalendarView, ViewContext, ViewRange, ViewRenderContext } from '../viewTypes.js';
import type { TemporalLike } from '../../core/index.js';
import { formatDate } from './formatting/timeLabels.js';
import { TimeGrid } from './components/TimeGrid.js';
import { buildTimeGridVM } from './models/timeGridModel.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Format an inclusive date range title. @remarks Português: Formata o título de um período de datas inclusivas. */
function rangeTitle(range: ViewRange, context: ViewContext): string {
  const { locale } = context.options;
  const start = range.startDate;
  const end = range.endDate;
  if (start.equals(end)) {
    return formatDate({
      date: start,
      locale,
      options: {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      },
    });
  }
  const sameMonth = start.year === end.year && start.month === end.month;
  if (sameMonth) {
    return `${start.day} – ${formatDate({ date: end, locale, options: { day: 'numeric', month: 'long', year: 'numeric' } })}`;
  }
  const startText = formatDate({
    date: start,
    locale,
    options: { day: 'numeric', month: 'short' },
  });
  const endText = formatDate({
    date: end,
    locale,
    options: { day: 'numeric', month: 'short', year: 'numeric' },
  });
  return `${startText} – ${endText}`;
}

function renderTimeGrid(name: string) {
  return (context: ViewRenderContext) =>
    createElement(TimeGrid, { vm: buildTimeGridVM({ context, viewName: name }) });
}

/** Seven-day grid aligned to weekStart. @remarks Português: Grade de sete dias alinhada a weekStart. */
export const weekView: CalendarView = {
  name: 'week',
  label: 'Semana',
  getRange(date: PlainDate, context: ViewContext): ViewRange {
    const start = context.dateUtils.startOfWeek({
      date,
      weekStart: context.options.weekStart,
    });
    const days = context.dateUtils.eachDayOfRange({ start, end: start.add({ days: 7 }) });
    return { days, startDate: start, endDate: start.add({ days: 6 }) };
  },
  navigate({ direction, date }) {
    return direction === 'next' ? date.add({ days: 7 }) : date.subtract({ days: 7 });
  },
  getTitle: rangeTitle,
  render: renderTimeGrid('week'),
};

/** Time grid for the reference date. @remarks Português: Grade horária da data de referência. */
export const dayView: CalendarView = {
  name: 'day',
  label: 'Dia',
  getRange(date: PlainDate): ViewRange {
    return { days: [date], startDate: date, endDate: date };
  },
  navigate({ direction, date }) {
    return direction === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 });
  },
  getTitle: rangeTitle,
  render: renderTimeGrid('day'),
};

/** Create consecutive days; dayCount is floored and must be at least 1. @remarks Português: Cria dias consecutivos; dayCount é arredondado para baixo e deve ser no mínimo 1. */
export function createNDaysView(dayCount: number, name = `ndays-${dayCount}`): CalendarView {
  if (!Number.isFinite(dayCount) || dayCount < 1) {
    throw new RangeError('dayCount must be a finite number greater than or equal to 1');
  }
  const totalDays = Math.floor(dayCount);
  return {
    name,
    label: `${totalDays} dias`,
    getRange(date: PlainDate, context: ViewContext): ViewRange {
      const days = context.dateUtils.eachDayOfRange({
        start: date,
        end: date.add({ days: totalDays }),
      });
      return { days, startDate: date, endDate: date.add({ days: totalDays - 1 }) };
    },
    navigate({ direction, date }) {
      return direction === 'next'
        ? date.add({ days: totalDays })
        : date.subtract({ days: totalDays });
    },
    getTitle: rangeTitle,
    render: renderTimeGrid(name),
  };
}

/** Standard week and day views to register explicitly. @remarks Português: Views padrão de semana e dia para registrar explicitamente. */
export const BUILTIN_TIME_GRID_VIEWS: readonly CalendarView[] = [weekView, dayView];
