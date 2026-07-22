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

let cached: TemporalLike | null = null;
let loading: Promise<TemporalLike> | null = null;

/** Retorna o namespace Temporal (nativo ou polyfill), carregando o polyfill se necessário. */
export function ensureTemporal(): Promise<TemporalLike> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  const native = (globalThis as { Temporal?: TemporalLike }).Temporal;
  if (native && typeof native.PlainDate?.from === 'function') {
    cached = native;
    return Promise.resolve(cached);
  }

  loading = import('@js-temporal/polyfill').then((mod) => {
    cached = mod.Temporal as unknown as TemporalLike;
    return cached;
  });
  return loading;
}

/**
 * Acesso síncrono ao Temporal já resolvido. Lança se `ensureTemporal()` ainda não completou.
 * Usado internamente pelos engines depois do bootstrap.
 */
export function getTemporal(): TemporalLike {
  if (!cached) {
    throw new Error(
      '[meucalendario] Temporal não inicializado. Chame `await ensureTemporal()` no bootstrap antes de usar os engines.',
    );
  }
  return cached;
}

/** Testa se o Temporal já está disponível de forma síncrona. */
export function isTemporalReady(): boolean {
  return cached !== null;
}
