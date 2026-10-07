import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../../src/core/date/temporal.js';
import { parseRRule } from '../../src/core/recurrence/parser.js';
import { expandRuleAll } from '../../src/core/recurrence/engine.js';
import { oracle, ours } from './_oracle.js';
import { ALL } from './scenarios.js';

let T: TemporalLike;
beforeAll(async () => {
  T = await ensureTemporal();
});

describe('motor de recorrência vs rrule.js (oráculo)', () => {
  for (const [name, dtstart, rule] of ALL) {
    it(name, () => {
      expect(ours(T, dtstart, rule)).toEqual(oracle(dtstart, rule));
    });
  }
});

describe('regressões de filtros RFC 5545', () => {
  it('seeks a distant daily COUNT window without spending its period budget on history', () => {
    const dates=expandRuleAll(T,parseRRule('FREQ=DAILY;COUNT=3000'),T.PlainDate.from('2020-01-01'),new Set(),10,
      {windowStart:T.PlainDate.from('2026-01-01'),windowEnd:T.PlainDate.from('2026-01-02'),maxPeriods:2});
    expect(dates.map(date=>date.toString())).toEqual(['2026-01-01','2026-01-02']);
    expect(expandRuleAll(T,parseRRule('FREQ=DAILY;COUNT=3'),T.PlainDate.from('2020-01-01'),new Set(),10,
      {windowStart:T.PlainDate.from('2026-01-01'),windowEnd:T.PlainDate.from('2026-01-02'),maxPeriods:2})).toEqual([]);
  });
  it('BYYEARDAY combines negative days, leap years and positional selection', () => {
    for (const rule of ['FREQ=YEARLY;BYYEARDAY=60,-1;COUNT=8', 'FREQ=YEARLY;BYYEARDAY=1,60,-1;BYSETPOS=-1;COUNT=5']) {
      expect(ours(T, '2023-01-01', `RRULE:${rule}`)).toEqual(oracle('2023-01-01', `RRULE:${rule}`));
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
      expect(ours(T, start!, `RRULE:${rule}`)).toEqual(oracle(start!, `RRULE:${rule}`));
    });
  }
  it('combina entradas BYDAY ordinais e não ordinais como união', () => {
    expect(ours(T, '2024-01-01', 'RRULE:FREQ=MONTHLY;BYDAY=1MO,FR;COUNT=10')).toEqual([
      '2024-01-01', '2024-01-05', '2024-01-12', '2024-01-19', '2024-01-26',
      '2024-02-02', '2024-02-05', '2024-02-09', '2024-02-16', '2024-02-23',
    ]);
  });
  it('BYSETPOS selecionando a mesma data duas vezes não duplica ocorrência nem COUNT', () => {
    expect(ours(T, '2024-01-01', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYSETPOS=1,-1;COUNT=3')).toEqual([
      '2024-01-01', '2024-02-01', '2024-03-01',
    ]);
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
      const model = parseRRule(`${rule};UNTIL=20271231`);
      const full = expandRuleAll(T, model, T.PlainDate.from('2010-01-03'), new Set(), 10000);
      const expected = full.filter((date) => date.toString() >= '2026-10-07' && date.toString() <= '2027-01-31').map(String);
      const sought = expandRuleAll(T, model, T.PlainDate.from('2010-01-03'), new Set(), 10000, {
        windowStart: T.PlainDate.from('2026-10-07'), windowEnd: T.PlainDate.from('2027-01-31'), maxPeriods: 50,
      });
      expect(sought.map(String)).toEqual(expected);
    }
  });

  it('não salta COUNT anterior à janela', () => {
    const values = expandRuleAll(T, parseRRule('FREQ=DAILY;COUNT=5'), T.PlainDate.from('2010-01-01'), new Set(), 100, {
      windowStart: T.PlainDate.from('2026-10-01'), windowEnd: T.PlainDate.from('2026-10-31'),
    });
    expect(values).toEqual([]);
  });
  it('não confunde dias antes da janela com períodos sem candidatos', () => {
    const list = expandRuleAll(T, parseRRule('FREQ=DAILY'), T.PlainDate.from('2010-01-01'), new Set(), 10, {
      windowStart: T.PlainDate.from('2026-10-01'),
      windowEnd: T.PlainDate.from('2026-10-03'),
    });
    expect(list.map((date) => date.toString())).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('encerra na janela mesmo quando a regra não possui candidatos', () => {
    const list = expandRuleAll(T, parseRRule('FREQ=MONTHLY;BYMONTH=2;BYMONTHDAY=30'), T.PlainDate.from('2024-01-01'), new Set(), 10, {
      windowEnd: T.PlainDate.from('2024-02-29'),
    });
    expect(list).toEqual([]);
    expect(() => expandRuleAll(T, parseRRule('FREQ=DAILY;COUNT=999999999'), T.PlainDate.from('2024-01-01'), new Set(), 100, { maxPeriods: 2 }))
      .toThrow(/orçamento de expansão/);
  });
  it('expande regra infinita numa janela de 1 mês rapidamente', () => {
    const model = parseRRule('RRULE:FREQ=DAILY');
    const start = T.PlainDate.from('2024-01-01');
    const t0 = performance.now();
    const list = expandRuleAll(T, model, start, new Set(), 10000, {
      windowStart: T.PlainDate.from('2024-06-01'),
      windowEnd: T.PlainDate.from('2024-06-30'),
    });
    const dt = performance.now() - t0;
    expect(list).toHaveLength(30);
    expect(list[0]!.toString()).toBe('2024-06-01');
    expect(list[29]!.toString()).toBe('2024-06-30');
    expect(dt).toBeLessThan(500);
  });
});
