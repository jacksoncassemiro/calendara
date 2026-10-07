/**
 * Testes NODE (sem DOM) da lógica pura do adapter React: a delegação do `createHandle` e os
 * defaults do `createReactView`. A montagem real do <Calendar/> (React + ilha + jsdom) fica em
 * `Calendar.dom.spec.tsx` (CI) — o sandbox não boota jsdom no tempo disponível.
 */
import { describe, it, expect } from 'vitest';
import { createHandle } from '../../src/react/handle.js';
import { createReactView } from '../../src/react/createReactView.js';
import type { CalendarApp } from '../../src/react/app/calendarApp.js';

describe('createHandle — delega ao CalendarApp', () => {
  it('encaminha cada método e retorna os valores', () => {
    const calls: string[] = [];
    const fakeApp = {
      prev: () => calls.push('prev'),
      next: () => calls.push('next'),
      today: () => calls.push('today'),
      setDate: (dateISO: string) => calls.push(`setDate:${dateISO}`),
      changeView: (viewName: string) => calls.push(`changeView:${viewName}`),
      getTitle: () => 'Título',
      getVisibleRange: () => ({ start: '2026-07-20', end: '2026-07-26' }),
      getState: () => ({ date: '2026-07-22' }),
      listViews: () => [{ name: 'week', label: 'Semana' }],
      evaluateSlot: () => ({ valid: true, reason: 'ok' as const }),
      evaluatePlacement: (input: { dateISO: string; startMin: number; endMin: number; resourceId?: string; kind: string }) => {
        expect(input.kind).toBe('select');
        calls.push(`placement:${input.dateISO}:${input.startMin}:${input.endMin}:${input.resourceId}`);
        return { valid: false, reason: 'over-capacity' as const };
      },
      refetch: () => calls.push('refetch'),
    };
    const handle = createHandle(fakeApp as unknown as CalendarApp);

    handle.prev();
    handle.next();
    handle.today();
    handle.setDate('2026-01-01');
    handle.changeView('day');
    handle.refetch();

    expect(calls).toEqual(['prev', 'next', 'today', 'setDate:2026-01-01', 'changeView:day', 'refetch']);
    expect(handle.getTitle()).toBe('Título');
    expect(handle.getVisibleRange()).toEqual({ start: '2026-07-20', end: '2026-07-26' });
    expect(handle.listViews()).toEqual([{ name: 'week', label: 'Semana' }]);
    expect(handle.evaluateSlot({ date: '2026-07-22' }).valid).toBe(true);
    expect(handle.evaluatePlacement({ dateISO: '2026-07-22', startMin: 540, endMin: 600, resourceId: 'r1' }))
      .toEqual({ valid: false, reason: 'over-capacity' });
    expect(calls[calls.length - 1]).toBe('placement:2026-07-22:540:600:r1');
  });
});

describe('createReactView — configuração de view', () => {
  // PlainDate falso (só o que a view usa: toString/add/subtract).
  function shiftISO(dateISO: string, days: number): string {
    const date = new Date(`${dateISO}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function fakeDate(dateISO: string): unknown {
    return {
      toString: () => dateISO,
      add: ({ days }: { days: number }) => fakeDate(shiftISO(dateISO, days)),
      subtract: ({ days }: { days: number }) => fakeDate(shiftISO(dateISO, -days)),
    };
  }

  it('default: 1 dia + navegação ±1 + título ISO', () => {
    const view = createReactView({ name: 'react-day', label: 'React' }, () => null);
    const date = fakeDate('2026-07-22') as never;
    const context = {} as never;

    expect(view.name).toBe('react-day');
    expect(view.label).toBe('React');
    const range = view.getRange(date, context);
    expect(range.days).toHaveLength(1);
    expect(range.startDate.toString()).toBe('2026-07-22');
    expect(view.navigate('next', date, context).toString()).toBe('2026-07-23');
    expect(view.navigate('prev', date, context).toString()).toBe('2026-07-21');
    expect(view.getTitle(range, context)).toBe('2026-07-22');
  });

  it('respeita getRange/navigate/getTitle customizados', () => {
    const view = createReactView(
      {
        name: 'x',
        label: 'X',
        getRange: (date) => ({ days: [date, date], startDate: date, endDate: date }),
        navigate: (_direction, date) => date,
        getTitle: () => 'custom',
      },
      () => null,
    );
    const date = fakeDate('2026-07-22') as never;
    const context = {} as never;
    expect(view.getRange(date, context).days).toHaveLength(2);
    expect(view.getTitle(view.getRange(date, context), context)).toBe('custom');
  });
});
