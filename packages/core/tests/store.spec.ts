import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store/store.js';
import { memoize } from '../src/store/memoize.js';

interface S {
  a: number;
  b: string;
  obj: { n: number };
}

describe('createStore (diff granular)', () => {
  it('notifica só quando alguma chave muda, com o conjunto de chaves alteradas', () => {
    const store = createStore<S>({ a: 1, b: 'x', obj: { n: 0 } });
    const seen: Array<ReadonlySet<keyof S>> = [];
    store.subscribe((changed) => seen.push(changed));

    store.setState({ a: 2 });
    store.setState({ a: 2 }); // mesmo valor → NÃO notifica
    store.setState({ b: 'y' });

    expect(seen).toHaveLength(2);
    expect([...seen[0]!]).toEqual(['a']);
    expect([...seen[1]!]).toEqual(['b']);
    expect(store.getState().a).toBe(2);
    expect(store.getState().b).toBe('y');
  });

  it('compara por identidade (novo objeto = mudança)', () => {
    const obj = { n: 0 };
    const store = createStore<S>({ a: 1, b: 'x', obj });
    const fn = vi.fn();
    store.subscribe(fn);
    store.setState({ obj }); // mesma ref → sem notificação
    expect(fn).not.toHaveBeenCalled();
    store.setState({ obj: { n: 0 } }); // nova ref → notifica
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe encerra as notificações', () => {
    const store = createStore<S>({ a: 1, b: 'x', obj: { n: 0 } });
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.setState({ a: 9 });
    off();
    store.setState({ a: 10 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('memoize', () => {
  it('reusa o resultado enquanto os argumentos forem idênticos', () => {
    const compute = vi.fn((n: number) => n * 2);
    const m = memoize(compute);
    expect(m(2)).toBe(4);
    expect(m(2)).toBe(4);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(m(3)).toBe(6);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('distingue por identidade de referência', () => {
    const compute = vi.fn((arr: number[]) => arr.length);
    const m = memoize(compute);
    const a = [1, 2, 3];
    m(a);
    m(a);
    expect(compute).toHaveBeenCalledTimes(1);
    m([1, 2, 3]); // nova ref
    expect(compute).toHaveBeenCalledTimes(2);
  });
});
