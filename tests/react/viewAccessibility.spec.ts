// @vitest-environment jsdom
import { Temporal } from '@js-temporal/polyfill';
import { createElement } from 'react';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDateUtils } from '../../src/core/index.js';
import type { TemporalLike } from '../../src/core/index.js';
import { DEFAULT_OPTIONS } from '../../src/core/index.js';
import type { CalendarEvent, EventOccurrence } from '../../src/core/index.js';
import { monthView } from '../../src/react/views/MonthView.js';
import { listView, createListView } from '../../src/react/views/ListView.js';
import { createNDaysView, dayView } from '../../src/react/views/timeGridViews.js';
import { createResourceDayView, createTimelineView } from '../../src/react/views/resourceViews.js';
import { occurrenceEditableForDay } from '../../src/react/views/layout/occurrenceDays.js';
import { formatDate, formatHourLabel, timeLabelStep } from '../../src/react/views/format.js';
import type { CalendarView, ViewRenderContext } from '../../src/react/views/viewDef.js';

const temporal = Temporal as unknown as TemporalLike;
const dateUtils = createDateUtils(temporal);
const options = { ...DEFAULT_OPTIONS, timeZone: 'America/Sao_Paulo' };
const mountedRoots = new Map<HTMLElement, Root>();

describe('keyboard slot selection integrates with calendar validation', () => {
  it('month: arrows move by week without creating an event until activation', () => {
    const { element, onDateClick } = mount(monthView, []);
    document.body.appendChild(element);
    const first = element.querySelector<HTMLButtonElement>('[data-mc-month-day="2026-07-22"] button')!;
    first.focus();
    flushSync(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
    const target = document.activeElement as HTMLButtonElement;
    expect(target.closest<HTMLElement>('[data-mc-month-day]')?.dataset.mcMonthDay).toBe('2026-07-29');
    expect(onDateClick).not.toHaveBeenCalled();
    expect(element.querySelectorAll('button.mc-month-daynum[tabindex="0"]')).toHaveLength(1);
    target.click();
    expect(onDateClick).toHaveBeenCalledWith('2026-07-29');
    unmount(element);
    element.remove();
  });
  for (const view of [dayView, createResourceDayView([]), createTimelineView([])]) {
    it(`${view.name}: navigates the time axis, rejects a blocked slot and selects the next`, async () => {
      const onDateSelect = vi.fn(), onClickBlocked = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = new CalendarApp({ date: '2026-07-22', view: view.name, views: [view], temporal,
        resources: [{ id: 'room', title: 'Sala' }],
        options: { ...options, startHour: 9, endHour: 11, slotMinutes: 30 },
        constraints: { blocked: [{ scope: 'time', date: '2026-07-22', startTime: '09:00', endTime: '09:30' }] },
        onDateSelect, onClickBlocked,
      });
      try {
        app.mount(container); await app.ready();
        const first = container.querySelector<HTMLElement>('[data-mc-cell-start="540"]')!;
        first.focus();
        const press = (key: string) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        press('Enter');
        expect(onDateSelect).not.toHaveBeenCalled();
        expect(onClickBlocked).toHaveBeenCalledWith(expect.objectContaining({ reason: 'blocked', startMin: 540 }));
        press(view.name === 'timeline' ? 'ArrowRight' : 'ArrowDown');
        expect((document.activeElement as HTMLElement).dataset.mcCellStart).toBe('570');
        press(' ');
        expect(onDateSelect).toHaveBeenCalledTimes(1);
        expect(onDateSelect).toHaveBeenCalledWith({ dateISO: '2026-07-22', startMin: 570, endMin: 600,
          resourceId: view.name === 'day' ? undefined : 'room' });
        expect(container.querySelectorAll('[data-mc-cell-start][tabindex="0"]')).toHaveLength(1);
        const previous = container;
        const remounted = document.createElement('div'); document.body.appendChild(remounted);
        app.mount(remounted);
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(onClickBlocked).toHaveBeenCalledTimes(1);
        previous.remove(); remounted.remove();
      } finally { app.destroy(); container.remove(); }
    });
  }
});

function unmount(element: HTMLElement) {
  const root = mountedRoots.get(element);
  if (root) flushSync(() => root.unmount());
  mountedRoots.delete(element);
}

afterEach(() => {
  for (const element of mountedRoots.keys()) unmount(element);
});

function occurrence(time: CalendarEvent['time']): EventOccurrence {
  return {
    event: { id: 'trip', calendarId: 'c', title: 'Viagem', time },
    masterId: 'trip', originalStart: time.start.date ?? time.start.dateTime!, isMaster: true,
  };
}

function mount(view: CalendarView, items: EventOccurrence[] = []) {
  const date = temporal.PlainDate.from('2026-07-22');
  const base = { temporal, dateUtils, options };
  const onEventClick = vi.fn();
  const onDateClick = vi.fn();
  const context: ViewRenderContext = {
    ...base, range: view.getRange(date, base), occurrences: items,
    constraints: {}, nowMs: 0, onEventClick, onDateClick,
  };
  const element = document.createElement('div');
  const root = createRoot(element);
  mountedRoots.set(element, root);
  flushSync(() => root.render(view.render(context)));
  return { element, onEventClick, onDateClick, context };
}

describe('Month and agenda interval rendering', () => {
  for (const view of [monthView, listView]) {
    const selector = view.name === 'month' ? '[data-mc-month-event]' : '[data-mc-list-item]';
    it(`${view.name}: renders all occupied dates and excludes all-day end`, () => {
      const { element } = mount(view, [occurrence({
        allDay: true, start: { date: '2026-07-21' }, end: { date: '2026-07-24' },
      })]);
      expect(element.querySelectorAll(selector)).toHaveLength(view.name==='month'?1:3);
      if(view.name==='month') expect(element.querySelector(selector)?.getAttribute('data-mc-month-dates')).toBe('2026-07-21 2026-07-22 2026-07-23');
      unmount(element);
    });

    it(`${view.name}: includes overnight continuation but excludes midnight end`, () => {
      const { element } = mount(view, [occurrence({
        allDay: false,
        start: { dateTime: '2026-07-21T23:00', timeZone: options.timeZone },
        end: { dateTime: '2026-07-23T00:00', timeZone: options.timeZone },
      })]);
      expect(element.querySelectorAll(selector)).toHaveLength(view.name==='month'?1:2);
      if(view.name==='month') expect(element.querySelector(selector)?.getAttribute('data-mc-month-dates')).toBe('2026-07-21 2026-07-22');
      else expect(element.querySelectorAll(selector)[1]?.textContent).toContain('00:00');
      unmount(element);
    });

    it(`${view.name}: projects intervals in the display timezone`, () => {
      const { element } = mount(view, [occurrence({
        allDay: false,
        start: { dateTime: '2026-07-22T01:00', timeZone: 'UTC' },
        end: { dateTime: '2026-07-22T02:00', timeZone: 'UTC' },
      })]);
      const day = view.name === 'month' ? '[data-mc-month-day="2026-07-21"]' : '[data-mc-list-day="2026-07-21"]';
      expect(element.querySelector(day)?.querySelector(selector)?.textContent).toContain('22:00');
      unmount(element);
    });

    it(`${view.name}: activates event callbacks using click, Enter and Space`, () => {
      const item = occurrence({ allDay: true, start: { date: '2026-07-22' }, end: { date: '2026-07-23' } });
      const { element, onEventClick, onDateClick } = mount(view, [item]);
      const event = element.querySelector<HTMLElement>(selector)!;
      expect(event.getAttribute('role')).toBe('button');
      expect(event.tabIndex).toBe(0);
      event.click();
      event.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      event.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(onEventClick).toHaveBeenCalledTimes(3);
      expect(onEventClick).toHaveBeenLastCalledWith(item);
      expect(onDateClick).not.toHaveBeenCalled();
      unmount(element);
    });
  }

  it('Month exposes an independently named date button', () => {
    const { element, onDateClick } = mount(monthView);
    const button = element.querySelector<HTMLButtonElement>('[data-mc-month-day="2026-07-22"] button')!;
    expect(button.getAttribute('aria-label')).toContain('2026');
    button.click();
    expect(onDateClick).toHaveBeenCalledWith('2026-07-22');
    unmount(element);
  });
});

describe('View ranges and formatting', () => {
  for (const createView of [createResourceDayView, createTimelineView]) {
    it(`${createView.name}: updates live resources and preserves React event slots and keyboard activation`, async () => {
      const initial = [{ id: 'room', title: 'Sala original' }];
      const view = createView(initial);
      const item = occurrence({ allDay: false,
        start: { dateTime: '2026-07-22T09:00', timeZone: options.timeZone },
        end: { dateTime: '2026-07-22T10:00', timeZone: options.timeZone },
      });
      item.event.resourceIds = ['room'];
      const onEventClick = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const app = new CalendarApp({ date: '2026-07-22', view: view.name, views: [view],
        events: [item.event], resources: initial, temporal, options, onEventClick,
        renderEvent: (info) => createElement('strong', { 'data-custom-event': true }, `${info.timeLabel} ${info.event.title}`),
      });
      try {
        app.mount(container);
        await app.ready();
        expect(container.querySelector('[data-custom-event]')?.textContent).toBe('09:00 Viagem');
        const segment = container.querySelector<HTMLElement>('[data-mc-event]')!;
        segment.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        segment.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        segment.click();
        expect(onEventClick).toHaveBeenCalledTimes(3);
        app.setResources([{ id: 'room', title: 'Sala atualizada' }, { id: 'new', title: 'Sala nova' }]);
        expect(() => app.setResources([{ id: 'room', title: 'Inválida', capacity: Infinity }])).toThrow(RangeError);
        expect(() => app.setResources([{ id: 'room', title: 'Inválida', bufferAfter: -15 }])).toThrow(RangeError);
        expect(container.textContent).toContain('Sala atualizada');
        expect(container.textContent).toContain('Sala nova');
        expect(container.textContent).not.toContain('Sala original');
        app.setResources([]);
        expect(container.querySelector('[data-mc-event]')).toBeNull();
      } finally {
        app.destroy();
        container.remove();
      }
    });
  }

  for (const view of [dayView, createResourceDayView([{ id: 'room', title: 'Sala' }]), createTimelineView([{ id: 'room', title: 'Sala' }])]) {
    it(`${view.name}: continuation segments expose full-interval editing`, () => {
      const item = occurrence({ allDay: false,
        start: { dateTime: '2026-07-21T23:00', timeZone: options.timeZone },
        end: { dateTime: '2026-07-22T09:00', timeZone: options.timeZone },
      });
      item.event.resourceIds = ['room'];
      const { element, onEventClick } = mount(view, [item]);
      const segment = element.querySelector<HTMLElement>('[data-mc-event]')!;
      expect(segment).not.toBeNull();
      expect(segment.title).toBe('Viagem');
      expect(segment.getAttribute('data-mc-editable')).toBe('true');
      expect(segment.classList.contains('mc-editable')).toBe(true);
      expect(segment.querySelector('[data-mc-resize]')).not.toBeNull();
      segment.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onEventClick).toHaveBeenCalledWith(item);
      const surface = element.querySelector<HTMLElement>('[data-mc-day], [data-mc-slot]')!;
      expect(surface.style.touchAction).toBe('pan-x pan-y');
      unmount(element);
    });
  }

  it('edits intersecting days and excludes the exclusive midnight boundary', () => {
    const { context } = mount(dayView);
    const item = occurrence({ allDay: false,
      start: { dateTime: '2026-07-22T23:00', timeZone: options.timeZone },
      end: { dateTime: '2026-07-23T00:00', timeZone: options.timeZone },
    });
    expect(occurrenceEditableForDay(item, '2026-07-22', context)).toBe(true);
    expect(occurrenceEditableForDay(item, '2026-07-23', context)).toBe(false);
    item.event.time.end.dateTime = '2026-07-23T01:00';
    expect(occurrenceEditableForDay(item, '2026-07-22', context)).toBe(true);
  });

  it('timegrid activates timed events from keyboard and all-day events from click and keyboard', () => {
    const timed = occurrence({ allDay: false,
      start: { dateTime: '2026-07-22T09:00', timeZone: options.timeZone },
      end: { dateTime: '2026-07-22T10:00', timeZone: options.timeZone },
    });
    timed.event.color = '#2563eb';
    const allDay = occurrence({ allDay: true,
      start: { date: '2026-07-22' }, end: { date: '2026-07-23' },
    });
    allDay.masterId = 'holiday';
    const { element, onEventClick } = mount(dayView, [timed, allDay]);
    const timedElement = element.querySelector<HTMLElement>('[data-mc-day] [data-mc-event]')!;
    expect(timedElement.style.backgroundColor).toBe('');
    expect(timedElement.style.boxShadow).toContain('#2563eb');
    expect(timedElement.style.borderLeftWidth).toBe('');
    timedElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onEventClick).toHaveBeenLastCalledWith(timed);
    const allDayElement = element.querySelector<HTMLElement>('[data-mc-allday-event]')!;
    allDayElement.click();
    allDayElement.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onEventClick).toHaveBeenCalledTimes(3);
    expect(onEventClick).toHaveBeenLastCalledWith(allDay);
    unmount(element);
  });

  it('custom agenda navigation advances by its span without snapping back to Monday', () => {
    const view = createListView(3);
    const date = temporal.PlainDate.from('2026-07-22');
    const context = { temporal, dateUtils, options };
    const first = view.getRange(date, context);
    const next = view.getRange(view.navigate('next', date, context), context);
    expect(first.startDate.toString()).toBe('2026-07-22');
    expect(next.startDate.toString()).toBe('2026-07-25');
  });

  it('rejects spans that produce invalid or infinite ranges', () => {
    for (const value of [NaN, Infinity, -1, 0]) {
      expect(() => createListView(value)).toThrow(RangeError);
      expect(() => createNDaysView(value)).toThrow(RangeError);
    }
  });

  it('formats midnight as 00:00 across locales and retains years below 100', () => {
    expect(formatHourLabel(0, 'en-US')).toBe('00:00');
    expect(formatHourLabel(0, 'pt-BR')).toBe('00:00');
    expect(formatDate(temporal.PlainDate.from('0099-01-01'), 'en-US', { year: 'numeric' })).toBe('99');
  });
});


describe('time label density', () => {
  it('honors explicit label intervals and adapts only automatic labels', () => {
    const options = { slotMinutes: 30, pxPerMinute: 1, timeLabelInterval: 30 } as Parameters<typeof timeLabelStep>[0];
    expect(timeLabelStep(options, true)).toBe(30);
    expect(timeLabelStep({ ...options, timeLabelInterval: undefined }, true)).toBe(60);
    expect(timeLabelStep({ ...options, pxPerMinute: 2 }, true)).toBe(30);
    expect(timeLabelStep(options)).toBe(30);
    expect(options.slotMinutes).toBe(30);
  });
});
