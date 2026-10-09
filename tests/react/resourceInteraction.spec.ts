import { BUILTIN_VIEWS } from '../../src/react/views/index.js';
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { createResourceDayView, createTimelineView } from '../../src/react/views/index.js';
import type { CalendarEvent } from '../../src/core/index.js';
import type { CalendarResource } from '../../src/core/index.js';
import type { EventChange, SelectionChange, BlockedInfo } from '../../src/core/index.js';

const TZ = 'America/Sao_Paulo';
const REF = '2026-07-22';
const NOW_MS = Number(
  Temporal.PlainDateTime.from('2026-07-22T10:00').toZonedDateTime(TZ).epochMilliseconds,
);

const baseOptions = {
  timeZone: TZ,
  startHour: 6,
  endHour: 20,
  slotMinutes: 30,
  pxPerMinute: 1,
  nowMs: NOW_MS,
  weekStart: 'MO' as const,
  locale: 'pt-BR',
  minEventMinutes: 15,
};

const SPAN_MIN = (baseOptions.endHour - baseOptions.startHour) * 60;

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

function timedEvent({
  id,
  startHM,
  endHM,
  resourceIds,
}: {
  /** Fixture event identifier. / PT: Identificador do evento de teste. */
  id: string;
  /** Local start time, HH:mm. / PT: Horário local inicial, HH:mm. */
  startHM: string;
  /** Exclusive local end time, HH:mm. / PT: Horário local final exclusivo, HH:mm. */
  endHM: string;
  /** Assigned resource identifiers. / PT: Identificadores dos recursos atribuidos. */
  resourceIds: string[];
}): CalendarEvent {
  return {
    id,
    calendarId: 'c1',
    title: id,
    time: {
      allDay: false,
      start: { dateTime: `2026-07-22T${startHM}:00`, timeZone: TZ },
      end: { dateTime: `2026-07-22T${endHM}:00`, timeZone: TZ },
    },
    resourceIds,
  };
}

/** One pixel per minute; resources occupy adjacent columns. / PT: Um pixel por minuto; recursos em colunas adjacentes. */
function stubMultiagendaRects({
  container,
  colWidth = 100,
}: {
  container: HTMLElement; /** Resource column width in pixels. / PT: Largura da coluna do recurso em pixels. */
  colWidth?: number;
}): void {
  const columns = Array.from(container.querySelectorAll('[data-mc-slot="y"]')) as HTMLElement[];
  columns.forEach((col, index) => {
    const left = index * colWidth;
    const right = left + colWidth;
    col.getBoundingClientRect = () =>
      ({
        left,
        right,
        top: 0,
        bottom: SPAN_MIN,
        width: colWidth,
        height: SPAN_MIN,
        x: left,
        y: 0,
        toJSON() {},
      }) as DOMRect;
  });
}

/** One pixel per minute; resources occupy stacked rows. / PT: Um pixel por minuto; recursos em linhas empilhadas. */
function stubTimelineRects({
  container,
  rowHeight = 100,
}: {
  container: HTMLElement; /** Resource row height in pixels. / PT: Altura da linha do recurso em pixels. */
  rowHeight?: number;
}): void {
  const rows = Array.from(container.querySelectorAll('[data-mc-slot="x"]')) as HTMLElement[];
  rows.forEach((row, index) => {
    const top = index * rowHeight;
    const bottom = top + rowHeight;
    row.getBoundingClientRect = () =>
      ({
        left: 0,
        right: SPAN_MIN,
        top,
        bottom,
        width: SPAN_MIN,
        height: rowHeight,
        x: 0,
        y: top,
        toJSON() {},
      }) as DOMRect;
  });
}

