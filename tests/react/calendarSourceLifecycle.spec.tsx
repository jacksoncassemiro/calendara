// @vitest-environment jsdom
/** @jsxRuntime automatic @jsxImportSource react */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { Temporal } from '@js-temporal/polyfill';
import { Calendar } from '../../src/react/Calendar.js';
import { CalendarApp, type EventSource, type RangeChange } from '../../src/react/app/calendarApp.js';
import { dayView } from '../../src/react/views/timeGridViews.js';
import { monthView } from '../../src/react/views/MonthView.js';
import { DEFAULT_OPTIONS, type CalendarEvent } from '../../src/core/index.js';
import type { CalendarHandle } from '../../src/react/types.js';

const referenceDate = '2026-10-07';
const temporal = Temporal as unknown as never;
const views = [dayView, monthView];
afterEach(cleanup);

function deferredEvents() {
  let resolve!: (events: CalendarEvent[]) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<CalendarEvent[]>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('React state and remote-source lifecycle', () => {
  it('resolves implicit initial dates in the configured zone before callbacks and fetching', async () => {
    const nowMs = Date.parse('2026-10-08T00:15:00Z');
    const hostDate = new Date(nowMs);
    const hostDateISO = `${hostDate.getFullYear()}-${String(hostDate.getMonth() + 1).padStart(2, '0')}-${String(hostDate.getDate()).padStart(2, '0')}`;
    const calendars = [
      { timeZone: 'Pacific/Kiritimati', expectedDate: '2026-10-08' },
      { timeZone: 'Pacific/Honolulu', expectedDate: '2026-10-07' },
    ];
    expect(calendars.some(({ expectedDate }) => expectedDate !== hostDateISO)).toBe(true);
    for (const { timeZone, expectedDate } of calendars) {
      const dates = vi.fn();
      const ranges = vi.fn();
      const source = vi.fn((_range: RangeChange) => [] as CalendarEvent[]);
      const app = new CalendarApp({ temporal, views: [dayView], options: { timeZone, nowMs }, eventSource: source });
      app.on('dateChange', dates);
      app.on('rangeChange', ranges);
      try {
        await app.ready();
        expect(app.getState().date).toBe(expectedDate);
        expect(dates.mock.calls).toEqual([[expectedDate]]);
        expect(ranges.mock.calls).toEqual([[{ start: expectedDate, end: expectedDate }]]);
        expect(source).toHaveBeenCalledTimes(1);
        expect(source.mock.calls[0]?.[0]).toEqual({ start: expectedDate, end: expectedDate });
        app.setDate('2026-11-01');
        app.today();
        expect(app.getState().date).toBe(expectedDate);
      } finally { app.destroy(); }
    }
  });

  it('preserves explicit dates and pre-ready navigation when resolving the initial timezone', async () => {
    const options = { timeZone: 'Pacific/Kiritimati', nowMs: Date.parse('2026-10-08T00:15:00Z') };
    const initialApp = new CalendarApp({ temporal, views, options, initialDate: '2026-09-15' });
    const explicitApp = new CalendarApp({ temporal, views, options, initialDate: '2026-09-15', date: '2026-09-21' });
    const navigatedApp = new CalendarApp({ temporal, views, options });
    const sameDateRequestedApp = new CalendarApp({ temporal, views, options });
    const requestedDate = sameDateRequestedApp.getState().date;
    navigatedApp.setDate('2026-11-05');
    sameDateRequestedApp.setDate(requestedDate);
    try {
      await Promise.all([initialApp.ready(), explicitApp.ready(), navigatedApp.ready(), sameDateRequestedApp.ready()]);
      expect(initialApp.getState().date).toBe('2026-09-15');
      expect(explicitApp.getState().date).toBe('2026-09-21');
      expect(navigatedApp.getState().date).toBe('2026-11-05');
      expect(sameDateRequestedApp.getState().date).toBe(requestedDate);
    } finally {
      for (const app of [initialApp, explicitApp, navigatedApp, sameDateRequestedApp]) app.destroy();
    }
  });

  it('uses initial view/date only at mounting and preserves navigation until request props change', async () => {
    const apiRef = { current: null as CalendarHandle | null };
    const { rerender } = render(<Calendar initialDate={referenceDate} initialView="month"
      views={views} temporal={temporal} apiRef={apiRef} />);
    await waitFor(() => expect(apiRef.current?.getState().viewName).toBe('month'));
    expect(apiRef.current!.getState().date).toBe(referenceDate);
    rerender(<Calendar initialDate="2026-11-15" initialView="day"
      views={views} temporal={temporal} apiRef={apiRef} />);
    expect(apiRef.current!.getState().viewName).toBe('month');
    expect(apiRef.current!.getState().date).toBe(referenceDate);
    act(() => apiRef.current!.setDate('2026-10-12'));
    rerender(<Calendar initialDate={referenceDate} initialView="month" date="2026-10-14" view="day"
      views={views} temporal={temporal} apiRef={apiRef} />);
    expect(apiRef.current!.getState().viewName).toBe('day');
    expect(apiRef.current!.getState().date).toBe('2026-10-14');
    act(() => { apiRef.current!.changeView('month'); apiRef.current!.next(); });
    rerender(<Calendar initialDate={referenceDate} initialView="month" date="2026-10-14" view="day"
      views={views} temporal={temporal} apiRef={apiRef} className="updated-host" />);
    expect(apiRef.current!.getState().viewName).toBe('month');
    expect(apiRef.current!.getState().date).not.toBe('2026-10-14');
  });

  it('selects the first configured view by default and gives explicit requests precedence over initial values', async () => {
    const defaultApp = new CalendarApp({ temporal, views: [monthView, dayView], initialDate: referenceDate });
    const requestedApp = new CalendarApp({ temporal, views,
      initialDate: '2026-11-15', initialView: 'month', date: referenceDate, view: 'day' });
    try {
      await Promise.all([defaultApp.ready(), requestedApp.ready()]);
      expect(defaultApp.getState().viewName).toBe('month');
      expect(defaultApp.getState().date).toBe(referenceDate);
      expect(requestedApp.getState().viewName).toBe('day');
      expect(requestedApp.getState().date).toBe(referenceDate);
    } finally {
      defaultApp.destroy();
      requestedApp.destroy();
    }
  });

  it('reports initial state and uses the latest callbacks after navigation and source errors', async () => {
    const apiRef = { current: null as CalendarHandle | null };
    const initialDate = vi.fn();
    const initialView = vi.fn();
    const initialRange = vi.fn();
    const latestDate = vi.fn();
    const latestView = vi.fn();
    const latestRange = vi.fn();
    const latestError = vi.fn();
    const { rerender } = render(<Calendar date={referenceDate} views={views} temporal={temporal}
      apiRef={apiRef} onDateChange={initialDate} onViewChange={initialView} onRangeChange={initialRange} />);
    await waitFor(() => expect(initialRange).toHaveBeenCalledWith({ start: referenceDate, end: referenceDate }));
    expect(initialDate).toHaveBeenCalledWith(referenceDate);
    expect(initialView).toHaveBeenCalledWith('day');
    rerender(<Calendar date={referenceDate} views={views} temporal={temporal} apiRef={apiRef}
      onDateChange={latestDate} onViewChange={latestView} onRangeChange={latestRange} onError={latestError} />);
    act(() => { apiRef.current!.next(); apiRef.current!.changeView('month'); });
    expect(latestDate).toHaveBeenCalledWith('2026-10-08');
    expect(latestView).toHaveBeenCalledWith('month');
    expect(latestRange).toHaveBeenCalled();
    expect(initialDate).toHaveBeenCalledTimes(1);
    expect(initialView).toHaveBeenCalledTimes(1);
    expect(initialRange).toHaveBeenCalledTimes(1);
    const failure = new Error('Remote source unavailable');
    rerender(<Calendar date={referenceDate} views={views} temporal={temporal} apiRef={apiRef}
      eventSource={() => Promise.reject(failure)} onError={latestError} />);
    await waitFor(() => expect(latestError).toHaveBeenCalledWith(failure));
  });

  it('aborts superseded ranges and keeps loading true until the current request settles', async () => {
    const requests: { range: RangeChange; signal: AbortSignal; deferred: ReturnType<typeof deferredEvents> }[] = [];
    const source: EventSource = (range, { signal }) => {
      const deferred = deferredEvents();
      requests.push({ range, signal, deferred });
      return deferred.promise;
    };
    const loading = vi.fn();
    const latestLoading = vi.fn();
    const errors = vi.fn();
    const apiRef = { current: null as CalendarHandle | null };
    const { rerender, unmount } = render(<Calendar date={referenceDate} views={views} temporal={temporal}
      apiRef={apiRef} eventSource={source} onLoadingChange={loading} onError={errors} />);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(loading.mock.calls).toEqual([[true]]);
    rerender(<Calendar date="2026-10-08" views={views} temporal={temporal} apiRef={apiRef}
      eventSource={source} onLoadingChange={latestLoading} onError={errors} />);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]!.signal.aborted).toBe(true);
    expect(requests[1]!.range).toEqual({ start: '2026-10-08', end: '2026-10-08' });
    await act(async () => { requests[0]!.deferred.reject(new Error('Aborted old request')); });
    expect(errors).not.toHaveBeenCalled();
    expect(latestLoading).not.toHaveBeenCalled();
    await act(async () => { requests[1]!.deferred.resolve([]); });
    expect(latestLoading.mock.calls).toEqual([[false]]);
    act(() => apiRef.current!.refetch());
    await waitFor(() => expect(requests).toHaveLength(3));
    unmount();
    expect(requests[2]!.signal.aborted).toBe(true);
    await act(async () => { requests[2]!.deferred.reject(new Error('Destroyed request')); });
    expect(errors).not.toHaveBeenCalled();
    expect(latestLoading.mock.calls).toEqual([[false], [true]]);
  });

  it('cancels an obsolete source when replaced or removed without allowing late events to win', async () => {
    const oldRequest = deferredEvents();
    let oldSignal: AbortSignal | undefined;
    const oldSource: EventSource = (_range, { signal }) => {
      oldSignal = signal;
      return oldRequest.promise;
    };
    const app = new CalendarApp({ date: referenceDate, views, temporal, eventSource: oldSource });
    const loading: unknown[] = [];
    app.on('loadingChange', (value) => loading.push(value));
    await waitFor(() => expect(oldSignal).toBeDefined());
    const newRequest = deferredEvents();
    let newSignal: AbortSignal | undefined;
    app.setEventSource((_range, { signal }) => { newSignal = signal; return newRequest.promise; });
    await waitFor(() => expect(newSignal).toBeDefined());
    expect(oldSignal!.aborted).toBe(true);
    oldRequest.resolve([{ id: 'late-event', calendarId: 'personal', title: 'Obsolete event',
      time: { allDay: true, start: { date: referenceDate }, end: { date: '2026-10-08' } } }]);
    await app.ready();
    expect(app.getState().events).toEqual([]);
    expect(loading).toEqual([true]);
    app.setEventSource(undefined);
    expect(newSignal!.aborted).toBe(true);
    expect(loading).toEqual([true, false]);
    newRequest.resolve([]);
    await Promise.resolve();
    app.destroy();
  });

  it('resets removed declarative options while preserving patch semantics for imperative callers', async () => {
    const apiRef = { current: null as CalendarHandle | null };
    const { rerender } = render(<Calendar date={referenceDate} views={views} temporal={temporal}
      apiRef={apiRef} options={{ startHour: 9, endHour: 17, slotMinutes: 60 }} />);
    await waitFor(() => expect(apiRef.current).toBeTruthy());
    rerender(<Calendar date={referenceDate} views={views} temporal={temporal} apiRef={apiRef}
      options={{ startHour: 10 }} />);
    expect(apiRef.current!.getState().options.startHour).toBe(10);
    expect(apiRef.current!.getState().options.endHour).toBe(DEFAULT_OPTIONS.endHour);
    expect(apiRef.current!.getState().options.slotMinutes).toBe(DEFAULT_OPTIONS.slotMinutes);
    rerender(<Calendar date={referenceDate} views={views} temporal={temporal} apiRef={apiRef} />);
    expect(apiRef.current!.getState().options).toEqual(DEFAULT_OPTIONS);
    const app = new CalendarApp({ temporal, options: { startHour: 9, endHour: 17 } });
    app.setOptions({ slotMinutes: 60 });
    expect(app.getState().options.startHour).toBe(9);
    expect(app.getState().options.endHour).toBe(17);
    app.destroy();
  });
});
