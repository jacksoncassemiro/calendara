import { describe, it, expect } from 'vitest';
import {
  snapMinute,
  clampSpanToGrid,
  computeMoveDraft,
  computeResizeDraft,
  computeSelectDraft,
} from '../../src/core/interaction/gestureGeometry.js';
import { validateOccupancy } from '../../src/core/interaction/occupancy.js';
import { applyEventTimeChange, minutesToDateTime } from '../../src/core/interaction/model.js';
import type { PlacementInfo, GridBounds, EventChange } from '../../src/core/interaction/model.js';
import type { CalendarEvent, EventOccurrence } from '../../src/core/types/event.js';

const BOUNDS: GridBounds = { startMin: 6 * 60, endMin: 20 * 60 }; // 360..1200

function occurrenceOf(event: CalendarEvent): EventOccurrence {
  return {
    event,
    masterId: event.id,
    originalStart: event.time.start.dateTime ?? event.time.start.date ?? '',
    isMaster: true,
  };
}

function placement(startMin: number, endMin: number, editable = true): PlacementInfo {
  const event: CalendarEvent = {
    id: 'e1',
    calendarId: 'c1',
    title: 'X',
    time: {
      allDay: false,
      start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
    },
    ...(editable ? {} : { editable: false }),
  };
  return {
    eventId: 'e1@2026-07-22T09:00:00',
    dateISO: '2026-07-22',
    startMin,
    endMin,
    occurrence: occurrenceOf(event),
    editable,
  };
}

describe('gestureGeometry — snap', () => {
  it('arredonda ao slot (nearest/floor/ceil)', () => {
    expect(snapMinute(547, 30, 'nearest')).toBe(540);
    expect(snapMinute(555, 30, 'nearest')).toBe(570);
    expect(snapMinute(559, 30, 'floor')).toBe(540);
    expect(snapMinute(541, 30, 'ceil')).toBe(570);
  });

  it('sem grade (slot<=0) apenas arredonda ao minuto', () => {
    expect(snapMinute(540.4, 0)).toBe(540);
  });
});

describe('gestureGeometry — clampSpanToGrid preserva duração', () => {
  it('desliza para dentro quando transborda o fundo', () => {
    const result = clampSpanToGrid(1170, 1290, BOUNDS); // dur 120, fundo 1200
    expect(result.endMin).toBe(BOUNDS.endMin);
    expect(result.startMin).toBe(BOUNDS.endMin - 120);
  });

  it('sobe para o topo quando começa antes do grid', () => {
    const result = clampSpanToGrid(300, 360, BOUNDS); // dur 60, topo 360
    expect(result.startMin).toBe(BOUNDS.startMin);
    expect(result.endMin).toBe(BOUNDS.startMin + 60);
  });
});

