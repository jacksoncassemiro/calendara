import { BUILTIN_VIEWS } from '../../src/react/views/index.js';
// @vitest-environment jsdom
/**
 * Regressão de interação (drag/resize/select) para as views orientadas a recurso — Multiagenda
 * (`createResourceDayView`) e Timeline (`createTimelineView`). Antes desta leva de mudanças as
 * duas views eram NO-OPS de interação (o InteractionEngine só entendia `[data-mc-day]`); aqui
 * cobrimos o novo contrato `[data-mc-slot]` (`locateBySlots`) fim-a-fim via CalendarApp real.
 *
 * Padrão: mesmo approach de `interactionApp.spec.ts` — monta um CalendarApp de verdade, dispara
 * Pointer Events sintéticos em coordenadas calculadas, e verifica o resultado no DOM/store/callbacks.
 * jsdom devolve retângulos zerados por padrão, então as colunas (Multiagenda) e faixas (Timeline)
 * têm `getBoundingClientRect` stubado — ver `stubMultiagendaRects`/`stubTimelineRects`.
 */
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

/** Extensão do grid em minutos (840 = 14h * 60). Com pxPerMinute=1 e rects stubados com esse
 * tamanho, `clientX`/`clientY` mapeiam 1:1 para "minutos a partir de startHour" — mesma convenção
 * usada em `interactionApp.spec.ts`. */
const SPAN_MIN = (baseOptions.endHour - baseOptions.startHour) * 60;

/** Dispara um "pointer event" (jsdom não constrói PointerEvent; MouseEvent basta — mesmo padrão de interactionApp.spec.ts). */
function firePointer(target: EventTarget, type: string, clientX: number, clientY: number): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY, button: 0 }));
}

function timedEvent(id: string, startHM: string, endHM: string, resourceIds: string[]): CalendarEvent {
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

/** Multiagenda: colunas verticais lado a lado, uma por recurso (ordem = `resource.order`, mesma ordem de `buildResourceColumns`). */
function stubMultiagendaRects(container: HTMLElement, colWidth = 100): void {
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

/** Timeline: faixas horizontais empilhadas, uma por recurso. */
function stubTimelineRects(container: HTMLElement, rowHeight = 100): void {
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

/** Localiza o nó de um evento DENTRO de uma coluna/faixa de recurso específica — necessário para
 * eventos multi-recurso, que renderizam um `[data-mc-event]` por coluna. */
function eventInResource(container: HTMLElement, resourceId: string, eventKey: string): HTMLElement {
  const slot = container.querySelector(`[data-mc-slot][data-mc-slot-resource="${resourceId}"]`) as HTMLElement | null;
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
    views: [...BUILTIN_VIEWS,
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

// ---------------------------------------------------------------------------
// Multiagenda (createResourceDayView / ResourceGrid / ResourceColumn)
// ---------------------------------------------------------------------------

describe('Multiagenda — interação (jsdom)', () => {
  it('mover um evento dentro da MESMA coluna de recurso: commita via onEventDrop, recurso inalterado', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'resources',
      resources,
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubMultiagendaRects(container);

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    // topo do evento (09:00 ⇒ minuto 540, offset 180 do startHour); solta às 11:00 (minuto 660, offset 300)
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);

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
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubMultiagendaRects(container); // r1 = [0,100), r2 = [100,200)

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    firePointer(eventNode, 'pointerdown', 5, 180); // r1, 09:00
    firePointer(document, 'pointermove', 150, 180); // r2, mesmo horário (mesmo clientY)
    firePointer(document, 'pointerup', 150, 180);

    expect(drops).toHaveLength(1);
    expect(drops[0]!.startDateTime).toBe('2026-07-22T09:00:00'); // horário não mudou
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
      events: [timedEvent('m', '09:00', '10:00', ['room1', 'profA'])],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubMultiagendaRects(container); // room1=[0,100), profA=[100,200), profB=[200,300)

    // o evento aparece nas colunas room1 E profA — pegamos o bloco de DENTRO da coluna profA.
    const eventNode = eventInResource(container, 'profA', 'm@2026-07-22T09:00:00');
    firePointer(eventNode, 'pointerdown', 150, 180); // profA, 09:00
    firePointer(document, 'pointermove', 250, 180); // profB, mesmo horário
    firePointer(document, 'pointerup', 250, 180);

    expect(drops).toHaveLength(1);
    expect(drops[0]!.resourceId).toBe('profB');
    expect(drops[0]!.fromResourceId).toBe('profA');
    const moved = app.getState().events.find((event) => event.id === 'm')!;
    // reassignResource(['room1','profA'], 'profA', 'profB') ⇒ ['room1', 'profB']
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
        timedEvent('e1', '09:00', '10:00', ['r1']), // será arrastado
        timedEvent('e2', '11:00', '12:00', ['r2']), // já ocupa r2 no horário de destino
      ],
      onEventDrop: (change) => drops.push(change),
      onDropBlocked: (info) => blocked.push(info),
    });
    await app.ready();
    stubMultiagendaRects(container); // r1=[0,100), r2=[100,200)

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    firePointer(eventNode, 'pointerdown', 5, 180); // r1, 09:00
    firePointer(document, 'pointermove', 150, 300); // r2, 11:00 — colide com e2
    firePointer(document, 'pointerup', 150, 300);

    expect(drops).toHaveLength(0);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]!.reason).toBe('over-capacity');
    // sem commit: e1 permanece em r1 às 09:00
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
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
      onEventResize: (change) => resizes.push(change),
    });
    await app.ready();
    stubMultiagendaRects(container);

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    const handle = eventNode.querySelector('[data-mc-resize="end"]') as HTMLElement;
    expect(handle).toBeTruthy();
    // borda inferior (10:00 ⇒ minuto 600, offset 240) arrastada até 10:30 (minuto 630, offset 270)
    firePointer(handle, 'pointerdown', 5, 240);
    firePointer(document, 'pointermove', 5, 270);
    firePointer(document, 'pointerup', 5, 270);

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
    stubMultiagendaRects(container);

    const column = container.querySelector('[data-mc-slot-resource="r1"]') as HTMLElement;
    // 13:00 (offset 420) → 14:00 (offset 480)
    firePointer(column, 'pointerdown', 5, 420);
    firePointer(document, 'pointermove', 5, 480);
    firePointer(document, 'pointerup', 5, 480);

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
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
    });
    await app.ready();
    stubMultiagendaRects(container);

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300); // ainda dentro da coluna r1
    // o render do rascunho é throttled via rAF (ver interactionApp.spec.ts) — espera o frame.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const r1Slot = container.querySelector('[data-mc-slot-resource="r1"]') as HTMLElement;
    const r2Slot = container.querySelector('[data-mc-slot-resource="r2"]') as HTMLElement;
    expect(r1Slot.querySelector('[data-mc-draft]')).toBeTruthy();
    expect(r2Slot.querySelector('[data-mc-draft]')).toBeNull();

    firePointer(document, 'pointerup', 5, 300);
    app.destroy();
  });
});

