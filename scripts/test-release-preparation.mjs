import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const fixture = resolve(root, 'output/release-fixture');
if (existsSync(fixture))
  throw new Error('Release fixture exists; preserve or remove it before rerunning.');
mkdirSync(resolve(fixture, 'scripts'), { recursive: true });
for (const path of [
  'package.json',
  'LICENSE',
  'README.md',
  'README.pt-BR.md',
  'CHANGELOG.md',
  'styles.css',
  'dist/esm',
  'dist/cjs',
  'scripts/prepare-release.mjs',
]) {
  cpSync(resolve(root, path), resolve(fixture, path), { recursive: true });
}
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};
const prepare = (tag) =>
  spawnSync(process.execPath, ['scripts/prepare-release.mjs', tag], {
    cwd: fixture,
    encoding: 'utf8',
  });
git('init', '-b', 'main');
git('config', 'user.name', 'Release fixture');
git('config', 'user.email', 'fixture@example.invalid');
git('add', '.');
git('commit', '-m', 'Release fixture');
git('update-ref', 'refs/remotes/origin/main', 'HEAD');
git('tag', 'v0.1.0');

assert.notEqual(prepare('v0.2.0').status, 0, 'Mismatched version accepted');
const valid = prepare('v0.1.0');
assert.equal(valid.status, 0, valid.stderr);
const archive = readFileSync(resolve(fixture, 'output/release/calendara-0.1.0.tgz'));
const digest = createHash('sha256').update(archive).digest('hex');
assert.equal(
  readFileSync(resolve(fixture, 'output/release/SHA256SUMS'), 'utf8'),
  `${digest}  calendara-0.1.0.tgz\n`,
);
assert.ok(
  readFileSync(resolve(fixture, 'output/release/release-notes.md'), 'utf8').includes('## [0.1.0]'),
);
writeFileSync(resolve(fixture, 'styles.css'), '/* Changed after tag */\n');
assert.notEqual(prepare('v0.1.0').status, 0, 'Dirty checkout accepted');
git('add', 'styles.css');
git('commit', '-m', 'Later fixture commit');
assert.notEqual(prepare('v0.1.0').status, 0, 'Wrong checkout accepted');
git('tag', '-f', 'v0.1.0');
git('checkout', '--orphan', 'unrelated');
git('commit', '-m', 'Unrelated main fixture');
git('update-ref', 'refs/remotes/origin/main', 'HEAD');
git('checkout', '--detach', 'v0.1.0');
assert.notEqual(prepare('v0.1.0').status, 0, 'Tag outside main accepted');
console.log(
  'Release fixture: package/checksum/notes valid; mismatched version, dirty checkout, wrong HEAD and tag outside main rejected.',
);
