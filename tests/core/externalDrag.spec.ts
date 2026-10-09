// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InteractionEngine,
  type InteractionCallbacks,
  type InteractionDeps,
} from '../../src/core/interaction/interactionEngine.js';
import type { PlacementInfo } from '../../src/core/interaction/model.js';

const DATE = '2026-07-22';
const origin: PlacementInfo = {
  eventId: `external@${DATE}T09:00`,
  dateISO: DATE,
  startMin: 540,
  endMin: 600,
  editable: true,
  occurrence: {
    masterId: 'external',
    originalStart: `${DATE}T09:00`,
    isMaster: true,
    event: {
      id: 'external',
      calendarId: 'appointments',
      title: 'Paciente pendente',
      color: '#aabbcc',
      time: {
        allDay: false,
        start: { dateTime: `${DATE}T09:00` },
        end: { dateTime: `${DATE}T10:00` },
      },
    },
  },
};

function pointer({
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
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }));
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function fixture({
  overrides = {},
  evaluate = () => ({ valid: true, reason: 'ok' }),
}: { overrides?: Partial<InteractionCallbacks>; evaluate?: InteractionDeps['evaluate'] } = {}) {
  const root = document.createElement('div');
  root.innerHTML = `<div data-mc-day="${DATE}"><div data-mc-event="${origin.eventId}" data-mc-start-min="540" data-mc-end-min="600" data-mc-editable="true"></div></div>`;
  document.body.append(root);
  const surface = root.firstElementChild as HTMLElement;
  surface.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: 200,
    bottom: 600,
    width: 200,
    height: 600,
    x: 0,
    y: 0,
    toJSON() {},
  });
  const callbacks: InteractionCallbacks = {
    onDraftChange: vi.fn(),
    commitMove: vi.fn(),
    commitResize: vi.fn(),
    commitSelect: vi.fn(),
    clickEvent: vi.fn(),
    clickEmpty: vi.fn(),
    blocked: vi.fn(),
    ...overrides,
  };
  const engine = new InteractionEngine({
    getGridBounds: () => ({ startMin: 480, endMin: 1080 }),
    getSlotMinutes: () => 30,
    getMinDurationMin: () => 30,
    resolveOccurrence: () => origin.occurrence,
    locateSlot: (_clientX, clientY) => ({ dateISO: DATE, minuteOfDay: 480 + clientY }),
    evaluate,
    callbacks,
  });
  engine.attach(root);
  cleanups.push(() => {
    engine.detach();
    root.remove();
  });
  return { root, surface, eventNode: surface.firstElementChild!, callbacks, engine };
}