function eventInResource({
  container,
  resourceId,
  eventKey,
}: {
  /** Mounted calendar container. / PT: Container do calendário montado. */
  container: HTMLElement;
  /** Resource containing the event copy. / PT: Recurso que contém a cópia do evento. */
  resourceId: string;
  /** Occurrence key rendered in the resource. / PT: Chave da ocorrência renderizada no recurso. */
  eventKey: string;
}): HTMLElement {
  const slot = container.querySelector(
    `[data-mc-slot][data-mc-slot-resource="${resourceId}"]`,
  ) as HTMLElement | null;
  if (!slot) throw new Error(`slot não encontrado para o recurso ${resourceId}`);
  const node = slot.querySelector(`[data-mc-event="${eventKey}"]`) as HTMLElement | null;
  if (!node) throw new Error(`evento ${eventKey} não encontrado no recurso ${resourceId}`);
  return node;
}

interface ResourceAppConfig {
  view: 'resources' | 'timeline';
  resources: CalendarResource[];
  events: CalendarEvent[];
  onEventDrop?: (change: EventChange) => void;
  onEventResize?: (change: EventChange) => void;
  onDateSelect?: (selection: SelectionChange) => void;
  onDropBlocked?: (info: BlockedInfo) => void;
}

function makeResourceApp(cfg: ResourceAppConfig): { app: CalendarApp; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = new CalendarApp({
    date: REF,
    view: cfg.view,
    events: cfg.events,
    resources: cfg.resources,
    temporal: Temporal as unknown as never,
    views: [
      ...BUILTIN_VIEWS,
      createResourceDayView(cfg.resources, 'resources'),
      createTimelineView(cfg.resources, 'timeline'),
    ],
    options: baseOptions,
    ...(cfg.onEventDrop ? { onEventDrop: cfg.onEventDrop } : {}),
    ...(cfg.onEventResize ? { onEventResize: cfg.onEventResize } : {}),
    ...(cfg.onDateSelect ? { onDateSelect: cfg.onDateSelect } : {}),
    ...(cfg.onDropBlocked ? { onDropBlocked: cfg.onDropBlocked } : {}),
  });
  app.mount(container);
  return { app, container };
}

