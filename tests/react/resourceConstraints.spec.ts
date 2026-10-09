// @vitest-environment jsdom
import { dayView } from '../../src/react/views/timeGridViews.js';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { createResourceDayView, createTimelineView } from '../../src/react/views/index.js';
import type { CalendarEvent, CalendarResource } from '../../src/core/index.js';

const DATE = '2026-07-22';
const resources: CalendarResource[] = [
  {
    id: 'closed-room',
    title: 'Sala fechada',
    constraints: { blocked: [{ date: DATE, scope: 'day' }] },
  },
  {
    id: 'open-room',
    title: 'Sala aberta',
    constraints: {
      allowedRanges: [{ start: DATE, end: DATE, startTime: '10:00', endTime: '16:00' }],
    },
  },
];

describe('resource-specific availability', () => {
  it('keeps placement, resource grid and timeline consistent without closing another room', async () => {
    const app = new CalendarApp({
      temporal: Temporal as never,
      date: DATE,
      view: 'resources',
      resources,
      views: [createResourceDayView(resources), createTimelineView(resources)],
      constraints: { businessHours: [{ daysOfWeek: [3], startTime: '08:00', endTime: '18:00' }] },
      options: { timeZone: 'UTC', startHour: 8, endHour: 18, pxPerMinute: 1 },
    });
    const host = document.createElement('div');
    document.body.append(host);
    app.mount(host);
    await app.ready();
    try {
      const placement = { kind: 'select' as const, dateISO: DATE, startMin: 600, endMin: 630 };
      expect(app.evaluatePlacement({ ...placement, resourceId: 'closed-room' })).toEqual({
        valid: false,
        reason: 'blocked',
      });
      expect(app.evaluatePlacement({ ...placement, resourceId: 'open-room' })).toEqual({
        valid: true,
        reason: 'ok',
      });
      expect(
        app.evaluatePlacement({
          ...placement,
          startMin: 540,
          endMin: 570,
          resourceId: 'open-room',
        }),
      ).toEqual({ valid: false, reason: 'outside-allowed' });
      for (const view of ['resources', 'timeline']) {
        app.changeView(view);
        expect(host.querySelectorAll('[data-mc-blocked]')).toHaveLength(1);
        expect(host.querySelectorAll('[data-mc-nonbusiness]')).toHaveLength(2);
      }
      app.setConstraints({
        blocked: [{ date: DATE, scope: 'time', startTime: '10:00', endTime: '11:00' }],
      });
      expect(app.evaluatePlacement({ ...placement, resourceId: 'open-room' })).toEqual({
        valid: false,
        reason: 'blocked',
      });
    } finally {
      app.destroy();
      host.remove();
    }
  });

  it('checks all resources belonging to a moved event even in a normal day view', async () => {
    const event: CalendarEvent = {
      id: 'reservation',
      calendarId: 'appointments',
      title: 'Consulta',
      resourceIds: ['open-room', 'closed-room'],
      time: {
        allDay: false,
        start: { dateTime: `${DATE}T10:00`, timeZone: 'UTC' },
        end: { dateTime: `${DATE}T10:30`, timeZone: 'UTC' },
      },
    };
    const app = new CalendarApp({
      views: [dayView],
      temporal: Temporal as never,
      date: DATE,
      view: 'day',
      resources,
      events: [event],
      options: { timeZone: 'UTC' },
    });
    await app.ready();
    try {
      const occurrence = {
        event,
        masterId: event.id,
        originalStart: `${DATE}T10:00`,
        isMaster: true,
      };
      expect(
        app.evaluatePlacement({
          kind: 'move',
          dateISO: DATE,
          startMin: 660,
          endMin: 690,
          occurrence,
        }),
      ).toEqual({ valid: false, reason: 'blocked' });
      expect(app.getState().events[0]).toBe(event);
    } finally {
      app.destroy();
    }
  });
});
