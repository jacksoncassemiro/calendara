import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destination = resolve(root, 'output/fresh-repository');
if (existsSync(destination))
  throw new Error(
    'output/fresh-repository already exists; choose whether to preserve it before exporting again.',
  );
const paths = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const files = [];
for (const path of new Set(paths)) {
  const source = resolve(root, path);
  const workspacePath = relative(root, source);
  if (
    workspacePath.startsWith(`..${sep}`) ||
    workspacePath === '..' ||
    path.split('/').includes('.git')
  ) {
    throw new Error(`Unsafe export path: ${path}`);
  }
  if (!existsSync(source)) continue;
  if (!lstatSync(source).isFile()) throw new Error(`Export supports regular files only: ${path}`);
  files.push({ source, target: resolve(destination, workspacePath) });
}
for (const { source, target } of files) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
console.log(
  `Exported ${files.length} working files to ${destination}. No Git history, branches or remotes were changed.`,
);
