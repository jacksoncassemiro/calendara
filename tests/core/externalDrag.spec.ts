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

function pointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY }));
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});

function fixture(
  overrides: Partial<InteractionCallbacks> = {},
  evaluate: InteractionDeps['evaluate'] = () => ({ valid: true, reason: 'ok' }),
) {
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
  it('previews and commits at the first incoming pointer position without requiring another move', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ commitExternal: receive });
    engine.startExternalDrag(
      origin,
      new MouseEvent('pointermove', { button: 0, clientX: 100, clientY: 180 }) as PointerEvent,
    );
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ startMin: 660, title: 'Paciente pendente' }),
    );
    pointer(document, 'pointerup', 100, 180);
    expect(receive).toHaveBeenCalledOnce();
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({ startDateTime: `${DATE}T11:00:00` }),
    );
  });
  it('previews the external title/time and commits once through receive, not ordinary move', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ commitExternal: receive });
    engine.startExternalDrag(origin, new MouseEvent('pointerdown', { button: 0 }) as PointerEvent);
    pointer(document, 'pointermove', 100, 180);
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
    pointer(document, 'pointerup', 100, 180);
    expect(receive).toHaveBeenCalledWith(
      expect.objectContaining({
        startDateTime: `${DATE}T11:00:00`,
        endDateTime: `${DATE}T12:00:00`,
      }),
    );
    expect(callbacks.commitMove).not.toHaveBeenCalled();
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(null);
    pointer(document, 'pointerup', 100, 180);
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it('rejects a blocked incoming drop and cancels one released outside after entering', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ commitExternal: receive }, () => ({
      valid: false,
      reason: 'blocked',
    }));
    engine.startExternalDrag(origin, new MouseEvent('pointerdown', { button: 0 }) as PointerEvent);
    pointer(document, 'pointermove', 100, 180);
    pointer(document, 'pointerup', 100, 180);
    expect(callbacks.blocked).toHaveBeenCalledWith(expect.objectContaining({ reason: 'blocked' }));
    expect(receive).not.toHaveBeenCalled();
    engine.startExternalDrag(origin, new MouseEvent('pointerdown', { button: 0 }) as PointerEvent);
    pointer(document, 'pointermove', 100, 180);
    pointer(document, 'pointerup', 250, 180);
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
      value: () => externalDestination,
    });
    cleanups.push(() => {
      if (oldHitTest) Object.defineProperty(document, 'elementFromPoint', oldHitTest);
      else Reflect.deleteProperty(document, 'elementFromPoint');
      externalDestination.remove();
    });
    const enabled = fixture({ dropOutside: remove });
    pointer(enabled.eventNode, 'pointerdown', 100, 60);
    pointer(document, 'pointermove', 250, 180);
    pointer(document, 'pointerup', 250, 180);
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ eventId: origin.eventId }), {
      clientX: 250,
      clientY: 180,
      target: externalDestination,
    });
    expect(enabled.callbacks.commitMove).not.toHaveBeenCalled();
    enabled.engine.detach();
    const ordinary = fixture();
    pointer(ordinary.eventNode, 'pointerdown', 100, 60);
    pointer(document, 'pointermove', 250, 180);
    pointer(document, 'pointerup', 250, 180);
    expect(ordinary.callbacks.commitMove).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape, rejects read-only origins and cleans a detached active gesture', () => {
    const receive = vi.fn();
    const { engine, callbacks } = fixture({ commitExternal: receive });
    const begin = (placement = origin) =>
      engine.startExternalDrag(
        placement,
        new MouseEvent('pointerdown', { button: 0 }) as PointerEvent,
      );
    begin({ ...origin, editable: false });
    pointer(document, 'pointermove', 100, 180);
    expect(callbacks.onDraftChange).not.toHaveBeenCalled();
    begin();
    pointer(document, 'pointermove', 100, 180);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    pointer(document, 'pointerup', 100, 180);
    expect(receive).not.toHaveBeenCalled();
    begin();
    pointer(document, 'pointermove', 100, 180);
    engine.detach();
    expect(callbacks.onDraftChange).toHaveBeenLastCalledWith(null);
    pointer(document, 'pointerup', 100, 180);
    expect(receive).not.toHaveBeenCalled();
  });
});
