import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const repository = process.cwd().replaceAll('\\', '/');
const directory = repository + '/output/floating-audit/causal';
await mkdir(directory, { recursive: true });
const probes = {
  day: `import { Calendar, dayView } from '${repository}/src/index.ts'; export { Calendar, dayView };`,
  rrule: "export { RRuleTemporal } from 'rrule-temporal';",
  polyfill: "export { Temporal } from '@js-temporal/polyfill';",
};
const measurements = [];
for (const [name, source] of Object.entries(probes)) {
  const entry = directory + '/' + name + '.js';
  await writeFile(entry, source);
  const result = await build({
    configFile: false,
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
  const chunks = result.output
    .filter((output) => output.type === 'chunk')
    .map((chunk) => ({
      file: chunk.fileName,
      entry: chunk.isEntry,
      bytes: Buffer.byteLength(chunk.code),
      gzipBytes: gzipSync(chunk.code).byteLength,
      modules: Object.entries(chunk.modules)
        .map(([id, module]) => ({
          id: id.replaceAll('\\', '/').replace(repository + '/', ''),
          renderedBytes: module.renderedLength,
        }))
        .sort((first, second) => second.renderedBytes - first.renderedBytes),
    }));
  measurements.push({ name, chunks });
  console.log(
    JSON.stringify({
      name,
      chunks: chunks.map((chunk) => ({ ...chunk, modules: chunk.modules.slice(0, 15) })),
    }),
  );
}
await writeFile(directory + '/causal-results.json', JSON.stringify(measurements, null, 2) + '\n');
