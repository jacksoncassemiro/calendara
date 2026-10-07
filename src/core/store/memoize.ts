/**
 * Memoização por identidade das dependências (estilo `reselect`/`memoize-one`).
 *
 * Usada para as derivações caras do render (expansão de recorrência, geometria): enquanto os
 * argumentos forem os MESMOS por referência, devolve o resultado em cache. É o que torna o
 * "diff granular" barato — trocar constraints não recomputa ocorrências, e vice-versa.
 */
export function memoize<Args extends readonly unknown[], Result>(
  compute: (...args: Args) => Result,
): (...args: Args) => Result {
  let lastArgs: Args | null = null;
  let lastResult: Result;
  let hasResult = false;

  return (...args: Args): Result => {
    if (
      hasResult &&
      lastArgs !== null &&
      lastArgs.length === args.length &&
      lastArgs.every((previousArg, index) => Object.is(previousArg, args[index]))
    ) {
      return lastResult;
    }
    lastArgs = args;
    lastResult = compute(...args);
    hasResult = true;
    return lastResult;
  };
}
