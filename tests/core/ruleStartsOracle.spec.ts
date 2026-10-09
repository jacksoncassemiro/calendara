import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { RRuleTemporal } from 'rrule-temporal';
import { ruleStarts } from '../../src/core/recurrence/ruleStarts.js';
import { parseRRule } from '../../src/core/recurrence/parser.js';
import type { CalendarEvent } from '../../src/core/types/index.js';
import { ALL } from './scenarios.js';

interface TimedRuleCase {
  start: string;
  rule: string;
  zone: string;
  window?: { start?: string; end?: string };
}

function starts({ start, rule, zone, window = {} }: TimedRuleCase) {
  const event: CalendarEvent = {
    id: 'series',
    calendarId: 'calendar',
    title: 'Recurrence',
    time: {
      allDay: false,
      start: { dateTime: start, timeZone: zone },
      end: {
        dateTime: Temporal.PlainDateTime.from(start).add({ hours: 1 }).toString(),
        timeZone: zone,
      },
    },
  };
  return ruleStarts({ temporal: Temporal, event, model: parseRRule(rule), window });
}

/** Independent former provider; retained only in development.
 * @remarks Português: Motor anterior independente, mantido apenas em desenvolvimento.
 */
function oracle({ start, rule, zone, window = {} }: TimedRuleCase) {
  const model = parseRRule(rule);
  const anchor = Temporal.PlainDateTime.from(start).toZonedDateTime(zone);
  const descriptor = (value: typeof anchor) => ({
    timeZoneId: zone,
    toString: () => value.toString(),
  });
  const until = model.until
    ? model.until.length === 10
      ? Temporal.PlainDate.from(model.until)
          .toPlainDateTime('23:59:59.999999999')
          .toZonedDateTime(zone)
      : /(?:Z|[+-]\d{2}:\d{2})$/i.test(model.until)
        ? Temporal.Instant.from(model.until).toZonedDateTimeISO(zone)
        : Temporal.PlainDateTime.from(model.until).toZonedDateTime(zone)
    : undefined;
  const provider = new RRuleTemporal({
    dtstart: descriptor(anchor),
    freq: model.freq,
    interval: model.interval,
    count: model.count,
    until: until ? descriptor(until) : undefined,
    byDay: model.byDay?.map(({ ordinal, weekday }) => `${ordinal ?? ''}${weekday}`),
    byMonth: model.byMonth,
    byMonthDay: model.byMonthDay,
    byYearDay: model.byYearDay,
    bySetPos: model.bySetPos,
    wkst: model.weekStart,
    cache: false,
  });
  const lower = window.start
    ? Temporal.PlainDate.from(window.start).toPlainDateTime('00:00').toZonedDateTime(zone)
    : anchor;
  const upper = window.end
    ? Temporal.PlainDate.from(window.end)
        .add({ days: 1 })
        .toPlainDateTime('00:00')
        .toZonedDateTime(zone)
        .subtract({ nanoseconds: 1 })
    : undefined;
  return (upper ? provider.between(descriptor(lower), descriptor(upper), true) : provider.all())
    .filter((value) => value.epochNanoseconds >= lower.epochNanoseconds)
    .map((value) => value.toPlainDateTime().toString());
}

describe('civil recurrence against independent zoned provider', () => {
  for (const zone of ['UTC', 'America/New_York', 'Australia/Lord_Howe']) {
    for (const [name, date, rule] of ALL) {
      if (name.includes('Impossible')) continue;
      it(`${zone}: ${name}`, () => {
        const input = { start: `${date}T09:00:00`, rule, zone };
        expect(starts(input)).toEqual(oracle(input));
      });
    }
  }
  for (const input of [
    { start: '2024-03-09T02:30:00', rule: 'FREQ=DAILY;COUNT=3', zone: 'America/New_York' },
    {
      start: '2024-03-09T02:30:00',
      rule: 'FREQ=DAILY;COUNT=3',
      zone: 'America/New_York',
      window: { start: '2024-03-12', end: '2024-03-20' },
    },
    {
      start: '2024-11-02T01:30:00',
      rule: 'FREQ=DAILY;UNTIL=20241103T061500Z',
      zone: 'America/New_York',
    },
    {
      start: '2024-01-01T23:30:00',
      rule: 'FREQ=DAILY;UNTIL=20240103T020000Z',
      zone: 'America/New_York',
    },
    { start: '2011-12-29T09:00:00', rule: 'FREQ=DAILY;COUNT=3', zone: 'Pacific/Apia' },
  ]) {
    it(`zoned boundary: ${JSON.stringify(input)}`, () => {
      expect(starts(input)).toEqual(oracle(input));
    });
  }
  it('filters nonexistent local times before selecting the second Sunday', () => {
    expect(
      starts({
        start: '2024-03-01T02:30:00',
        rule: 'FREQ=MONTHLY;BYDAY=SU;BYSETPOS=2;COUNT=1',
        zone: 'America/New_York',
      }),
    ).toEqual(['2024-03-17T02:30:00']);
  });
});
