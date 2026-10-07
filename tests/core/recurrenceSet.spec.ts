import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../../src/core/date/temporal.js';
import { createDateUtils } from '../../src/core/date/dateUtils.js';
import { expandEvent } from '../../src/core/recurrence/recurrenceSet.js';
import type { CalendarEvent } from '../../src/core/types/index.js';

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
  it('rejects unsupported and malformed external rules before producing a different series', () => {
    for (const rule of ['FREQ=HOURLY;COUNT=2', 'FREQ=DAILY;BYHOUR=9', 'FREQ=WEEKLY;BYDAY=oops', 'FREQ=DAILY;COUNT=0', 'FREQ=DAILY;COUNT=2junk', 'FREQ=DAILY;FREQ=WEEKLY',
      { freq: 'DAILY' as const, count: Infinity }, { freq: 'DAILY' as const, interval: NaN }]) {
      expect(() => expandEvent(T, allDayEvent({ recurrence: { rule } }), { end: '2024-01-08' })).toThrow(RangeError);
    }
  });
  it('recusa materializar recorrência infinita sem limite superior', () => {
    expect(() => expandEvent(T, allDayEvent({ recurrence: { rule: 'FREQ=DAILY' } })))
      .toThrow(/window.end, COUNT ou UNTIL/);
    expect(() => expandEvent(T, allDayEvent({ recurrence: { rule: 'FREQ=DAILY' } }), { start: '2024-01-01' }))
      .toThrow(/recorrência infinita/);
  });
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

describe('expandEvent — limites e exceções timed', () => {
  function timed(recurrence: CalendarEvent['recurrence']): CalendarEvent {
    return {
      id: 'timed', calendarId: 'c1', title: 'NY', recurrence,
      time: {
        allDay: false,
        start: { dateTime: '2024-01-01T09:00:00', timeZone: 'America/New_York' },
        end: { dateTime: '2024-01-01T10:00:00', timeZone: 'America/New_York' },
      },
    };
  }

  it('UNTIL UTC compara o instante inclusive sem incluir horário posterior do mesmo dia', () => {
    expect(expandEvent(T, timed({ rule: 'FREQ=DAILY;UNTIL=20240102T135959Z' }))).toHaveLength(1);
    expect(expandEvent(T, timed({ rule: 'FREQ=DAILY;UNTIL=20240102T140000Z' }))).toHaveLength(2);
  });

  it('UNTIL UTC próximo da meia-noite é projetado na timezone do mestre', () => {
    const event = timed({ rule: 'FREQ=DAILY;UNTIL=20240102T010000Z' });
    event.time.start.timeZone = 'Asia/Tokyo';
    event.time.end.timeZone = 'Asia/Tokyo';
    expect(expandEvent(T, event)).toHaveLength(2);
  });

  it('RDATE timed preserva horários distintos no mesmo dia e duração', () => {
    const occurrences = expandEvent(T, timed({ rule: 'FREQ=DAILY;COUNT=1', rDates: [
      '2024-01-01T11:00:00', '2024-01-01T16:00:00Z',
    ] }));
    expect(occurrences.map((item) => item.originalStart)).toEqual([
      '2024-01-01T09:00:00', '2024-01-01T11:00:00',
    ]);
    expect(occurrences[1]!.event.time.end.dateTime).toBe('2024-01-01T12:00:00');
  });

  it('EXDATE datetime exclui só o início exato e mantém COUNT sem reposição', () => {
    const occurrences = expandEvent(T, timed({ rule: 'FREQ=DAILY;COUNT=2',
      rDates: ['2024-01-01T11:00:00'], exDates: ['2024-01-01T14:00:00Z'],
    }));
    expect(occurrences.map((item) => item.originalStart)).toEqual([
      '2024-01-01T11:00:00', '2024-01-02T09:00:00',
    ]);
  });

  it('EXDATE date-only continua excluindo todos os horários da data', () => {
    expect(expandEvent(T, timed({ rule: 'FREQ=DAILY;COUNT=1',
      rDates: ['2024-01-01T11:00:00'], exDates: ['2024-01-01'],
    }))).toEqual([]);
  });
});

