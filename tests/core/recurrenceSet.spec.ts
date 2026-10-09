import { describe, it, expect, beforeAll } from 'vitest';
import { ensureTemporal, type TemporalLike } from '../../src/core/date/temporal.js';
import { createDateUtils } from '../../src/core/date/dateUtils.js';
import { expandEvent } from '../../src/core/recurrence/recurrenceSet.js';
import type { CalendarEvent } from '../../src/core/types/index.js';
import { ALL } from './scenarios.js';
import { expandRuleAll } from '../../src/core/recurrence/engine.js';
import { parseRRule } from '../../src/core/recurrence/parser.js';

let temporal: TemporalLike;
beforeAll(async () => {
  temporal = await ensureTemporal();
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
  it('integrated provider preserves all 50 date scenarios for all-day and UTC timed events', () => {
    for (const [name, start, rule] of ALL) {
      const expected = expandRuleAll({
        temporal,
        model: parseRRule(rule),
        dtstart: temporal.PlainDate.from(start),
      }).map((date) => date.toString());
      const base = allDayEvent({
        time: {
          allDay: true,
          start: { date: start },
          end: { date: temporal.PlainDate.from(start).add({ days: 1 }).toString() },
        },
        recurrence: { rule },
      });
      expect(
        expandEvent({ temporal, event: base }).map((item) => item.originalStart),
        name,
      ).toEqual(expected);
      const timed = {
        ...base,
        time: {
          allDay: false,
          start: { dateTime: `${start}T00:00:00`, timeZone: 'UTC' },
          end: { dateTime: `${start}T01:00:00`, timeZone: 'UTC' },
        },
      };
      expect(
        expandEvent({ temporal, event: timed }).map((item) => item.originalStart.slice(0, 10)),
        name,
      ).toEqual(expected);
    }
  });
  it('rejects a master DTSTART in a DST gap rather than shifting every subsequent hour', () => {
    const event = allDayEvent({
      time: {
        allDay: false,
        start: { dateTime: '2024-03-10T02:30:00', timeZone: 'America/New_York' },
        end: { dateTime: '2024-03-10T03:30:00', timeZone: 'America/New_York' },
      },
      recurrence: { rule: 'FREQ=DAILY;COUNT=3' },
    });
    expect(() => expandEvent({ temporal, event })).toThrow(/inexistente/);
  });
  it('rejects unsupported and malformed external rules before producing a different series', () => {
    for (const rule of [
      'FREQ=HOURLY;COUNT=2',
      'FREQ=DAILY;BYEASTER=9',
      'FREQ=WEEKLY;BYDAY=oops',
      'FREQ=DAILY;COUNT=0',
      'FREQ=DAILY;COUNT=2junk',
      'FREQ=DAILY;FREQ=WEEKLY',
      { freq: 'DAILY' as const, count: Infinity },
      { freq: 'DAILY' as const, interval: NaN },
    ]) {
      expect(() =>
        expandEvent({
          temporal,
          event: allDayEvent({ recurrence: { rule } }),
          window: { end: '2024-01-08' },
        }),
      ).toThrow(RangeError);
    }
  });
  it('recusa materializar recorrência infinita sem limite superior', () => {
    expect(() =>
      expandEvent({
        temporal,
        event: allDayEvent({ recurrence: { rule: 'FREQ=DAILY' } }),
      }),
    ).toThrow(/window.end, COUNT ou UNTIL/);
    expect(() =>
      expandEvent({
        temporal,
        event: allDayEvent({ recurrence: { rule: 'FREQ=DAILY' } }),
        window: {
          start: '2024-01-01',
        },
      }),
    ).toThrow(/recorrência infinita/);
  });
  it('evento sem recorrência gera 1 ocorrência (mestre)', () => {
    const occurrences = expandEvent({ temporal, event: allDayEvent() });
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.isMaster).toBe(true);
    expect(occurrences[0]!.originalStart).toBe('2024-01-01');
  });

  it('respeita a janela', () => {
    const occurrences = expandEvent({
      temporal,
      event: allDayEvent(),
      window: {
        start: '2024-02-01',
        end: '2024-02-28',
      },
    });
    expect(occurrences).toHaveLength(0);
  });
});

