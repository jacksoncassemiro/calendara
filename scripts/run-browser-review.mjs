import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../node_modules/@playwright/cli/playwright-cli.js', import.meta.url));
mkdirSync(new URL('../output/playwright/', import.meta.url), { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5180, strictPort: true } });
function run(args, required = true) {
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
} finally {
  await run(['close'], false);
  await server.close();
}
