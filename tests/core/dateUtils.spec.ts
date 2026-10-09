import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../../src/core/date/temporal.js';
import {
  createDateUtils,
  weekdayCodeToDayOfWeek,
  dayOfWeekToCode,
  jsWeekdayToDayOfWeek,
  dayOfWeekToJs,
  type DateUtils,
} from '../../src/core/date/dateUtils.js';

let temporal: TemporalLike;
let dateUtils: DateUtils;
beforeAll(async () => {
  temporal = await ensureTemporal();
  dateUtils = createDateUtils(temporal);
});

describe('conversões de weekday', () => {
  it('código ↔ dayOfWeek (MO=1..SU=7)', () => {
    expect(weekdayCodeToDayOfWeek('MO')).toBe(1);
    expect(weekdayCodeToDayOfWeek('SU')).toBe(7);
    expect(dayOfWeekToCode(1)).toBe('MO');
    expect(dayOfWeekToCode(7)).toBe('SU');
  });
  it('JS (0=dom) ↔ Temporal dayOfWeek', () => {
    expect(jsWeekdayToDayOfWeek(0)).toBe(7);
    expect(jsWeekdayToDayOfWeek(1)).toBe(1);
    expect(dayOfWeekToJs(7)).toBe(0);
    expect(dayOfWeekToJs(3)).toBe(3);
  });
});

describe('startOfWeek', () => {
  it('semana começando na segunda (default)', () => {
    expect(dateUtils.startOfWeek({ date: temporal.PlainDate.from('2024-01-10') }).toString()).toBe(
      '2024-01-08',
    );
  });
  it('semana começando no domingo', () => {
    expect(
      dateUtils
        .startOfWeek({ date: temporal.PlainDate.from('2024-01-10'), weekStart: 'SU' })
        .toString(),
    ).toBe('2024-01-07');
  });
});

describe('eachDayOfRange', () => {
  it('lista [start,end)', () => {
    const days = dateUtils.eachDayOfRange({
      start: temporal.PlainDate.from('2024-01-01'),
      end: temporal.PlainDate.from('2024-01-04'),
    });
    expect(days.map((date) => date.toString())).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
  });
});

describe('nthWeekdayInMonth', () => {
  it('2ª e 4ª sexta de jan/2024', () => {
    expect(
      dateUtils.nthWeekdayInMonth({ year: 2024, month: 1, dayOfWeek: 5, ordinal: 2 })!.toString(),
    ).toBe('2024-01-12');
    expect(
      dateUtils.nthWeekdayInMonth({ year: 2024, month: 1, dayOfWeek: 5, ordinal: 4 })!.toString(),
    ).toBe('2024-01-26');
  });
  it('última segunda de jan/2024', () => {
    expect(
      dateUtils.nthWeekdayInMonth({ year: 2024, month: 1, dayOfWeek: 1, ordinal: -1 })!.toString(),
    ).toBe('2024-01-29');
  });
  it('5ª quarta inexistente (fev/2024) → null', () => {
    expect(
      dateUtils.nthWeekdayInMonth({ year: 2024, month: 2, dayOfWeek: 3, ordinal: 5 }),
    ).toBeNull();
  });
});

describe('epochMsInZone', () => {
  it('interprets the DST transition in the supplied timezone', () => {
    const dateTime = temporal.PlainDateTime.from('2024-03-10T01:30:00');
    const timeZone = 'America/New_York';
    const before = dateUtils.epochMsInZone({ dateTime, timeZone });
    const after = dateUtils.epochMsInZone({
      dateTime: temporal.PlainDateTime.from('2024-03-10T03:30:00'),
      timeZone,
    });
    expect(after - before).toBe(60 * 60 * 1000);
    expect(before).toBe(Date.parse('2024-03-10T06:30:00Z'));
  });
});