describe('gestureGeometry — move', () => {
  it('conversão opt-in timed→allDay conserva dias de duração e não converte na grade mensal', () => {
    const origin = { ...placement(540, 600), resourceId: 'sala', durationMinutes: 1500 };
    const pointer = { dateISO: '2026-07-24', minuteOfDay: 0, allDay: true, resourceId: 'coleta' };
    expect(computeMoveDraft(origin, pointer, 15, 30, BOUNDS, true)).toEqual({
      dateISO: '2026-07-24',
      startMin: 0,
      endMin: 0,
      endDateISO: '2026-07-26',
      allDay: true,
      resourceId: 'coleta',
    });
    expect(computeMoveDraft(origin, pointer, 15, 30, BOUNDS).allDay).toBeUndefined();
    expect(
      computeMoveDraft(origin, { ...pointer, dateOnly: true }, -540, 30, BOUNDS, true).allDay,
    ).toBeUndefined();
  });

  it('conversão opt-in allDay→timed mantém dias completos e persiste tipo/endpoints corretos', () => {
    const origin = {
      ...placement(0, 0),
      allDay: true,
      endDateISO: '2026-07-25',
      resourceId: 'triagem',
    };
    const event = {
      ...origin.occurrence.event,
      time: { allDay: true, start: { date: '2026-07-22' }, end: { date: '2026-07-25' } },
    };
    const draft = computeMoveDraft(
      origin,
      { dateISO: '2026-07-26', minuteOfDay: 490 },
      1440,
      30,
      BOUNDS,
      true,
    );
    expect(draft).toEqual({
      dateISO: '2026-07-26',
      startMin: 480,
      endDateISO: '2026-07-29',
      endMin: 480,
      allDay: false,
      resourceId: 'triagem',
    });
    const [next] = applyEventTimeChange([event], {
      ...draft,
      kind: 'move',
      occurrence: occurrenceOf(event),
      event,
      startDateTime: minutesToDateTime(draft.dateISO, draft.startMin),
      endDateTime: minutesToDateTime(draft.endDateISO!, draft.endMin),
      timeZone: 'America/Sao_Paulo',
    });
    expect(next!.time).toEqual({
      allDay: false,
      start: { dateTime: '2026-07-26T08:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-07-29T08:00:00', timeZone: 'America/Sao_Paulo' },
    });
  });

  it('mantém a duração e ancora sob o ponto de agarre', () => {
    const origin = placement(540, 600); // 09:00–10:00, dur 60
    const grabOffset = 0; // agarrou no topo
    const draft = computeMoveDraft(
      origin,
      { dateISO: '2026-07-23', minuteOfDay: 660 },
      grabOffset,
      30,
      BOUNDS,
    );
    expect(draft.dateISO).toBe('2026-07-23'); // moveu de dia
    expect(draft.startMin).toBe(660); // 11:00
    expect(draft.endMin).toBe(720); // 12:00 (dur preservada)
  });

  it('respeita o offset de agarre (não “pula” o evento para o cursor)', () => {
    const origin = placement(540, 600);
    // agarrou 30min abaixo do topo; cursor em 690 ⇒ início 660
    const draft = computeMoveDraft(
      origin,
      { dateISO: '2026-07-22', minuteOfDay: 690 },
      30,
      30,
      BOUNDS,
    );
    expect(draft.startMin).toBe(660);
    expect(draft.endMin).toBe(720);
  });
});

