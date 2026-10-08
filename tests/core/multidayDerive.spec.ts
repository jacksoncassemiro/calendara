import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { expandRange, buildDays, resourceBusyIntervals } from '../../src/core/render/derive.js';
import { buildResourceColumns } from '../../src/core/render/resourceDerive.js';
import type { CalendarEvent } from '../../src/core/types/event.js';

const TZ = 'America/Sao_Paulo';
const grid = { startHour: 0, endHour: 24 };
function timed(start: string, end: string, timeZone = TZ): CalendarEvent {
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
      timed('2026-07-21T23:40', '2026-07-21T23:50'),
      { ...timed('2026-07-23T00:10', '2026-07-23T00:20'), id: 'next' },
      { ...timed('2026-07-21T19:00', '2026-07-23T09:00'), id: 'shift' },
    ];
    const occurrences = expandRange(Temporal, events, '2026-07-21', '2026-07-23', TZ);
    const resource = { id: 'r', title: 'Sala', bufferBefore: 20, bufferAfter: 20 };
    const columns = buildResourceColumns(
      Temporal,
      [resource],
      Temporal.PlainDate.from('2026-07-22'),
      occurrences,
      {},
      grid,
      TZ,
    );
    expect(columns[0]!.day.timed.map((event) => event.id.split('@')[0])).toEqual(['shift']);
    expect(columns[0]!.bufferSegments).toEqual([
      { startMin: 0, endMin: 10 },
      { startMin: 1430, endMin: 1440 },
    ]);
    const shiftOnly = occurrences.filter((occurrence) => occurrence.masterId === 'shift');
    expect(
      buildResourceColumns(
        Temporal,
        [resource],
        Temporal.PlainDate.from('2026-07-22'),
        shiftOnly,
        {},
        grid,
        TZ,
      )[0]!.bufferSegments,
    ).toEqual([]);
  });
  it('keeps adjacent dates untrimmed for occupancy while visual days stay clipped', () => {
    const events = [
      timed('2026-07-21T23:40', '2026-07-21T23:50'),
      { ...timed('2026-07-23T00:10', '2026-07-23T00:20'), id: 'next' },
    ];
    const occurrences = expandRange(Temporal, events, '2026-07-21', '2026-07-23', TZ);
    const day = Temporal.PlainDate.from('2026-07-22');
    expect(buildDays(Temporal, [day], occurrences, {}, grid, TZ)[0]!.timed).toHaveLength(0);
    expect(resourceBusyIntervals(Temporal, day, occurrences, TZ)).toEqual([
      { startMin: -20, endMin: -10 },
      { startMin: 1450, endMin: 1460 },
    ]);
  });
  it('includes a timed continuation starting before the range and excludes midnight end', () => {
    const event = timed('2026-07-20T22:00', '2026-07-22T00:00');
    const occurrences = expandRange(Temporal, [event], '2026-07-21', '2026-07-22', TZ);
    expect(occurrences).toHaveLength(1);
    const days = buildDays(
      Temporal,
      [Temporal.PlainDate.from('2026-07-21'), Temporal.PlainDate.from('2026-07-22')],
      occurrences,
      {},
      grid,
      TZ,
    );
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
    const occurrences = expandRange(Temporal, [event], '2026-07-20', '2026-07-22');
    const days = buildDays(
      Temporal,
      ['2026-07-20', '2026-07-21', '2026-07-22'].map((date) => Temporal.PlainDate.from(date)),
      occurrences,
      {},
      grid,
      TZ,
    );
    expect(days.map((day) => day.allDay.length)).toEqual([1, 1, 0]);
  });
  it('includes recurring continuations even when their original start is outside the window', () => {
    const event = {
      ...timed('2026-07-01T23:00', '2026-07-02T02:00'),
      recurrence: { rule: 'FREQ=DAILY;COUNT=30' },
    };
    const occurrences = expandRange(Temporal, [event], '2026-07-22', '2026-07-22', TZ);
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2026-07-21T23:00:00',
      '2026-07-22T23:00:00',
    ]);
    const days = buildDays(
      Temporal,
      [Temporal.PlainDate.from('2026-07-22')],
      occurrences,
      {},
      grid,
      TZ,
    );
    expect(days[0]!.timed.map(({ startMin, endMin }) => [startMin, endMin])).toEqual([
      [0, 120],
      [1380, 1440],
    ]);
  });
  it('queries events from the next source date when they fall in the display date', () => {
    const event = timed('2026-07-23T01:00', '2026-07-23T02:00', 'UTC');
    expect(expandRange(Temporal, [event], '2026-07-22', '2026-07-22', TZ)).toHaveLength(1);
    expect(expandRange(Temporal, [event], '2026-07-23', '2026-07-23', TZ)).toHaveLength(0);
  });
  it('clips resource buffers to visible hours even when the event is outside the grid', () => {
    const events = [
      timed('2026-07-22T06:00', '2026-07-22T07:50'),
      { ...timed('2026-07-22T18:10', '2026-07-22T19:00'), id: 'late' },
    ];
    const occurrences = expandRange(Temporal, events, '2026-07-22', '2026-07-22', TZ);
    const columns = buildResourceColumns(
      Temporal,
      [{ id: 'r', title: 'Sala', bufferBefore: 20, bufferAfter: 20 }],
      Temporal.PlainDate.from('2026-07-22'),
      occurrences,
      {},
      { startHour: 8, endHour: 18 },
      TZ,
    );
    expect(columns[0]!.bufferSegments).toEqual([
      { startMin: 480, endMin: 490 },
      { startMin: 1070, endMin: 1080 },
    ]);
  });
});
