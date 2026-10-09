import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  InteractionEngine,
  type InteractionDeps,
} from '../../src/core/interaction/interactionEngine.js';
import type {
  PointerSlot,
  EventChange,
  SelectionChange,
  BlockedInfo,
  PlacementInfo,
} from '../../src/core/interaction/model.js';
import type { EventOccurrence } from '../../src/core/types/event.js';

interface FakeRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

class FakeElement {
  readonly tag: string;
  readonly attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  parentNode: FakeElement | null = null;
  ownerDocument: FakeDocument | null = null;
  readonly childNodes: FakeElement[] = [];
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  rect: FakeRect = { left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 };

  constructor(tag: string) {
    this.tag = tag;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.childNodes.push(child);
    return child;
  }

  matches(selector: string): boolean {
    const attributeName = selector.slice(1, -1);
    return this.attributes.has(attributeName);
  }

  closest(selector: string): FakeElement | null {
    let node: FakeElement | null = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const matches: FakeElement[] = [];
    const walk = (node: FakeElement): void => {
      for (const child of node.childNodes) {
        if (child.matches(selector)) matches.push(child);
        walk(child);
      }
    };
    walk(this);
    return matches;
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  getBoundingClientRect(): FakeRect {
    return this.rect;
  }

  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, event: unknown): void {
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler(event);
  }
}

(globalThis as unknown as { Element: unknown }).Element = FakeElement;