describe('gestureGeometry — resize', () => {
  it('redimensiona início com snap, limite do grid e duração mínima, sem trocar recurso', () => {
    const origin = { ...placement(540, 600), resourceId: 'triagem' };
    const pointer = { dateISO: origin.dateISO, minuteOfDay: 490, resourceId: 'outra-sala' };
    expect(computeResizeDraft(origin, pointer, 30, 15, BOUNDS, 'start')).toEqual({
      dateISO: origin.dateISO,
      startMin: 480,
      endMin: 600,
      resourceId: 'triagem',
    });
    expect(
      computeResizeDraft(origin, { ...pointer, minuteOfDay: 660 }, 30, 45, BOUNDS, 'start')
        .startMin,
    ).toBe(555);
    expect(
      computeResizeDraft(origin, { ...pointer, minuteOfDay: 0 }, 30, 15, BOUNDS, 'start').startMin,
    ).toBe(360);
  });

  it('expande início para dia anterior e preserva fim de um intervalo noturno', () => {
    const origin = { ...placement(1140, 540), endDateISO: '2026-07-23', resourceId: 'coleta' };
    expect(
      computeResizeDraft(
        origin,
        { dateISO: '2026-07-21', minuteOfDay: 1150 },
        30,
        15,
        BOUNDS,
        'start',
      ),
    ).toEqual({
      dateISO: '2026-07-21',
      startMin: 1140,
      endDateISO: '2026-07-23',
      endMin: 540,
      resourceId: 'coleta',
    });
    expect(
      computeResizeDraft(
        origin,
        { dateISO: '2026-07-24', minuteOfDay: 600 },
        30,
        15,
        BOUNDS,
        'start',
      ),
    ).toEqual({
      dateISO: '2026-07-23',
      startMin: 510,
      endDateISO: '2026-07-23',
      endMin: 540,
      resourceId: 'coleta',
    });
  });

  it('mês preserva relógio e meia-noite exclusiva ao mudar a data do início', () => {
    const origin = { ...placement(557, 0), endDateISO: '2026-07-24' };
    expect(
      computeResizeDraft(
        origin,
        { dateISO: '2026-07-21', minuteOfDay: 0, dateOnly: true },
        30,
        15,
        BOUNDS,
        'start',
      ),
    ).toEqual({ dateISO: '2026-07-21', startMin: 557, endDateISO: '2026-07-24', endMin: 0 });
    // Crossing the fixed endpoint clamps to the minimum interval, never a negative duration.
    expect(
      computeResizeDraft(
        origin,
        { dateISO: '2026-07-25', minuteOfDay: 0, dateOnly: true },
        30,
        15,
        BOUNDS,
        'start',
      ),
    ).toEqual({ dateISO: '2026-07-23', startMin: 1425, endDateISO: '2026-07-24', endMin: 0 });
  });

  it('início de dia inteiro mantém fim exclusivo e pelo menos um dia', () => {
    const origin = {
      ...placement(0, 0),
      allDay: true,
      endDateISO: '2026-07-25',
      resourceId: 'triagem',
    };
    expect(
      computeResizeDraft(
        origin,
        { dateISO: '2026-07-20', minuteOfDay: 0, allDay: true },
        30,
        15,
        BOUNDS,
        'start',
      ),
    ).toEqual({
      dateISO: '2026-07-20',
      startMin: 0,
      endMin: 0,
      allDay: true,
      endDateISO: '2026-07-25',
      resourceId: 'triagem',
    });
    expect(
      computeResizeDraft(
        origin,
        { dateISO: '2026-07-27', minuteOfDay: 0, allDay: true },
        30,
        15,
        BOUNDS,
        'start',
      ).dateISO,
    ).toBe('2026-07-24');
  });

  it('mantém o início e move o fim (com duração mínima)', () => {
    const origin = placement(540, 600);
    const draft = computeResizeDraft(
      origin,
      { dateISO: '2026-07-22', minuteOfDay: 700 },
      30,
      15,
      BOUNDS,
    );
    expect(draft.startMin).toBe(540);
    expect(draft.endMin).toBe(690); // 700 snap→690
  });

  it('nunca fica abaixo da duração mínima', () => {
    const origin = placement(540, 600);
    const draft = computeResizeDraft(
      origin,
      { dateISO: '2026-07-22', minuteOfDay: 540 },
      30,
      15,
      BOUNDS,
    );
    expect(draft.endMin).toBeGreaterThanOrEqual(540 + 30); // min(15,slot30)=30
  });
});

describe('gestureGeometry — select', () => {
  it('ordena âncora/cursor e faz snap para fora', () => {
    const draft = computeSelectDraft(
      { dateISO: '2026-07-22', minuteOfDay: 815 },
      { dateISO: '2026-07-22', minuteOfDay: 785 },
      30,
      15,
      BOUNDS,
    );
    expect(draft.startMin).toBe(780); // floor(785)
    expect(draft.endMin).toBe(840); // ceil(815)
  });
});

describe('occupancy — lotação e buffer', () => {
  const busyAt = (startMin: number, endMin: number) => ({ startMin, endMin });

  it('lotação já estourada longe do candidato não barra outro horário', () => {
    expect(
      validateOccupancy(busyAt(720, 780), {
        capacity: 1,
        bufferBefore: 15,
        bufferAfter: 15,
        busy: [busyAt(540, 600), busyAt(550, 610)],
      }),
    ).toEqual({ valid: true, reason: 'ok' });
  });

  it('não conta pico de concorrência fora da interseção com o candidato', () => {
    expect(
      validateOccupancy(busyAt(150, 200), {
        capacity: 2,
        bufferBefore: 0,
        bufferAfter: 0,
        busy: [busyAt(100, 160), busyAt(110, 140), busyAt(130, 145)],
      }),
    ).toEqual({ valid: true, reason: 'ok' });
  });

  it('capacity 1: candidato sobre evento existente ⇒ over-capacity', () => {
    const result = validateOccupancy(busyAt(660, 720), {
      capacity: 1,
      bufferBefore: 0,
      bufferAfter: 0,
      busy: [busyAt(660, 720)],
    });
    expect(result).toEqual({ valid: false, reason: 'over-capacity' });
  });

  it('capacity 2: dois simultâneos ainda cabem', () => {
    const result = validateOccupancy(busyAt(660, 720), {
      capacity: 2,
      bufferBefore: 0,
      bufferAfter: 0,
      busy: [busyAt(660, 720)],
    });
    expect(result.valid).toBe(true);
  });

  it('back-to-back dentro do buffer ⇒ buffer-conflict', () => {
    // existente 600–660; candidato 660–720 encostado; buffer 15 ⇒ conflito
    const result = validateOccupancy(busyAt(660, 720), {
      capacity: 1,
      bufferBefore: 15,
      bufferAfter: 15,
      busy: [busyAt(600, 660)],
    });
    expect(result).toEqual({ valid: false, reason: 'buffer-conflict' });
  });

  it('com folga suficiente ⇒ ok', () => {
    const result = validateOccupancy(busyAt(720, 780), {
      capacity: 1,
      bufferBefore: 15,
      bufferAfter: 15,
      busy: [busyAt(600, 660)],
    });
    expect(result).toEqual({ valid: true, reason: 'ok' });
  });
});

