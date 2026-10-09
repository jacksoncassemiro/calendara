import { beforeAll, describe, expect, it } from 'vitest';
import rrulePackage from 'rrule';
import { ensureTemporal, type TemporalLike } from '../../src/core/date/temporal.js';
import {
  parseRRule,
  serializeRRule,
  validateRRuleModel,
} from '../../src/core/recurrence/parser.js';
import { expandEvent } from '../../src/core/recurrence/recurrenceSet.js';
import type { CalendarEvent } from '../../src/core/types/index.js';

let temporal: TemporalLike;
beforeAll(async () => {
  temporal = await ensureTemporal();
});
function event({
  rule,
  start = '2024-01-01T09:15:30',
  zone = 'UTC',
}: {
  rule: string;
  start?: string;
  zone?: string;
}): CalendarEvent {
  return {
    id: 'r',
    calendarId: 'c',
    title: 'RFC',
    time: {
      allDay: false,
      start: { dateTime: start, timeZone: zone },
      end: {
        dateTime: temporal.PlainDateTime.from(start).add({ hours: 1 }).toString(),
        timeZone: zone,
      },
    },
    recurrence: { rule },
  };
}

describe('additional RFC recurrence coverage', () => {
  for (const rule of [
    'FREQ=YEARLY;BYWEEKNO=1;COUNT=30',
    'FREQ=YEARLY;BYWEEKNO=-1;COUNT=30',
    'FREQ=YEARLY;BYWEEKNO=53;BYDAY=MO;COUNT=4',
    'FREQ=YEARLY;BYWEEKNO=1,-1;BYDAY=SU;WKST=SU;COUNT=12',
    'FREQ=YEARLY;INTERVAL=2;BYWEEKNO=1;BYMONTH=12;COUNT=3',
    'FREQ=YEARLY;BYWEEKNO=1,-1;BYSETPOS=-1;COUNT=5',
    'FREQ=SECONDLY;INTERVAL=17;COUNT=20',
    'FREQ=MINUTELY;INTERVAL=90;BYSECOND=0,30;COUNT=20',
    'FREQ=HOURLY;INTERVAL=3;BYMINUTE=0,30;BYSECOND=10,20;COUNT=20',
    'FREQ=DAILY;BYHOUR=8,12,18;BYMINUTE=0,30;COUNT=20',
    'FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=8,17;BYSETPOS=-1;COUNT=8',
    'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9,17;BYSETPOS=-1;COUNT=8',
    'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;BYHOUR=10,15;COUNT=6',
    'FREQ=HOURLY;BYYEARDAY=1;COUNT=10',
    'FREQ=SECONDLY;BYHOUR=23;BYMINUTE=59;BYSECOND=0,30;COUNT=4',
    'FREQ=DAILY;BYHOUR=9,15;UNTIL=20240103T090000Z',
  ]) {
    it(`matches an independent UTC oracle: ${rule}`, () => {
      const start = '2024-01-01T09:15:30';
      const options = rrulePackage.RRule.parseString(rule);
      options.dtstart = new Date(`${start}Z`);
      const expected = new rrulePackage.RRule(options)
        .all()
        .map((date) => temporal.PlainDateTime.from(date.toISOString().slice(0, 19)).toString());
      expect(
        expandEvent({ temporal, event: event({ rule: rule, start: start }) }).map(
          (occurrence) => occurrence.originalStart,
        ),
      ).toEqual(expected);
      expect(parseRRule(serializeRRule(parseRRule(rule)))).toEqual(parseRRule(rule));
    });
  }
  it('skips a spring gap before COUNT, preserves duration, and uses first fold occurrence', () => {
    const spring = expandEvent({
      temporal,
      event: event({
        rule: 'FREQ=HOURLY;COUNT=4',
        start: '2024-03-10T00:30:00',
        zone: 'America/New_York',
      }),
    });
    expect(spring.map((occurrence) => occurrence.originalStart)).toEqual([
      '2024-03-10T00:30:00',
      '2024-03-10T01:30:00',
      '2024-03-10T03:30:00',
      '2024-03-10T04:30:00',
    ]);
    expect(spring[2]!.event.time.end.dateTime).toBe('2024-03-10T04:30:00');
    const fall = expandEvent({
      temporal,
      event: event({
        rule: 'FREQ=HOURLY;COUNT=4',
        start: '2024-11-03T00:30:00',
        zone: 'America/New_York',
      }),
    });
    expect(fall.map((occurrence) => occurrence.originalStart)).toEqual([
      '2024-11-03T00:30:00',
      '2024-11-03T01:30:00',
      '2024-11-03T02:30:00',
      '2024-11-03T03:30:00',
    ]);
  });
  it('selects BYSETPOS after removing a nonexistent expanded local time', () => {
    expect(
      expandEvent({
        temporal,
        event: event({
          rule: 'FREQ=DAILY;BYHOUR=1,2,3;BYMINUTE=30;BYSETPOS=2;COUNT=2',
          start: '2024-03-10T00:30:00',
          zone: 'America/New_York',
        }),
      }).map((occurrence) => occurrence.originalStart),
    ).toEqual(['2024-03-10T03:30:00', '2024-03-11T02:30:00']);
  });
  it('keeps intraday BYSETPOS inside each hour, including an empty initial hour', () => {
    expect(
      expandEvent({
        temporal,
        event: event({ rule: 'FREQ=HOURLY;BYHOUR=10,13;BYMINUTE=30;BYSETPOS=-1;COUNT=4' }),
      }).map((occurrence) => occurrence.originalStart),
    ).toEqual([
      '2024-01-01T10:30:30',
      '2024-01-01T13:30:30',
      '2024-01-02T10:30:30',
      '2024-01-02T13:30:30',
    ]);
  });
  it('skips excluded days and hours in minute rules while retaining minute phase', () => {
    expect(
      expandEvent({
        temporal,
        event: event({ rule: 'FREQ=MINUTELY;BYDAY=FR;BYHOUR=16;BYSECOND=5;COUNT=3' }),
      }).map((occurrence) => occurrence.originalStart),
    ).toEqual(['2024-01-05T16:00:05', '2024-01-05T16:01:05', '2024-01-05T16:02:05']);
  });
  it('finds an intraday occurrence moved from outside the requested window', () => {
    const source = event({ rule: 'FREQ=HOURLY;COUNT=4' });
    source.recurrence!.overrides = {
      '2024-01-01T10:15:30': {
        time: {
          allDay: false,
          start: { dateTime: '2024-02-01T14:00:00', timeZone: 'UTC' },
          end: { dateTime: '2024-02-01T15:00:00', timeZone: 'UTC' },
        },
      },
    };
    const moved = expandEvent({
      temporal,
      event: source,
      window: { start: '2024-02-01', end: '2024-02-01' },
    });
    expect(moved.map((occurrence) => occurrence.originalStart)).toEqual(['2024-01-01T10:15:30']);
    expect(moved[0]!.event.time.start.dateTime).toBe('2024-02-01T14:00:00');
  });
  it('seeks distant intraday windows while preserving interval phase', () => {
    const occurrences = expandEvent({
      temporal,
      event: event({ rule: 'FREQ=MINUTELY;INTERVAL=90' }),
      window: { start: '2030-01-01', end: '2030-01-01' },
    });
    const options = rrulePackage.RRule.parseString('FREQ=MINUTELY;INTERVAL=90');
    options.dtstart = new Date('2024-01-01T09:15:30Z');
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual(
      new rrulePackage.RRule(options)
        .between(new Date('2030-01-01T00:00:00Z'), new Date('2030-01-01T23:59:59Z'), true)
        .map((date) => temporal.PlainDateTime.from(date.toISOString().slice(0, 19)).toString()),
    );
  });
  it('rejects unsupported and RFC-invalid rules instead of dropping their meaning', () => {
    for (const rule of [
      'FREQ=DAILY;COUNT=3;UNTIL=20240104',
      'FREQ=DAILY;BYDAY=1MO',
      'FREQ=WEEKLY;BYMONTHDAY=1',
      'FREQ=MONTHLY;BYWEEKNO=1',
      'FREQ=YEARLY;BYWEEKNO=1;BYDAY=1MO',
      'FREQ=MONTHLY;BYSETPOS=1',
      'FREQ=DAILY;BYSECOND=60',
    ])
      expect(() => parseRRule(rule)).toThrow(RangeError);
    expect(() => validateRRuleModel({ freq: 'DAILY', unsupported: [1] } as never)).toThrow(
      /não suportado/,
    );
  });
  it('ignores all-day time filters and serializes an offset UNTIL without changing its instant', () => {
    const source = event({ rule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=30;COUNT=2' });
    source.time = { allDay: true, start: { date: '2024-01-01' }, end: { date: '2024-01-02' } };
    expect(
      expandEvent({ temporal, event: source }).map((occurrence) => occurrence.originalStart),
    ).toEqual(['2024-01-01', '2024-01-02']);
    expect(serializeRRule({ freq: 'DAILY', until: '2024-01-01T09:00:00+03:00' })).toBe(
      'FREQ=DAILY;UNTIL=20240101T060000Z',
    );
  });
});
