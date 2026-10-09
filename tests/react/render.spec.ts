// @vitest-environment jsdom
import { BUILTIN_VIEWS } from '../../src/react/views/registry/defaultViews.js';
import { describe, it, expect, beforeAll } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import type { CalendarEvent } from '../../src/core/index.js';
import type { ConstraintSet } from '../../src/core/index.js';

const TZ = 'America/Sao_Paulo';

it('rejects invalid option updates without corrupting state', async () => {
  const app = new CalendarApp({ views: BUILTIN_VIEWS, temporal: Temporal });
  await app.ready();
  expect(() => app.setOptions({ slotMinutes: 0 })).toThrow(RangeError);
  expect(app.getState().options.slotMinutes).toBe(30);
  app.destroy();
});

const REF = '2026-07-22';

const NOW_MS = Number(
  Temporal.PlainDateTime.from('2026-07-22T10:00').toZonedDateTime(TZ).epochMilliseconds,
);

const events: CalendarEvent[] = [
  {
    id: 'e1',
    calendarId: 'c1',
    title: 'Consulta',
    time: {
      allDay: false,
      start: { dateTime: '2026-07-22T09:00:00', timeZone: TZ },
      end: { dateTime: '2026-07-22T10:00:00', timeZone: TZ },
    },
    color: '#3366ff',
  },
  {
    id: 'e2',
    calendarId: 'c1',
    title: 'Sobreposto',
    time: {
      allDay: false,
      start: { dateTime: '2026-07-22T09:30:00', timeZone: TZ },
      end: { dateTime: '2026-07-22T10:30:00', timeZone: TZ },
    },
  },
];

const constraints: ConstraintSet = {
  businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
  blocked: [{ scope: 'time', date: '2026-07-22', startTime: '12:00', endTime: '13:00' }],
};

function makeApp(view = 'week') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = new CalendarApp({
    views: BUILTIN_VIEWS,
    date: REF,
    view,
    events,
    constraints,
    temporal: Temporal as unknown as never,
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

describe('CalendarApp — render Week/Day (jsdom)', () => {
  it('renderiza 7 colunas na semana, com eventos posicionados', async () => {
    const { app, container } = makeApp('week');
    await app.ready();

    const cols = container.querySelectorAll('[data-mc-day]');
    expect(cols).toHaveLength(7);

    const evs = container.querySelectorAll('[data-mc-event]');
    expect(evs.length).toBe(2);
    const e1 = container.querySelector('[data-mc-event="e1@2026-07-22T09:00:00"]') as HTMLElement;
    expect(e1).toBeTruthy();
    expect(e1.style.top).toBe('180px');
    expect(e1.style.height).toBe('60px');
    expect(new Set([...evs].map((node) => (node as HTMLElement).style.left)).size).toBe(2);
    app.destroy();
  });

  it('desenha camada de fundo (horário comercial) e bloqueios', async () => {
    const { app, container } = makeApp('week');
    await app.ready();

    expect(container.querySelectorAll('[data-mc-nonbusiness]').length).toBeGreaterThan(0);
    const wed = container.querySelector('[data-mc-day="2026-07-22"]') as HTMLElement;
    expect(wed.querySelectorAll('[data-mc-blocked]').length).toBe(1);
    app.destroy();
  });

  it('mostra a linha "agora" no dia de hoje', async () => {
    const { app, container } = makeApp('week');
    await app.ready();
    const now = container.querySelectorAll('[data-mc-now]');
    expect(now).toHaveLength(1);
    expect((now[0] as HTMLElement).style.top).toBe('240px');
    app.destroy();
  });

  it('navega prev/next/today SEM recriar a instância (mesmo nó raiz)', async () => {
    const { app, container } = makeApp('week');
    await app.ready();

    const rootBefore = container.querySelector('[data-mc-root]');
    const firstDayBefore = (container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay;
    expect(firstDayBefore).toBe('2026-07-20');

    app.next();
    const rootAfter = container.querySelector('[data-mc-root]');
    expect(rootAfter).toBe(rootBefore);
    const firstDayAfter = (container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay;
    expect(firstDayAfter).toBe('2026-07-27');
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(7);

    app.prev();
    expect((container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay).toBe(
      '2026-07-20',
    );

    app.today();
    expect(container.querySelector('[data-mc-root]')).toBe(rootBefore);
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(7);
    app.destroy();
  });

  it('troca de view week→day mantém a instância e passa a 1 coluna', async () => {
    const { app, container } = makeApp('week');
    await app.ready();
    const root = container.querySelector('[data-mc-root]');
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(7);

    app.changeView('day');
    expect(container.querySelector('[data-mc-root]')).toBe(root);
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(1);
    expect((container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay).toBe(REF);
    app.destroy();
  });

  it('expõe título e range visível; valida slots via ConstraintEngine', async () => {
    const { app } = makeApp('week');
    await app.ready();
    expect(app.getTitle()).toMatch(/\d/);
    expect(app.getVisibleRange()).toEqual({ start: '2026-07-20', end: '2026-07-26' });
    expect(app.evaluateSlot({ date: '2026-07-22', startMin: 750, endMin: 780 }).valid).toBe(false);
    expect(app.evaluateSlot({ date: '2026-07-22', startMin: 540, endMin: 600 }).valid).toBe(true);
    app.destroy();
  });
});
