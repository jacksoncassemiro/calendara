/**
 * Stable imperative calendar API and its attachment ref.
 * Português: API imperativa estável e ref de conexão com o calendário.
 *
 * Devolve `{ ref, api }`: passe `ref` para `<Calendar apiRef={ref} />` e use `api` (métodos
 * estáveis) em handlers para comandar o calendário (prev/next/changeView/…) sem re-render.
 */
import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { CalendarHandle } from './types.js';

export interface UseCalendar {
  /** Ligue em `<Calendar apiRef={ref} />`. */
  ref: RefObject<CalendarHandle | null>;
  /** API estável (delega ao calendário montado; no-op seguro antes da montagem). */
  api: CalendarHandle;
}

export function useCalendar(): UseCalendar {
  const ref = useRef<CalendarHandle | null>(null);
  const api = useMemo<CalendarHandle>(
    () => ({
      prev: () => ref.current?.prev(),
      next: () => ref.current?.next(),
      today: () => ref.current?.today(),
      setDate: (dateISO) => ref.current?.setDate(dateISO),
      changeView: (viewName) => ref.current?.changeView(viewName),
      getTitle: () => ref.current?.getTitle() ?? '',
      getVisibleRange: () => ref.current?.getVisibleRange() ?? { start: '', end: '' },
      getState: () => {
        const state = ref.current?.getState();
        if (!state) throw new Error('[calendara/react] calendário ainda não montado');
        return state;
      },
      listViews: () => ref.current?.listViews() ?? [],
      evaluateSlot: (slot) => ref.current?.evaluateSlot(slot) ?? { valid: false },
      evaluatePlacement: (input) =>
        ref.current?.evaluatePlacement(input) ?? { valid: false, reason: 'outside-allowed' },
      evaluateEvent: (event, occurrence) => {
        if (!ref.current) throw new Error('[calendara/react] calendário ainda não montado');
        return ref.current.evaluateEvent(event, occurrence);
      },
      refetch: () => ref.current?.refetch(),
    }),
    [],
  );
  return { ref, api };
}
