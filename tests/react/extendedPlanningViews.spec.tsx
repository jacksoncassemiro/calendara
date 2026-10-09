// @vitest-environment jsdom
import { Temporal } from '@js-temporal/polyfill';
import { createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDateUtils,
  DEFAULT_OPTIONS,
  type CalendarEvent,
  type EventOccurrence,
  type TemporalLike,
} from '../../src/core/index.js';
import type { CalendarView, ViewRenderContext } from '../../src/react/viewTypes.js';
import {
  createMultiMonthView,
  quarterView,
  yearView,
} from '../../src/react/views/MultiMonthView.js';
import { yearPlannerView } from '../../src/react/views/YearPlannerView.js';
import { dayAgendaView } from '../../src/react/views/DayAgendaView.js';

const temporal = Temporal as unknown as TemporalLike;
const base = {
  temporal,
  dateUtils: createDateUtils(temporal),
  options: {
    ...DEFAULT_OPTIONS,
    locale: 'en-US',
    timeZone: 'UTC',
    monthCompactBreakpoint: false as const,
  },
};
const roots: Root[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) flushSync(() => root.unmount());
  document.body.replaceChildren();
});

function occurrence({
  id,
  time,
  title = id,
}: {
  /** Event identifier. @remarks Português: Identificador do evento. */
  id: string;
  /** Exclusive-end event interval. @remarks Português: Intervalo do evento com fim exclusivo. */
  time: CalendarEvent['time'];
  /** Event title; defaults to identifier. @remarks Português: Título do evento; padrão é o identificador. */
  title?: string;
}): EventOccurrence {
  return {
    event: { id, calendarId: 'test', title, time },
    masterId: id,
    originalStart: time.start.date ?? time.start.dateTime!,
    isMaster: true,
  };
}

function mount({
  view,
  dateISO = '2024-02-29',
  occurrences = [],
  overrides = {},
}: {
  /** View to render. @remarks Português: View a renderizar. */
  view: CalendarView;
  /** Reference date; defaults to leap day. @remarks Português: Data de referência; padrão é dia bissexto. */
  dateISO?: string;
  /** Supplied expanded occurrences. @remarks Português: Ocorrências expandidas fornecidas. */
  occurrences?: EventOccurrence[];
  /** Consumer context overrides. @remarks Português: Substituições do contexto pelo consumidor. */
  overrides?: Partial<ViewRenderContext>;
}) {
  const context: ViewRenderContext = {
    ...base,
    referenceDateISO: dateISO,
    viewName: view.name,
    range: view.getRange(temporal.PlainDate.from(dateISO), base),
    occurrences,
    constraints: {},
    nowMs: Date.UTC(2024, 1, 29, 12),
    onDateClick: vi.fn(),
    onEventClick: vi.fn(),
    ...overrides,
  };
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  roots.push(root);
  flushSync(() => root.render(view.render(context)));
  return { element, context };
}

const trip = occurrence({
  id: 'trip',
  title: 'Cross-month trip',
  time: { allDay: true, start: { date: '2024-02-28' }, end: { date: '2024-03-02' } },
});

describe('multi-month planning ranges', () => {
  it('aligns quarters and navigates to the next aligned quarter', () => {
    const date = temporal.PlainDate.from('2024-02-29');
    const range = quarterView.getRange(date, base);
    expect(range.days.some((day) => day.toString() === '2024-02-29')).toBe(true);
    expect(quarterView.navigate({ direction: 'next', date, context: base }).toString()).toBe(
      '2024-04-01',
    );
    expect(quarterView.getTitle(range, base)).toContain('January');
    const { element } = mount({ view: quarterView });
    expect(
      [...element.querySelectorAll('[data-mc-month-panel]')].map((panel) =>
        panel.getAttribute('data-mc-month-panel'),
      ),
    ).toEqual(['2024-01', '2024-02', '2024-03']);
  });
  it('renders twelve months through one context, preserving custom headers and styles', () => {
    const renderDayHeader = vi.fn((info) =>
      createElement(
        Fragment,
        {},
        info.defaultContent,
        createElement('small', { 'data-planning-status': info.dateISO }, 'Available'),
      ),
    );
    const getDayStyle = vi.fn(() => ({ backgroundColor: '#abcdef' }));
    const { element } = mount({
      view: yearView,
      occurrences: [trip],
      overrides: { renderDayHeader, getDayStyle },
    });
    expect(element.querySelectorAll('[data-mc-month-panel]')).toHaveLength(12);
    expect(
      element.querySelector('[data-mc-month-panel="2024-02"] [data-mc-month-event]')?.textContent,
    ).toContain('Cross-month trip');
    expect(
      element.querySelector('[data-mc-month-panel="2024-03"] [data-mc-month-event]')?.textContent,
    ).toContain('Cross-month trip');
    expect(renderDayHeader).toHaveBeenCalledWith(
      expect.objectContaining({ viewName: 'year', dateISO: '2024-02-29' }),
    );
    expect(getDayStyle).toHaveBeenCalledWith(
      expect.objectContaining({ viewName: 'year', dateISO: '2024-02-29' }),
    );
  });
  it('rejects unbounded or fractional panel counts', () => {
    for (const months of [0, 25, 1.5, Infinity])
      expect(() => createMultiMonthView({ months })).toThrow(RangeError);
  });
});

