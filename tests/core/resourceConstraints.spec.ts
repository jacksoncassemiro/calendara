import { describe, expect, it } from 'vitest';
import { ConstraintEngine } from '../../src/core/constraint/constraintEngine.js';
import { resourceConstraintSet } from '../../src/core/render/resourceConstraints.js';

describe('resource constraints composition', () => {
  it('intersects global and local windows instead of treating their union as availability', () => {
    const effective = resourceConstraintSet({
      resource: {
        id: 'room',
        title: 'Room',
        businessHours: [{ daysOfWeek: [3], startTime: '07:00', endTime: '19:00' }],
        constraints: {
          allowedRanges: [
            { start: '2026-07-20', end: '2026-07-25', startTime: '09:00', endTime: '17:00' },
          ],
        },
      },
      global: {
        businessHours: [{ daysOfWeek: [3], startTime: '08:00', endTime: '18:00' }],
        allowedRanges: [
          { start: '2026-07-22', end: '2026-07-23', startTime: '10:00', endTime: '16:00' },
        ],
      },
    });
    const engine = new ConstraintEngine(effective);
    expect(engine.evaluate({ date: '2026-07-22', startMin: 450, endMin: 480 }).reason).toBe(
      'outside-business-hours',
    );
    expect(engine.evaluate({ date: '2026-07-22', startMin: 540, endMin: 570 }).reason).toBe(
      'outside-allowed',
    );
    expect(engine.isValid({ date: '2026-07-22', startMin: 600, endMin: 660 })).toBe(true);
  });

  it('keeps disjoint allowed windows and weekday rules explicitly closed', () => {
    const effective = resourceConstraintSet({
      resource: {
        id: 'room',
        title: 'Room',
        constraints: {
          businessHours: [{ daysOfWeek: [4], startTime: '08:00', endTime: '18:00' }],
          allowedRanges: [{ start: '2026-08-01', end: '2026-08-02' }],
        },
      },
      global: {
        businessHours: [{ daysOfWeek: [3], startTime: '08:00', endTime: '18:00' }],
        allowedRanges: [{ start: '2026-07-22', end: '2026-07-23' }],
      },
    });
    const engine = new ConstraintEngine(effective);
    expect(engine.isValid({ date: '2026-07-22', startMin: 600, endMin: 660 })).toBe(false);
    expect(
      new ConstraintEngine({ allowedRanges: effective.allowedRanges! }).isValid({
        date: '2026-07-22',
        startMin: 600,
        endMin: 660,
      }),
    ).toBe(false);
  });
});
