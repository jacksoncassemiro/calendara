// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCalendarHistory } from '../../src/react/hooks/useCalendarHistory.js';

afterEach(cleanup);

const events = (title: string) => [
  {
    id: 'series',
    title,
    time: { start: '2026-10-09', end: '2026-10-12', allDay: true },
    resourceIds: ['room'],
    recurrence: { overrides: { '2026-10-09': { title: 'Occurrence' } } },
    metadata: { nested: { value: 1 } },
  },
];

it('persists complete snapshots for commit, undo and redo and clears redo after a new edit', async () => {
  const persist = vi.fn();
  const initial = events('Original');
  const { result } = renderHook(() => useCalendarHistory({ initialEvents: initial, persist }));
  await act(async () => {
    await result.current.commit(events('Edited'));
  });
  expect(result.current.canUndo).toBe(true);
  await act(async () => {
    await result.current.undo();
  });
  expect(result.current.events).toEqual(initial);
  expect(result.current.canRedo).toBe(true);
  await act(async () => {
    await result.current.redo();
  });
  expect(result.current.events[0]?.title).toBe('Edited');
  await act(async () => {
    await result.current.undo();
  });
  await act(async () => {
    await result.current.commit(events('New'));
  });
  expect(result.current.canRedo).toBe(false);
  expect(persist.mock.calls.map(([snapshot]) => snapshot[0].title)).toEqual([
    'Edited',
    'Original',
    'Edited',
    'Original',
    'New',
  ]);
});

it('isolates initial data, supplied edits, exposed events and persistence from stored snapshots', async () => {
  const initial = events('Original');
  const persist = vi.fn((snapshot) => {
    snapshot[0].metadata.nested.value = 99;
  });
  const { result } = renderHook(() => useCalendarHistory({ initialEvents: initial, persist }));
  initial[0]!.metadata.nested.value = 2;
  result.current.events[0]!.metadata.nested.value = 3;
  const edited = events('Edited');
  await act(async () => {
    await result.current.commit(edited);
  });
  edited[0]!.metadata.nested.value = 4;
  expect(result.current.events[0]?.metadata.nested.value).toBe(1);
  await act(async () => {
    await result.current.undo();
  });
  expect(result.current.events[0]?.metadata.nested.value).toBe(1);
});

it('retains current events and both history directions after failed persistence', async () => {
  const persist = vi.fn();
  const { result } = renderHook(() => useCalendarHistory({ initialEvents: events('A'), persist }));
  await act(async () => {
    await result.current.commit(events('B'));
  });
  await act(async () => {
    await result.current.commit(events('C'));
  });
  await act(async () => {
    await result.current.undo();
  });
  for (const operation of [
    () => result.current.commit(events('D')),
    result.current.undo,
    result.current.redo,
  ]) {
    persist.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await expect(operation()).rejects.toThrow('offline');
    });
    expect(result.current.events[0]?.title).toBe('B');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.pending).toBe(false);
  }
});

it('blocks overlapping operations and ignores completion after an external replacement', async () => {
  let resolve!: () => void;
  const persist = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const { result } = renderHook(() => useCalendarHistory({ initialEvents: events('A'), persist }));
  let first!: Promise<boolean>;
  act(() => {
    first = result.current.commit(events('B'));
  });
  expect(result.current.pending).toBe(true);
  expect(await result.current.commit(events('C'))).toBe(false);
  expect(await result.current.undo()).toBe(false);
  expect(await result.current.redo()).toBe(false);
  act(() => {
    result.current.replaceEvents(events('Server'));
  });
  expect(result.current.pending).toBe(true);
  expect(await result.current.commit(events('D'))).toBe(false);
  await act(async () => {
    resolve();
    expect(await first).toBe(false);
  });
  expect(result.current.events[0]?.title).toBe('Server');
  expect(result.current.canUndo).toBe(false);
  expect(result.current.canRedo).toBe(false);
  expect(result.current.pending).toBe(false);
  expect(persist).toHaveBeenCalledOnce();
});

it('bounds history, supports zero history and uses the latest persistence callback', async () => {
  const first = vi.fn();
  const latest = vi.fn();
  const { result, rerender } = renderHook(
    ({ persist }) => useCalendarHistory({ initialEvents: events('A'), limit: 1, persist }),
    { initialProps: { persist: first } },
  );
  await act(async () => {
    await result.current.commit(events('B'));
  });
  rerender({ persist: latest });
  await act(async () => {
    await result.current.commit(events('C'));
  });
  await act(async () => {
    await result.current.undo();
  });
  expect(result.current.events[0]?.title).toBe('B');
  expect(await result.current.undo()).toBe(false);
  expect(first).toHaveBeenCalledOnce();
  expect(latest).toHaveBeenCalledTimes(2);
  act(() => {
    result.current.replaceEvents(events('Reloaded'));
  });
  expect(result.current.canRedo).toBe(false);
  const disabled = renderHook(() => useCalendarHistory({ initialEvents: events('A'), limit: 0 }));
  await act(async () => {
    await disabled.result.current.commit(events('B'));
  });
  expect(disabled.result.current.canUndo).toBe(false);
});

it('supports a consumer clone for non-cloneable metadata and ignores unmounted completion', async () => {
  const callback = () => 'custom';
  let resolve!: () => void;
  const persist = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const { result, unmount } = renderHook(() =>
    useCalendarHistory({
      initialEvents: [{ callback, data: { title: 'A' } }],
      cloneSnapshot: (snapshot) => snapshot.map((event) => ({ ...event, data: { ...event.data } })),
      persist,
    }),
  );
  let pending!: Promise<boolean>;
  act(() => {
    pending = result.current.commit([{ callback, data: { title: 'B' } }]);
  });
  unmount();
  resolve();
  expect(await pending).toBe(false);
});
