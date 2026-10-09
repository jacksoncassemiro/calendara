// @vitest-environment jsdom
/** @jsxRuntime automatic @jsxImportSource react */

import { BUILTIN_VIEWS } from '../../src/react/views/registry/defaultViews.js';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, waitFor, act, cleanup } from '@testing-library/react';
import { useRef, useEffect, useState, StrictMode, createContext, useContext } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { Calendar } from '../../src/react/Calendar.js';
import { useCalendar } from '../../src/react/useCalendar.js';
import { createReactView } from '../../src/react/createReactView.js';
import { dayView, weekView } from '../../src/react/views/timeGridViews.js';
import { monthView } from '../../src/react/views/MonthView.js';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { createResourceDayView } from '../../src/react/views/index.js';
import type { CalendarEvent } from '../../src/core/index.js';
import type { CalendarHandle } from '../../src/react/types.js';

const TZ = 'America/Sao_Paulo';
const REF = '2026-07-22';
const temporal = Temporal as unknown as never;
afterEach(cleanup);

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
  it('updates day decorations and header content from consumer state, then restores defaults', async () => {
    const views = [dayView];
    const base = { views, initialDate: REF, temporal, options, events };
    const { container, rerender } = render(
      <Calendar
        {...base}
        getDayStyle={() => ({ backgroundColor: 'rgb(36, 70, 55)' })}
        renderDayHeader={({ defaultContent, dateISO }) => (
          <>
            {defaultContent}
            <small data-status={dateISO}>Available</small>
          </>
        )}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-status]')?.textContent).toBe('Available'),
    );
    expect(container.querySelector('[data-status]')?.getAttribute('data-status')).toBe(REF);
    expect(container.querySelector('.mc-day-col')?.getAttribute('style')).toContain(
      'rgb(36, 70, 55)',
    );
    rerender(
      <Calendar
        {...base}
        renderDayHeader={({ defaultContent }) => (
          <>
            {defaultContent}
            <small data-status="full">Full</small>
          </>
        )}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-status]')?.textContent).toBe('Full'));
    expect(container.querySelector('.mc-day-col')?.getAttribute('style')).not.toContain(
      'rgb(36, 70, 55)',
    );
    expect(container.querySelector('[data-mc-event]')?.textContent).toContain('Consulta');
    rerender(<Calendar {...base} />);
    await waitFor(() => expect(container.querySelector('[data-status]')).toBeNull());
    expect(container.querySelector('.mc-daynum')?.textContent).toBe('22');
  });

  it('updates resource columns from live props, supports empty lists and restores factory defaults', async () => {
    const fallback = [{ id: 'fallback', title: 'Factory resource' }];
    const views = [createResourceDayView(fallback, 'live-resources')];
    const { container, rerender } = render(
      <Calendar
        date={REF}
        view="live-resources"
        views={views}
        temporal={temporal}
        options={options}
        resources={[{ id: 'r1', title: 'Room one' }]}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-mc-resource-header="r1"]')).toBeTruthy(),
    );
    rerender(
      <Calendar
        date={REF}
        view="live-resources"
        views={views}
        temporal={temporal}
        options={options}
        resources={[{ id: 'r2', title: 'Room two' }]}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-mc-resource-header="r2"]')).toBeTruthy(),
    );
    expect(container.querySelector('[data-mc-resource-header="r1"]')).toBeNull();
    rerender(
      <Calendar
        date={REF}
        view="live-resources"
        views={views}
        temporal={temporal}
        options={options}
        resources={[]}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-resource-header]')).toBeNull());
    rerender(
      <Calendar
        date={REF}
        view="live-resources"
        views={views}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-mc-resource-header="fallback"]')).toBeTruthy(),
    );
  });
  it('keeps event content stable when the host passes equivalent calendar data', async () => {
    const renderEvent = vi.fn((info: { event: CalendarEvent }) => (
      <span data-testid="stable-slot">{info.event.title}</span>
    ));
    const { container, rerender } = render(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        temporal={temporal}
        options={options}
        events={events}
        resources={[]}
        constraints={{}}
        renderEvent={renderEvent}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="stable-slot"]')).toBeTruthy(),
    );
    const calls = renderEvent.mock.calls.length;
    const slot = container.querySelector('[data-testid="stable-slot"]');
    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        temporal={temporal}
        options={{ ...options }}
        events={events.map((event) => ({ ...event, time: { ...event.time } }))}
        resources={[]}
        constraints={{}}
        renderEvent={renderEvent}
      />,
    );
    expect(container.querySelector('[data-testid="stable-slot"]')).toBe(slot);
    expect(renderEvent.mock.calls).toHaveLength(calls);
  });

  it('fetches once for the final range when date and view props change together', async () => {
    const source = vi.fn((_range: { start: string; end: string }) => [] as CalendarEvent[]);
    const { container, rerender } = render(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="week"
        temporal={temporal}
        options={options}
        eventSource={source}
        refetchKey="initial"
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-root]')).toBeTruthy());
    expect(source).toHaveBeenCalledTimes(1);
    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date="2026-08-10"
        view="day"
        temporal={temporal}
        options={options}
        eventSource={source}
        refetchKey="initial"
      />,
    );
    await waitFor(() => expect(source).toHaveBeenCalledTimes(2));
    expect(source.mock.calls[1]?.[0]).toEqual({ start: '2026-08-10', end: '2026-08-10' });
  });

  it('preserves imperative navigation when unrelated options change', async () => {
    const apiRef = { current: null as CalendarHandle | null };
    const { container, rerender } = render(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        apiRef={apiRef}
        temporal={temporal}
        events={events}
        options={options}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-day]')).toBeTruthy());
    act(() => {
      apiRef.current!.next();
    });
    await waitFor(() =>
      expect((container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay).toBe(
        '2026-07-23',
      ),
    );
    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        apiRef={apiRef}
        temporal={temporal}
        events={events}
        options={{ ...options, slotMinutes: 30 }}
      />,
    );
    expect((container.querySelector('[data-mc-day]') as HTMLElement).dataset.mcDay).toBe(
      '2026-07-23',
    );
  });
  it('event, toolbar and custom views inherit and update the consumer context', async () => {
    const Theme = createContext('missing');
    function ThemeLabel({ kind }: { kind: string }) {
      const theme = useContext(Theme);
      return <span data-theme-kind={kind}>{theme}</span>;
    }
    const view = createReactView({ name: 'context-view', label: 'Context' }, () => (
      <ThemeLabel kind="view" />
    ));
    const renderEvent = () => <ThemeLabel kind="event" />;
    const customToolbar = () => <ThemeLabel kind="toolbar" />;
    function Harness({ theme, currentView }: { theme: string; currentView: string }) {
      return (
        <Theme.Provider value={theme}>
          <Calendar
            date={REF}
            view={currentView}
            views={[dayView, view]}
            temporal={temporal}
            events={events}
            options={options}
            renderEvent={renderEvent}
            customToolbar={customToolbar}
          />
        </Theme.Provider>
      );
    }
    const { container, rerender } = render(<Harness theme="light" currentView="day" />);
    await waitFor(() =>
      expect(container.querySelector('[data-theme-kind="event"]')?.textContent).toBe('light'),
    );
    expect(container.querySelector('[data-theme-kind="toolbar"]')?.textContent).toBe('light');
    rerender(<Harness theme="dark" currentView="day" />);
    await waitFor(() =>
      expect(container.querySelector('[data-theme-kind="event"]')?.textContent).toBe('dark'),
    );
    expect(container.querySelector('[data-theme-kind="toolbar"]')?.textContent).toBe('dark');
    rerender(<Harness theme="dark" currentView="context-view" />);
    await waitFor(() =>
      expect(container.querySelector('[data-theme-kind="view"]')?.textContent).toBe('dark'),
    );
    rerender(<Harness theme="contrast" currentView="context-view" />);
    await waitFor(() =>
      expect(container.querySelector('[data-theme-kind="view"]')?.textContent).toBe('contrast'),
    );
  });
  it('supports React hooks in custom view bodies', async () => {
    function Body() {
      const [value, setValue] = useState(0);
      return (
        <button data-testid="hook-body" onClick={() => setValue((current) => current + 1)}>
          {value}
        </button>
      );
    }
    const view = createReactView({ name: 'hooks', label: 'Hooks' }, Body);
    const { container } = render(
      <Calendar date={REF} view="hooks" views={[view]} temporal={temporal} />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="hook-body"]')?.textContent).toBe('0'),
    );
    act(() => {
      (container.querySelector('[data-testid="hook-body"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="hook-body"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-mc-react-island]')).toBeNull();
  });

  it('StrictMode destroys abandoned instances before fetching and maintains the API ref', async () => {
    let fetches = 0;
    const apiRef = { current: null as CalendarHandle | null };
    const { container, unmount } = render(
      <StrictMode>
        <Calendar
          views={BUILTIN_VIEWS}
          date={REF}
          temporal={temporal}
          apiRef={apiRef}
          eventSource={() => {
            fetches++;
            return events;
          }}
        />
      </StrictMode>,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-event]')).toBeTruthy());
    expect(fetches).toBe(1);
    expect(apiRef.current).toBeTruthy();
    unmount();
    expect(apiRef.current).toBeNull();
  });

  it('replaces API refs, event sources and custom toolbars without remounting', async () => {
    const firstRef = { current: null as CalendarHandle | null };
    const secondRef = { current: null as CalendarHandle | null };
    const { container, rerender } = render(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        temporal={temporal}
        apiRef={firstRef}
        eventSource={() => events}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-event]')).toBeTruthy());
    const root = container.querySelector('[data-mc-root]');
    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        temporal={temporal}
        apiRef={secondRef}
        eventSource={() => []}
        customToolbar={() => <div data-testid="new-toolbar">New</div>}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="new-toolbar"]')).toBeTruthy(),
    );
    await waitFor(() => expect(container.querySelector('[data-mc-event]')).toBeNull());
    expect(container.querySelector('[data-mc-root]')).toBe(root);
    expect(firstRef.current).toBeNull();
    expect(secondRef.current).toBeTruthy();
    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        temporal={temporal}
        apiRef={secondRef}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-toolbar]')).toBeTruthy());
  });
  it('monta o core uma vez e renderiza a semana', async () => {
    const { container } = render(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="week"
        events={events}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-root]')).toBeTruthy());
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(7);
    expect(container.querySelector('[data-mc-event="e1@2026-07-22T09:00:00"]')).toBeTruthy();
    cleanup();
  });

  it('sincroniza a prop events sem recriar a instância', async () => {
    const { container, rerender } = render(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        events={[]}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-mc-root]')).toBeTruthy());
    const rootBefore = container.querySelector('[data-mc-root]');
    expect(container.querySelectorAll('[data-mc-event]')).toHaveLength(0);

    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        view="day"
        events={events}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() => expect(container.querySelectorAll('[data-mc-event]')).toHaveLength(1));

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
      return (
        <Calendar
          views={BUILTIN_VIEWS}
          date={REF}
          view="week"
          temporal={temporal}
          options={options}
          apiRef={ref}
        />
      );
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
        views={BUILTIN_VIEWS}
        date={REF}
        view="week"
        temporal={temporal}
        options={options}
        customToolbar={(ctx) => <div data-testid="react-toolbar">{ctx.title}</div>}
      />,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-testid="react-toolbar"]')).toBeTruthy(),
    );

    expect(container.querySelector('[data-mc-toolbar]')).toBeNull();
    cleanup();
  });

  it('uses only the chosen views and keeps order when replacing the active view', async () => {
    const apiRef = { current: null as CalendarHandle | null };
    const { container, rerender } = render(
      <Calendar
        date={REF}
        views={[monthView, dayView]}
        apiRef={apiRef}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() => expect(container.querySelector('.mc-month')).toBeTruthy());
    expect(apiRef.current!.listViews().map((view) => view.name)).toEqual(['month', 'day']);
    expect(() => apiRef.current!.changeView('week')).toThrow('view não registrada');
    rerender(
      <Calendar
        date={REF}
        views={[dayView, monthView]}
        apiRef={apiRef}
        temporal={temporal}
        options={options}
      />,
    );
    expect(apiRef.current!.listViews().map((view) => view.name)).toEqual(['day', 'month']);
    expect(apiRef.current!.getState().viewName).toBe('month');
    rerender(
      <Calendar
        date={REF}
        views={[dayView]}
        apiRef={apiRef}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() => expect(apiRef.current!.getState().viewName).toBe('day'));
    expect(container.querySelector('.mc-month')).toBeNull();
    expect(apiRef.current!.listViews().map((view) => view.name)).toEqual(['day']);
    expect(container.querySelectorAll('[data-mc-day]')).toHaveLength(1);
    expect(() => apiRef.current!.changeView('month')).toThrow('view não registrada');
    rerender(
      <Calendar
        views={BUILTIN_VIEWS}
        date={REF}
        apiRef={apiRef}
        temporal={temporal}
        options={options}
      />,
    );
    expect(apiRef.current!.listViews().map((view) => view.name)).toEqual([
      'week',
      'day',
      'month',
      'list',
    ]);
  });

  it('rejects invalid registries without changing the mounted selection', () => {
    // @ts-expect-error Views are required. PT: Views são obrigatórias.
    expect(() => new CalendarApp({ temporal })).toThrow('pelo menos uma view');
    expect(() => new CalendarApp({ views: [] })).toThrow('pelo menos uma view');
    expect(() => new CalendarApp({ views: [dayView, dayView] })).toThrow('view duplicada');
    expect(() => new CalendarApp({ views: [dayView], view: 'month' })).toThrow(
      'view não registrada',
    );
    const app = new CalendarApp({ views: [dayView], temporal, date: REF });
    expect(() => app.setViews([])).toThrow('pelo menos uma view');
    expect(app.listViews()).toEqual([{ name: 'day', label: dayView.label }]);
    app.setViews([weekView]);
    expect(app.getState().viewName).toBe('week');
    app.destroy();
  });

  it('createReactView renders a native React body', async () => {
    const reactView = createReactView({ name: 'react-day', label: 'React' }, () => (
      <div data-testid="react-body">corpo</div>
    ));
    const { container } = render(
      <Calendar
        date={REF}
        view="react-day"
        views={[reactView]}
        temporal={temporal}
        options={options}
      />,
    );
    await waitFor(() => expect(container.querySelector('[data-testid="react-body"]')).toBeTruthy());
    cleanup();
  });
});
