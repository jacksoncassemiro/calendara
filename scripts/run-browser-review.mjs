import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/@playwright/cli/playwright-cli.js', import.meta.url));
mkdirSync(new URL('../output/playwright/', import.meta.url), { recursive: true });
mkdirSync(new URL('../output/layout-review/', import.meta.url), { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5180, strictPort: true, hmr: false } });
const selectedScripts = process.argv.slice(2);
function run(args, required = true) {
  if (args[0] === "run-code" && selectedScripts.length && !selectedScripts.includes(args[2])) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, '-s=calendar-review', ...args], { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 || !required ? resolve() : reject(new Error(`Playwright exited ${code}`)));
  });
}
try {
  await server.listen();
  await run(['open', 'http://127.0.0.1:5180/examples/react.html', '--browser', process.env.MC_BROWSER ?? (process.platform === 'win32' ? 'msedge' : 'chrome')]);
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
} finally {
  await run(['close'], false);
  await server.close();
}
