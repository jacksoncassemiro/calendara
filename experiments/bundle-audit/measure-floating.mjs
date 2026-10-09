import { build } from 'vite';
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
const root = process.cwd();
const moduleRoot = root.replaceAll('\\', '/') + '/';
const output = path.join(root, 'output/floating-audit');
await mkdir(output, { recursive: true });
const scenarios = {
  floating: `export { autoUpdate, flip, FloatingFocusManager, FloatingPortal, offset, shift, useDismiss, useFloating, useInteractions, useRole } from '@floating-ui/react';`,
  'actual-popover': `export { MonthMorePopover } from '${path.join(root, 'src/react/views/components/MonthMorePopover.tsx').replaceAll('\\', '/')}';`,
  'calendara-month-day': `import React from 'react'; import { Calendar, monthView, dayView } from '${path.join(root, 'src/index.ts').replaceAll('\\', '/')}'; export const Demo = () => React.createElement(Calendar,{views:[monthView,dayView],events:[]});`,
  'floating-positioning-only': `export { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react-dom';`,
};
const measurements = [];
for (const [name, source] of Object.entries(scenarios)) {
  const entry = path.join(output, name + '.js');
  await writeFile(entry, source);
  const result = await build({
    configFile: false,
    root,
    logLevel: 'error',
    build: {
      write: false,
      minify: 'oxc',
      target: 'es2022',
      rolldownOptions: {
        input: entry,
        preserveEntrySignatures: 'strict',
        external: (id) => /^(react|react-dom)(\/|$)/.test(id),
        output: { format: 'es' },
      },
    },
  });
  const chunks = (Array.isArray(result) ? result : [result])
    .flatMap((b) => b.output)
    .filter((c) => c.type === 'chunk');
  const details = chunks.map((c) => ({
    file: c.fileName,
    entry: c.isEntry,
    bytes: Buffer.byteLength(c.code),
    gzip: gzipSync(c.code).byteLength,
    floatingModules: Object.keys(c.modules)
      .filter((module) => module.includes('@floating-ui'))
      .map((module) => module.replaceAll('\\', '/').replace(moduleRoot, '')),
  }));
  const row = {
    name,
    bytes: details.reduce((n, c) => n + c.bytes, 0),
    gzip: details.reduce((n, c) => n + c.gzip, 0),
    chunks: details,
  };
  measurements.push(row);
  console.log(JSON.stringify(row));
}
const packages = ['react', 'react-dom', 'core', 'dom', 'utils'];
const disk = [];
async function total(dir) {
  let bytes = 0;
  for (const name of await readdir(dir)) {
    const file = path.join(dir, name);
    const metadata = await stat(file);
    bytes += metadata.isDirectory() ? await total(file) : metadata.size;
  }
  return bytes;
}
for (const name of packages) {
  const dir = path.join(root, 'node_modules/@floating-ui', name);
  const manifest = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  disk.push({
    package: manifest.name,
    version: manifest.version,
    installedBytes: await total(dir),
  });
}
const result = {
  date: '2026-10-08',
  node: process.version,
  target: 'es2022',
  excluded: ['react', 'react-dom', 'CSS'],
  measurements,
  disk,
};
await writeFile(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
