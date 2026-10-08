import { createServer, preview } from 'vite';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(
  new URL('../node_modules/@playwright/cli/playwright-cli.js', import.meta.url),
);
mkdirSync(new URL('../output/playwright/', import.meta.url), { recursive: true });
mkdirSync(new URL('../output/layout-review/', import.meta.url), { recursive: true });
const productionPreview = process.env.MC_REVIEW_PREVIEW === '1';
const server = productionPreview
  ? await preview({ root, preview: { host: '127.0.0.1', port: 5180, strictPort: true } })
  : await createServer({
      root,
      server: { host: '127.0.0.1', port: 5180, strictPort: true, hmr: false },
    });
const selectedScripts = process.argv.slice(2);
const browserExpressionPath = fileURLToPath(
  new URL('../output/playwright/browser-expression.js', import.meta.url),
);
function run(args, required = true) {
  if (args[0] === 'run-code' && selectedScripts.length && !selectedScripts.includes(args[2]))
    return Promise.resolve();

  if (args[0] === 'run-code') {
    // The CLI consumes a function expression; formatted JS files end with a statement terminator.
    const source = readFileSync(new URL(`../${args[2]}`, import.meta.url), 'utf8');
    const expression = source.trimEnd().replace(/;$/, '');
    writeFileSync(browserExpressionPath, expression);
    args = [...args];
    args[2] = browserExpressionPath;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '-s=calendar-review', ...args], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 || !required ? resolve() : reject(new Error(`Playwright exited ${code}`)),
    );
  });
}
try {
  if (!productionPreview) await server.listen();
  await run([
    'open',
    `http://127.0.0.1:5180${productionPreview ? (process.env.MC_SITE_BASE ?? '/') : '/'}examples/react.html`,
    '--browser',
    process.env.MC_BROWSER ?? (process.platform === 'win32' ? 'msedge' : 'chrome'),
  ]);
  await run(['run-code', '--filename', 'scripts/browser-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-demo-month-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-month-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-interaction-regressions.js']);
  await run(['run-code', '--filename', 'scripts/browser-dense-review.js']);
  await run(['run-code', '--filename', 'scripts/capture-layout-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-sticky-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-feature-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-page-sticky-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-spacing-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-axis-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-slot-controls-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-event-margin-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-scroll-content-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-label-configurations-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-persona-reception-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-persona-clinician-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-persona-personal-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-persona-admin-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-recurrence-editor-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-draft-feedback-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-month-availability-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-view-selection-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-external-drag-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-default-theme-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-auto-scroll-review.js']);
  await run(['run-code', '--filename', 'scripts/browser-docs-site-review.js']);
} finally {
  await run(['close'], false);
  if (productionPreview)
    await new Promise((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
  else await server.close();
}