describe('external pointer drag lifecycle', () => {
  it('exports a list card without inventing a timed destination or deleting its event', () => {
    const outside = vi.fn();
    const { surface, eventNode, callbacks } = fixture({ overrides: { dropOutside: outside } });
    surface.removeAttribute('data-mc-day');
    surface.setAttribute('data-mc-list-day', DATE);
    eventNode.setAttribute('data-mc-event-date', DATE);
    eventNode.setAttribute('data-mc-drag-source', '');
    (eventNode as HTMLElement).getBoundingClientRect = () => surface.getBoundingClientRect();

    pointer({ target: eventNode, type: 'pointerdown', clientX: 50, clientY: 100 });
    pointer({ target: document, type: 'pointerup', clientX: 50, clientY: 100 });
    expect(callbacks.clickEvent).toHaveBeenCalledOnce();

    pointer({ target: eventNode, type: 'pointerdown', clientX: 50, clientY: 100 });
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(callbacks.commitMove).not.toHaveBeenCalled();
    expect(outside).not.toHaveBeenCalled();
    expect(callbacks.clickEvent).toHaveBeenCalledOnce();

    pointer({ target: eventNode, type: 'pointerdown', clientX: 50, clientY: 100 });
    pointer({ target: document, type: 'pointermove', clientX: 300, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 300, clientY: 180 });
    expect(outside).toHaveBeenCalledOnce();
    expect(outside.mock.calls[0][0].occurrence).toEqual(origin.occurrence);
    expect(callbacks.commitMove).not.toHaveBeenCalled();

    pointer({ target: eventNode, type: 'pointerdown', clientX: 50, clientY: 100 });
    pointer({ target: document, type: 'pointermove', clientX: 300, clientY: 180 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer({ target: document, type: 'pointerup', clientX: 300, clientY: 180 });
    expect(outside).toHaveBeenCalledOnce();

    eventNode.setAttribute('data-mc-editable', 'false');
    pointer({ target: eventNode, type: 'pointerdown', clientX: 50, clientY: 100 });
    pointer({ target: document, type: 'pointermove', clientX: 300, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 300, clientY: 180 });
    expect(outside).toHaveBeenCalledOnce();
  });
  it('previews and commits at the first incoming pointer position without requiring another move', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ overrides: { commitExternal: receive } });
    engine.startExternalDrag(
      origin,
      new MouseEvent('pointermove', { button: 0, clientX: 100, clientY: 180 }) as PointerEvent,
    );
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ startMin: 660, title: 'Paciente pendente' }),
    );
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(receive).toHaveBeenCalledOnce();
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({ startDateTime: `${DATE}T11:00:00` }),
    );
  });
  it('previews the external title/time and commits once through receive, not ordinary move', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ overrides: { commitExternal: receive } });
    engine.startExternalDrag(origin, new MouseEvent('pointerdown', { button: 0 }) as PointerEvent);
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startMin: 660,
        endMin: 720,
        title: 'Paciente pendente',
        color: '#aabbcc',
        valid: true,
      }),
    );
    expect(receive).not.toHaveBeenCalled();
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        startDateTime: `${DATE}T11:00:00`,
        endDateTime: `${DATE}T12:00:00`,
      }),
    );
    expect(callbacks.commitMove).not.toHaveBeenCalled();
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(null);
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('rejects a blocked incoming drop and cancels one released outside after entering', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({
      overrides: { commitExternal: receive },
      evaluate: () => ({
        valid: false,
        reason: 'blocked',
      }),
    });
    engine.startExternalDrag(origin, new MouseEvent('pointerdown', { button: 0 }) as PointerEvent);
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(callbacks.blocked).toHaveBeenCalledWith(expect.objectContaining({ reason: 'blocked' }));
    expect(receive).not.toHaveBeenCalled();
    engine.startExternalDrag(origin, new MouseEvent('pointerdown', { button: 0 }) as PointerEvent);
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 250, clientY: 180 });
    expect(callbacks.blocked).toHaveBeenCalledTimes(1);
    expect(receive).not.toHaveBeenCalled();
    expect(callbacks.clickEvent).not.toHaveBeenCalled();
  });

  it('makes an outside destination opt-in while preserving ordinary edge clamping', () => {
    const remove = vi.fn();
    const externalDestination = document.createElement('div');
    document.body.append(externalDestination);
    const oldHitTest = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: (clientX: number) => (clientX > 200 ? externalDestination : enabled.surface),
    });
    cleanups.push(() => {
      if (oldHitTest) Object.defineProperty(document, 'elementFromPoint', oldHitTest);
      else Reflect.deleteProperty(document, 'elementFromPoint');
      externalDestination.remove();
    });
    const enabled = fixture({ overrides: { dropOutside: remove } });
    pointer({ target: enabled.eventNode, type: 'pointerdown', clientX: 100, clientY: 60 });
    pointer({ target: document, type: 'pointermove', clientX: 250, clientY: 180 });
    expect(document.querySelector('.mc-outside-preview')?.textContent).toBe(
      origin.occurrence.event.title,
    );
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    expect(document.querySelector('.mc-outside-preview')).toBeNull();
    pointer({ target: document, type: 'pointermove', clientX: 250, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 250, clientY: 180 });
    expect(document.querySelector('.mc-outside-preview')).toBeNull();
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ eventId: origin.eventId }), {
      clientX: 250,
      clientY: 180,
      target: externalDestination,
    });
    expect(enabled.callbacks.commitMove).not.toHaveBeenCalled();
    enabled.engine.detach();
    const ordinary = fixture();
    pointer({ target: ordinary.eventNode, type: 'pointerdown', clientX: 100, clientY: 60 });
    pointer({ target: document, type: 'pointermove', clientX: 250, clientY: 180 });
    pointer({ target: document, type: 'pointerup', clientX: 250, clientY: 180 });
    expect(ordinary.callbacks.commitMove).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape, rejects read-only origins and cleans a detached active gesture', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ overrides: { commitExternal: receive } });
    const begin = (placement = origin) =>
      engine.startExternalDrag(
        placement,
        new MouseEvent('pointerdown', { button: 0 }) as PointerEvent,
      );
    begin({ ...origin, editable: false });
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    expect(callbacks.onDraftChange).not.toHaveBeenCalled();
    begin();
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(receive).not.toHaveBeenCalled();
    begin();
    pointer({ target: document, type: 'pointermove', clientX: 100, clientY: 180 });
    engine.detach();
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(null);
    pointer({ target: document, type: 'pointerup', clientX: 100, clientY: 180 });
    expect(receive).not.toHaveBeenCalled();
  });
});