describe('expandEvent — limites e exceções timed', () => {
  function timed(recurrence: CalendarEvent['recurrence']): CalendarEvent {
    return {
      id: 'timed',
      calendarId: 'c1',
      title: 'NY',
      recurrence,
      time: {
        allDay: false,
        start: { dateTime: '2024-01-01T09:00:00', timeZone: 'America/New_York' },
        end: { dateTime: '2024-01-01T10:00:00', timeZone: 'America/New_York' },
      },
    };
  }

  it('UNTIL UTC compara o instante inclusive sem incluir horário posterior do mesmo dia', () => {
    expect(
      expandEvent({
        temporal,
        event: timed({ rule: 'FREQ=DAILY;UNTIL=20240102T135959Z' }),
      }),
    ).toHaveLength(1);
    expect(
      expandEvent({
        temporal,
        event: timed({ rule: 'FREQ=DAILY;UNTIL=20240102T140000Z' }),
      }),
    ).toHaveLength(2);
  });

  it('UNTIL UTC próximo da meia-noite é projetado na timezone do mestre', () => {
    const event = timed({ rule: 'FREQ=DAILY;UNTIL=20240102T010000Z' });
    event.time.start.timeZone = 'Asia/Tokyo';
    event.time.end.timeZone = 'Asia/Tokyo';
    expect(expandEvent({ temporal, event })).toHaveLength(2);
  });

  it('RDATE timed preserva horários distintos no mesmo dia e duração', () => {
    const occurrences = expandEvent({
      temporal,
      event: timed({
        rule: 'FREQ=DAILY;COUNT=1',
        rDates: ['2024-01-01T11:00:00', '2024-01-01T16:00:00Z'],
      }),
    });
    expect(occurrences.map((item) => item.originalStart)).toEqual([
      '2024-01-01T09:00:00',
      '2024-01-01T11:00:00',
    ]);
    expect(occurrences[1]!.event.time.end.dateTime).toBe('2024-01-01T12:00:00');
  });

  it('EXDATE datetime exclui só o início exato e mantém COUNT sem reposição', () => {
    const occurrences = expandEvent({
      temporal,
      event: timed({
        rule: 'FREQ=DAILY;COUNT=2',
        rDates: ['2024-01-01T11:00:00'],
        exDates: ['2024-01-01T14:00:00Z'],
      }),
    });
    expect(occurrences.map((item) => item.originalStart)).toEqual([
      '2024-01-01T11:00:00',
      '2024-01-02T09:00:00',
    ]);
  });

  it('EXDATE date-only continua excluindo todos os horários da data', () => {
    expect(
      expandEvent({
        temporal,
        event: timed({
          rule: 'FREQ=DAILY;COUNT=1',
          rDates: ['2024-01-01T11:00:00'],
          exDates: ['2024-01-01'],
        }),
      }),
    ).toEqual([]);
  });
});

