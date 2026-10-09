import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { expandRange, buildDays, resourceBusyIntervals } from '../../src/core/render/derive.js';
import { buildResourceColumns } from '../../src/core/render/resourceDerive.js';
import type { CalendarEvent } from '../../src/core/types/event.js';

const TZ = 'America/Sao_Paulo';
const grid = { startHour: 0, endHour: 24 };
function timed({
  start,
  end,
  timeZone = TZ,
}: {
  /** Local start date-time. / PT: Data e hora local inicial. */
  start: string;
  /** Exclusive local end date-time. / PT: Data e hora local final. */
  end: string;
  /** Zone for both endpoints. / PT: Fuso dos dois limites. */
  timeZone?: string;
}): CalendarEvent {
  return {
    id: 'night',
    calendarId: 'c',
    title: 'Plantão',
    resourceIds: ['r'],
    time: {
      allDay: false,
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
    },
  };
}
describe('visible interval projection', () => {
  it('projects adjacent buffers but does not invent preparation at multiday continuations', () => {
    const events = [
      timed({ start: '2026-07-21T23:40', end: '2026-07-21T23:50' }),
      { ...timed({ start: '2026-07-23T00:10', end: '2026-07-23T00:20' }), id: 'next' },
      { ...timed({ start: '2026-07-21T19:00', end: '2026-07-23T09:00' }), id: 'shift' },
    ];
    const occurrences = expandRange({
      temporal: Temporal,
      events,
      startISO: '2026-07-21',
      endISO: '2026-07-23',
      displayTimeZone: TZ,
    });
    const resource = { id: 'r', title: 'Sala', bufferBefore: 20, bufferAfter: 20 };
    const columns = buildResourceColumns({
      temporal: Temporal,
      resources: [resource],
      day: Temporal.PlainDate.from('2026-07-22'),
      occurrences,
      globalConstraints: {},
      grid,
      displayTimeZone: TZ,
    });
    expect(columns[0]!.day.timed.map((event) => event.id.split('@')[0])).toEqual(['shift']);
    expect(columns[0]!.bufferSegments).toEqual([
      { startMin: 0, endMin: 10 },
      { startMin: 1430, endMin: 1440 },
    ]);
    const shiftOnly = occurrences.filter((occurrence) => occurrence.masterId === 'shift');
    expect(
      buildResourceColumns({
        temporal: Temporal,
        resources: [resource],
        day: Temporal.PlainDate.from('2026-07-22'),
        occurrences: shiftOnly,
        globalConstraints: {},
        grid,
        displayTimeZone: TZ,
      })[0]!.bufferSegments,
    ).toEqual([]);
  });
  it('keeps adjacent dates untrimmed for occupancy while visual days stay clipped', () => {
    const events = [
      timed({ start: '2026-07-21T23:40', end: '2026-07-21T23:50' }),
      { ...timed({ start: '2026-07-23T00:10', end: '2026-07-23T00:20' }), id: 'next' },
    ];
    const occurrences = expandRange({
      temporal: Temporal,
      events,
      startISO: '2026-07-21',
      endISO: '2026-07-23',
      displayTimeZone: TZ,
    });
    const day = Temporal.PlainDate.from('2026-07-22');
    expect(
      buildDays({
        temporal: Temporal,
        days: [day],
        occurrences,
        constraints: {},
        grid,
        displayTimeZone: TZ,
      })[0]!.timed,
    ).toHaveLength(0);
    expect(
      resourceBusyIntervals({
        temporal: Temporal,
        day,
        occurrences,
        displayTimeZone: TZ,
      }),
    ).toEqual([
      { startMin: -20, endMin: -10 },
      { startMin: 1450, endMin: 1460 },
    ]);
  });
  it('includes a timed continuation starting before the range and excludes midnight end', () => {
    const event = timed({ start: '2026-07-20T22:00', end: '2026-07-22T00:00' });
    const occurrences = expandRange({
      temporal: Temporal,
      events: [event],
      startISO: '2026-07-21',
      endISO: '2026-07-22',
      displayTimeZone: TZ,
    });
    expect(occurrences).toHaveLength(1);
    const days = buildDays({
      temporal: Temporal,
      days: [Temporal.PlainDate.from('2026-07-21'), Temporal.PlainDate.from('2026-07-22')],
      occurrences,
      constraints: {},
      grid,
      displayTimeZone: TZ,
    });
    expect(days[0]!.timed.map(({ startMin, endMin }) => [startMin, endMin])).toEqual([[0, 1440]]);
    expect(days[1]!.timed).toHaveLength(0);
  });
  it('spreads all-day events across dates using an exclusive end', () => {
    const event: CalendarEvent = {
      id: 'a',
      calendarId: 'c',
      title: 'Férias',
      time: {
        allDay: true,
        start: { date: '2026-07-19' },
        end: { date: '2026-07-22' },
      },
    };
    const occurrences = expandRange({
      temporal: Temporal,
      events: [event],
      startISO: '2026-07-20',
      endISO: '2026-07-22',
    });
    const days = buildDays({
      temporal: Temporal,
      days: ['2026-07-20', '2026-07-21', '2026-07-22'].map((date) => Temporal.PlainDate.from(date)),
      occurrences,
      constraints: {},
      grid,
      displayTimeZone: TZ,
    });
    expect(days.map((day) => day.allDay.length)).toEqual([1, 1, 0]);
  });
  it('includes recurring continuations even when their original start is outside the window', () => {
    const event = {
      ...timed({ start: '2026-07-01T23:00', end: '2026-07-02T02:00' }),
      recurrence: { rule: 'FREQ=DAILY;COUNT=30' },
    };
    const occurrences = expandRange({
      temporal: Temporal,
      events: [event],
      startISO: '2026-07-22',
      endISO: '2026-07-22',
      displayTimeZone: TZ,
    });
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2026-07-21T23:00:00',
      '2026-07-22T23:00:00',
    ]);
    const days = buildDays({
      temporal: Temporal,
      days: [Temporal.PlainDate.from('2026-07-22')],
      occurrences,
      constraints: {},
      grid,
      displayTimeZone: TZ,
    });
    expect(days[0]!.timed.map(({ startMin, endMin }) => [startMin, endMin])).toEqual([
      [0, 120],
      [1380, 1440],
    ]);
  });
  it('queries events from the next source date when they fall in the display date', () => {
    const event = timed({ start: '2026-07-23T01:00', end: '2026-07-23T02:00', timeZone: 'UTC' });
    expect(
      expandRange({
        temporal: Temporal,
        events: [event],
        startISO: '2026-07-22',
        endISO: '2026-07-22',
        displayTimeZone: TZ,
      }),
    ).toHaveLength(1);
    expect(
      expandRange({
        temporal: Temporal,
        events: [event],
        startISO: '2026-07-23',
        endISO: '2026-07-23',
        displayTimeZone: TZ,
      }),
    ).toHaveLength(0);
  });
  it('clips resource buffers to visible hours even when the event is outside the grid', () => {
    const events = [
      timed({ start: '2026-07-22T06:00', end: '2026-07-22T07:50' }),
      { ...timed({ start: '2026-07-22T18:10', end: '2026-07-22T19:00' }), id: 'late' },
    ];
    const occurrences = expandRange({
      temporal: Temporal,
      events,
      startISO: '2026-07-22',
      endISO: '2026-07-22',
      displayTimeZone: TZ,
    });
    const columns = buildResourceColumns({
      temporal: Temporal,
      resources: [{ id: 'r', title: 'Sala', bufferBefore: 20, bufferAfter: 20 }],
      day: Temporal.PlainDate.from('2026-07-22'),
      occurrences,
      globalConstraints: {},
      grid: { startHour: 8, endHour: 18 },
      displayTimeZone: TZ,
    });
    expect(columns[0]!.bufferSegments).toEqual([
      { startMin: 480, endMin: 490 },
      { startMin: 1070, endMin: 1080 },
    ]);
  });
});
