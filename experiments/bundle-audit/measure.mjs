import { build } from 'vite';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const fixture = path.join(repository, 'output/bundle-audit');
const packageDirectory = path.join(fixture, 'node_modules');
const libraryEntry = path.join(repository, 'src/index.ts').replaceAll('\\', '/');
const viteManifest = JSON.parse(await readFile(path.join(repository, 'node_modules/vite/package.json'), 'utf8'));
const scenarios = {
  'calendara-day': `import { Calendar, dayView } from '${libraryEntry}'; export const Demo = () => React.createElement(Calendar, { views: [dayView], initialView: 'day', initialDate: '2026-10-07', events: [] });`,
  'calendara-month-day': `import { Calendar, dayView, monthView } from '${libraryEntry}'; export const Demo = () => React.createElement(Calendar, { views: [monthView, dayView], initialView: 'month', initialDate: '2026-10-07', events: [] });`,
  'calendara-all-resources-editor': `import { Calendar, BUILTIN_VIEWS, createResourceDayView, createTimelineView, CalendarEventEditor } from '${libraryEntry}'; export const Demo = () => React.createElement(Calendar, { views: [...BUILTIN_VIEWS, createResourceDayView(), createTimelineView()], events: [], resources: [] }); export const Editor = CalendarEventEditor;`,
  'fullcalendar-month-day': `import Calendar from '@fullcalendar/react'; import dayGrid from '@fullcalendar/react/daygrid'; import timeGrid from '@fullcalendar/react/timegrid'; import theme from '@fullcalendar/react/themes/monarch'; export const Demo = () => React.createElement(Calendar, { plugins: [dayGrid, timeGrid, theme], initialView: 'dayGridMonth', events: [] });`,
  'schedule-x-month-day': `import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react'; import { createViewDay, createViewMonthGrid } from '@schedule-x/calendar'; import 'temporal-polyfill/global'; export function Demo() { const calendar = useCalendarApp({ views: [createViewDay(), createViewMonthGrid()], events: [] }); return React.createElement(ScheduleXCalendar, {calendarApp: calendar}); }`,
  'mantine-month-day': `import { DayView, MonthView } from '@mantine/schedule'; import { MantineProvider } from '@mantine/core'; export const Demo = ({day=false}) => React.createElement(MantineProvider, {}, React.createElement(day ? DayView : MonthView, { date: '2026-10-07', events: [] }));`,
  'react-big-calendar-month-day': `import { Calendar, dayjsLocalizer } from 'react-big-calendar'; import dayjs from 'dayjs'; const localizer = dayjsLocalizer(dayjs); export const Demo = () => React.createElement(Calendar, { localizer, views: ['month','day'], defaultView: 'month', defaultDate: new Date(2026,9,7), events: [] });`,
};

await mkdir(fixture, { recursive: true });
const measurements = [];
for (const [name, source] of Object.entries(scenarios)) {
  const entry = path.join(fixture, `${name}.js`);
  await writeFile(entry, `import React from 'react';\n${source}\n`);
  const result = await build({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    resolve: {
      alias: name.startsWith('schedule-x') ? [{ find: /^temporal-polyfill(\/.*)?$/, replacement: `${packageDirectory.replaceAll('\\', '/')}/temporal-polyfill-sx$1` }] : [],
    },
    build: {
      write: false,
      minify: 'oxc',
      target: 'es2022',
      sourcemap: false,
      rolldownOptions: {
        input: entry,
        preserveEntrySignatures: 'strict',
        external: (id) => /^(react|react-dom)(\/|$)/.test(id),
        output: { format: 'es', entryFileNames: `${name}.js`, chunkFileNames: `${name}-[name]-[hash].js` },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output);
  const chunks = outputs.filter((output) => output.type === 'chunk');
  const assets = outputs.filter((output) => output.type === 'asset');
  const details = chunks.map((chunk) => ({
    file: chunk.fileName,
    entry: chunk.isEntry,
    bytes: Buffer.byteLength(chunk.code),
    gzipBytes: gzipSync(chunk.code).byteLength,
    modules: Object.keys(chunk.modules).length,
    localModules: Object.keys(chunk.modules)
      .map((module) => module.replaceAll('\\', '/'))
      .filter((module) => module.startsWith(`${repository.replaceAll('\\', '/')}src/`))
      .map((module) => module.slice(repository.replaceAll('\\', '/').length)),
  }));
  for (const chunk of chunks) await writeFile(path.join(fixture, chunk.fileName), chunk.code);
  const measurement = { name, jsBytes: details.reduce((sum, chunk) => sum + chunk.bytes, 0), gzipBytes: details.reduce((sum, chunk) => sum + chunk.gzipBytes, 0), chunks: details, cssBytes: assets.reduce((sum, asset) => sum + Buffer.byteLength(asset.source), 0) };
  measurements.push(measurement);
  console.log(JSON.stringify(measurement));
}
const fixtureManifest = JSON.parse(await readFile(path.join(fixture, 'package.json'), 'utf8'));
const report = { date: new Date().toISOString().slice(0, 10), node: process.version, platform: process.platform, vite: viteManifest.version, target: 'es2022', excluded: ['react', 'react-dom', 'CSS'], versions: fixtureManifest.dependencies, measurements };
await writeFile(path.join(repository, 'experiments/bundle-audit/results.json'), `${JSON.stringify(report, null, 2)}\n`);
