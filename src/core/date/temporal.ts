import type { Temporal as TemporalNS } from '@js-temporal/polyfill';

/** Temporal namespace supplied natively or by the polyfill.
 * @remarks Português: Namespace Temporal nativo ou fornecido pelo polyfill.
 */
export type TemporalLike = typeof TemporalNS;

let cachedTemporal: TemporalLike | null = null;
let loadingPromise: Promise<TemporalLike> | null = null;

/** Resolve native Temporal or load the polyfill; failed loads can be retried.
 * @remarks Português: Resolve Temporal nativo ou carrega o polyfill; falhas permitem nova tentativa.
 */
export function ensureTemporal(): Promise<TemporalLike> {
  if (cachedTemporal) return Promise.resolve(cachedTemporal);
  if (loadingPromise) return loadingPromise;

  const nativeTemporal = (globalThis as { Temporal?: TemporalLike }).Temporal;
  if (nativeTemporal && typeof nativeTemporal.PlainDate?.from === 'function') {
    cachedTemporal = nativeTemporal;
    return Promise.resolve(cachedTemporal);
  }

  loadingPromise = import('@js-temporal/polyfill')
    .then((polyfillModule) => {
      cachedTemporal = polyfillModule.Temporal as unknown as TemporalLike;
      return cachedTemporal;
    })
    .catch((error: unknown) => {
      loadingPromise = null;
      throw error;
    });
  return loadingPromise;
}

/** Read initialized Temporal; throws before ensureTemporal completes.
 * @remarks Português: Consulta Temporal inicializado; lança erro antes de ensureTemporal concluir.
 */
export function getTemporal(): TemporalLike {
  if (!cachedTemporal) {
    throw new Error(
      '[calendara] Temporal não inicializado. Chame `await ensureTemporal()` no bootstrap antes de usar os engines.',
    );
  }
  return cachedTemporal;
}

/** Whether Temporal is available synchronously.
 * @remarks Português: Indica se Temporal está disponível de forma síncrona.
 */
export function isTemporalReady(): boolean {
  return cachedTemporal !== null;
}
