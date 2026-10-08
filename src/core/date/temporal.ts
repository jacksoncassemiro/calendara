/**
 * Shim de compatibilidade do Temporal API (ADR-003 / política de compatibilidade em 03-ARQUITETURA.md).
 *
 * Estratégia: usar `globalThis.Temporal` quando nativo (Chrome 144 / Firefox 139+ / Edge, Node futuro).
 * Quando ausente (Safari, Node atual), carregar `@js-temporal/polyfill` sob demanda.
 *
 * `getTemporal()` é assíncrono e memoizado — deve ser chamado uma vez no bootstrap.
 * `Temporal` (export síncrono) fica disponível após a primeira resolução; o core sempre
 * aguarda `ensureTemporal()` antes de usar tipos Temporal.
 */
import type { Temporal as TemporalNS } from '@js-temporal/polyfill';

export type TemporalLike = typeof TemporalNS;

let cachedTemporal: TemporalLike | null = null;
let loadingPromise: Promise<TemporalLike> | null = null;

/** Retorna o namespace Temporal (nativo ou polyfill), carregando o polyfill se necessário. */
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
      // A transient chunk/network error must allow a later initialization retry.
      loadingPromise = null;
      throw error;
    });
  return loadingPromise;
}

/**
 * Acesso síncrono ao Temporal já resolvido. Lança se `ensureTemporal()` ainda não completou.
 * Usado internamente pelos engines depois do bootstrap.
 */
export function getTemporal(): TemporalLike {
  if (!cachedTemporal) {
    throw new Error(
      '[calendara] Temporal não inicializado. Chame `await ensureTemporal()` no bootstrap antes de usar os engines.',
    );
  }
  return cachedTemporal;
}

/** Testa se o Temporal já está disponível de forma síncrona. */
export function isTemporalReady(): boolean {
  return cachedTemporal !== null;
}
