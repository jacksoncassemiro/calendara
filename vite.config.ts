import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: {
    '@meucalendario/calendar/styles.css': fileURLToPath(new URL('./styles.css', import.meta.url)),
    '@meucalendario/calendar/core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
    '@meucalendario/calendar': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
  } },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { host: '127.0.0.1' },
  build: { rolldownOptions: { input: ['examples/react.html'] }, outDir: 'dist/playground' },
});