describe('expandEvent — DST gaps and folds', () => {
  function series({
    startDate,
    time,
    recurrence,
  }: {
    /** First local date of the series. / PT: Primeira data local da série. */
    startDate: string;
    /** Local wall-clock time, HH:mm. / PT: Horário local, HH:mm. */
    time: string;
    /** Recurrence policy under test. / PT: Regra de recorrencia em teste. */
    recurrence: CalendarEvent['recurrence'];
  }): CalendarEvent {
    return {
      id: 'dst-policy',
      calendarId: 'c',
      title: 'DST',
      recurrence,
      time: {
        allDay: false,
        start: { dateTime: `${startDate}T${time}:00`, timeZone: 'America/New_York' },
        end: { dateTime: `${startDate}T${time}:00`, timeZone: 'America/New_York' },
      },
    };
  }

  it('ignora horário inexistente da regra sem consumir COUNT, mas EXDATE continua consumindo', () => {
    const event = series({
      startDate: '2024-03-09',
      time: '02:30',
      recurrence: {
        rule: 'FREQ=DAILY;COUNT=3',
        exDates: ['2024-03-11'],
      },
    });
    expect(expandEvent({ temporal, event }).map((item) => item.originalStart)).toEqual([
      '2024-03-09T02:30:00',
      '2024-03-12T02:30:00',
    ]);
  });

  it('COUNT após gap vale também para override movido e janela distante', () => {
    const movedTime = {
      allDay: false,
      start: { dateTime: '2024-04-01T09:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2024-04-01T10:00:00', timeZone: 'America/New_York' },
    };
    const event = series({
      startDate: '2024-03-09',
      time: '02:30',
      recurrence: {
        rule: 'FREQ=DAILY;COUNT=3',
        overrides: {
          '2024-03-12T02:30:00': { time: movedTime },
        },
      },
    });
    expect(
      expandEvent({
        temporal,
        event,
        window: { start: '2024-04-01', end: '2024-04-01' },
      }).map((item) => item.originalStart),
    ).toEqual(['2024-03-12T02:30:00']);
  });

  it('fold escolhe primeiro instante; UNTIL UTC compara instante em vez de hora repetida', () => {
    const event = series({
      startDate: '2024-11-02',
      time: '01:30',
      recurrence: { rule: 'FREQ=DAILY;UNTIL=20241103T061500Z' },
    });
    const values = expandEvent({ temporal, event });
    expect(values.map((item) => item.originalStart)).toEqual([
      '2024-11-02T01:30:00',
      '2024-11-03T01:30:00',
    ]);
    const fold = temporal.PlainDateTime.from(values[1]!.event.time.start.dateTime!).toZonedDateTime(
      'America/New_York',
    );
    expect(fold.toInstant().toString()).toBe('2024-11-03T05:30:00Z');
  });

  it('EXDATE do segundo instante fold não remove ocorrência no primeiro instante', () => {
    const late = series({
      startDate: '2024-11-02',
      time: '01:30',
      recurrence: {
        rule: 'FREQ=DAILY;COUNT=3',
        exDates: ['2024-11-03T06:30:00Z'],
      },
    });
    expect(expandEvent({ temporal, event: late })).toHaveLength(3);
    const early = {
      ...late,
      recurrence: { rule: 'FREQ=DAILY;COUNT=3', exDates: ['2024-11-03T05:30:00Z'] },
    };
    expect(expandEvent({ temporal, event: early }).map((item) => item.originalStart)).toEqual([
      '2024-11-02T01:30:00',
      '2024-11-04T01:30:00',
    ]);
  });

  it('rejeita RDATE local inexistente e instante fold não representável por wall-clock', () => {
    expect(() =>
      expandEvent({
        temporal,
        event: series({
          startDate: '2024-03-09',
          time: '02:30',
          recurrence: {
            rule: 'FREQ=DAILY;COUNT=1',
            rDates: ['2024-03-10T02:30:00'],
          },
        }),
      }),
    ).toThrow(/horário local inexistente/);
    expect(() =>
      expandEvent({
        temporal,
        event: series({
          startDate: '2024-11-02',
          time: '01:30',
          recurrence: {
            rule: 'FREQ=DAILY;COUNT=1',
            rDates: ['2024-11-03T06:30:00Z'],
          },
        }),
      }),
    ).toThrow(/contrato wall-clock/);
  });
});

