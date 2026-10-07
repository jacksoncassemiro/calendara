import { describe, it, expect } from 'vitest';
import {
  occurrencesForResource,
  resourceConstraintSet,
} from '../../src/core/render/resourceDerive.js';
import type { EventOccurrence } from '../../src/core/types/event.js';
import type { CalendarResource } from '../../src/core/types/resource.js';
import type { ConstraintSet } from '../../src/core/types/constraint.js';

function occurrence(id: string, resourceIds: string[]): EventOccurrence {
  return {
    event: {
      id,
      calendarId: 'c1',
      title: id,
      time: { allDay: false, start: { dateTime: `2026-07-22T09:00:00` }, end: { dateTime: `2026-07-22T10:00:00` } },
      resourceIds,
    },
    masterId: id,
    originalStart: '2026-07-22T09:00:00',
    isMaster: true,
  };
}

describe('occurrencesForResource', () => {
  it('filtra por resourceIds (inclui multi-recurso)', () => {
    const occurrences = [occurrence('a', ['r1']), occurrence('b', ['r2']), occurrence('m', ['r1', 'r2'])];
    expect(occurrencesForResource(occurrences, 'r1').map((occ) => occ.event.id)).toEqual(['a', 'm']);
    expect(occurrencesForResource(occurrences, 'r2').map((occ) => occ.event.id)).toEqual(['b', 'm']);
  });

  it('ignora ocorrências sem resourceIds', () => {
    const occurrences = [occurrence('x', [])];
    expect(occurrencesForResource(occurrences, 'r1')).toHaveLength(0);
  });
});

describe('resourceConstraintSet', () => {
  const global: ConstraintSet = {
    businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
    blocked: [{ scope: 'day', date: '2026-07-25' }],
  };

  it('usa o horário comercial próprio do recurso quando existe', () => {
    const resource: CalendarResource = {
      id: 'r1',
      title: 'Sala 1',
      businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '12:00' }],
    };
    const result = resourceConstraintSet(resource, global);
    expect(result.businessHours![0]!.endTime).toBe('12:00'); // próprio, não o global
    expect(result.blocked).toEqual(global.blocked); // bloqueios globais preservados
  });

  it('cai no horário global quando o recurso não define o próprio', () => {
    const resource: CalendarResource = { id: 'r2', title: 'Sala 2' };
    const result = resourceConstraintSet(resource, global);
    expect(result.businessHours![0]!.endTime).toBe('18:00');
  });
});
