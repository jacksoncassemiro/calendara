// @vitest-environment jsdom
import { BUILTIN_VIEWS } from '../../src/react/views/registry/defaultViews.js';
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { InteractionEngine, type InteractionDeps } from '../../src/core/index.js';
import type {
  PointerSlot,
  EventChange,
  SelectionChange,
  BlockedInfo,
  PlacementInfo,
} from '../../src/core/index.js';
import type { CalendarEvent, EventOccurrence } from '../../src/core/index.js';
import type { ConstraintSet } from '../../src/core/index.js';
import type { CalendarResource } from '../../src/core/index.js';

const TZ = 'America/Sao_Paulo';
const REF = '2026-07-22';

/** Dispara um "pointer event" (jsdom não constrói PointerEvent; MouseEvent basta). */
function firePointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 }));
}

/**
 * Igual a `firePointer`, mas com um `pointerId` explícito (MouseEvent não tem esse campo nativo —
 * o motor lê `event.pointerId` via `readCoords`, então injetamos como propriedade expando antes
 * do dispatch). Usado para simular múltiplos ponteiros (multi-touch) num mesmo teste.
 */
function firePointerId(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
  pointerId: number,
): void {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
  target.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// InteractionEngine isolado (localizador injetado ⇒ determinístico, sem layout).
// ---------------------------------------------------------------------------

describe('InteractionEngine — máquina de gesto (localizador injetado)', () => {
  function buildDom(): {
    container: HTMLElement;
    eventNode: HTMLElement;
    handle: HTMLElement;
    column: HTMLElement;
  } {
    const container = document.createElement('div');
    const column = document.createElement('div');
    column.setAttribute('data-mc-day', REF);
    const eventNode = document.createElement('div');
    eventNode.setAttribute('data-mc-event', 'e1@2026-07-22T09:00:00');
    eventNode.dataset.mcStartMin = '540';
    eventNode.dataset.mcEndMin = '600';
    eventNode.dataset.mcEditable = 'true';
    const handle = document.createElement('div');
    handle.setAttribute('data-mc-resize', '');
    eventNode.appendChild(handle);
    column.appendChild(eventNode);
    container.appendChild(column);
    document.body.appendChild(container);
    return { container, eventNode, handle, column };
  }

  const occurrence: EventOccurrence = {
    event: {
      id: 'e1',
      calendarId: 'c1',
      title: 'X',
      time: {
        allDay: false,
        start: { dateTime: '2026-07-22T09:00:00', timeZone: TZ },
        end: { dateTime: '2026-07-22T10:00:00', timeZone: TZ },
      },
    },
    masterId: 'e1',
    originalStart: '2026-07-22T09:00:00',
    isMaster: true,
  };

  function makeEngine(overrides: Partial<InteractionDeps> = {}) {
    const calls = {
      move: [] as EventChange[],
      resize: [] as EventChange[],
      select: [] as SelectionChange[],
      blocked: [] as BlockedInfo[],
      clickEvent: [] as PlacementInfo[],
      clickEmpty: [] as PointerSlot[],
    };
    const deps: InteractionDeps = {
      getGridBounds: () => ({ startMin: 360, endMin: 1200 }),
      getSlotMinutes: () => 30,
      getMinDurationMin: () => 15,
      // localizador injetado: minuto == clientY (linear e previsível).
      locateSlot: (clientX: number, clientY: number): PointerSlot => ({
        dateISO: REF,
        minuteOfDay: clientY,
      }),
      evaluate: (input) => {
        const blockedZone = input.startMin >= 720; // ≥12:00 é inválido neste stub
        return blockedZone ? { valid: false, reason: 'blocked' } : { valid: true, reason: 'ok' };
      },
      resolveOccurrence: () => occurrence,
      callbacks: {
        onDraftChange: () => {},
        commitMove: (change) => calls.move.push(change),
        commitResize: (change) => calls.resize.push(change),
        commitSelect: (selection) => calls.select.push(selection),
        clickEvent: (placement) => calls.clickEvent.push(placement),
        clickEmpty: (slot) => calls.clickEmpty.push(slot),
        blocked: (info) => calls.blocked.push(info),
      },
      ...overrides,
    };
    return { engine: new InteractionEngine(deps), calls };
  }

  it('MOVER commita a nova posição (duração preservada)', () => {
    const { container, eventNode } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer(eventNode, 'pointerdown', 5, 540);
    firePointer(document, 'pointermove', 5, 660);
    firePointer(document, 'pointerup', 5, 660);
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);
    expect(calls.move[0]!.startDateTime).toBe('2026-07-22T11:00:00');
    engine.detach();
  });

  it('drop inválido chama blocked e NÃO commita', () => {
    const { container, eventNode } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer(eventNode, 'pointerdown', 5, 540);
    firePointer(document, 'pointermove', 5, 780); // ≥12:00 ⇒ inválido
    firePointer(document, 'pointerup', 5, 780);
    expect(calls.move).toHaveLength(0);
    expect(calls.blocked).toHaveLength(1);
    expect(calls.blocked[0]!.reason).toBe('blocked');
    engine.detach();
  });

  it('REDIMENSIONAR (alça) mantém o início e move o fim', () => {
    const { container, handle } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer(handle, 'pointerdown', 5, 600);
    firePointer(document, 'pointermove', 5, 690);
    firePointer(document, 'pointerup', 5, 690);
    expect(calls.resize).toHaveLength(1);
    expect(calls.resize[0]!.startMin).toBe(540);
    expect(calls.resize[0]!.endMin).toBe(690);
    engine.detach();
  });

  it('SELECIONAR em área vazia emite intervalo', () => {
    const { container, column } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    // 10:00 (600) → 11:00 (660), abaixo da zona inválida do stub (≥720).
    firePointer(column, 'pointerdown', 5, 600);
    firePointer(document, 'pointermove', 5, 660);
    firePointer(document, 'pointerup', 5, 660);
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toEqual({ dateISO: REF, startMin: 600, endMin: 660 });
    engine.detach();
  });

  it('clique (sem arrasto) no evento dispara clickEvent, não move', () => {
    const { container, eventNode } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer(eventNode, 'pointerdown', 5, 540);
    firePointer(document, 'pointerup', 5, 540);
    expect(calls.move).toHaveLength(0);
    expect(calls.clickEvent).toHaveLength(1);
    engine.detach();
  });

  it('um segundo pointerdown (pointerId diferente) durante um gesto ativo não o corrompe — o original ainda commita', () => {
    const { container, eventNode, column } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointerId(eventNode, 'pointerdown', 5, 540, 1);
    // segundo "dedo" toca a coluna vazia enquanto o gesto 1 (mover) está ativo.
    firePointerId(column, 'pointerdown', 5, 600, 2);
    firePointerId(document, 'pointermove', 5, 660, 1);
    firePointerId(document, 'pointerup', 5, 660, 1);
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.select).toHaveLength(0);
    engine.detach();
  });

  it('pointercancel aborta o gesto sem commitar; o próximo pointerdown (pointerId novo) é aceito', () => {
    const { container, eventNode, column } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointerId(eventNode, 'pointerdown', 5, 540, 1);
    firePointerId(document, 'pointermove', 5, 660, 1);
    firePointerId(document, 'pointercancel', 5, 660, 1);
    expect(calls.move).toHaveLength(0);
    expect(calls.blocked).toHaveLength(0);

    // o motor não ficou travado: um gesto novo com pointerId diferente completa normalmente.
    firePointerId(column, 'pointerdown', 5, 600, 2);
    firePointerId(document, 'pointermove', 5, 660, 2);
    firePointerId(document, 'pointerup', 5, 660, 2);
    expect(calls.select).toHaveLength(1);
    engine.detach();
  });

  it('ignores movement from another pointer while dragging', () => {
    const { container, eventNode } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointerId(eventNode, 'pointerdown', 5, 540, 1);
    firePointerId(document, 'pointermove', 5, 660, 1);
    firePointerId(document, 'pointermove', 5, 900, 2);
    firePointerId(document, 'pointerup', 5, 660, 1);
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    engine.detach();
  });
});