describe('year planner', () => {
  it('includes all leap-year dates and retains exclusive all-day ends across months', () => {
    const range = yearPlannerView.getRange(temporal.PlainDate.from('2024-07-01'), base);
    expect(range.days).toHaveLength(366);
    expect(range.startDate.toString()).toBe('2024-01-01');
    expect(range.endDate.toString()).toBe('2024-12-31');
    const { element, context } = mount({ view: yearPlannerView, occurrences: [trip] });
    for (const date of ['2024-02-28', '2024-02-29', '2024-03-01'])
      expect(
        element.querySelector(`[data-mc-year-planner-date="${date}"] .mc-year-planner-event`),
      ).not.toBeNull();
    expect(
      element.querySelector('[data-mc-year-planner-date="2024-03-02"] .mc-year-planner-event'),
    ).toBeNull();
    element
      .querySelector<HTMLButtonElement>(
        '[data-mc-year-planner-date="2024-02-29"] .mc-year-planner-event',
      )!
      .click();
    expect(context.onEventClick).toHaveBeenCalledWith(trip);
    const leapDay = element.querySelector<HTMLButtonElement>(
      '[data-mc-year-planner-date="2024-02-29"] .mc-year-planner-date',
    )!;
    leapDay.focus();
    leapDay.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement?.closest('td')?.getAttribute('data-mc-year-planner-date')).toBe(
      '2024-03-01',
    );
    leapDay.focus();
    leapDay.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement?.closest('td')?.getAttribute('data-mc-year-planner-date')).toBe(
      '2024-03-29',
    );
  });
  it('keeps date actions usable through a consumer header renderer', () => {
    const { element, context } = mount({
      view: yearPlannerView,
      overrides: {
        renderDayHeader: (info) =>
          createElement(Fragment, {}, info.defaultContent, createElement('small', {}, 'Free')),
      },
    });
    element
      .querySelector<HTMLButtonElement>(
        '[data-mc-year-planner-date="2024-02-29"] .mc-year-planner-date',
      )!
      .click();
    expect(context.onDateClick).toHaveBeenCalledWith('2024-02-29');
    expect(
      element.querySelector('[data-mc-year-planner-date="2024-02-29"]')?.textContent,
    ).toContain('Free');
  });
});

describe('day agenda', () => {
  it('orders all-day and timed events and passes original identity to activation', () => {
    const late = occurrence({
      id: 'late',
      time: {
        allDay: false,
        start: { dateTime: '2024-02-29T15:00:00', timeZone: 'UTC' },
        end: { dateTime: '2024-02-29T16:00:00', timeZone: 'UTC' },
      },
    });
    const early = occurrence({
      id: 'early',
      time: {
        allDay: false,
        start: { dateTime: '2024-02-29T09:00:00', timeZone: 'UTC' },
        end: { dateTime: '2024-02-29T10:00:00', timeZone: 'UTC' },
      },
    });
    const { element, context } = mount({ view: dayAgendaView, occurrences: [late, trip, early] });
    expect(
      [...element.querySelectorAll('[data-mc-agenda-occurrence]')].map((card) => card.textContent),
    ).toEqual(['Cross-month trip', 'early', 'late']);
    const card = element.querySelectorAll<HTMLElement>('[data-mc-agenda-occurrence]')[1]!;
    card.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    expect(context.onEventClick).toHaveBeenCalledWith(early);
    expect(element.querySelector('[data-mc-day-agenda]')?.textContent).toContain('3 events');
  });
  it('does not show an exclusive all-day end and supports empty-date creation', () => {
    const { element, context } = mount({
      view: dayAgendaView,
      dateISO: '2024-03-02',
      occurrences: [trip],
    });
    expect(element.querySelectorAll('[data-mc-agenda-occurrence]')).toHaveLength(0);
    expect(element.textContent).toContain('No events on this date.');
    element.querySelector<HTMLButtonElement>('.mc-day-agenda-create')!.click();
    expect(context.onDateClick).toHaveBeenCalledWith('2024-03-02');
  });
});
