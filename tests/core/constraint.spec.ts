import { describe, it, expect } from 'vitest';
import { ConstraintEngine, jsDayOfWeek } from '../../src/core/constraint/constraintEngine.js';

// businessHours: seg-sex 08:00-18:00 (daysOfWeek 1..5)
const weekdayBusinessHours = [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }];

describe('jsDayOfWeek', () => {
  it('2024-01-01 é segunda (1)', () => expect(jsDayOfWeek('2024-01-01')).toBe(1));
  it('2024-01-06 é sábado (6)', () => expect(jsDayOfWeek('2024-01-06')).toBe(6));
  it('2024-01-07 é domingo (0)', () => expect(jsDayOfWeek('2024-01-07')).toBe(0));
});

describe('businessHours', () => {
  const constraintEngine = new ConstraintEngine({ businessHours: weekdayBusinessHours });
  it('slot dentro do expediente é válido', () => {
    expect(constraintEngine.isValid({ date: '2024-01-01', startMin: 9 * 60, endMin: 10 * 60 })).toBe(true);
  });
  it('slot antes do expediente é inválido', () => {
    const evaluation = constraintEngine.evaluate({ date: '2024-01-01', startMin: 7 * 60, endMin: 7 * 60 + 30 });
    expect(evaluation.valid).toBe(false);
    expect(evaluation.reason).toBe('outside-business-hours');
  });
  it('fim de semana é inválido', () => {
    expect(constraintEngine.isValid({ date: '2024-01-06', startMin: 9 * 60, endMin: 10 * 60 })).toBe(false);
  });
  it('sem businessHours tudo é válido', () => {
    expect(new ConstraintEngine().isValid({ date: '2024-01-06', startMin: 60 })).toBe(true);
  });
});

describe('blocked (precedência)', () => {
  it('bloqueio de dia inteiro invalida qualquer slot', () => {
    const constraintEngine = new ConstraintEngine({
      businessHours: weekdayBusinessHours,
      blocked: [{ scope: 'day', date: '2024-01-02' }],
    });
    const evaluation = constraintEngine.evaluate({ date: '2024-01-02', startMin: 9 * 60, endMin: 10 * 60 });
    expect(evaluation.valid).toBe(false);
    expect(evaluation.reason).toBe('blocked');
  });
  it('bloqueio de horário invalida só o slot sobreposto', () => {
    const constraintEngine = new ConstraintEngine({
      businessHours: weekdayBusinessHours,
      blocked: [{ scope: 'time', date: '2024-01-02', startTime: '12:00', endTime: '13:00' }],
    });
    expect(constraintEngine.isValid({ date: '2024-01-02', startMin: 12 * 60 + 30, endMin: 12 * 60 + 45 })).toBe(false);
    expect(constraintEngine.isValid({ date: '2024-01-02', startMin: 14 * 60, endMin: 15 * 60 })).toBe(true);
  });
});

describe('allowedRanges', () => {
  it('fora do range permitido é inválido', () => {
    const constraintEngine = new ConstraintEngine({
      allowedRanges: [{ start: '2024-01-01', end: '2024-01-31' }],
    });
    expect(constraintEngine.isValid({ date: '2024-01-15', startMin: 9 * 60 })).toBe(true);
    const evaluation = constraintEngine.evaluate({ date: '2024-02-15', startMin: 9 * 60 });
    expect(evaluation.valid).toBe(false);
    expect(evaluation.reason).toBe('outside-allowed');
  });
});
