import { expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { expandEvent, splitEventSeries, type CalendarEvent } from '../../src/core/index.js';
import { ALL } from './scenarios.js';

const series: CalendarEvent = {
  id: 'old',
  calendarId: 'c',
  title: 'Original',
  resourceIds: ['room'],
  time: { allDay: true, start: { date: '2024-01-01' }, end: { date: '2024-01-03' } },
  recurrence: {
    rule: 'FREQ=DAILY;COUNT=6',
    exDates: ['2024-01-02'],
    rDates: ['2024-01-09'],
    overrides: { '2024-01-03': { cancelled: true }, '2024-01-05': { title: 'Exceção' } },
  },
};
it('a neutral split reconstructs the series across the existing frequency/interval/filter scenarios', () => {
  for (const [name, start, rule] of ALL) {
    const event: CalendarEvent = {
      ...series,
      time: {
        allDay: true,
        start: { date: start },
        end: { date: Temporal.PlainDate.from(start).add({ days: 2 }).toString() },
      },
      recurrence: { rule },
    };
    const original = expandEvent({ temporal: Temporal, event });
    if (!original.length) continue;
    const cut = original[Math.min(2, original.length - 1)]!.originalStart;
    const { before, following } = splitEventSeries({
      temporal: Temporal,
      event,
      originalStart: cut,
      newId: 'new',
    });
    const combined = [
      ...(before ? expandEvent({ temporal: Temporal, event: before }) : []),
      ...expandEvent({ temporal: Temporal, event: following }),
    ];
    expect(
      combined.map((item) => [item.originalStart, item.event.time]),
      name,
    ).toEqual(original.map((item) => [item.originalStart, item.event.time]));
  }
});
it('splits COUNT including excluded/cancelled starts, preserving past and future exceptions and duration', () => {
  const original = structuredClone(series);
  const { before, following } = splitEventSeries({
    temporal: Temporal,
    event: series,
    originalStart: '2024-01-04',
    newId: 'new',
    changes: {
      title: 'Futuro',
      resourceIds: ['other'],
    },
  });
  expect(before!.recurrence!.rule).toMatchObject({ count: 3 });
  expect(following.recurrence!.rule).toMatchObject({ count: 3 });
  expect(
    expandEvent({ temporal: Temporal, event: before! }).map((item) => item.originalStart),
  ).toEqual(['2024-01-01']);
  const future = expandEvent({ temporal: Temporal, event: following });
  expect(future.map((item) => item.originalStart)).toEqual([
    '2024-01-04',
    '2024-01-05',
    '2024-01-06',
    '2024-01-09',
  ]);
  expect(future.map((item) => item.event.title)).toEqual(['Futuro', 'Exceção', 'Futuro', 'Futuro']);
  expect(
    future.every((item) => item.masterId === 'new' && item.event.resourceIds?.[0] === 'other'),
  ).toBe(true);
  expect(future[0]!.event.time.end.date).toBe('2024-01-06');
  expect(series).toEqual(original);
});
it('retimes following keys, UTC exceptions, moved overrides and UNTIL across DST without changing the past', () => {
  const event: CalendarEvent = {
    id: 'old',
    calendarId: 'c',
    title: 'NY',
    time: {
      allDay: false,
      start: { dateTime: '2024-03-08T09:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2024-03-08T10:00:00', timeZone: 'America/New_York' },
    },
    recurrence: {
      rule: 'FREQ=DAILY;UNTIL=20240312T130000Z',
      exDates: ['2024-03-11T13:00:00Z'],
      overrides: {
        '2024-03-12T09:00:00': {
          time: {
            allDay: false,
            start: { dateTime: '2024-03-12T11:00:00', timeZone: 'America/New_York' },
            end: { dateTime: '2024-03-12T12:00:00', timeZone: 'America/New_York' },
          },
        },
      },
    },
  };
  const { before, following } = splitEventSeries({
    temporal: Temporal,
    event,
    originalStart: '2024-03-10T09:00:00',
    newId: 'new',
    changes: {
      time: {
        allDay: false,
        start: { dateTime: '2024-03-10T10:00:00', timeZone: 'America/New_York' },
        end: { dateTime: '2024-03-10T11:00:00', timeZone: 'America/New_York' },
      },
    },
  });
  expect(
    expandEvent({ temporal: Temporal, event: before! }).map((item) => item.originalStart),
  ).toEqual(['2024-03-08T09:00:00', '2024-03-09T09:00:00']);
  const future = expandEvent({ temporal: Temporal, event: following });
  expect(future.map((item) => item.originalStart)).toEqual([
    '2024-03-10T10:00:00',
    '2024-03-12T10:00:00',
  ]);
  expect(future[1]!.event.time.start.dateTime).toBe('2024-03-12T12:00:00');
});
it('supports first/infinite cuts, and rejects cancelled, RDATE-only and incompatible filter cuts', () => {
  const first = splitEventSeries({
    temporal: Temporal,
    event: series,
    originalStart: '2024-01-01',
    newId: 'new',
  });
  expect(first.before).toBeNull();
  const infinite = { ...series, recurrence: { rule: 'FREQ=WEEKLY;INTERVAL=2' } };
  const split = splitEventSeries({
    temporal: Temporal,
    event: infinite,
    originalStart: '2024-01-29',
    newId: 'new',
  });
  expect(
    expandEvent({ temporal: Temporal, event: split.before! }).map((item) => item.originalStart),
  ).toEqual(['2024-01-01', '2024-01-15']);
  expect(
    expandEvent({ temporal: Temporal, event: split.following, window: { end: '2024-03-01' } }).map(
      (item) => item.originalStart,
    ),
  ).toEqual(['2024-01-29', '2024-02-12', '2024-02-26']);
  for (const cut of ['2024-01-02', '2024-01-03', '2024-01-09'])
    expect(() =>
      splitEventSeries({ temporal: Temporal, event: series, originalStart: cut, newId: 'new' }),
    ).toThrow();
  expect(() =>
    splitEventSeries({
      temporal: Temporal,
      event: { ...series, recurrence: { rule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=5' } },
      originalStart: '2024-01-08',
      newId: 'new',
      changes: {
        time: { allDay: true, start: { date: '2024-01-09' }, end: { date: '2024-01-11' } },
      },
    }),
  ).toThrow(/filtros/);
});
