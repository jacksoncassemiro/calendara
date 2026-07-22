import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../src/date/temporal.js';
import { createDateUtils } from '../src/date/dateUtils.js';
import { expandEvent } from '../src/recurrence/recurrenceSet.js';
import type { CalendarEvent } from '../src/types/index.js';

let T: TemporalLike;
beforeAll(async () => {
  T = await ensureTemporal();
});

function allDayEvent(over: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    calendarId: 'c1',
    title: 'All day',
    time: { allDay: true, start: { date: '2024-01-01' }, end: { date: '2024-01-02' } },
    ...over,
  };
}

describe('expandEvent — evento simples', () => {
  it('evento sem recorrência gera 1 ocorrência (mestre)', () => {
    const occ = expandEvent(T, allDayEvent());
    expect(occ).toHaveLength(1);
    expect(occ[0]!.isMaster).toBe(true);
    expect(occ[0]!.originalStart).toBe('2024-01-01');
  });

  it('respeita a janela', () => {
    const occ = expandEvent(T, allDayEvent(), { start: '2024-02-01', end: '2024-02-28' });
    expect(occ).toHaveLength(0);
  });
});

describe('expandEvent — recorrência all-day', () => {
  const daily = allDayEvent({ recurrence: { rule: 'FREQ=DAILY;COUNT=5' } });

  it('expande COUNT=5', () => {
    const occ = expandEvent(T, daily);
    expect(occ.map((o) => o.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ]);
    expect(occ[0]!.isMaster).toBe(true);
    expect(occ[1]!.isMaster).toBe(false);
  });

  it('EXDATE remove ocorrência mas mantém COUNT', () => {
    const ev = allDayEvent({ recurrence: { rule: 'FREQ=DAILY;COUNT=5', exDates: ['2024-01-03'] } });
    const occ = expandEvent(T, ev);
    // 5 contadas, 1 removida => 4 visíveis, sem "puxar" a 6ª
    expect(occ.map((o) => o.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-04',
      '2024-01-05',
    ]);
  });

  it('RDATE adiciona data extra (não conta para COUNT)', () => {
    const ev = allDayEvent({ recurrence: { rule: 'FREQ=DAILY;COUNT=3', rDates: ['2024-01-10'] } });
    const occ = expandEvent(T, ev);
    expect(occ.map((o) => o.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-10',
    ]);
  });

  it('override edita o título de UMA ocorrência', () => {
    const ev = allDayEvent({
      recurrence: { rule: 'FREQ=DAILY;COUNT=3', overrides: { '2024-01-02': { title: 'Editado' } } },
    });
    const occ = expandEvent(T, ev);
    expect(occ.map((o) => o.event.title)).toEqual(['All day', 'Editado', 'All day']);
  });

  it('override cancela UMA ocorrência', () => {
    const ev = allDayEvent({
      recurrence: { rule: 'FREQ=DAILY;COUNT=3', overrides: { '2024-01-02': { cancelled: true } } },
    });
    const occ = expandEvent(T, ev);
    expect(occ.map((o) => o.originalStart)).toEqual(['2024-01-01', '2024-01-03']);
  });
});

describe('expandEvent — timed + DST (America/New_York, spring forward 2024-03-10)', () => {
  it('mantém a hora local 09:00 e desloca o instante UTC na virada', () => {
    const ev: CalendarEvent = {
      id: 'dst',
      calendarId: 'c1',
      title: 'Daily 9am NY',
      time: {
        allDay: false,
        start: { dateTime: '2024-03-08T09:00:00', timeZone: 'America/New_York' },
        end: { dateTime: '2024-03-08T10:00:00', timeZone: 'America/New_York' },
      },
      recurrence: { rule: 'FREQ=DAILY;COUNT=5' },
    };
    const occ = expandEvent(T, ev);
    const du = createDateUtils(T);
    const starts = occ.map((o) => o.event.time.start.dateTime!);
    // hora local sempre 09:00
    for (const s of starts) expect(s.slice(11, 16)).toBe('09:00');

    // 08→09 mar: antes do DST (EST, UTC-5); 11 mar em diante: EDT (UTC-4)
    const epoch = (iso: string) => du.epochMsInZone(T.PlainDateTime.from(iso), 'America/New_York');
    const d09 = epoch('2024-03-09T09:00:00');
    const d10 = epoch('2024-03-10T09:00:00'); // dia da virada (relógio pula 02→03)
    const d11 = epoch('2024-03-11T09:00:00');
    // de 9 para 10: só 23h reais (spring forward)
    expect((d10 - d09) / 3_600_000).toBeCloseTo(23, 5);
    // de 10 para 11: 24h normais
    expect((d11 - d10) / 3_600_000).toBeCloseTo(24, 5);
  });
});
