import { describe, it, expect } from 'vitest';
import { parseRRule, serializeRRule } from '../../src/core/recurrence/parser.js';

describe('parseRRule', () => {
  it('faz parse de multi-ordinal (byDay com ordinal por entrada)', () => {
    const recurrenceRule = parseRRule('RRULE:FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6');
    expect(recurrenceRule.freq).toBe('MONTHLY');
    expect(recurrenceRule.count).toBe(6);
    expect(recurrenceRule.byDay).toEqual([
      { weekday: 'FR', ordinal: 2 },
      { weekday: 'FR', ordinal: 4 },
    ]);
  });

  it('byDay sem ordinal fica sem ordinal', () => {
    const recurrenceRule = parseRRule('FREQ=WEEKLY;BYDAY=MO,WE,FR');
    expect(recurrenceRule.byDay).toEqual([{ weekday: 'MO' }, { weekday: 'WE' }, { weekday: 'FR' }]);
  });

  it('faz parse de negativos, BYSETPOS lista e WKST', () => {
    const recurrenceRule = parseRRule('FREQ=MONTHLY;BYMONTHDAY=-1,-2;BYSETPOS=1,-1;WKST=SU;BYDAY=-1SU');
    expect(recurrenceRule.byMonthDay).toEqual([-1, -2]);
    expect(recurrenceRule.bySetPos).toEqual([1, -1]);
    expect(recurrenceRule.weekStart).toBe('SU');
    expect(recurrenceRule.byDay).toEqual([{ weekday: 'SU', ordinal: -1 }]);
  });

  it('normaliza UNTIL para ISO', () => {
    expect(parseRRule('FREQ=DAILY;UNTIL=20240110T000000Z').until).toBe('2024-01-10T00:00:00Z');
    expect(parseRRule('FREQ=DAILY;UNTIL=20240110').until).toBe('2024-01-10');
  });
});

describe('serializeRRule (round-trip semântico)', () => {
  const rules = [
    'FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR',
    'FREQ=MONTHLY;BYMONTHDAY=-1',
    'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
    'FREQ=WEEKLY;BYDAY=SU,SA;WKST=SU',
    'FREQ=DAILY;UNTIL=20240110T000000Z',
  ];
  for (const ruleText of rules) {
    it(`round-trip: ${ruleText}`, () => {
      // parse → serialize → parse deve preservar o modelo
      expect(parseRRule(serializeRRule(parseRRule(ruleText)))).toEqual(parseRRule(ruleText));
    });
  }
});