describe('model — apply/format', () => {
  it('minutesToDateTime formata wall-clock', () => {
    expect(minutesToDateTime('2026-07-22', 545)).toBe('2026-07-22T09:05:00');
  });

  it('1440 representa meia-noite do dia seguinte inclusive viradas de mês/ano e anos abaixo de 100', () => {
    expect(minutesToDateTime('2024-02-29', 1440)).toBe('2024-03-01T00:00:00');
    expect(minutesToDateTime('2026-12-31', 1440)).toBe('2027-01-01T00:00:00');
    expect(minutesToDateTime('0099-12-31', 1440)).toBe('0100-01-01T00:00:00');
  });

  it('persiste horários novos na timezone em que o gesto foi feito', () => {
    const event = placement(540, 600).occurrence.event;
    const change: EventChange = {
      kind: 'move',
      event,
      occurrence: occurrenceOf(event),
      dateISO: '2026-07-22',
      startMin: 660,
      endMin: 720,
      startDateTime: '2026-07-22T11:00:00',
      endDateTime: '2026-07-22T12:00:00',
      timeZone: 'America/New_York',
    };
    const [next] = applyEventTimeChange([event], change);
    expect(next!.time.start.timeZone).toBe('America/New_York');
    expect(next!.time.end.timeZone).toBe('America/New_York');
  });

  it('applyEventTimeChange troca só o wall-clock do evento não-recorrente', () => {
    const event: CalendarEvent = {
      id: 'e1',
      calendarId: 'c1',
      title: 'X',
      time: {
        allDay: false,
        start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
      },
    };
    const change: EventChange = {
      kind: 'move',
      occurrence: occurrenceOf(event),
      event,
      dateISO: '2026-07-22',
      startMin: 660,
      endMin: 720,
      startDateTime: '2026-07-22T11:00:00',
      endDateTime: '2026-07-22T12:00:00',
    };
    const next = applyEventTimeChange([event], change);
    expect(next[0]!.time.start.dateTime).toBe('2026-07-22T11:00:00');
    expect(next[0]!.time.end.dateTime).toBe('2026-07-22T12:00:00');
    expect(next[0]!.time.start.timeZone).toBe('America/Sao_Paulo'); // preservado
  });

  it('não muta eventos recorrentes (exigiriam override)', () => {
    const event: CalendarEvent = {
      id: 'r1',
      calendarId: 'c1',
      title: 'Série',
      time: {
        allDay: false,
        start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
      },
      recurrence: { rule: { freq: 'DAILY' } },
    };
    const change: EventChange = {
      kind: 'move',
      occurrence: { event, masterId: 'r1', originalStart: '2026-07-22T09:00:00', isMaster: false },
      event,
      dateISO: '2026-07-22',
      startMin: 660,
      endMin: 720,
      startDateTime: '2026-07-22T11:00:00',
      endDateTime: '2026-07-22T12:00:00',
    };
    const next = applyEventTimeChange([event], change);
    expect(next[0]!.time.start.dateTime).toBe('2026-07-22T09:00:00'); // inalterado
  });
});