describe('expandEvent — DST gaps and folds', () => {
  function series(startDate: string, time: string, recurrence: CalendarEvent['recurrence']): CalendarEvent {
    return {
      id: 'dst-policy', calendarId: 'c', title: 'DST', recurrence,
      time: { allDay: false,
        start: { dateTime: `${startDate}T${time}:00`, timeZone: 'America/New_York' },
        end: { dateTime: `${startDate}T${time}:00`, timeZone: 'America/New_York' },
      },
    };
  }

  it('ignora horário inexistente da regra sem consumir COUNT, mas EXDATE continua consumindo', () => {
    const event = series('2024-03-09', '02:30', { rule: 'FREQ=DAILY;COUNT=3', exDates: ['2024-03-11'] });
    expect(expandEvent(T, event).map((item) => item.originalStart)).toEqual([
      '2024-03-09T02:30:00', '2024-03-12T02:30:00',
    ]);
  });

  it('COUNT após gap vale também para override movido e janela distante', () => {
    const movedTime = { allDay: false,
      start: { dateTime: '2024-04-01T09:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2024-04-01T10:00:00', timeZone: 'America/New_York' },
    };
    const event = series('2024-03-09', '02:30', { rule: 'FREQ=DAILY;COUNT=3', overrides: {
      '2024-03-12T02:30:00': { time: movedTime },
    } });
    expect(expandEvent(T, event, { start: '2024-04-01', end: '2024-04-01' }).map((item) => item.originalStart))
      .toEqual(['2024-03-12T02:30:00']);
  });

  it('fold escolhe primeiro instante; UNTIL UTC compara instante em vez de hora repetida', () => {
    const event = series('2024-11-02', '01:30', { rule: 'FREQ=DAILY;UNTIL=20241103T061500Z' });
    const values = expandEvent(T, event);
    expect(values.map((item) => item.originalStart)).toEqual(['2024-11-02T01:30:00', '2024-11-03T01:30:00']);
    const fold = T.PlainDateTime.from(values[1]!.event.time.start.dateTime!).toZonedDateTime('America/New_York');
    expect(fold.toInstant().toString()).toBe('2024-11-03T05:30:00Z');
  });

  it('EXDATE do segundo instante fold não remove ocorrência no primeiro instante', () => {
    const late = series('2024-11-02', '01:30', { rule: 'FREQ=DAILY;COUNT=3', exDates: ['2024-11-03T06:30:00Z'] });
    expect(expandEvent(T, late)).toHaveLength(3);
    const early = { ...late, recurrence: { rule: 'FREQ=DAILY;COUNT=3', exDates: ['2024-11-03T05:30:00Z'] } };
    expect(expandEvent(T, early).map((item) => item.originalStart)).toEqual(['2024-11-02T01:30:00', '2024-11-04T01:30:00']);
  });

  it('rejeita RDATE local inexistente e instante fold não representável por wall-clock', () => {
    expect(() => expandEvent(T, series('2024-03-09', '02:30', { rule: 'FREQ=DAILY;COUNT=1', rDates: ['2024-03-10T02:30:00'] })))
      .toThrow(/horário local inexistente/);
    expect(() => expandEvent(T, series('2024-11-02', '01:30', { rule: 'FREQ=DAILY;COUNT=1', rDates: ['2024-11-03T06:30:00Z'] })))
      .toThrow(/contrato wall-clock/);
  });
});

describe('expandEvent — recorrência all-day', () => {
  const daily = allDayEvent({ recurrence: { rule: 'FREQ=DAILY;COUNT=5' } });

  it('inclui override movido para dentro da janela mesmo com data original fora', () => {
    const movedTime = { allDay: true, start: { date: '2024-02-10' }, end: { date: '2024-02-11' } };
    const event = allDayEvent({ recurrence: {
      rule: 'FREQ=DAILY;COUNT=3',
      overrides: { '2024-01-02': { time: movedTime } },
    } });
    const occurrences = expandEvent(T, event, { start: '2024-02-10', end: '2024-02-10' });
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.originalStart).toBe('2024-01-02');
    expect(occurrences[0]!.event.time).toEqual(movedTime);
  });

  it('não cria ocorrências de chaves fora de COUNT, excluídas ou com hora original incorreta', () => {
    const movedTime = { allDay: true, start: { date: '2024-02-10' }, end: { date: '2024-02-11' } };
    const event = allDayEvent({ recurrence: {
      rule: 'FREQ=DAILY;COUNT=3', exDates: ['2024-01-02'],
      overrides: {
        '2024-01-02': { time: movedTime },
        '2024-01-05': { time: movedTime },
        '2024-01-03T10:00:00': { time: movedTime },
      },
    } });
    expect(expandEvent(T, event, { start: '2024-02-10', end: '2024-02-10' })).toEqual([]);
  });

  it('reconhece ocorrência RDATE movida e deduplica overrides já expandidos', () => {
    const movedTime = { allDay: true, start: { date: '2024-02-10' }, end: { date: '2024-02-11' } };
    const event = allDayEvent({ recurrence: {
      rule: 'FREQ=DAILY;COUNT=3', rDates: ['2024-01-10'],
      overrides: { '2024-01-10': { time: movedTime } },
    } });
    expect(expandEvent(T, event, { start: '2024-02-10', end: '2024-02-10' })).toHaveLength(1);
    expect(expandEvent(T, event)).toHaveLength(4);
  });

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
    expect(occ[1]!.event.time.start.date).toBe('2024-01-02');
    expect(occ[1]!.event.time.end.date).toBe('2024-01-03');
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
