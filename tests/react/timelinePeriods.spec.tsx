// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { flushSync } from 'react-dom';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import {
  createResourceTimelineView,
  type ResourceTimelineConfig,
} from '../../src/react/views/TimelineView.js';
import type { CalendarEvent, CalendarResource } from '../../src/core/index.js';

const resources: CalendarResource[] = [
  { id: 'a', title: 'Room A', order: 1 },
  { id: 'b', title: 'Room B', order: 2 },
  { id: 'c', title: 'Room C', order: 3 },
];
const events: CalendarEvent[] = [
  {
    id: 'overnight',
    calendarId: 'test',
    title: 'Overnight',
    resourceIds: ['a'],
    time: {
      allDay: false,
      start: { dateTime: '2024-03-09T22:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2024-03-11T02:00:00', timeZone: 'America/New_York' },
    },
  },
  {
    id: 'all-day',
    calendarId: 'test',
    title: 'Conference',
    resourceIds: ['b'],
    time: { allDay: true, start: { date: '2024-03-08' }, end: { date: '2024-03-12' } },
  },
];

async function mountTimeline({
  config,
  date = '2024-03-09',
  visibleResourceIds,
}: {
  /** Factory choices under test. / PT: Escolhas da factory em teste. */
  config: ResourceTimelineConfig;
  /** Reference date, YYYY-MM-DD. / PT: Data de referência, YYYY-MM-DD. */
  date?: string;
  /** Optional visible resources. / PT: Recursos visíveis opcionais. */
  visibleResourceIds?: string[];
}) {
  const view = createResourceTimelineView(config);
  const container = document.createElement('div');
  document.body.append(container);
  const app = new CalendarApp({
    views: [view],
    view: view.name,
    date,
    resources,
    events,
    temporal: Temporal as unknown as never,
    options: {
      timeZone: 'America/New_York',
      startHour: 0,
      endHour: 24,
      weekStart: 'MO',
      ...(visibleResourceIds ? { visibleResourceIds } : {}),
    },
  });
  app.mount(container);
  await app.ready();
  return { app, container };
}

describe('resource timeline civil periods', () => {
  it('aligns weeks to weekStart across daylight saving and preserves overnight fragments', async () => {
    const { app, container } = await mountTimeline({ config: { duration: 'week' } });
    try {
      expect(app.getVisibleRange()).toEqual({ start: '2024-03-04', end: '2024-03-10' });
      expect(container.querySelectorAll('[data-mc-timeline-date]')).toHaveLength(7);
      expect(
        container.querySelectorAll('[data-mc-slot="x"][data-mc-slot-resource="a"]'),
      ).toHaveLength(7);
      const fragments = [...container.querySelectorAll('[data-mc-event^="overnight@"]')];
      expect(fragments).toHaveLength(2);
      expect(
        fragments.map((node) => node.closest('[data-mc-slot]')?.getAttribute('data-mc-slot-date')),
      ).toEqual(['2024-03-09', '2024-03-10']);
      expect(new Set(fragments.map((node) => node.getAttribute('data-mc-event'))).size).toBe(1);
      expect(container.querySelectorAll('[data-mc-event^="all-day@"]')).toHaveLength(3);
      app.next();
      expect(app.getVisibleRange()).toEqual({ start: '2024-03-11', end: '2024-03-17' });
      expect(container.querySelector('[data-mc-event^="overnight@"]')).not.toBeNull();
    } finally {
      app.destroy();
      container.remove();
    }
  });
  it('uses every leap-month date and navigates by civil months', async () => {
    const { app, container } = await mountTimeline({
      config: { duration: 'month' },
      date: '2024-02-29',
    });
    try {
      expect(app.getVisibleRange()).toEqual({ start: '2024-02-01', end: '2024-02-29' });
      expect(container.querySelectorAll('[data-mc-timeline-date]')).toHaveLength(29);
      app.next();
      expect(app.getVisibleRange()).toEqual({ start: '2024-03-01', end: '2024-03-31' });
      expect(container.querySelectorAll('[data-mc-timeline-date]')).toHaveLength(31);
      app.prev();
      expect(app.getVisibleRange().start).toBe('2024-02-01');
    } finally {
      app.destroy();
      container.remove();
    }
  });
  it('windows ordered resources after filtering and supports real group collapse', async () => {
    const { app, container } = await mountTimeline({
      config: {
        duration: 'week',
        groupBy: (resource) => (resource.id === 'c' ? 'Other' : 'Rooms'),
        collapsedGroups: ['Other'],
        resourceWindow: { start: 0, count: 2 },
      },
      visibleResourceIds: ['b', 'c'],
    });
    try {
      expect(
        [...container.querySelectorAll('[data-mc-period-resource]')].map((node) =>
          node.getAttribute('data-mc-period-resource'),
        ),
      ).toEqual(['b']);
      const toggle = container.querySelector(
        '[data-mc-resource-group="Other"] button',
      ) as HTMLButtonElement;
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      flushSync(() => toggle.click());
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(container.querySelector('[data-mc-period-resource="c"]')).not.toBeNull();
    } finally {
      app.destroy();
      container.remove();
    }
  });
});
