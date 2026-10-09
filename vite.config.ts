import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';

const documentationAssets = new Map<string, URL>([
  ['llms.txt', new URL('./llms.txt', import.meta.url)],
  ...['en', 'pt-BR'].flatMap((language) => [
    ...readdirSync(new URL(`./docs/${language}/`, import.meta.url))
      .filter((name) => name.endsWith('.md'))
      .map((name): [string, URL] => [
        `docs/${language}/${name}`,
        new URL(`./docs/${language}/${name}`, import.meta.url),
      ]),
    [
      `docs/${language}/api-reference.md`,
      new URL('./examples/generated/api-reference.md', import.meta.url),
    ] as [string, URL],
  ]),
]);

export default defineConfig({
  base: process.env.MC_SITE_BASE || './',
  optimizeDeps: { include: ['react', 'react-dom/client', '@floating-ui/react'] },
  plugins: [
    {
      name: 'calendara-documentation-assets',
      transformIndexHtml: {
        order: 'post',
        handler(_html, context) {
          return [
            {
              tag: 'link',
              attrs: {
                rel: 'describedby',
                href: context.path.includes('/examples/') ? '../llms.txt' : './llms.txt',
                type: 'text/plain',
              },
              injectTo: 'head',
            },
          ];
        },
      },
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const base = server.config.base === './' ? '/' : server.config.base;
          const path = request.url?.split('?')[0];
          const file = path?.startsWith(base)
            ? documentationAssets.get(path.slice(base.length))
            : undefined;
          if (!file) return next();
          response.setHeader(
            'Content-Type',
            path?.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8',
          );
          response.end(readFileSync(file));
        });
      },
      generateBundle() {
        for (const [fileName, file] of documentationAssets) {
          this.emitFile({ type: 'asset', fileName, source: readFileSync(file) });
        }
      },
    },
  ],
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
    rolldownOptions: { input: ['index.html', 'examples/react.html', 'examples/features.html'] },
    outDir: 'dist/playground',
  },
});
