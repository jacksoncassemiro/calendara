import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '../../core/types/event.js';

/** Consumer event history options. @remarks Português: Opções do histórico de eventos do consumidor. */
export interface CalendarHistoryOptions<Event = CalendarEvent> {
  /** Initial events, read once; use replaceEvents for reloads. @remarks Português: Eventos iniciais, lidos uma vez; use replaceEvents para recargas. */
  initialEvents: readonly Event[];
  /** Persist each commit, undo or redo before changing local state. @remarks Português: Persiste cada alteração, desfazer ou refazer antes de alterar o estado local. */
  persist?: (events: Event[]) => void | Promise<void>;
  /** Maximum undo snapshots; default 50, integer ≥ 0. @remarks Português: Máximo de snapshots para desfazer; padrão 50, inteiro ≥ 0. */
  limit?: number;
  /** Detached snapshot copy; default structuredClone. Required for non-cloneable metadata. @remarks Português: Cópia independente; padrão structuredClone. Necessária para metadados não clonáveis. */
  cloneSnapshot?: (events: readonly Event[]) => Event[];
}

/** Local events and asynchronous history actions. @remarks Português: Eventos locais e ações assíncronas de histórico. */
export interface CalendarHistory<Event = CalendarEvent> {
  /** Detached current events; update through commit. @remarks Português: Eventos atuais independentes; atualize por commit. */
  events: Event[];
  /** True while persistence is running. @remarks Português: True durante a persistência. */
  pending: boolean;
  /** Undo is available and no request is pending. @remarks Português: Há alteração para desfazer e nenhuma requisição pendente. */
  canUndo: boolean;
  /** Redo is available and no request is pending. @remarks Português: Há alteração para refazer e nenhuma requisição pendente. */
  canRedo: boolean;
  /** Persist a replacement; resolves false while busy, rejects on persistence failure. @remarks Português: Persiste uma substituição; retorna false quando ocupado e rejeita se a persistência falhar. */
  commit: (events: readonly Event[]) => Promise<boolean>;
  /** Persist the previous snapshot; resolves false when unavailable. @remarks Português: Persiste o snapshot anterior; retorna false quando indisponível. */
  undo: () => Promise<boolean>;
  /** Persist the next snapshot; resolves false when unavailable. @remarks Português: Persiste o próximo snapshot; retorna false quando indisponível. */
  redo: () => Promise<boolean>;
  /** Replace from an external source and clear history without persistence. @remarks Português: Substitui por dados externos e limpa o histórico sem persistir. */
  replaceEvents: (events: readonly Event[]) => void;
}

interface HistoryState<Event> {
  current: Event[];
  past: Event[][];
  future: Event[][];
  pending: boolean;
  revision: number;
}

/** Bounded consumer history, independent of Calendar stores and server transactions.
 * @remarks Português: Histórico limitado do consumidor, independente do store do Calendar e de transações do servidor.
 */
export function useCalendarHistory<Event = CalendarEvent>(
  options: CalendarHistoryOptions<Event>,
): CalendarHistory<Event> {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('Calendar history limit must be a non-negative integer');
  }
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const clone = (events: readonly Event[]): Event[] =>
    optionsRef.current.cloneSnapshot?.(events) ?? structuredClone([...events]);
  const [state, setState] = useState<HistoryState<Event>>(() => ({
    current: clone(options.initialEvents),
    past: [],
    future: [],
    pending: false,
    revision: 0,
  }));
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stateRef.current.revision += 1;
    };
  }, []);

  const actions = useMemo(() => {
    const copy = (events: readonly Event[]): Event[] =>
      optionsRef.current.cloneSnapshot?.(events) ?? structuredClone([...events]);
    const publish = (next: HistoryState<Event>) => {
      stateRef.current = next;
      if (mountedRef.current) setState(next);
    };
    const apply = async (
      operation: 'commit' | 'undo' | 'redo',
      events?: readonly Event[],
    ): Promise<boolean> => {
      const previous = stateRef.current;
      if (!mountedRef.current || previous.pending) return false;
      const target =
        operation === 'commit'
          ? events
          : operation === 'undo'
            ? previous.past.at(-1)
            : previous.future.at(-1);
      if (!target) return false;
      const current = copy(target);
      const persistEvents = copy(current);
      const revision = previous.revision;
      publish({ ...previous, pending: true });
      try {
        await optionsRef.current.persist?.(persistEvents);
        if (!mountedRef.current || stateRef.current.revision !== revision) return false;
        const maximum = optionsRef.current.limit ?? 50;
        const bounded = (snapshots: Event[][]) => (maximum === 0 ? [] : snapshots.slice(-maximum));
        publish({
          current,
          past:
            operation === 'undo'
              ? previous.past.slice(0, -1)
              : bounded([...previous.past, previous.current]),
          future:
            operation === 'commit'
              ? []
              : operation === 'redo'
                ? previous.future.slice(0, -1)
                : bounded([...previous.future, previous.current]),
          pending: false,
          revision,
        });
        return true;
      } finally {
        if (stateRef.current.pending) publish({ ...stateRef.current, pending: false });
      }
    };
    return {
      commit: (events: readonly Event[]) => apply('commit', events),
      undo: () => apply('undo'),
      redo: () => apply('redo'),
      replaceEvents: (events: readonly Event[]) => {
        const previous = stateRef.current;
        publish({
          current: copy(events),
          past: [],
          future: [],
          pending: previous.pending,
          revision: previous.revision + 1,
        });
      },
    };
  }, []);
  const events = useMemo(() => clone(state.current), [state.current]);
  return {
    events,
    pending: state.pending,
    canUndo: !state.pending && state.past.length > 0,
    canRedo: !state.pending && state.future.length > 0,
    ...actions,
  };
}
