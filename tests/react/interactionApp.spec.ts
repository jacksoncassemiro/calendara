// @vitest-environment jsdom
import { BUILTIN_VIEWS } from '../../src/react/views/registry/defaultViews.js';
import { describe, it, expect } from 'vitest';
import { Temporal } from 'temporal-polyfill';
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

/** Use MouseEvent when jsdom lacks PointerEvent. / PT: Usa MouseEvent quando jsdom não oferece PointerEvent. */
function firePointer({
  target,
  type,
  clientX,
  clientY,
}: {
  /** Dispatch target. / PT: Alvo do disparo. */
  target: EventTarget;
  /** Pointer event name. / PT: Nome do evento de ponteiro. */
  type: string;
  /** Horizontal client coordinate in pixels. / PT: Coordenada horizontal do cliente em pixels. */
  clientX: number;
  /** Vertical client coordinate in pixels. / PT: Coordenada vertical do cliente em pixels. */
  clientY: number;
}): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 }));
}

/** Attach pointer identity to simulate concurrent contacts. / PT: Adiciona identidade para simular contatos simultâneos. */
function firePointerId({
  target,
  type,
  clientX,
  clientY,
  pointerId,
}: {
  /** Dispatch target. / PT: Alvo do disparo. */
  target: EventTarget;
  /** Pointer event name. / PT: Nome do evento de ponteiro. */
  type: string;
  /** Horizontal client coordinate in pixels. / PT: Coordenada horizontal do cliente em pixels. */
  clientX: number;
  /** Vertical client coordinate in pixels. / PT: Coordenada vertical do cliente em pixels. */
  clientY: number;
  /** Identity of the simulated pointer. / PT: Identidade do ponteiro simulado. */
  pointerId: number;
}): void {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
  target.dispatchEvent(event);
}

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
      locateSlot: (clientX: number, clientY: number): PointerSlot => ({
        dateISO: REF,
        minuteOfDay: clientY,
      }),
      evaluate: (input) => {
        const blockedZone = input.startMin >= 720;
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
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 540 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 660 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 660 });
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
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 540 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 780 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 780 });
    expect(calls.move).toHaveLength(0);
    expect(calls.blocked).toHaveLength(1);
    expect(calls.blocked[0]!.reason).toBe('blocked');
    engine.detach();
  });

  it('REDIMENSIONAR (alça) mantém o início e move o fim', () => {
    const { container, handle } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer({ target: handle, type: 'pointerdown', clientX: 5, clientY: 600 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 690 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 690 });
    expect(calls.resize).toHaveLength(1);
    expect(calls.resize[0]!.startMin).toBe(540);
    expect(calls.resize[0]!.endMin).toBe(690);
    engine.detach();
  });

  it('SELECIONAR em área vazia emite intervalo', () => {
    const { container, column } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer({ target: column, type: 'pointerdown', clientX: 5, clientY: 600 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 660 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 660 });
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toEqual({ dateISO: REF, startMin: 600, endMin: 660 });
    engine.detach();
  });

  it('clique (sem arrasto) no evento dispara clickEvent, não move', () => {
    const { container, eventNode } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 540 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 540 });
    expect(calls.move).toHaveLength(0);
    expect(calls.clickEvent).toHaveLength(1);
    engine.detach();
  });

  it('um segundo pointerdown (pointerId diferente) durante um gesto ativo não o corrompe — o original ainda commita', () => {
    const { container, eventNode, column } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointerId({
      target: eventNode,
      type: 'pointerdown',
      clientX: 5,
      clientY: 540,
      pointerId: 1,
    });
    firePointerId({ target: column, type: 'pointerdown', clientX: 5, clientY: 600, pointerId: 2 });
    firePointerId({
      target: document,
      type: 'pointermove',
      clientX: 5,
      clientY: 660,
      pointerId: 1,
    });
    firePointerId({ target: document, type: 'pointerup', clientX: 5, clientY: 660, pointerId: 1 });
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.select).toHaveLength(0);
    engine.detach();
  });

  it('pointercancel aborta o gesto sem commitar; o próximo pointerdown (pointerId novo) é aceito', () => {
    const { container, eventNode, column } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointerId({
      target: eventNode,
      type: 'pointerdown',
      clientX: 5,
      clientY: 540,
      pointerId: 1,
    });
    firePointerId({
      target: document,
      type: 'pointermove',
      clientX: 5,
      clientY: 660,
      pointerId: 1,
    });
    firePointerId({
      target: document,
      type: 'pointercancel',
      clientX: 5,
      clientY: 660,
      pointerId: 1,
    });
    expect(calls.move).toHaveLength(0);
    expect(calls.blocked).toHaveLength(0);

    firePointerId({ target: column, type: 'pointerdown', clientX: 5, clientY: 600, pointerId: 2 });
    firePointerId({
      target: document,
      type: 'pointermove',
      clientX: 5,
      clientY: 660,
      pointerId: 2,
    });
    firePointerId({ target: document, type: 'pointerup', clientX: 5, clientY: 660, pointerId: 2 });
    expect(calls.select).toHaveLength(1);
    engine.detach();
  });

  it('ignores movement from another pointer while dragging', () => {
    const { container, eventNode } = buildDom();
    const { engine, calls } = makeEngine();
    engine.attach(container);
    firePointerId({
      target: eventNode,
      type: 'pointerdown',
      clientX: 5,
      clientY: 540,
      pointerId: 1,
    });
    firePointerId({
      target: document,
      type: 'pointermove',
      clientX: 5,
      clientY: 660,
      pointerId: 1,
    });
    firePointerId({
      target: document,
      type: 'pointermove',
      clientX: 5,
      clientY: 900,
      pointerId: 2,
    });
    firePointerId({ target: document, type: 'pointerup', clientX: 5, clientY: 660, pointerId: 1 });
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    engine.detach();
  });
});

