// @vitest-environment jsdom
import { dayView } from '../../src/react/views/timeGridViews.js';
import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { expandRange, type CalendarEvent, type TemporalLike } from '../../src/core/index.js';
import { CalendarApp, type CalendarConfig } from '../../src/react/app/calendarApp.js';
import { createHandle } from '../../src/react/handle.js';

const temporal = Temporal as unknown as TemporalLike;
const referenceDate = '2026-10-09';

function timedEvent(
  id: string,
  startTime: string,
  endTime: string,
  resourceIds = ['room'],
): CalendarEvent {
  return {
    id,
    calendarId: 'appointments',
    title: id,
    resourceIds,
    time: {
      allDay: false,
      start: { dateTime: `${referenceDate}T${startTime}:00`, timeZone: 'UTC' },
      end: { dateTime: `${referenceDate}T${endTime}:00`, timeZone: 'UTC' },
    },
  };
}

async function withCalendar(
  configuration: Omit<CalendarConfig, 'views'>,
  assertions: (app: CalendarApp) => void,
): Promise<void> {
  const app = new CalendarApp({
    views: [dayView],
    temporal,
    date: referenceDate,
    view: 'day',
    options: { timeZone: 'UTC', startHour: 0, endHour: 24 },
    ...configuration,
  });
  try {
    await app.ready();
    assertions(app);
  } finally {
    app.destroy();
  }
}

describe('editor event candidate validation', () => {
  it('rejects calls before Temporal is ready instead of silently skipping capacity', async () => {
    const app = new CalendarApp({ views: [dayView], temporal, date: referenceDate });
    try {
      expect(() => app.evaluateEvent(timedEvent('new', '09:00', '10:00'))).toThrow(
        /evaluateEvent.*ready/,
      );
      await app.ready();
      expect(app.evaluateEvent(timedEvent('new', '09:00', '10:00'))).toEqual({
        valid: true,
        reason: 'ok',
      });
    } finally {
      app.destroy();
    }
  });

  it('validates creation through the public handle against capacity, buffers and global blocks', async () => {
    await withCalendar(
      {
        resources: [{ id: 'room', title: 'Sala', capacity: 1, bufferAfter: 15 }],
        events: [timedEvent('existing', '09:00', '10:00')],
        constraints: {
          blocked: [{ scope: 'time', date: referenceDate, startTime: '13:00', endTime: '14:00' }],
        },
      },
      (app) => {
        const handle = createHandle(app);
        expect(handle.evaluateEvent(timedEvent('new', '09:30', '10:00'))).toEqual({
          valid: false,
          reason: 'over-capacity',
        });
        expect(handle.evaluateEvent(timedEvent('new', '10:00', '10:30'))).toEqual({
          valid: false,
          reason: 'buffer-conflict',
        });
        expect(handle.evaluateEvent(timedEvent('new', '10:15', '10:45'))).toEqual({
          valid: true,
          reason: 'ok',
        });
        expect(handle.evaluateEvent(timedEvent('new', '13:00', '13:30'))).toEqual({
          valid: false,
          reason: 'blocked',
        });
        expect(app.getState().events.map((event) => event.id)).toEqual(['existing']);
      },
    );
  });

  it('excludes the original occurrence while validating every resource assigned to the edited candidate', async () => {
    const series = {
      ...timedEvent('series', '09:00', '10:00', ['room', 'professional']),
      recurrence: { rule: 'FREQ=DAILY;COUNT=2' },
    };
    const professionalAppointment = timedEvent('other', '11:00', '12:00', ['professional']);
    const originalOccurrence = expandRange(
      temporal,
      [series],
      referenceDate,
      referenceDate,
      'UTC',
    )[0]!;
    await withCalendar(
      {
        resources: [
          { id: 'room', title: 'Sala', capacity: false },
          { id: 'professional', title: 'Profissional', capacity: 1 },
        ],
        events: [series, professionalAppointment],
      },
      (app) => {
        const handle = createHandle(app);
        expect(handle.evaluateEvent(originalOccurrence.event, originalOccurrence)).toEqual({
          valid: true,
          reason: 'ok',
        });
        expect(
          handle.evaluateEvent(
            timedEvent('series', '10:00', '11:00', ['room', 'professional']),
            originalOccurrence,
          ),
        ).toEqual({ valid: true, reason: 'ok' });
        expect(
          handle.evaluateEvent(
            timedEvent('series', '11:00', '12:00', ['room', 'professional']),
            originalOccurrence,
          ),
        ).toEqual({ valid: false, reason: 'over-capacity' });
        expect(
          handle.evaluateEvent(
            timedEvent('series', '11:00', '12:00', ['room']),
            originalOccurrence,
          ),
        ).toEqual({ valid: true, reason: 'ok' });
      },
    );
  });

  it('checks every occupied day while leaving an exclusive midnight endpoint unoccupied', async () => {
    await withCalendar(
      {
        constraints: { blocked: [{ scope: 'day', date: '2026-10-10' }] },
      },
      (app) => {
        const allDayCandidate: CalendarEvent = {
          id: 'holiday',
          calendarId: 'personal',
          title: 'Folga',
          time: { allDay: true, start: { date: referenceDate }, end: { date: '2026-10-10' } },
        };
        expect(app.evaluateEvent(allDayCandidate)).toEqual({ valid: true, reason: 'ok' });
        expect(
          app.evaluateEvent({
            ...allDayCandidate,
            time: { ...allDayCandidate.time, end: { date: '2026-10-11' } },
          }),
        ).toEqual({ valid: false, reason: 'blocked' });

        const overnightCandidate = timedEvent('overnight', '22:00', '23:00', []);
        overnightCandidate.time.end = { dateTime: '2026-10-10T00:00:00', timeZone: 'UTC' };
        expect(app.evaluateEvent(overnightCandidate)).toEqual({ valid: true, reason: 'ok' });
        expect(
          app.evaluateEvent({
            ...overnightCandidate,
            time: {
              ...overnightCandidate.time,
              end: { dateTime: '2026-10-10T00:01:00', timeZone: 'UTC' },
            },
          }),
        ).toEqual({ valid: false, reason: 'blocked' });
      },
    );
  });
});