// ---------------------------------------------------------------------------
// Timeline (createTimelineView / Timeline)
// ---------------------------------------------------------------------------

describe('Timeline — interação (jsdom)', () => {
  it('mover um evento ao longo do eixo X dentro da sua linha: commita, recurso inalterado', async () => {
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const drops: EventChange[] = [];
    const { app, container } = makeResourceApp({
      view: 'timeline',
      resources,
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubTimelineRects(container); // r1 = linha [0,100)

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    // 09:00 ⇒ minuto 540, offset-X 180; solta em 11:00 (minuto 660, offset-X 300)
    firePointer(eventNode, 'pointerdown', 180, 50);
    firePointer(document, 'pointermove', 300, 50);
    firePointer(document, 'pointerup', 300, 50);

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
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
      onEventDrop: (change) => drops.push(change),
    });
    await app.ready();
    stubTimelineRects(container); // r1=[0,100), r2=[100,200)

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    firePointer(eventNode, 'pointerdown', 180, 50); // linha r1, 09:00
    firePointer(document, 'pointermove', 180, 150); // linha r2, mesmo horário (mesmo clientX)
    firePointer(document, 'pointerup', 180, 150);

    expect(drops).toHaveLength(1);
    expect(drops[0]!.startDateTime).toBe('2026-07-22T09:00:00'); // horário não mudou
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
      events: [timedEvent('e1', '09:00', '10:00', ['r1'])],
      onEventResize: (change) => resizes.push(change),
    });
    await app.ready();
    stubTimelineRects(container);

    const eventNode = eventInResource(container, 'r1', 'e1@2026-07-22T09:00:00');
    const handle = eventNode.querySelector('[data-mc-resize="end"]') as HTMLElement;
    expect(handle).toBeTruthy();
    // borda direita (10:00 ⇒ minuto 600, offset-X 240) arrastada até 10:30 (minuto 630, offset-X 270)
    firePointer(handle, 'pointerdown', 240, 50);
    firePointer(document, 'pointermove', 270, 50);
    firePointer(document, 'pointerup', 270, 50);

    expect(resizes).toHaveLength(1);
    expect(resizes[0]!.startDateTime).toBe('2026-07-22T09:00:00');
    expect(resizes[0]!.endDateTime).toBe('2026-07-22T10:30:00');
    expect(resizes[0]!.resourceId).toBe('r1');
    app.destroy();
  });
});

// ---------------------------------------------------------------------------
// Guarda de regressão: registrar views de recurso no mesmo CalendarApp não pode afetar o
// caminho legado (`[data-mc-day]` / locateByRects) usado pelo TimeGrid (Semana/Dia).
// ---------------------------------------------------------------------------

describe('TimeGrid — guarda de regressão (locateByRects não é afetado por locateBySlots)', () => {
  it('arrastar um evento na view Dia ainda funciona com views de recurso registradas no mesmo app', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const resources: CalendarResource[] = [{ id: 'r1', title: 'R1', order: 1 }];
    const drops: EventChange[] = [];
    const app = new CalendarApp({
      date: REF,
      view: 'day',
      events: [timedEvent('e1', '09:00', '10:00', [])],
      temporal: Temporal as unknown as never,
      views: [...BUILTIN_VIEWS,
        createResourceDayView(resources, 'resources'),
        createTimelineView(resources, 'timeline'),
      ],
      options: baseOptions,
      onEventDrop: (change) => drops.push(change),
    });
    app.mount(container);
    await app.ready();

    // caminho legado: só `[data-mc-day]` existe no DOM (a view Dia está ativa, não as de recurso).
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
    firePointer(eventNode, 'pointerdown', 5, 180);
    firePointer(document, 'pointermove', 5, 300);
    firePointer(document, 'pointerup', 5, 300);

    expect(drops).toHaveLength(1);
    expect(app.getState().events[0]!.time.start.dateTime).toBe('2026-07-22T11:00:00');
    app.destroy();
  });
});