describe('Multiagenda — interação (jsdom)', () => {
  it('mover um evento dentro da MESMA coluna de recurso: commita via onEventDrop, recurso inalterado', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });

    expect(drops).toHaveLength(1);
    expect(drops[0]!.startDateTime).toBe('2026-07-22T11:00:00');
    expect(drops[0]!.endDateTime).toBe('2026-07-22T12:00:00');
    expect(drops[0]!.resourceId).toBe('r1');
    expect(drops[0]!.fromResourceId).toBe('r1');
    const moved = app.getState().events.find((event) => event.id === 'e1')!;
    expect(moved.time.start.dateTime).toBe('2026-07-22T11:00:00');
    expect(moved.resourceIds).toEqual(['r1']);
    app.destroy();
  });

  it('arrastar um evento de UMA coluna de recurso para OUTRA no MESMO horário: reatribui o recurso (caso single-resource)', async () => {
    const resources: CalendarResource[] = [
      { id: 'r1', title: 'R1', order: 1 },
      { id: 'r2', title: 'R2', order: 2 },
    ];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 150, clientY: 180 });
    firePointer({ target: document, type: 'pointerup', clientX: 150, clientY: 180 });

    expect(drops).toHaveLength(1);
    expect(drops[0]!.startDateTime).toBe('2026-07-22T09:00:00');
    expect(drops[0]!.resourceId).toBe('r2');
    expect(drops[0]!.fromResourceId).toBe('r1');
    const moved = app.getState().events.find((event) => event.id === 'e1')!;
    expect(moved.resourceIds).toEqual(['r2']);
    app.destroy();
  });

  it('arrastar um evento MULTI-recurso (sala+profissional) entre colunas de profissional: preserva a sala, troca só o profissional', async () => {
    const resources: CalendarResource[] = [
      { id: 'room1', title: 'Sala 1', order: 1 },
      { id: 'profA', title: 'Prof A', order: 2 },
      { id: 'profB', title: 'Prof B', order: 3 },
    ];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [
        timedEvent({ id: 'm', startHM: '09:00', endHM: '10:00', resourceIds: ['room1', 'profA'] }),
      ],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'profA',
      eventKey: 'm@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 150, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 250, clientY: 180 });
    firePointer({ target: document, type: 'pointerup', clientX: 250, clientY: 180 });

    expect(drops).toHaveLength(1);
    expect(drops[0]!.resourceId).toBe('profB');
    expect(drops[0]!.fromResourceId).toBe('profA');
    const moved = app.getState().events.find((event) => event.id === 'm')!;
    expect(moved.resourceIds).toEqual(['room1', 'profB']);
    app.destroy();
  });

  it('arrastar para um recurso/horário LOTADO (capacity 1, ocupante conflitante): barrado — onDropBlocked, sem commit', async () => {
    const resources: CalendarResource[] = [
      { id: 'r1', title: 'R1', order: 1 },
      { id: 'r2', title: 'R2', order: 2, capacity: 1 },
    ];
    const drops: EventChange[] = [];
    const blocked: BlockedInfo[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [
        timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] }),
        timedEvent({ id: 'e2', startHM: '11:00', endHM: '12:00', resourceIds: ['r2'] }),
      ],
      onEventDrop: (change) => drops.push(change),
      onDropBlocked: (info) => blocked.push(info),
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 150, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 150, clientY: 300 });

    expect(drops).toHaveLength(0);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.reason).toBe('over-capacity');
    const untouched = app.getState().events.find((event) => event.id === 'e1')!;
    expect(untouched.time.start.dateTime).toBe('2026-07-22T09:00:00');
    expect(untouched.resourceIds).toEqual(['r1']);
    app.destroy();
  });

  it('redimensionar um evento dentro da sua coluna de recurso: commita via onEventResize, recurso inalterado', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const resizes: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
      onEventResize: (change) => resizes.push(change),
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    const handle = eventNode.querySelector('[data-mc-resize="end"]') as HTMLElement;
    expect(handle).toBeTruthy();
    firePointer({ target: handle, type: 'pointerdown', clientX: 5, clientY: 240 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 270 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 270 });

    expect(resizes).toHaveLength(1);
    expect(resizes[0]!.startDateTime).toBe('2026-07-22T09:00:00');
    expect(resizes[0]!.endDateTime).toBe('2026-07-22T10:30:00');
    expect(resizes[0]!.resourceId).toBe('r1');
    app.destroy();
  });

  it('selecionar área vazia dentro de uma coluna de recurso: onDateSelect recebe o resourceId da coluna', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const selections: SelectionChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [],
      onDateSelect: (selection) => selections.push(selection),
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const column = container.querySelector('[data-mc-slot-resource="r1"]') as HTMLElement;
    firePointer({ target: column, type: 'pointerdown', clientX: 5, clientY: 420 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 480 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 480 });

    expect(selections).toHaveLength(1);
    expect(selections[0]).toEqual({ dateISO: REF, startMin: 780, endMin: 840, resourceId: 'r1' });
    app.destroy();
  });

  it('fantasma do rascunho só é desenhado na coluna a que pertence (ausente nas outras colunas durante o arrasto)', async () => {
    const resources: CalendarResource[] = [
      { id: 'r1', title: 'R1', order: 1 },
      { id: 'r2', title: 'R2', order: 2 },
    ];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
    });
    await app.ready();
    stubMultiagendaRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const r1Slot = container.querySelector('[data-mc-slot-resource="r1"]') as HTMLElement;
    const r2Slot = container.querySelector('[data-mc-slot-resource="r2"]') as HTMLElement;
    expect(r1Slot.querySelector('[data-mc-draft]')).toBeTruthy();
    expect(r2Slot.querySelector('[data-mc-draft]')).toBeNull();

    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });
    app.destroy();
  });
});

