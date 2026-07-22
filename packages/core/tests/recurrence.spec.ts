import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../src/date/temporal.js';
import { parseRRule } from '../src/recurrence/parser.js';
import { expandRuleAll } from '../src/recurrence/engine.js';
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

describe('janela (lazy) e performance', () => {
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
