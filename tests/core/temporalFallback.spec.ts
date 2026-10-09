import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Temporal } from 'temporal-polyfill';

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('temporal-polyfill');
  vi.stubGlobal('Temporal', undefined);
});

afterEach(() => {
  vi.doUnmock('temporal-polyfill');
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Temporal resolution / resolução de Temporal', () => {
  it('prefers the supplied native namespace without importing the fallback / prioriza o namespace nativo', async () => {
    vi.stubGlobal('Temporal', Temporal);
    const fallbackImport = vi.fn(() => {
      throw new Error('Fallback must not load when native Temporal exists');
    });
    vi.doMock('temporal-polyfill', fallbackImport);
    const loader = await import('../../src/core/date/temporal.js');

    expect(loader.isTemporalReady()).toBe(false);
    expect(await loader.ensureTemporal()).toBe(Temporal);
    expect(loader.getTemporal()).toBe(Temporal);
    expect(loader.isTemporalReady()).toBe(true);
    expect(fallbackImport).not.toHaveBeenCalled();
  });

  it('shares fallback loading, caches its result and leaves the host untouched / compartilha o carregamento sem alterar o host', async () => {
    const loader = await import('../../src/core/date/temporal.js');
    expect(() => loader.getTemporal()).toThrow('Temporal');
    const firstLoad = loader.ensureTemporal();
    expect(loader.ensureTemporal()).toBe(firstLoad);
    const fallback = await firstLoad;

    expect(fallback.PlainDate.from('2026-10-08').add({ days: 1 }).toString()).toBe('2026-10-09');
    expect(await loader.ensureTemporal()).toBe(fallback);
    expect(loader.getTemporal()).toBe(fallback);
    expect(loader.isTemporalReady()).toBe(true);
    expect(globalThis).not.toHaveProperty('Temporal', fallback);
    expect((globalThis as { Temporal?: unknown }).Temporal).toBeUndefined();
  });

  it('can retry after a failed fallback import / permite tentar novamente após falha de importação', async () => {
    const importFailure = new Error('Temporary module load failure');
    vi.doMock('temporal-polyfill', () => {
      throw importFailure;
    });
    const loader = await import('../../src/core/date/temporal.js');
    await expect(loader.ensureTemporal()).rejects.toThrow();
    expect(loader.isTemporalReady()).toBe(false);
    expect(() => loader.getTemporal()).toThrow('Temporal');

    vi.doUnmock('temporal-polyfill');
    const fallback = await loader.ensureTemporal();
    expect(fallback.Instant.from('2026-10-08T12:00:00Z').toString()).toBe('2026-10-08T12:00:00Z');
    expect(loader.getTemporal()).toBe(fallback);
  });
});
