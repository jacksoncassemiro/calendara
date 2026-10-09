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
/** Run a command in its working directory. / PT: Executa o comando no diretório indicado. */
function run({ command, args, cwd = root }) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
for (const name of ['calendar']) {
  const archive = fileURLToPath(new URL(`${name}.tgz`, output));
  if (process.platform === 'win32') {
    // Avoid shell interpretation of Node paths. / PT: Evita interpretar caminhos do Node pelo shell.
    run({
      command: process.execPath,
      args: [
        join(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'),
        'pack',
        '--filename',
        archive,
      ],
      cwd: root,
    });
  } else {
    run({ command: 'yarn', args: ['pack', '--filename', archive], cwd: root });
  }
  const target = new URL('consumer/node_modules/@jacksoncassemiro/calendara/', output);
  mkdirSync(target, { recursive: true });
  run({
    command: 'tar',
    args: ['-xf', archive, '-C', fileURLToPath(target), '--strip-components=1'],
  });
}
const consumer = new URL('consumer/', output);
writeFileSync(new URL('package.json', consumer), '{"private":true,"type":"module"}\n');
writeFileSync(
  new URL('smoke.mjs', consumer),
  `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { ensureTemporal, expandEvent } from '@jacksoncassemiro/calendara/core';
import { CalendarApp, Calendar, useCalendar, createReactView, weekView } from '@jacksoncassemiro/calendara';
const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('./node_modules/@jacksoncassemiro/calendara/package.json', import.meta.url), 'utf8'));
assert.equal(manifest.dependencies['rrule-temporal'], undefined);
assert.equal(manifest.dependencies['@js-temporal/polyfill'], undefined);
assert.equal(manifest.dependencies['temporal-polyfill'], '1.0.5');
const temporal = await ensureTemporal();
assert.deepEqual(expandEvent({ temporal, event: {
  id: 'series', calendarId: 'calendar', title: 'Recurrence',
  time: { allDay: false, start: { dateTime: '2024-03-09T02:30:00', timeZone: 'America/New_York' }, end: { dateTime: '2024-03-09T03:30:00', timeZone: 'America/New_York' } },
  recurrence: { rule: 'FREQ=DAILY;COUNT=3' }
} }).map(item => item.originalStart), ['2024-03-09T02:30:00', '2024-03-11T02:30:00', '2024-03-12T02:30:00']);
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
run({ command: process.execPath, args: ['smoke.mjs'], cwd: fileURLToPath(consumer) });
writeFileSync(
  new URL('consumer.tsx', consumer),
  `
import { Calendar, useCalendar, dayView } from '@jacksoncassemiro/calendara';
import type { CalendarEvent } from '@jacksoncassemiro/calendara';
const events: CalendarEvent[] = [];
export function Example() { const {ref} = useCalendar(); return <Calendar views={[dayView]} apiRef={ref} events={events} />; }
`,
);
run({
  command: process.execPath,
  args: [
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
  ],
});
console.log('Consumidor React TypeScript externo: OK.');