class FakeDocument {
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  addEventListener(type: string, handler: (event: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }
  removeEventListener(type: string, handler: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(handler);
  }
  emit(type: string, event: unknown): void {
    for (const handler of [...(this.listeners.get(type) ?? [])]) handler(event);
  }
}

function makeEvent({
  target,
  clientX,
  clientY,
  pointerId = 0,
}: {
  target: FakeElement | FakeDocument;
  clientX: number;
  clientY: number;
  pointerId?: number;
}) {
  return { target, clientX, clientY, pointerId, button: 0 };
}

const occurrence: EventOccurrence = {
  event: {
    id: 'e1',
    calendarId: 'c1',
    title: 'X',
    time: {
      allDay: false,
      start: { dateTime: '2026-07-22T09:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-07-22T10:00:00', timeZone: 'America/Sao_Paulo' },
    },
  },
  masterId: 'e1',
  originalStart: '2026-07-22T09:00:00',
  isMaster: true,
};

interface Harness {
  container: FakeElement;
  documentRef: FakeDocument;
  column: FakeElement;
  eventNode: FakeElement;
  handle: FakeElement;
}

function buildDom(): Harness {
  const documentRef = new FakeDocument();
  const container = new FakeElement('div');
  container.ownerDocument = documentRef;
  const column = new FakeElement('div');
  column.setAttribute('data-mc-day', '2026-07-22');
  column.dataset.mcDay = '2026-07-22';
  column.rect = { left: 0, right: 100, top: 0, bottom: 840, width: 100, height: 840 };
  const eventNode = new FakeElement('div');
  eventNode.setAttribute('data-mc-event', 'e1@2026-07-22T09:00:00');
  eventNode.dataset.mcEvent = 'e1@2026-07-22T09:00:00';
  eventNode.dataset.mcStartMin = '540';
  eventNode.dataset.mcEndMin = '600';
  eventNode.dataset.mcEditable = 'true';
  const handle = new FakeElement('div');
  handle.setAttribute('data-mc-resize', '');
  handle.dataset.mcResize = '';
  eventNode.appendChild(handle);
  column.appendChild(eventNode);
  container.appendChild(column);
  return { container, documentRef, column, eventNode, handle };
}

interface Calls {
  move: EventChange[];
  resize: EventChange[];
  select: SelectionChange[];
  blocked: BlockedInfo[];
  clickEvent: PlacementInfo[];
  clickEmpty: PointerSlot[];
  drafts: unknown[];
}

function makeEngine(
  dom: Harness,
  options: {
    injectLocator?: boolean;
    allowEventTypeChange?: boolean;
    span?: ReturnType<NonNullable<InteractionDeps['resolveSpan']>>;
  } = {},
): { engine: InteractionEngine; calls: Calls } {
  const calls: Calls = {
    move: [],
    resize: [],
    select: [],
    blocked: [],
    clickEvent: [],
    clickEmpty: [],
    drafts: [],
  };
  const deps: InteractionDeps = {
    getGridBounds: () => ({ startMin: 360, endMin: 1200 }),
    getSlotMinutes: () => 30,
    getMinDurationMin: () => 15,
    allowEventTypeChange: () => options.allowEventTypeChange ?? false,
    ...(options.span ? { resolveSpan: () => options.span! } : {}),
    evaluate: (input) => {
      const blockedZone = input.startMin >= 720;
      return blockedZone ? { valid: false, reason: 'blocked' } : { valid: true, reason: 'ok' };
    },
    resolveOccurrence: () => occurrence,
    callbacks: {
      onDraftChange: (draft) => calls.drafts.push(draft),
      commitMove: (change) => calls.move.push(change),
      commitResize: (change) => calls.resize.push(change),
      commitSelect: (selection) => calls.select.push(selection),
      clickEvent: (placement) => calls.clickEvent.push(placement),
      clickEmpty: (slot) => calls.clickEmpty.push(slot),
      blocked: (info) => calls.blocked.push(info),
    },
  };
  const useInjected = options.injectLocator !== false;
  if (useInjected) {
    deps.locateSlot = (_clientX: number, clientY: number): PointerSlot => ({
      dateISO: '2026-07-22',
      minuteOfDay: clientY,
    });
  }
  const engine = new InteractionEngine(deps);

  engine.attach(dom.container as unknown as HTMLElement);
  return { engine, calls };
}

describe('InteractionEngine — gesto com localizador injetado', () => {
  let dom: Harness;
  beforeEach(() => {
    dom = buildDom();
  });

  it('MOVER commita a nova posição (duração preservada)', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660 }),
    );
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);
    expect(calls.move[0]!.startDateTime).toBe('2026-07-22T11:00:00');
  });

  it('drop inválido chama blocked e NÃO commita', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 780 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 780 }),
    );
    expect(calls.move).toHaveLength(0);
    expect(calls.blocked).toHaveLength(1);
    expect(calls.blocked[0]!.reason).toBe('blocked');
    expect(calls.blocked[0]!.occurrence).toBe(occurrence);
  });

  it('REDIMENSIONAR (alça) mantém o início e move o fim', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent({ target: dom.handle, clientX: 5, clientY: 600 }));
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 690 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 690 }),
    );
    expect(calls.resize).toHaveLength(1);
    expect(calls.resize[0]!.startMin).toBe(540);
    expect(calls.resize[0]!.endMin).toBe(690);
  });

  it('touch swipes cancel before any draft or click, while a held touch can move', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const { calls } = makeEngine(dom);
      for (const target of [dom.column, dom.eventNode]) {
        dom.container.emit('pointerdown', {
          ...makeEvent({ target, clientX: 5, clientY: 540 }),
          pointerType: 'touch',
        });
        dom.documentRef.emit('pointermove', {
          ...makeEvent({ target: dom.documentRef, clientX: 5, clientY: 560 }),
          pointerType: 'touch',
        });
        dom.documentRef.emit(
          'pointerup',
          makeEvent({ target: dom.documentRef, clientX: 5, clientY: 560 }),
        );
      }
      expect(calls.drafts.filter(Boolean)).toHaveLength(0);
      expect(calls.clickEmpty).toHaveLength(0);
      expect(calls.clickEvent).toHaveLength(0);
      dom.container.emit('pointerdown', {
        ...makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540 }),
        pointerType: 'touch',
      });
      clock.mockReturnValue(500);
      dom.documentRef.emit('pointermove', {
        ...makeEvent({ target: dom.documentRef, clientX: 5, clientY: 600 }),
        pointerType: 'touch',
      });
      dom.documentRef.emit(
        'pointerup',
        makeEvent({ target: dom.documentRef, clientX: 5, clientY: 600 }),
      );
      expect(calls.move).toHaveLength(1);
      expect(calls.move[0]!.startMin).toBe(600);
    } finally {
      clock.mockRestore();
    }
  });

  it('SELECIONAR em área vazia emite intervalo', () => {
    const { calls } = makeEngine(dom);

    dom.container.emit('pointerdown', makeEvent({ target: dom.column, clientX: 5, clientY: 600 }));
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660 }),
    );
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toEqual({ dateISO: '2026-07-22', startMin: 600, endMin: 660 });
  });

  it('clique (sem arrasto) no evento dispara clickEvent, não move', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 540 }),
    );
    expect(calls.move).toHaveLength(0);
    expect(calls.clickEvent).toHaveLength(1);
    expect(calls.clickEvent[0]!.eventId).toBe('e1@2026-07-22T09:00:00');
  });

  it('clique em área vazia dispara clickEmpty', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent({ target: dom.column, clientX: 5, clientY: 780 }));
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 780 }),
    );
    expect(calls.clickEmpty).toHaveLength(1);
    expect(calls.clickEmpty[0]!.dateISO).toBe('2026-07-22');
  });

  it('evento NÃO editável não arrasta (vira clique)', () => {
    dom.eventNode.dataset.mcEditable = 'false';
    const { calls } = makeEngine(dom);
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660 }),
    );
    expect(calls.move).toHaveLength(0);
    expect(calls.clickEvent).toHaveLength(1);
  });

  it('um segundo pointerdown (pointerId diferente) durante um gesto ativo é ignorado — o gesto original continua e commita normalmente', () => {
    const { calls } = makeEngine(dom);

    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540, pointerId: 1 }),
    );

    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.column, clientX: 5, clientY: 600, pointerId: 2 }),
    );

    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 1 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 1 }),
    );
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);

    expect(calls.select).toHaveLength(0);
    expect(calls.clickEmpty).toHaveLength(0);
  });

  it('pointercancel aborta o gesto ativo: limpa o estado sem commitar e limpa o fantasma', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540, pointerId: 1 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 1 }),
    );
    expect(calls.drafts.length).toBeGreaterThan(0);
    expect(calls.drafts[calls.drafts.length - 1]).not.toBeNull();

    dom.documentRef.emit(
      'pointercancel',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 1 }),
    );

    expect(calls.move).toHaveLength(0);
    expect(calls.resize).toHaveLength(0);
    expect(calls.select).toHaveLength(0);
    expect(calls.blocked).toHaveLength(0);

    expect(calls.drafts[calls.drafts.length - 1]).toBeNull();

    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.column, clientX: 5, clientY: 600, pointerId: 2 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 2 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 2 }),
    );
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toEqual({ dateISO: '2026-07-22', startMin: 600, endMin: 660 });
  });

  it('pointercancel com pointerId de outro ponteiro (não o do gesto ativo) é ignorado', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 540, pointerId: 1 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 1 }),
    );

    dom.documentRef.emit(
      'pointercancel',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 2 }),
    );

    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 660, pointerId: 1 }),
    );
    expect(calls.move).toHaveLength(1);
  });
});

