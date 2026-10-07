import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@meucalendario/calendar/core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      '@meucalendario/calendar': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    // node por padrão (engines puros/Temporal). Specs de render pedem jsdom via
    // docblock `// @vitest-environment jsdom` no topo do arquivo.
    environment: 'node',
    globals: false,
  },
});
