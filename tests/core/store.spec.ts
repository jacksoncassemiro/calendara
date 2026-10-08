import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/core/store/store.js';
import { memoize } from '../../src/core/store/memoize.js';

interface StoreState {
  count: number;
  label: string;
  nestedState: { value: number };
}

describe('createStore (diff granular)', () => {
  it('notifica só quando alguma chave muda, com o conjunto de chaves alteradas', () => {
    const store = createStore<StoreState>({ count: 1, label: 'x', nestedState: { value: 0 } });
    const changedKeySets: Array<ReadonlySet<keyof StoreState>> = [];
    store.subscribe((changed) => changedKeySets.push(changed));

    store.setState({ count: 2 });
    store.setState({ count: 2 }); // mesmo valor → NÃO notifica
    store.setState({ label: 'y' });

    expect(changedKeySets).toHaveLength(2);
    expect([...changedKeySets[0]!]).toEqual(['count']);
    expect([...changedKeySets[1]!]).toEqual(['label']);
    expect(store.getState().count).toBe(2);
    expect(store.getState().label).toBe('y');
  });

  it('compara por identidade (novo objeto = mudança)', () => {
    const nestedState = { value: 0 };
    const store = createStore<StoreState>({ count: 1, label: 'x', nestedState });
    const subscriber = vi.fn();
    store.subscribe(subscriber);
    store.setState({ nestedState }); // mesma ref → sem notificação
    expect(subscriber).not.toHaveBeenCalled();
    store.setState({ nestedState: { value: 0 } }); // nova ref → notifica
    expect(subscriber).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe encerra as notificações', () => {
    const store = createStore<StoreState>({ count: 1, label: 'x', nestedState: { value: 0 } });
    const subscriber = vi.fn();
    const unsubscribe = store.subscribe(subscriber);
    store.setState({ count: 9 });
    unsubscribe();
    store.setState({ count: 10 });
    expect(subscriber).toHaveBeenCalledTimes(1);
  });
});

describe('memoize', () => {
  it('reusa o resultado enquanto os argumentos forem idênticos', () => {
    const compute = vi.fn((value: number) => value * 2);
    const memoizedCompute = memoize(compute);
    expect(memoizedCompute(2)).toBe(4);
    expect(memoizedCompute(2)).toBe(4);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(memoizedCompute(3)).toBe(6);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('distingue por identidade de referência', () => {
    const compute = vi.fn((values: number[]) => values.length);
    const memoizedCompute = memoize(compute);
    const inputValues = [1, 2, 3];
    memoizedCompute(inputValues);
    memoizedCompute(inputValues);
    expect(compute).toHaveBeenCalledTimes(1);
    memoizedCompute([1, 2, 3]); // nova ref
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