describe('InteractionEngine — localizador padrão por retângulos', () => {
  it('opt-in distingue faixa allDay real de grid timed e converte nos dois sentidos', () => {
    const setup = () => {
      const dom = buildDom();
      const cell = new FakeElement('div');
      cell.setAttribute('data-mc-allday-cell', '2026-07-22');
      cell.dataset.mcAlldayCell = '2026-07-22';
      cell.rect = { left: 0, right: 100, top: -50, bottom: 0, width: 100, height: 50 };
      dom.container.appendChild(cell);
      return { dom, cell };
    };
    const { dom } = setup();
    const { calls } = makeEngine(dom, { injectLocator: false, allowEventTypeChange: true });
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 180 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: -25 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: -25 }),
    );
    expect(calls.move[0]).toMatchObject({
      allDay: true,
      dateISO: '2026-07-22',
      endDateISO: '2026-07-23',
    });

    const reverse = setup();
    reverse.cell.appendChild(reverse.dom.eventNode);
    const result = makeEngine(reverse.dom, {
      injectLocator: false,
      allowEventTypeChange: true,
      span: {
        dateISO: '2026-07-22',
        startMin: 0,
        endDateISO: '2026-07-24',
        endMin: 0,
        allDay: true,
      },
    });
    reverse.dom.container.emit(
      'pointerdown',
      makeEvent({ target: reverse.dom.eventNode, clientX: 5, clientY: -25 }),
    );
    reverse.dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: reverse.dom.documentRef, clientX: 5, clientY: 120 }),
    );
    reverse.dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: reverse.dom.documentRef, clientX: 5, clientY: 120 }),
    );
    expect(result.calls.move[0]).toMatchObject({
      allDay: false,
      startDateTime: '2026-07-22T08:00:00',
      endDateTime: '2026-07-24T08:00:00',
    });
  });

  it('alça start redimensiona início, mantém fim e entrega preview e commit de resize', () => {
    const dom = buildDom();
    dom.handle.dataset.mcResize = 'start';
    dom.handle.setAttribute('data-mc-resize', 'start');
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent({ target: dom.handle, clientX: 5, clientY: 540 }));
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 480 }),
    );
    expect(calls.drafts.at(-1)).toMatchObject({ kind: 'resize', startMin: 480, endMin: 600 });
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 480 }),
    );
    expect(calls.move).toHaveLength(0);
    expect(calls.resize).toHaveLength(1);
    expect(calls.resize[0]).toMatchObject({
      startDateTime: '2026-07-22T08:00:00',
      endDateTime: '2026-07-22T10:00:00',
    });
  });

  it('projeta clientY na coluna via getBoundingClientRect (sem locateSlot injetado)', () => {
    const dom = buildDom();

    const { calls } = makeEngine(dom, { injectLocator: false });
    dom.container.emit(
      'pointerdown',
      makeEvent({ target: dom.eventNode, clientX: 5, clientY: 180 }),
    );
    dom.documentRef.emit(
      'pointermove',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 300 }),
    );
    dom.documentRef.emit(
      'pointerup',
      makeEvent({ target: dom.documentRef, clientX: 5, clientY: 300 }),
    );
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);
  });
});
