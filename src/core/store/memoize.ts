/** Reuse the last result while each argument retains its identity.
 * @remarks Português: Reutiliza o último resultado enquanto os argumentos mantêm sua identidade.
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
