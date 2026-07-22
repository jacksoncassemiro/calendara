// @vitest-environment jsdom
/** @jsxRuntime automatic @jsxImportSource react */
/**
 * Integração React ponta-a-ponta (CI). NÃO roda no sandbox de verificação (jsdom não boota no
 * limite de tempo) — rodar com `yarn test` num ambiente normal. Cobre: montagem única + render do
 * core, sync de props (events/view), API imperativa (useCalendar), customToolbar (suprime a nativa)
 * e createReactView (corpo em React embutido via ilha).
 */
import { describe, it, expect } from 'vitest';
import { render, waitFor, act, cleanup } from '@testing-library/react';
import { useRef, useEffect } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { Calendar } from '../src/Calendar.js';
import { useCalendar } from '../src/useCalendar.js';
import { createReactView } from '../src/createReactView.js';
import type { CalendarEvent } from '@meucalendario/core';
import type { CalendarHandle } from '../src/types.js';

const TZ = 'America/Sao_Paulo';
const REF = '2026-07-22';
const temporal = Temporal as unknown as never;

const options = {
  timeZone: TZ,
  startHour: 6,
  endHour: 20,
  slotMinutes: 60,
  pxPerMinute: 1,
  nowMs: 0,
  weekStart: 'MO' as const,
  locale: 'pt-BR',
  minEventMinutes: 15,
};

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
  },
];

describe('<Calendar/> (jsdom)', () => {
  it('monta o core uma vez e renderiza a semana', async () => {
    const { container } = render(
      <Calendar date={REF} view="week" events={events} temporal={temporal} options={options} />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-root]')).toBeTruthy());
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(7);
    expect(container.querySelector('[data-mc-event="e1@2026-07-22T09:00:00"]')).toBeTruthy();
    cleanup();
  });

  it('sincroniza a prop events sem recriar a instância', async () => {
    const { container, rerender } = render(
      <Calendar date={REF} view="day" events={[]} temporal={temporal} options={options} />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-root]')).toBeTruthy());
    const rootBefore = container.querySelector('[data-mc-root]');
    expect(container.querySelectorAll('[data-mc-event]')).toHaveLength(0);

    rerender(<Calendar date={REF} view="day" events={events} temporal={temporal} options={options} />);
    await waitFor(() => expect(container.querySelectorAll('[data-mc-event]')).toHaveLength(1));
    // mesma instância: o nó raiz do core não foi recriado.
    expect(container.querySelector('[data-mc-root]')).toBe(rootBefore);
    cleanup();
  });

  it('useCalendar comanda a navegação imperativamente', async () => {
    let handle: CalendarHandle | null = null;
    function Harness() {
      const { ref, api } = useCalendar();
      useEffect(() => {
        handle = api;
      }, [api]);
      return <Calendar date={REF} view="week" temporal={temporal} options={options} apiRef={ref} />;
    }
    const { container } = render(<Harness />);
    await waitFor(() => expect(container.querySelector('[data-mc-root]')).toBeTruthy());
    const firstDay = () => (container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay;
    expect(firstDay()).toBe('2026-07-20');
    act(() => {
      handle!.next();
    });
    await waitFor(() => expect(firstDay()).toBe('2026-07-27'));
    cleanup();
  });

  it('customToolbar (React) substitui a toolbar nativa', async () => {
    const { container } = render(
      <Calendar
        date={REF}
        view="week"
        temporal={temporal}
        options={options}
        customToolbar={(ctx) => <div data-testid="react-toolbar">{ctx.title}</div>}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-react-island]')).toBeTruthy());
    await waitFor(() =>
      expect(container.querySelector('[data-testid="react-toolbar"]')).toBeTruthy(),
    );
    // a toolbar nativa não é desenhada quando há customToolbar.
    expect(container.querySelector('[data-mc-toolbar]')).toBeNull();
    cleanup();
  });

  it('createReactView embute um corpo React via ilha', async () => {
    const reactView = createReactView(
      { name: 'react-day', label: 'React' },
      () => <div data-testid="react-body">corpo</div>,
    );
    const { container } = render(
      <Calendar
        date={REF}
        view="react-day"
        views={[reactView]}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="react-body"]')).toBeTruthy(),
    );
    cleanup();
  });
});
