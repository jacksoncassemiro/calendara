// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../src/render/calendarApp.js';
import { InteractionEngine, type InteractionDeps } from '../src/interaction/interactionEngine.js';
import type { PointerSlot, EventChange, SelectionChange, BlockedInfo, PlacementInfo } from '../src/interaction/model.js';
import type { CalendarEvent, EventOccurrence } from '../src/types/event.js';
import type { ConstraintSet } from '../src/types/constraint.js';
import type { CalendarResource } from '../src/types/resource.js';

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
  function buildDom(): { container: HTMLElement; eventNode: HTMLElement; handle: HTMLElement; column: HTMLElement } {
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
      locateSlot: (clientX: number, clientY: number): PointerSlot => ({ dateISO: REF, minuteOfDay: clientY }),
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
});

// ---------------------------------------------------------------------------
// Integração via CalendarApp (retângulos das colunas stubados ⇒ minuto=360+clientY).
// ---------------------------------------------------------------------------

/** Stub de layout: cada coluna do dia ocupa [0..100]x, altura = (endHour-startHour)*60. */
function stubColumnRects(container: HTMLElement, heightMin: number): void {
  for (const column of Array.from(container.querySelectorAll('[data-mc-day]'))) {
    (column as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, right: 100, top: 0, bottom: heightMin, width: 100, height: heightMin, x: 0, y: 0, toJSON() {} }) as DOMRect;
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
  it('arrastar persiste no store e chama onEventDrop', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const drops: EventChange[] = [];
    const app = new CalendarApp({
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
    const e1Node = container.querySelector('[data-mc-event="e1@2026-07-22T09:00:00"]') as HTMLElement;
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