describe('expandEvent — recorrência all-day', () => {
  const daily = allDayEvent({ recurrence: { rule: 'FREQ=DAILY;COUNT=5' } });

  it('inclui override movido para dentro da janela mesmo com data original fora', () => {
    const movedTime = { allDay: true, start: { date: '2024-02-10' }, end: { date: '2024-02-11' } };
    const event = allDayEvent({
      recurrence: {
        rule: 'FREQ=DAILY;COUNT=3',
        overrides: { '2024-01-02': { time: movedTime } },
      },
    });
    const occurrences = expandEvent({
      temporal,
      event,
      window: { start: '2024-02-10', end: '2024-02-10' },
    });
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]!.originalStart).toBe('2024-01-02');
    expect(occurrences[0]!.event.time).toEqual(movedTime);
  });

  it('não cria ocorrências de chaves fora de COUNT, excluídas ou com hora original incorreta', () => {
    const movedTime = { allDay: true, start: { date: '2024-02-10' }, end: { date: '2024-02-11' } };
    const event = allDayEvent({
      recurrence: {
        rule: 'FREQ=DAILY;COUNT=3',
        exDates: ['2024-01-02'],
        overrides: {
          '2024-01-02': { time: movedTime },
          '2024-01-05': { time: movedTime },
          '2024-01-03T10:00:00': { time: movedTime },
        },
      },
    });
    expect(
      expandEvent({
        temporal,
        event,
        window: { start: '2024-02-10', end: '2024-02-10' },
      }),
    ).toEqual([]);
  });

  it('reconhece ocorrência RDATE movida e deduplica overrides já expandidos', () => {
    const movedTime = { allDay: true, start: { date: '2024-02-10' }, end: { date: '2024-02-11' } };
    const event = allDayEvent({
      recurrence: {
        rule: 'FREQ=DAILY;COUNT=3',
        rDates: ['2024-01-10'],
        overrides: { '2024-01-10': { time: movedTime } },
      },
    });
    expect(
      expandEvent({
        temporal,
        event,
        window: { start: '2024-02-10', end: '2024-02-10' },
      }),
    ).toHaveLength(1);
    expect(expandEvent({ temporal, event })).toHaveLength(4);
  });

  it('expande COUNT=5', () => {
    const occurrences = expandEvent({ temporal, event: daily });
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-04',
      '2024-01-05',
    ]);
    expect(occurrences[0]!.isMaster).toBe(true);
    expect(occurrences[1]!.isMaster).toBe(false);
  });

  it('EXDATE remove ocorrência mas mantém COUNT', () => {
    const event = allDayEvent({
      recurrence: { rule: 'FREQ=DAILY;COUNT=5', exDates: ['2024-01-03'] },
    });
    const occurrences = expandEvent({ temporal, event });
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-04',
      '2024-01-05',
    ]);
  });

  it('RDATE adiciona data extra (não conta para COUNT)', () => {
    const event = allDayEvent({
      recurrence: { rule: 'FREQ=DAILY;COUNT=3', rDates: ['2024-01-10'] },
    });
    const occurrences = expandEvent({ temporal, event });
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03',
      '2024-01-10',
    ]);
  });

  it('override edita o título de UMA ocorrência', () => {
    const event = allDayEvent({
      recurrence: { rule: 'FREQ=DAILY;COUNT=3', overrides: { '2024-01-02': { title: 'Editado' } } },
    });
    const occurrences = expandEvent({ temporal, event });
    expect(occurrences.map((occurrence) => occurrence.event.title)).toEqual([
      'All day',
      'Editado',
      'All day',
    ]);
    expect(occurrences[1]!.event.time.start.date).toBe('2024-01-02');
    expect(occurrences[1]!.event.time.end.date).toBe('2024-01-03');
  });

  it('override cancela UMA ocorrência', () => {
    const event = allDayEvent({
      recurrence: { rule: 'FREQ=DAILY;COUNT=3', overrides: { '2024-01-02': { cancelled: true } } },
    });
    const occurrences = expandEvent({ temporal, event });
    expect(occurrences.map((occurrence) => occurrence.originalStart)).toEqual([
      '2024-01-01',
      '2024-01-03',
    ]);
  });
});

describe('expandEvent — timed + DST (America/New_York, spring forward 2024-03-10)', () => {
  it('mantém a hora local 09:00 e desloca o instante UTC na virada', () => {
    const event: CalendarEvent = {
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
    const occurrences = expandEvent({ temporal, event });
    const dateUtils = createDateUtils(temporal);
    const starts = occurrences.map((occurrence) => occurrence.event.time.start.dateTime!);
    for (const startDateTime of starts) expect(startDateTime.slice(11, 16)).toBe('09:00');

    const epochMillisecondsAt = (dateTime: string) =>
      dateUtils.epochMsInZone({
        dateTime: temporal.PlainDateTime.from(dateTime),
        timeZone: 'America/New_York',
      });
    const beforeTransitionMs = epochMillisecondsAt('2024-03-09T09:00:00');
    const transitionDayMs = epochMillisecondsAt('2024-03-10T09:00:00');
    const afterTransitionMs = epochMillisecondsAt('2024-03-11T09:00:00');
    expect((transitionDayMs - beforeTransitionMs) / 3_600_000).toBeCloseTo(23, 5);
    expect((afterTransitionMs - transitionDayMs) / 3_600_000).toBeCloseTo(24, 5);
  });
});