// ---------------------------------------------------------------------------
// Integração via CalendarApp (retângulos das colunas stubados ⇒ minuto=360+clientY).
// ---------------------------------------------------------------------------

/** Stub de layout: cada coluna do dia ocupa [0..100]x, altura = (endHour-startHour)*60. */
function stubColumnRects(container: HTMLElement, heightMin: number): void {
  for (const column of Array.from(container.querySelectorAll('[data-mc-day]'))) {
    (column as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        right: 100,
        top: 0,
        bottom: heightMin,
        width: 100,
        height: heightMin,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
  }
}

const baseOptions = {
  timeZone: TZ,
  startHour: 6,
  endHour: 20,
  slotMinutes: 30,
  pxPerMinute: 1,
  nowMs: 0,
  weekStart: 'MO' as const,
  locale: 'pt-BR',
  minEventMinutes: 15,
};

const eventE1: CalendarEvent = {
  id: 'e1',
  calendarId: 'c1',
  title: 'Consulta',
  time: {
    allDay: false,
    start: { dateTime: '2026-07-22T09:00:00', timeZone: TZ },
    end: { dateTime: '2026-07-22T10:00:00', timeZone: TZ },
  },
};

describe('CalendarApp — interação ponta-a-ponta (jsdom)', () => {
  it('validates every day of a full interval including capacity outside the visible day', async () => {
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      temporal: Temporal as never,
      date: REF,
      view: 'day',
      resources: [{ id: 'r1', title: 'Sala' }],
      events: [
        {
          id: 'busy',
          calendarId: 'c1',
          resourceIds: ['r1'],
          time: { allDay: true, start: { date: '2026-07-23' }, end: { date: '2026-07-24' } },
        },
      ],
      constraints: { blocked: [{ scope: 'date', date: '2026-07-24' }] },
    });
    await app.ready();
    expect(
      app.evaluatePlacement({
        kind: 'move',
        dateISO: REF,
        startMin: 1380,
        endDateISO: '2026-07-23',
        endMin: 60,
        resourceId: 'r1',
      }).reason,
    ).toBe('over-capacity');
    expect(
      app.evaluatePlacement({
        kind: 'move',
        dateISO: REF,
        startMin: 0,
        endDateISO: '2026-07-25',
        endMin: 0,
        allDay: true,
      }).valid,
    ).toBe(false);
    expect(
      app.evaluatePlacement({
        kind: 'move',
        dateISO: REF,
        startMin: 0,
        endDateISO: '2026-07-23',
        endMin: 0,
        allDay: true,
      }).valid,
    ).toBe(true);
    app.destroy();
  });
  it('restores the original event when two overlapping saves both reject', async () => {
    const resolvers: ((result: boolean) => void)[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [eventE1],
      temporal: Temporal as never,
      options: baseOptions,
      onEventDrop: () =>
        new Promise<boolean>((resolve) => {
          resolvers.push(resolve);
        }),
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, 840);
    firePointer(container.querySelector('[data-mc-event]')!, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);
    firePointer(container.querySelector('[data-mc-event]')!, 'pointerdown', 5, 300);
    firePointer(document, 'pointermove', 5, 360);
    firePointer(document, 'pointerup', 5, 360);
    expect(resolvers).toHaveLength(2);
    resolvers[0]!(false);
    await Promise.resolve();
    resolvers[1]!(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(app.getState().events[0]!.time.start.dateTime).toBe(eventE1.time.start.dateTime);
    app.destroy();
  });
  it('validates new reservations against capacity and resource hours outside the visible range', async () => {
    const occupied: CalendarEvent = {
      ...eventE1,
      resourceIds: ['r1'],
      time: {
        allDay: false,
        start: { dateTime: '2026-08-10T09:00:00', timeZone: TZ },
        end: { dateTime: '2026-08-10T10:00:00', timeZone: TZ },
      },
    };
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [occupied],
      temporal: Temporal as never,
      resources: [
        {
          id: 'r1',
          title: 'Sala',
          capacity: 1,
          businessHours: [{ daysOfWeek: [1], startTime: '08:00', endTime: '18:00' }],
        },
      ],
      options: baseOptions,
    });
    await app.ready();
    const candidate = {
      kind: 'select' as const,
      dateISO: '2026-08-10',
      startMin: 570,
      endMin: 600,
      resourceId: 'r1',
    };
    expect(app.evaluatePlacement(candidate)).toEqual({ valid: false, reason: 'over-capacity' });
    expect(app.evaluatePlacement({ ...candidate, startMin: 660, endMin: 690 })).toEqual({
      valid: true,
      reason: 'ok',
    });
    expect(app.evaluatePlacement({ ...candidate, startMin: 1140, endMin: 1170 })).toEqual({
      valid: false,
      reason: 'outside-business-hours',
    });
    app.destroy();
  });

  it('commits display wall-clock time with the display timezone instead of the source timezone', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const source: CalendarEvent = {
      ...eventE1,
      time: {
        allDay: false,
        start: { dateTime: '2026-07-22T12:00:00', timeZone: 'UTC' },
        end: { dateTime: '2026-07-22T13:00:00', timeZone: 'UTC' },
      },
    };
    const drops: EventChange[] = [];
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [source],
      temporal: Temporal as never,
      options: baseOptions,
      onEventDrop: (change) => {
        drops.push(change);
      },
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, 840);
    const node = container.querySelector('[data-mc-event]')!;
    firePointer(node, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);
    expect(drops[0]?.timeZone).toBe(TZ);
    expect(app.getState().events[0]?.time.start).toEqual({
      dateTime: '2026-07-22T11:00:00',
      timeZone: TZ,
    });
    app.destroy();
  });

  it('counts an all-day resource reservation when validating a timed move', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const blocked: BlockedInfo[] = [];
    const reservation: CalendarEvent = {
      id: 'reservation',
      calendarId: 'c1',
      resourceIds: ['r1'],
      time: { allDay: true, start: { date: REF }, end: { date: '2026-07-23' } },
    };
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [{ ...eventE1, resourceIds: ['r1'] }, reservation],
      resources: [{ id: 'r1', title: 'Sala' }],
      temporal: Temporal as never,
      options: baseOptions,
      onDropBlocked: (info) => {
        blocked.push(info);
      },
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, 840);
    const node = container.querySelector('[data-mc-day] [data-mc-event][data-mc-start-min]')!;
    firePointer(node, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);
    expect(blocked[0]?.reason).toBe('over-capacity');
    expect(app.getState().events[0]?.time.start.dateTime).toBe('2026-07-22T09:00:00');
    app.destroy();
  });

  it('reverts a failed commit without losing an unrelated event update', async () => {
    let rejectDrop!: (value: boolean) => void;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const other = { ...eventE1, id: 'other', title: 'Other' };
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [eventE1, other],
      temporal: Temporal as never,
      options: baseOptions,
      onEventDrop: () =>
        new Promise<boolean>((resolve) => {
          rejectDrop = resolve;
        }),
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, 840);
    const node = container.querySelector('[data-mc-event="e1@2026-07-22T09:00:00"]')!;
    firePointer(node, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);
    app.setEvents([app.getState().events[0]!, { ...other, title: 'Updated' }]);
    rejectDrop(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(app.getState().events[0]!.time.start.dateTime).toBe(eventE1.time.start.dateTime);
    expect(app.getState().events[1]!.title).toBe('Updated');
    app.destroy();
  });

  it('reverts callbacks that throw synchronously and clears the draft', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [eventE1],
      temporal: Temporal as never,
      options: baseOptions,
      onEventDrop: () => {
        throw new Error('save failed');
      },
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, 840);
    firePointer(container.querySelector('[data-mc-event]')!, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);
    expect(app.getState().events[0]!.time.start.dateTime).toBe(eventE1.time.start.dateTime);
    expect(container.querySelector('[data-mc-draft]')).toBeNull();
    app.destroy();
  });

  it('renders after a rejected initial event source and reports the error', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const failure = new Error('offline');
    const errors: unknown[] = [];
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      temporal: Temporal as never,
      events: [eventE1],
      eventSource: () => Promise.reject(failure),
    });
    app.on('error', (error) => errors.push(error));
    app.mount(container);
    await app.ready();
    expect(container.querySelector('[data-mc-root]')).toBeTruthy();
    expect(errors).toEqual([failure]);
    expect(app.getState().events).toEqual([eventE1]);
    app.destroy();
  });
  it('arrastar persiste no store e chama onEventDrop', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const drops: EventChange[] = [];
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [eventE1],
      temporal: Temporal as unknown as never,
      options: baseOptions,
      onEventDrop: (change) => {
        drops.push(change);
      },
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, (20 - 6) * 60);

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    expect(eventNode).toBeTruthy();
    // topo do evento = (540-360)=180px ⇒ minuto 540; solta em clientY 300 ⇒ minuto 660 (11:00)
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);

    expect(drops).toHaveLength(1);
    const movedEvent = app.getState().events[0]!;
    expect(movedEvent.time.start.dateTime).toBe('2026-07-22T11:00:00');
    expect(movedEvent.time.end.dateTime).toBe('2026-07-22T12:00:00');
    app.destroy();
  });

  it('drop em horário bloqueado chama onDropBlocked e reverte', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const blocked: BlockedInfo[] = [];
    const constraints: ConstraintSet = {
      blocked: [{ scope: 'time', date: REF, startTime: '12:00', endTime: '13:00' }],
    };
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [eventE1],
      constraints,
      temporal: Temporal as unknown as never,
      options: baseOptions,
      onDropBlocked: (info) => blocked.push(info),
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, (20 - 6) * 60);

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    // solta em clientY 360 ⇒ minuto 720 (12:00), dentro do bloqueio
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 360);
    firePointer(document, 'pointerup', 5, 360);

    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.reason).toBe('blocked');
    // revert: evento continua às 09:00
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T09:00:00');
    app.destroy();
  });

  it('seleção em área vazia chama onDateSelect', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const selections: SelectionChange[] = [];
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [],
      temporal: Temporal as unknown as never,
      options: baseOptions,
      onDateSelect: (selection) => selections.push(selection),
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, (20 - 6) * 60);

    const column = container.querySelector('[data-mc-day]') as HTMLElement;
    // 13:00 (clientY 420) → 14:00 (clientY 480)
    firePointer(column, 'pointerdown', 5, 420);
    firePointer(document, 'pointermove', 5, 480);
    firePointer(document, 'pointerup', 5, 480);

    expect(selections).toHaveLength(1);
    expect(selections[0]).toEqual({ dateISO: REF, startMin: 780, endMin: 840 });
    app.destroy();
  });

  it('validação DURA de lotação: mover sobre recurso cheio (capacity 1) é barrado', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const blocked: BlockedInfo[] = [];
    const resources: CalendarResource[] = [{ id: 'r1', title: 'Sala 1', capacity: 1 }];
    const events: CalendarEvent[] = [
      { ...eventE1, id: 'e1', resourceIds: ['r1'] },
      {
        id: 'e2',
        calendarId: 'c1',
        title: 'Outro',
        resourceIds: ['r1'],
        time: {
          allDay: false,
          start: { dateTime: '2026-07-22T11:00:00', timeZone: TZ },
          end: { dateTime: '2026-07-22T12:00:00', timeZone: TZ },
        },
      },
    ];
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events,
      resources,
      temporal: Temporal as unknown as never,
      options: baseOptions,
      onDropBlocked: (info) => blocked.push(info),
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, (20 - 6) * 60);

    // e1 (09:00, topo 180) movido para 11:00 (clientY 300) — colide com e2 no mesmo recurso.
    const e1Node = container.querySelector(
      '[data-mc-event="e1@2026-07-22T09:00:00"]',
    ) as HTMLElement;
    expect(e1Node).toBeTruthy();
    firePointer(e1Node, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);

    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.reason).toBe('over-capacity');
    // revert: e1 continua às 09:00
    expect(app.getState().events.find((event) => event.id === 'e1')!.time.start.dateTime).toBe(
      '2026-07-22T09:00:00',
    );
    app.destroy();
  });

  it('pointercancel (ex.: browser assume o scroll) aborta o arrasto sem commit, limpa o fantasma e libera o próximo gesto', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const drops: EventChange[] = [];
    const app = new CalendarApp({
      views: BUILTIN_VIEWS,
      date: REF,
      view: 'day',
      events: [eventE1],
      temporal: Temporal as unknown as never,
      options: baseOptions,
      onEventDrop: (change) => {
        drops.push(change);
      },
    });
    app.mount(container);
    await app.ready();
    stubColumnRects(container, (20 - 6) * 60);

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300); // passa o threshold ⇒ agenda o render do fantasma
    // o render do rascunho agora é throttled via rAF (Bug de hardening #3) — espera o frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(container.querySelector('[data-mc-draft]')).toBeTruthy();

    firePointer(document, 'pointercancel', 5, 300);

    // aborto: nenhum commit, evento permanece no horário original.
    expect(drops).toHaveLength(0);
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T09:00:00');
    // fantasma limpo (onDraftChange(null) renderizou de imediato).
    expect(container.querySelector('[data-mc-draft]')).toBeNull();

    // o motor não ficou travado: um novo arrasto (mesmo pointerId, gesto novo) ainda funciona.
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);
    expect(drops).toHaveLength(1);
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T11:00:00');

    app.destroy();
  });
});