function stubColumnRects({
  container,
  heightMin,
}: {
  container: HTMLElement; /** Column height at one pixel per minute. / PT: Altura da coluna com um pixel por minuto. */
  heightMin: number;
}): void {
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
    stubColumnRects({ container, heightMin: 840 });
    firePointer({
      target: container.querySelector('[data-mc-event]')!,
      type: 'pointerdown',
      clientX: 5,
      clientY: 180,
    });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
    firePointer({
      target: container.querySelector('[data-mc-event]')!,
      type: 'pointerdown',
      clientX: 5,
      clientY: 300,
    });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 360 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 360 });
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
    stubColumnRects({ container, heightMin: 840 });
    const node = container.querySelector('[data-mc-event]')!;
    firePointer({ target: node, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
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
    stubColumnRects({ container, heightMin: 840 });
    const node = container.querySelector('[data-mc-day] [data-mc-event][data-mc-start-min]')!;
    firePointer({ target: node, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
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
    stubColumnRects({ container, heightMin: 840 });
    const node = container.querySelector('[data-mc-event="e1@2026-07-22T09:00:00"]')!;
    firePointer({ target: node, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
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
    stubColumnRects({ container, heightMin: 840 });
    firePointer({
      target: container.querySelector('[data-mc-event]')!,
      type: 'pointerdown',
      clientX: 5,
      clientY: 180,
    });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
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
    stubColumnRects({ container, heightMin: (20 - 6) * 60 });

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    expect(eventNode).toBeTruthy();
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });

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
    stubColumnRects({ container, heightMin: (20 - 6) * 60 });

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 360 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 360 });

    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.reason).toBe('blocked');
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
    stubColumnRects({ container, heightMin: (20 - 6) * 60 });

    const column = container.querySelector('[data-mc-day]') as HTMLElement;
    firePointer({ target: column, type: 'pointerdown', clientX: 5, clientY: 420 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 480 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 480 });

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
    stubColumnRects({ container, heightMin: (20 - 6) * 60 });

    const e1Node = container.querySelector(
      '[data-mc-event="e1@2026-07-22T09:00:00"]',
    ) as HTMLElement;
    expect(e1Node).toBeTruthy();
    firePointer({ target: e1Node, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });

    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.reason).toBe('over-capacity');
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
    stubColumnRects({ container, heightMin: (20 - 6) * 60 });

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(container.querySelector('[data-mc-draft]')).toBeTruthy();

    firePointer({ target: document, type: 'pointercancel', clientX: 5, clientY: 300 });

    expect(drops).toHaveLength(0);
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T09:00:00');
    expect(container.querySelector('[data-mc-draft]')).toBeNull();

    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
    expect(drops).toHaveLength(1);
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T11:00:00');

    app.destroy();
  });
});
