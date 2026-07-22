/**
 * Store observável mínimo, sem framework (ADR-001/002).
 *
 * Objetivo: ser a fonte de verdade do CalendarApp e permitir **diff granular** — cada
 * `setState` calcula quais chaves de topo mudaram (comparação por identidade) e entrega
 * esse conjunto aos assinantes, para que a camada de render só recompute/redesenhe o que mudou.
 * Não há dependência de Preact/React aqui: o render se conecta via `subscribe`.
 */

export type Listener<S> = (changed: ReadonlySet<keyof S>, state: Readonly<S>) => void;

export interface Store<S extends object> {
  /** Estado atual (imutável por convenção — troque via setState). */
  getState(): Readonly<S>;
  /** Merge raso. Só notifica se alguma chave realmente mudou de referência. */
  setState(patch: Partial<S>): void;
  /** Registra assinante; retorna função de cancelamento. */
  subscribe(listener: Listener<S>): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state: S = { ...initial };
  const listeners = new Set<Listener<S>>();

  return {
    getState: () => state,

    setState(patch: Partial<S>): void {
      const changed = new Set<keyof S>();
      for (const k in patch) {
        const key = k as keyof S;
        if (!Object.is(state[key], patch[key])) changed.add(key);
      }
      if (changed.size === 0) return; // nada mudou → nenhum re-render
      state = { ...state, ...patch };
      // cópia defensiva: um listener pode se desinscrever durante a iteração
      for (const l of [...listeners]) l(changed, state);
    },

    subscribe(listener: Listener<S>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
