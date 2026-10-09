/** Stable actions and attachment ref for Calendar.apiRef.
 * @remarks Português: Ações estáveis e ref de conexão com Calendar.apiRef.
 */
import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import type { CalendarHandle } from './types.js';

/** Attachment ref and stable calendar actions.
 * @remarks Português: Ref de conexão e ações estáveis do calendário.
 */
export interface UseCalendar {
  /** Attach to Calendar.apiRef. @remarks Português: Conecte a Calendar.apiRef. */
  ref: RefObject<CalendarHandle | null>;
  /** Stable actions; navigation is a no-op before mount. @remarks Português: Ações estáveis; navegação não atua antes da montagem. */
  api: CalendarHandle;
}

/** Connect to Calendar.apiRef and control the mounted calendar. @remarks Português: Conecta a Calendar.apiRef e controla o calendário montado. */
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
