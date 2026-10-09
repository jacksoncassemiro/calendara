/** Subscriber receiving changed top-level keys and the current state snapshot.
 * @remarks Português: Assinante que recebe chaves superiores alteradas e o estado atual.
 */
export type Listener<State> = (
  changedKeys: ReadonlySet<keyof State>,
  state: Readonly<State>,
) => void;

/** Observable state with shallow identity-based updates.
 * @remarks Português: Estado observável com atualização rasa por identidade.
 */
export interface Store<State extends object> {
  /** Read the current snapshot; update it only through setState.
   * @remarks Português: Consulta o estado atual; atualize somente por setState.
   */
  getState(): Readonly<State>;

  /** Shallow-merge a patch and notify only changed key identities.
   * @remarks Português: Combina alterações superficialmente e notifica apenas identidades alteradas.
   */
  setState(patch: Partial<State>): void;

  /** Register a subscriber and return its unsubscribe function.
   * @remarks Português: Registra assinante e retorna sua função de cancelamento.
   */
  subscribe(listener: Listener<State>): () => void;
}

/** Create an observable store; unchanged key identities do not notify subscribers.
 * @remarks Português: Cria estado observável; identidades de chaves inalteradas não notificam assinantes.
 */
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
      if (changedKeys.size === 0) return;
      state = { ...state, ...patch };

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
