import { BUILTIN_VIEWS } from '../../src/react/views/index.js';
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import type { CalendarEvent, CalendarResource } from '../../src/core/index.js';
import { createResourceDayView, createTimelineView } from '../../src/react/views/index.js';

const timed = ({
  id,
  start,
  end,
}: {
  /** Fixture event identifier. / PT: Identificador do evento de teste. */
  id: string;
  /** Local start date-time. / PT: Data e hora local inicial. */
  start: string;
  /** Exclusive local end date-time. / PT: Data e hora local final. */
  end: string;
}): CalendarEvent => ({
  id,
  calendarId: 'c',
  title: id,
  resourceIds: ['room'],
  time: {
    allDay: false,
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
  },
});

describe('resource preparation across date boundaries', () => {
  it('renders adjacent preparation in resources and timeline without rendering off-date reservations', async () => {
    const resources: CalendarResource[] = [
      { id: 'room', title: 'Sala', capacity: 1, bufferBefore: 20, bufferAfter: 20 },
    ];
    const events = [
      timed({ id: 'previous', start: '2026-07-22T23:40', end: '2026-07-22T23:50' }),
      timed({ id: 'next', start: '2026-07-24T00:10', end: '2026-07-24T00:20' }),
    ];
    const app = new CalendarApp({
      temporal: Temporal as never,
      date: '2026-07-23',
      view: 'resources',
      resources,
      events,
      views: [...BUILTIN_VIEWS, createResourceDayView(resources), createTimelineView(resources)],
      options: { timeZone: 'UTC', startHour: 0, endHour: 24, pxPerMinute: 1 },
    });
    const host = document.createElement('div');
    document.body.append(host);
    app.mount(host);
    await app.ready();
    try {
      for (const view of ['resources', 'timeline']) {
        app.changeView(view);
        expect(host.querySelectorAll('[data-mc-event]')).toHaveLength(0);
        const bands = Array.from(host.querySelectorAll<HTMLElement>('[data-mc-buffer]'));
        expect(bands).toHaveLength(2);
        expect(
          bands.map((band) =>
            view === 'resources'
              ? [band.style.top, band.style.height]
              : [band.style.left, band.style.width],
          ),
        ).toEqual([
          ['0px', '10px'],
          ['1430px', '10px'],
        ]);
      }
    } finally {
      app.destroy();
      host.remove();
    }
  });
  const cases = [
    {
      title: 'after a reservation ending yesterday',
      bufferAfter: 20,
      bufferBefore: 0,
      event: timed({ id: 'late', start: '2026-07-22T23:40', end: '2026-07-22T23:50' }),
      date: '2026-07-23',
      start: 5,
      end: 15,
      freeStart: 10,
      freeEnd: 20,
    },
    {
      title: 'before a reservation beginning tomorrow',
      bufferAfter: 0,
      bufferBefore: 20,
      event: timed({ id: 'early', start: '2026-07-23T00:10', end: '2026-07-23T00:20' }),
      date: '2026-07-22',
      start: 1435,
      end: 1440,
      freeStart: 1420,
      freeEnd: 1430,
    },
    {
      title: 'candidate preparation reaching into yesterday',
      bufferAfter: 0,
      bufferBefore: 20,
      event: timed({ id: 'late', start: '2026-07-22T23:40', end: '2026-07-22T23:50' }),
      date: '2026-07-23',
      start: 5,
      end: 15,
      freeStart: 10,
      freeEnd: 20,
    },
  ];
  for (const scenario of cases) {
    it(`validates ${scenario.title} outside the visible day, for capacity 1/2/unlimited`, async () => {
      for (const configuration of [
        { capacity: 1, reservations: 1, valid: false },
        { capacity: 2, reservations: 1, valid: true },
        { capacity: 2, reservations: 2, valid: false },
        { capacity: false as const, reservations: 2, valid: true },
      ]) {
        const resource: CalendarResource = {
          id: 'room',
          title: 'Sala',
          capacity: configuration.capacity,
          bufferBefore: scenario.bufferBefore,
          bufferAfter: scenario.bufferAfter,
        };
        const events = Array.from({ length: configuration.reservations }, (_, i) => ({
          ...scenario.event,
          id: `reservation-${i}`,
        }));
        const app = new CalendarApp({
          views: BUILTIN_VIEWS,
          temporal: Temporal as never,
          date: scenario.date,
          view: 'day',
          resources: [resource],
          events,
          options: { timeZone: 'UTC', startHour: 0, endHour: 24 },
        });
        await app.ready();
        try {
          const candidate = {
            dateISO: scenario.date,
            startMin: scenario.start,
            endMin: scenario.end,
            resourceId: 'room',
          };
          expect(app.evaluatePlacement(candidate)).toEqual(
            configuration.valid
              ? { valid: true, reason: 'ok' }
              : { valid: false, reason: 'buffer-conflict' },
          );
          expect(
            app.evaluatePlacement({
              ...candidate,
              startMin: scenario.freeStart,
              endMin: scenario.freeEnd,
            }),
          ).toEqual({ valid: true, reason: 'ok' });
          app.setDate(scenario.event.time.start.dateTime!.slice(0, 10));
          expect(app.evaluatePlacement(candidate).valid).toBe(configuration.valid);
        } finally {
          app.destroy();
        }
      }
    });
  }
});
