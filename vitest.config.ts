import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Render interno usa Preact (ADR-002). JSX é compilado para o runtime do Preact.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  test: {
    include: ['packages/**/*.{test,spec}.{ts,tsx}'],
    // node por padrão (engines puros/Temporal). Specs de render pedem jsdom via
    // docblock `// @vitest-environment jsdom` no topo do arquivo.
    environment: 'node',
    globals: false,
  },
});
