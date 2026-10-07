import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const config of ['tsconfig.json', 'tsconfig.examples.json']) {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', config, '--noEmit'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
