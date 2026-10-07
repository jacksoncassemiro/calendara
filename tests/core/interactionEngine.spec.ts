/**
 * Testes do InteractionEngine em ambiente NODE, com um DOM FALSO mínimo (o motor toca só um
 * punhado de APIs de DOM). Assim a máquina de gesto — mover/redimensionar/selecionar, clique vs.
 * arrasto, preview/commit/blocked, e o localizador por retângulos — é validada sem o custo do
 * jsdom. A integração real com Preact/DOM fica em `interactionApp.spec.ts` (jsdom, CI).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InteractionEngine, type InteractionDeps } from '../../src/core/interaction/interactionEngine.js';
import type {
  PointerSlot,
  EventChange,
  SelectionChange,
  BlockedInfo,
  PlacementInfo,
} from '../../src/core/interaction/model.js';
import type { EventOccurrence } from '../../src/core/types/event.js';

// --- DOM falso ---------------------------------------------------------------

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

  appendChild(child: FakeElement): FakeElement {
    child.parentNode = this;
    child.ownerDocument = this.ownerDocument;
    this.childNodes.push(child);
    return child;
  }

  matches(selector: string): boolean {
    const attributeName = selector.slice(1, -1); // '[data-mc-day]' → 'data-mc-day'
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

// O motor faz `coords.target instanceof Element`; no node não há `Element` global.
// Registramos o DOM falso como o `Element` global para o instanceof funcionar.
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

function makeEvent(
  target: FakeElement | FakeDocument,
  clientX: number,
  clientY: number,
  pointerId = 0,
) {
  return { target, clientX, clientY, pointerId, button: 0 };
}

// --- fixture -----------------------------------------------------------------

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
  options: { injectLocator?: boolean } = {},
): { engine: InteractionEngine; calls: Calls } {
  const calls: Calls = { move: [], resize: [], select: [], blocked: [], clickEvent: [], clickEmpty: [], drafts: [] };
  const deps: InteractionDeps = {
    getGridBounds: () => ({ startMin: 360, endMin: 1200 }),
    getSlotMinutes: () => 30,
    getMinDurationMin: () => 15,
    evaluate: (input) => {
      const blockedZone = input.startMin >= 720; // ≥12:00 inválido neste stub
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
    // localizador determinístico: minuto == clientY.
    deps.locateSlot = (_clientX: number, clientY: number): PointerSlot => ({
      dateISO: '2026-07-22',
      minuteOfDay: clientY,
    });
  }
  const engine = new InteractionEngine(deps);
  // attach espera um HTMLElement; o DOM falso implementa a superfície usada.
  engine.attach(dom.container as unknown as HTMLElement);
  return { engine, calls };
}

// --- testes ------------------------------------------------------------------

describe('InteractionEngine — gesto com localizador injetado', () => {
  let dom: Harness;
  beforeEach(() => {
    dom = buildDom();
  });

  it('MOVER commita a nova posição (duração preservada)', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 660));
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);
    expect(calls.move[0]!.startDateTime).toBe('2026-07-22T11:00:00');
  });

  it('drop inválido chama blocked e NÃO commita', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 780));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 780));
    expect(calls.move).toHaveLength(0);
    expect(calls.blocked).toHaveLength(1);
    expect(calls.blocked[0]!.reason).toBe('blocked');
    expect(calls.blocked[0]!.occurrence).toBe(occurrence);
  });

  it('REDIMENSIONAR (alça) mantém o início e move o fim', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.handle, 5, 600));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 690));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 690));
    expect(calls.resize).toHaveLength(1);
    expect(calls.resize[0]!.startMin).toBe(540);
    expect(calls.resize[0]!.endMin).toBe(690);
  });

  it('SELECIONAR em área vazia emite intervalo', () => {
    const { calls } = makeEngine(dom);
    // 10:00 (600) → 11:00 (660), abaixo da zona inválida do stub (≥720).
    dom.container.emit('pointerdown', makeEvent(dom.column, 5, 600));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 660));
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toEqual({ dateISO: '2026-07-22', startMin: 600, endMin: 660 });
  });

  it('clique (sem arrasto) no evento dispara clickEvent, não move', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 540));
    expect(calls.move).toHaveLength(0);
    expect(calls.clickEvent).toHaveLength(1);
    expect(calls.clickEvent[0]!.eventId).toBe('e1@2026-07-22T09:00:00');
  });

  it('clique em área vazia dispara clickEmpty', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.column, 5, 780));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 780));
    expect(calls.clickEmpty).toHaveLength(1);
    expect(calls.clickEmpty[0]!.dateISO).toBe('2026-07-22');
  });

  it('evento NÃO editável não arrasta (vira clique)', () => {
    dom.eventNode.dataset.mcEditable = 'false';
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 660));
    expect(calls.move).toHaveLength(0);
    expect(calls.clickEvent).toHaveLength(1);
  });

  it('um segundo pointerdown (pointerId diferente) durante um gesto ativo é ignorado — o gesto original continua e commita normalmente', () => {
    const { calls } = makeEngine(dom);
    // pointerId 1 inicia um MOVER no evento.
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540, 1));
    // segundo "dedo" (pointerId 2) toca a coluna vazia enquanto o gesto 1 ainda está ativo — deve
    // ser ignorado (sem sobrescrever `this.gesture`), não deve iniciar um gesto de seleção.
    dom.container.emit('pointerdown', makeEvent(dom.column, 5, 600, 2));
    // pointermove/pointerup do gesto ORIGINAL (pointerId 1) seguem funcionando e commitam.
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660, 1));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 660, 1));
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);
    // o segundo pointerdown não iniciou gesto nenhum próprio.
    expect(calls.select).toHaveLength(0);
    expect(calls.clickEmpty).toHaveLength(0);
  });

  it('pointercancel aborta o gesto ativo: limpa o estado sem commitar e limpa o fantasma', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540, 1));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660, 1)); // passa o threshold ⇒ gera fantasma
    expect(calls.drafts.length).toBeGreaterThan(0);
    expect(calls.drafts[calls.drafts.length - 1]).not.toBeNull();

    dom.documentRef.emit('pointercancel', makeEvent(dom.documentRef, 5, 660, 1));

    // aborto, não "soltar": nenhum commit/blocked disparado.
    expect(calls.move).toHaveLength(0);
    expect(calls.resize).toHaveLength(0);
    expect(calls.select).toHaveLength(0);
    expect(calls.blocked).toHaveLength(0);
    // onDraftChange(null) foi chamado ⇒ fantasma limpo.
    expect(calls.drafts[calls.drafts.length - 1]).toBeNull();

    // `this.gesture` foi limpo: um pointerdown NOVO (pointerId diferente) é aceito e completa
    // normalmente — prova de que o cancel não deixou o motor "travado" para sempre.
    dom.container.emit('pointerdown', makeEvent(dom.column, 5, 600, 2));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660, 2));
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 660, 2));
    expect(calls.select).toHaveLength(1);
    expect(calls.select[0]).toEqual({ dateISO: '2026-07-22', startMin: 600, endMin: 660 });
  });

  it('pointercancel com pointerId de outro ponteiro (não o do gesto ativo) é ignorado', () => {
    const { calls } = makeEngine(dom);
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 540, 1));
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 660, 1));
    // pointercancel de um pointerId que NÃO é o do gesto ativo (ex.: segundo dedo que nunca virou gesto).
    dom.documentRef.emit('pointercancel', makeEvent(dom.documentRef, 5, 660, 2));
    // gesto original continua vivo e ainda commita normalmente no pointerup dele.
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 660, 1));
    expect(calls.move).toHaveLength(1);
  });
});

describe('InteractionEngine — localizador padrão por retângulos', () => {
  it('projeta clientY na coluna via getBoundingClientRect (sem locateSlot injetado)', () => {
    const dom = buildDom();
    // sem injeção: usa rects. Coluna: top 0, height 840, span 360..1200 ⇒ minuto = 360 + clientY.
    const { calls } = makeEngine(dom, { injectLocator: false });
    dom.container.emit('pointerdown', makeEvent(dom.eventNode, 5, 180)); // minuto 540
    dom.documentRef.emit('pointermove', makeEvent(dom.documentRef, 5, 300)); // minuto 660
    dom.documentRef.emit('pointerup', makeEvent(dom.documentRef, 5, 300));
    expect(calls.move).toHaveLength(1);
    expect(calls.move[0]!.startMin).toBe(660);
    expect(calls.move[0]!.endMin).toBe(720);
  });
});
