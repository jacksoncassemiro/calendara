import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../../src/core/date/temporal.js';
import { parseRRule } from '../../src/core/recurrence/parser.js';
import { expandRuleAll } from '../../src/core/recurrence/engine.js';
import { expandRRuleOracle, expandCalendarRule } from './_oracle.js';
import { ALL } from './scenarios.js';

let temporal: TemporalLike;
beforeAll(async () => {
  temporal = await ensureTemporal();
});

describe('motor de recorrência vs rrule.js (oráculo)', () => {
  for (const [name, startDate, rule] of ALL) {
    it(name, () => {
      expect(
        expandCalendarRule({ temporal, startDateISO: startDate, recurrenceText: rule }),
      ).toEqual(expandRRuleOracle({ startDateISO: startDate, recurrenceText: rule }));
    });
  }
});

describe('regressões de filtros RFC 5545', () => {
  it('seeks a distant daily COUNT window without spending its period budget on history', () => {
    const dates = expandRuleAll({
      temporal,
      model: parseRRule('FREQ=DAILY;COUNT=3000'),
      dtstart: temporal.PlainDate.from('2020-01-01'),
      exDates: new Set(),
      maxResults: 10,
      options: {
        windowStart: temporal.PlainDate.from('2026-01-01'),
        windowEnd: temporal.PlainDate.from('2026-01-02'),
        maxPeriods: 2,
      },
    });
    expect(dates.map((date) => date.toString())).toEqual(['2026-01-01', '2026-01-02']);
    expect(
      expandRuleAll({
        temporal,
        model: parseRRule('FREQ=DAILY;COUNT=3'),
        dtstart: temporal.PlainDate.from('2020-01-01'),
        exDates: new Set(),
        maxResults: 10,
        options: {
          windowStart: temporal.PlainDate.from('2026-01-01'),
          windowEnd: temporal.PlainDate.from('2026-01-02'),
          maxPeriods: 2,
        },
      }),
    ).toEqual([]);
  });
  it('BYYEARDAY combines negative days, leap years and positional selection', () => {
    for (const rule of [
      'FREQ=YEARLY;BYYEARDAY=60,-1;COUNT=8',
      'FREQ=YEARLY;BYYEARDAY=1,60,-1;BYSETPOS=-1;COUNT=5',
    ]) {
      expect(
        expandCalendarRule({
          temporal,
          startDateISO: '2023-01-01',
          recurrenceText: `RRULE:${rule}`,
        }),
      ).toEqual(expandRRuleOracle({ startDateISO: '2023-01-01', recurrenceText: `RRULE:${rule}` }));
    }
    expect(() => parseRRule('FREQ=MONTHLY;BYYEARDAY=60')).toThrow(/YEARLY/);
  });
  const rules = [
    ['2024-01-01', 'FREQ=DAILY;BYMONTHDAY=1,-1;COUNT=6'],
    ['2024-01-01', 'FREQ=YEARLY;BYMONTH=2,6;COUNT=4'],
    ['2024-01-01', 'FREQ=YEARLY;BYDAY=1MO,-1FR;COUNT=4'],
    ['2024-01-01', 'FREQ=MONTHLY;BYDAY=1MO;BYMONTH=2;COUNT=3'],
    ['2024-01-01', 'FREQ=MONTHLY;BYDAY=1MO;BYMONTHDAY=1,2,3;COUNT=3'],
    ['2024-01-15', 'FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1;COUNT=3'],
  ];
  for (const [start, rule] of rules) {
    it(`${start}: ${rule}`, () => {
      expect(
        expandCalendarRule({
          temporal,
          startDateISO: start!,
          recurrenceText: `RRULE:${rule}`,
        }),
      ).toEqual(expandRRuleOracle({ startDateISO: start!, recurrenceText: `RRULE:${rule}` }));
    });
  }
  it('combina entradas BYDAY ordinais e não ordinais como união', () => {
    expect(
      expandCalendarRule({
        temporal,
        startDateISO: '2024-01-01',
        recurrenceText: 'RRULE:FREQ=MONTHLY;BYDAY=1MO,FR;COUNT=10',
      }),
    ).toEqual([
      '2024-01-01',
      '2024-01-05',
      '2024-01-12',
      '2024-01-19',
      '2024-01-26',
      '2024-02-02',
      '2024-02-05',
      '2024-02-09',
      '2024-02-16',
      '2024-02-23',
    ]);
  });
  it('BYSETPOS selecionando a mesma data duas vezes não duplica ocorrência nem COUNT', () => {
    expect(
      expandCalendarRule({
        temporal,
        startDateISO: '2024-01-01',
        recurrenceText: 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYSETPOS=1,-1;COUNT=3',
      }),
    ).toEqual(['2024-01-01', '2024-02-01', '2024-03-01']);
  });
});

