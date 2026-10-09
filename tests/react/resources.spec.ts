import { BUILTIN_VIEWS } from '../../src/react/views/index.js';
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { createResourceDayView, createTimelineView } from '../../src/react/views/index.js';
import type { CalendarEvent } from '../../src/core/index.js';
import type { CalendarResource } from '../../src/core/index.js';

const TZ = 'America/Sao_Paulo';
const REF = '2026-07-22';
const NOW_MS = Number(
  Temporal.PlainDateTime.from('2026-07-22T10:00').toZonedDateTime(TZ).epochMilliseconds,
);

const resources: CalendarResource[] = [
  { id: 'r1', title: 'Sala 1', capacity: 1, order: 1 },
  { id: 'r2', title: 'Sala 2', capacity: 2, bufferAfter: 15, order: 2 },
];

function timed({
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

const events: CalendarEvent[] = [
  timed({ id: 'a', startHM: '09:00', endHM: '10:00', resourceIds: ['r1'] }),
  timed({ id: 'b', startHM: '09:30', endHM: '10:30', resourceIds: ['r1'] }),
  timed({ id: 'c', startHM: '09:00', endHM: '10:00', resourceIds: ['r2'] }),
  timed({ id: 'm', startHM: '11:00', endHM: '12:00', resourceIds: ['r1', 'r2'] }),
];

function makeApp(view: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = new CalendarApp({
    date: REF,
    view,
    events,
    temporal: Temporal as unknown as never,
    views: [
      ...BUILTIN_VIEWS,
      createResourceDayView(resources, 'resources'),
      createTimelineView(resources, 'timeline'),
    ],
    options: {
      timeZone: TZ,
      startHour: 6,
      endHour: 20,
      slotMinutes: 60,
      pxPerMinute: 1,
      nowMs: NOW_MS,
      weekStart: 'MO',
      locale: 'pt-BR',
    },
  });
  app.mount(container);
  return { app, container };
}

describe('Fase 3B — Multiagenda (colunas por recurso)', () => {
  it('renderiza uma coluna por recurso', async () => {
    const { app, container } = makeApp('resources');
    await app.ready();
    expect(container.querySelectorAll('[data-mc-resource]')).toHaveLength(2);
    app.destroy();
  });

  it('sinaliza lotação estourada (concorrência > capacity)', async () => {
    const { app, container } = makeApp('resources');
    await app.ready();
    const r1 = container.querySelector('[data-mc-resource-header="r1"]') as HTMLElement;
    const r2 = container.querySelector('[data-mc-resource-header="r2"]') as HTMLElement;
    expect(r1.querySelector('[data-mc-over-capacity]')).toBeTruthy();
    expect(r2.querySelector('[data-mc-over-capacity]')).toBeNull();
    app.destroy();
  });

  it('evento multi-recurso aparece nas duas colunas', async () => {
    const { app, container } = makeApp('resources');
    await app.ready();
    expect(container.querySelectorAll('[data-mc-event="m@2026-07-22T11:00:00"]')).toHaveLength(2);
    app.destroy();
  });

  it('desenha bandas de buffer no recurso com bufferAfter', async () => {
    const { app, container } = makeApp('resources');
    await app.ready();
    const r2 = container.querySelector('[data-mc-resource="r2"]') as HTMLElement;
    expect(r2.querySelectorAll('[data-mc-buffer]').length).toBe(2);
    const r1 = container.querySelector('[data-mc-resource="r1"]') as HTMLElement;
    expect(r1.querySelectorAll('[data-mc-buffer]').length).toBe(0);
    app.destroy();
  });

  it('toggle de visibilidade filtra recursos', async () => {
    const { app, container } = makeApp('resources');
    await app.ready();
    app.setVisibleResources(['r2']);
    expect(container.querySelectorAll('[data-mc-resource]')).toHaveLength(1);
    expect(container.querySelector('[data-mc-resource="r2"]')).toBeTruthy();
    app.destroy();
  });
});

describe('Fase 3B — Timeline (recursos em linhas)', () => {
  it('renderiza uma linha por recurso com eventos no eixo X', async () => {
    const { app, container } = makeApp('timeline');
    await app.ready();
    expect(container.querySelectorAll('[data-mc-timeline-row]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-mc-event="m@2026-07-22T11:00:00"]')).toHaveLength(2);
    app.destroy();
  });
});
