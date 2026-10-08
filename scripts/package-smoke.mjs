import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../output/package-smoke/', import.meta.url);
mkdirSync(output, { recursive: true });
const consumerPath = fileURLToPath(new URL('consumer/', output));
if (!consumerPath.startsWith(fileURLToPath(output)))
  throw new Error('Consumer output outside smoke directory');
rmSync(consumerPath, { recursive: true, force: true });
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const name of ['calendar']) {
  const archive = fileURLToPath(new URL(`${name}.tgz`, output));
  if (process.platform === 'win32') {
    // Corepack ships beside Node on the supported Windows setup. Invoke its JS
    // entry directly so paths with spaces are not interpreted by a shell.
    run(
      process.execPath,
      [
        join(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'),
        'pack',
        '--filename',
        archive,
      ],
      root,
    );
  } else {
    run('yarn', ['pack', '--filename', archive], root);
  }
  const target = new URL('consumer/node_modules/@jacksoncassemiro/calendara/', output);
  mkdirSync(target, { recursive: true });
  run('tar', ['-xf', archive, '-C', fileURLToPath(target), '--strip-components=1']);
}
const consumer = new URL('consumer/', output);
writeFileSync(new URL('package.json', consumer), '{"private":true,"type":"module"}\n');
writeFileSync(
  new URL('smoke.mjs', consumer),
  `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { ensureTemporal } from '@jacksoncassemiro/calendara/core';
import { CalendarApp, Calendar, useCalendar, createReactView, weekView } from '@jacksoncassemiro/calendara';
const require = createRequire(import.meta.url);
assert.equal(typeof CalendarApp, 'function');
assert.equal(typeof Calendar, 'function');
assert.equal(typeof useCalendar, 'function');
assert.equal(typeof createReactView, 'function');
assert.equal(require('@jacksoncassemiro/calendara/core').CalendarApp, undefined);
assert.equal(typeof require('@jacksoncassemiro/calendara').Calendar, 'function');
assert.ok(readFileSync(require.resolve('@jacksoncassemiro/calendara/styles.css'), 'utf8').includes('[data-mc-root]'));
const app = new CalendarApp({ views: [weekView], temporal: await ensureTemporal(), date: '2026-10-07' });
await app.ready();
assert.deepEqual(app.getVisibleRange(), { start: '2026-10-05', end: '2026-10-11' });
app.destroy();
console.log('Pacotes empacotados: imports ESM, require CJS e CSS OK.');
`,
);
run(process.execPath, ['smoke.mjs'], fileURLToPath(consumer));
writeFileSync(
  new URL('consumer.tsx', consumer),
  `
import { Calendar, useCalendar, dayView } from '@jacksoncassemiro/calendara';
import type { CalendarEvent } from '@jacksoncassemiro/calendara';
const events: CalendarEvent[] = [];
export function Example() { const {ref} = useCalendar(); return <Calendar views={[dayView]} apiRef={ref} events={events} />; }
`,
);
run(process.execPath, [
  'node_modules/typescript/bin/tsc',
  '--noEmit',
  '--strict',
  '--skipLibCheck',
  '--jsx',
  'react-jsx',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  '--target',
  'ES2022',
  fileURLToPath(new URL('consumer.tsx', consumer)),
]);
console.log('Consumidor React TypeScript externo: OK.');