describe('janela (lazy) e performance', () => {
  it('salta períodos anteriores sem COUNT preservando fase e BYSETPOS das quatro frequências', () => {
    const rules = [
      'FREQ=DAILY;INTERVAL=3;BYDAY=MO,WE,FR',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO,WE;WKST=SU',
      'FREQ=MONTHLY;INTERVAL=3;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
      'FREQ=YEARLY;INTERVAL=2;BYMONTH=2,6;BYMONTHDAY=-1',
    ];
    for (const rule of rules) {
      const recurrenceRule = parseRRule(`${rule};UNTIL=20271231`);
      const allDates = expandRuleAll({
        temporal,
        model: recurrenceRule,
        dtstart: temporal.PlainDate.from('2010-01-03'),
        exDates: new Set(),
        maxResults: 10000,
      });
      const expectedWindowDates = allDates
        .filter((date) => date.toString() >= '2026-10-07' && date.toString() <= '2027-01-31')
        .map(String);
      const windowDates = expandRuleAll({
        temporal,
        model: recurrenceRule,
        dtstart: temporal.PlainDate.from('2010-01-03'),
        exDates: new Set(),
        maxResults: 10000,
        options: {
          windowStart: temporal.PlainDate.from('2026-10-07'),
          windowEnd: temporal.PlainDate.from('2027-01-31'),
          maxPeriods: 50,
        },
      });
      expect(windowDates.map(String)).toEqual(expectedWindowDates);
    }
  });

  it('não salta COUNT anterior à janela', () => {
    const occurrenceDates = expandRuleAll({
      temporal,
      model: parseRRule('FREQ=DAILY;COUNT=5'),
      dtstart: temporal.PlainDate.from('2010-01-01'),
      exDates: new Set(),
      maxResults: 100,
      options: {
        windowStart: temporal.PlainDate.from('2026-10-01'),
        windowEnd: temporal.PlainDate.from('2026-10-31'),
      },
    });
    expect(occurrenceDates).toEqual([]);
  });
  it('não confunde dias antes da janela com períodos sem candidatos', () => {
    const occurrenceDates = expandRuleAll({
      temporal,
      model: parseRRule('FREQ=DAILY'),
      dtstart: temporal.PlainDate.from('2010-01-01'),
      exDates: new Set(),
      maxResults: 10,
      options: {
        windowStart: temporal.PlainDate.from('2026-10-01'),
        windowEnd: temporal.PlainDate.from('2026-10-03'),
      },
    });
    expect(occurrenceDates.map((date) => date.toString())).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('encerra na janela mesmo quando a regra não possui candidatos', () => {
    const occurrenceDates = expandRuleAll({
      temporal,
      model: parseRRule('FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=30'),
      dtstart: temporal.PlainDate.from('2024-01-01'),
      exDates: new Set(),
      maxResults: 10,
      options: {
        windowEnd: temporal.PlainDate.from('2024-02-29'),
      },
    });
    expect(occurrenceDates).toEqual([]);
    expect(() =>
      expandRuleAll({
        temporal,
        model: parseRRule('FREQ=DAILY;COUNT=999999999'),
        dtstart: temporal.PlainDate.from('2024-01-01'),
        exDates: new Set(),
        maxResults: 100,
        options: { maxPeriods: 2 },
      }),
    ).toThrow(/orçamento de expansão/);
  });
  it('expande regra infinita numa janela de 1 mês rapidamente', () => {
    const recurrenceRule = parseRRule('RRULE:FREQ=DAILY');
    const start = temporal.PlainDate.from('2024-01-01');
    const expansionStartedAt = performance.now();
    const occurrenceDates = expandRuleAll({
      temporal,
      model: recurrenceRule,
      dtstart: start,
      exDates: new Set(),
      maxResults: 10000,
      options: {
        windowStart: temporal.PlainDate.from('2024-06-01'),
        windowEnd: temporal.PlainDate.from('2024-06-30'),
      },
    });
    const expansionDurationMs = performance.now() - expansionStartedAt;
    expect(occurrenceDates).toHaveLength(30);
    expect(occurrenceDates[0]!.toString()).toBe('2024-06-01');
    expect(occurrenceDates[29]!.toString()).toBe('2024-06-30');
    expect(expansionDurationMs).toBeLessThan(500);
  });
});
