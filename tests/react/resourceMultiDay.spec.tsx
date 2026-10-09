// @vitest-environment jsdom
/** @jsxRuntime automatic @jsxImportSource react */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { Temporal } from '@js-temporal/polyfill';
import { Calendar } from '../../src/react/Calendar.js';
import { createResourceView } from '../../src/react/views/ResourceDayView.js';
import { createDateUtils, DEFAULT_OPTIONS, type CalendarEvent } from '../../src/core/index.js';

afterEach(cleanup);
const temporal = Temporal as unknown as never;
const resources = [
  { id: 'room', title: 'Room', capacity: 1, bufferAfter: 15 },
  { id: 'person', title: 'Professional' },
];
const options = { ...DEFAULT_OPTIONS, timeZone: 'UTC', startHour: 8, endHour: 18, nowMs: 0 };
const events: CalendarEvent[] = [
  {
    id: 'long',
    calendarId: 'calendar',
    title: 'Long appointment',
    editable: false,
    resourceIds: ['room'],
    time: {
      allDay: false,
      start: { dateTime: '2026-10-07T17:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-10-08T10:00:00', timeZone: 'UTC' },
    },
  },
  {
    id: 'busy',
    calendarId: 'calendar',
    title: 'Concurrent',
    resourceIds: ['room'],
    time: {
      allDay: false,
      start: { dateTime: '2026-10-08T09:00:00', timeZone: 'UTC' },
      end: { dateTime: '2026-10-08T10:00:00', timeZone: 'UTC' },
    },
  },
  {
    id: 'all-day',
    calendarId: 'calendar',
    title: 'Conference',
    resourceIds: ['person'],
    time: { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-09' } },
  },
];

describe('resource columns across dates', () => {
  it('aligns ranges to configured weeks and navigates by the visible period', () => {
    const view = createResourceView({ days: 7, alignment: 'week' });
    const date = Temporal.PlainDate.from('2026-10-07');
    const context = { temporal, dateUtils: createDateUtils(temporal), options };
    expect(view.getRange(date, context).days.map((day) => day.toString())).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(view.navigate?.({ direction: 'next', date, context }).toString()).toBe('2026-10-14');
    expect(() => createResourceView({ days: 0 })).toThrow(RangeError);
  });

  it.each(['date', 'resource'] as const)(
    'preserves day/resource identity when grouped by %s',
    async (groupBy) => {
      const view = createResourceView({ days: 2, groupBy, name: 'resource-days' });
      const { container } = render(
        <Calendar
          views={[view]}
          resources={resources}
          events={events}
          initialDate="2026-10-07"
          temporal={temporal}
          options={options}
          constraints={{ blocked: [{ scope: 'day', date: '2026-10-08' }] }}
          renderDayHeader={({ defaultContent, dateISO, resourceId }) => (
            <>
              {defaultContent}
              <small data-header-pair={`${dateISO}:${resourceId}`}>Status</small>
            </>
          )}
        />,
      );
      await waitFor(() => expect(container.querySelectorAll('.mc-resource-col')).toHaveLength(4));
      const columns = Array.from(container.querySelectorAll('.mc-resource-col'));
      expect(
        columns.map(
          (column) =>
            `${column.getAttribute('data-mc-slot-date')}:${column.getAttribute('data-mc-slot-resource')}`,
        ),
      ).toEqual(
        groupBy === 'date'
          ? ['2026-10-07:room', '2026-10-07:person', '2026-10-08:room', '2026-10-08:person']
          : ['2026-10-07:room', '2026-10-08:room', '2026-10-07:person', '2026-10-08:person'],
      );
      expect(container.querySelectorAll('[data-header-pair]')).toHaveLength(4);
      expect(container.querySelectorAll('[data-mc-event="long@2026-10-07T17:00:00"]')).toHaveLength(
        2,
      );
      expect(
        container.querySelectorAll(
          '[data-mc-event="long@2026-10-07T17:00:00"][data-mc-editable="false"]',
        ),
      ).toHaveLength(2);
      expect(container.querySelectorAll('[data-mc-event="all-day@2026-10-07"]')).toHaveLength(2);
      const blockedRoom = container.querySelector(
        '[data-mc-slot-date="2026-10-08"][data-mc-slot-resource="room"]',
      );
      expect(blockedRoom?.querySelector('[data-mc-blocked]')).not.toBeNull();
      expect(blockedRoom?.classList.contains('mc-over-capacity')).toBe(true);
      expect(blockedRoom?.querySelector('[data-mc-buffer]')).not.toBeNull();
    },
  );
});