describe('Timeline — interação (jsdom)', () => {
  it('mover um evento ao longo do eixo X dentro da sua linha: commita, recurso inalterado', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'timeline',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubTimelineRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 180, clientY: 50 });
    firePointer({ target: document, type: 'pointermove', clientX: 300, clientY: 50 });
    firePointer({ target: document, type: 'pointerup', clientX: 300, clientY: 50 });

    expect(drops).toHaveLength(1);
    expect(drops[0]!.startDateTime).toBe('2026-07-22T11:00:00');
    expect(drops[0]!.endDateTime).toBe('2026-07-22T12:00:00');
    expect(drops[0]!.resourceId).toBe('r1');
    const moved = app.getState().events.find((event) => event.id === 'e1')!;
    expect(moved.resourceIds).toEqual(['r1']);
    app.destroy();
  });

  it('arrastar um evento para OUTRA linha de recurso no MESMO horário: reatribui o recurso', async () => {
    const resources: CalendarResource[] = [
      { id: 'r1', title: 'R1', order: 1 },
      { id: 'r2', title: 'R2', order: 2 },
    ];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'timeline',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubTimelineRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 180, clientY: 50 });
    firePointer({ target: document, type: 'pointermove', clientX: 180, clientY: 150 });
    firePointer({ target: document, type: 'pointerup', clientX: 180, clientY: 150 });

    expect(drops).toHaveLength(1);
    expect(drops[0]!.startDateTime).toBe('2026-07-22T09:00:00');
    expect(drops[0]!.resourceId).toBe('r2');
    expect(drops[0]!.fromResourceId).toBe('r1');
    const moved = app.getState().events.find((event) => event.id === 'e1')!;
    expect(moved.resourceIds).toEqual(['r2']);
    app.destroy();
  });

  it('redimensionar via alça da borda DIREITA: commita novo fim, recurso e início inalterados', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const resizes: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'timeline',
      resources,
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] })],
      onEventResize: (change) => resizes.push(change),
    });
    await app.ready();
    stubTimelineRects({ container });

    const eventNode = eventInResource({
      container,
      resourceId: 'r1',
      eventKey: 'e1@2026-07-22T09:00:00',
    });
    const handle = eventNode.querySelector('[data-mc-resize="end"]') as HTMLElement;
    expect(handle).toBeTruthy();
    firePointer({ target: handle, type: 'pointerdown', clientX: 240, clientY: 50 });
    firePointer({ target: document, type: 'pointermove', clientX: 270, clientY: 50 });
    firePointer({ target: document, type: 'pointerup', clientX: 270, clientY: 50 });

    expect(resizes).toHaveLength(1);
    expect(resizes[0]!.startDateTime).toBe('2026-07-22T09:00:00');
    expect(resizes[0]!.endDateTime).toBe('2026-07-22T10:30:00');
    expect(resizes[0]!.resourceId).toBe('r1');
    app.destroy();
  });
});

describe('TimeGrid — guarda de regressão (locateByRects não é afetado por locateBySlots)', () => {
  it('arrastar um evento na view Dia ainda funciona com views de recurso registradas no mesmo app', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const drops: EventChange[] = [];
    const app = new CalendarApp({
      date: REF,
      view: 'day',
      events: [timedEvent({ id: 'e1', startHM: '09:00', endHM: '10:00', resourceIds: [] })],
      temporal: Temporal as unknown as never,
      views: [
        ...BUILTIN_VIEWS,
        createResourceDayView(resources, 'resources'),
        createTimelineView(resources, 'timeline'),
      ],
      options: baseOptions,
      onEventDrop: (change) => drops.push(change),
    });
    app.mount(container);
    await app.ready();

    for (const column of Array.from(container.querySelectorAll('[data-mc-day]'))) {
      (column as HTMLElement).getBoundingClientRect = () =>
        ({
          left: 0,
          right: 100,
          top: 0,
          bottom: SPAN_MIN,
          width: 100,
          height: SPAN_MIN,
          x: 0,
          y: 0,
          toJSON() {},
        }) as DOMRect;
    }
    expect(container.querySelectorAll('[data-mc-slot]')).toHaveLength(0);

    const eventNode = container.querySelector('[data-mc-event]') as HTMLElement;
    firePointer({ target: eventNode, type: 'pointerdown', clientX: 5, clientY: 180 });
    firePointer({ target: document, type: 'pointermove', clientX: 5, clientY: 300 });
    firePointer({ target: document, type: 'pointerup', clientX: 5, clientY: 300 });

    expect(drops).toHaveLength(1);
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T11:00:00');
    app.destroy();
  });
});
