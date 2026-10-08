import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIONS, validateCalendarOptions } from '../../src/core/render/state.js';

describe('grid option validation', () => {
  it.each([
    { slotMinutes: 0 },
    { slotMinutes: -1 },
    { slotMinutes: Infinity },
    { pxPerMinute: 0 },
    { pxPerMinute: NaN },
    { startHour: 20, endHour: 7 },
    { startHour: '08:99' },
    { endHour: 25 },
    { startHour: 'invalid' },
    { minEventMinutes: -15 },
    { monthMaxEvents: -1 },
    { monthMaxEvents: 1.5 },
    { monthCompactBreakpoint: -1 },
    { monthCompactBreakpoint: NaN },
    { monthCompactBreakpoint: 0 },
    { timeLabelInterval: 0 },
  ])('rejects unusable dimensions %j', (patch) => {
    expect(() => validateCalendarOptions({ ...DEFAULT_OPTIONS, ...patch })).toThrow(RangeError);
  });
  it('accepts fractional hours and 24:00 exclusive end', () => {
    expect(() =>
      validateCalendarOptions({ ...DEFAULT_OPTIONS, startHour: '07:30', endHour: '24:00' }),
    ).not.toThrow();
  });
});
