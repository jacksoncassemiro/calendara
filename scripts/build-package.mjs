import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const kind of ['esm', 'cjs']) {
  const output = fileURLToPath(new URL(`../dist/${kind}/`, import.meta.url));
  if (!output.startsWith(root)) throw new Error('Build output outside workspace');
  rmSync(output, { recursive: true, force: true });
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', `tsconfig.${kind}.json`], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const directory = new URL('../dist/cjs/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('package.json', directory), '{"type":"commonjs"}\n');
