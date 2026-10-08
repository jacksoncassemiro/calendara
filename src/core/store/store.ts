/**
 * Store observável mínimo, sem framework (ADR-001/002).
 *
 * Objetivo: ser a fonte de verdade do CalendarApp e permitir **diff granular** — cada
 * `setState` calcula quais chaves de topo mudaram (comparação por identidade) e entrega
 * esse conjunto aos assinantes, para que a camada de render só recompute/redesenhe o que mudou.
 * Não há dependência de Preact/React aqui: o render se conecta via `subscribe`.
 */

export type Listener<State> = (
  changedKeys: ReadonlySet<keyof State>,
  state: Readonly<State>,
) => void;

export interface Store<State extends object> {
  /** Estado atual (imutável por convenção — troque via setState). */
  getState(): Readonly<State>;
  /** Merge raso. Só notifica se alguma chave realmente mudou de referência. */
  setState(patch: Partial<State>): void;
  /** Registra assinante; retorna função de cancelamento. */
  subscribe(listener: Listener<State>): () => void;
}

export function createStore<State extends object>(initialState: State): Store<State> {
  let state: State = { ...initialState };
  const listeners = new Set<Listener<State>>();

  return {
    getState: () => state,

    setState(patch: Partial<State>): void {
      const changedKeys = new Set<keyof State>();
      for (const rawKey in patch) {
        const key = rawKey as keyof State;
        if (!Object.is(state[key], patch[key])) changedKeys.add(key);
      }
      if (changedKeys.size === 0) return; // nada mudou → nenhum re-render
      state = { ...state, ...patch };
      // cópia defensiva: um listener pode se desinscrever durante a iteração
      for (const listener of [...listeners]) listener(changedKeys, state);
    },

    subscribe(listener: Listener<State>): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
