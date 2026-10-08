import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: process.env.MC_SITE_BASE || './',
  resolve: {
    alias: {
      '@jacksoncassemiro/calendara/styles.css': fileURLToPath(
        new URL('./styles.css', import.meta.url),
      ),
      '@jacksoncassemiro/calendara/core': fileURLToPath(
        new URL('./src/core/index.ts', import.meta.url),
      ),
      '@jacksoncassemiro/calendara': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: 'automatic', importSource: 'react' } },
  server: { host: '127.0.0.1' },
  build: {
    rolldownOptions: { input: ['index.html', 'examples/react.html'] },
    outDir: 'dist/playground',
  },
});
