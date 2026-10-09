import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@meucalendario/calendar/core': fileURLToPath(
        new URL('./src/core/index.ts', import.meta.url),
      ),
      '@meucalendario/calendar': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    // Default engine environment; rendering specs select jsdom. / PT: Ambiente padrão do motor; testes de render selecionam jsdom.
    environment: 'node',
    // Bound concurrent DOM suites to avoid CPU contention. / PT: Limita testes DOM simultâneos para evitar disputa por CPU.
    maxWorkers: 4,
    globals: false,
  },
});
