import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (manifest.name !== '@jacksoncassemiro/calendara' || manifest.license !== 'MIT') {
  throw new Error('Release package must be Calendara with the MIT license.');
}
for (const packageFile of ['dist/esm', 'dist/cjs', 'styles.css']) {
  if (!manifest.files?.includes(packageFile))
    throw new Error(`Package files must include ${packageFile}.`);
}
const tag = process.argv[2];
const versionPattern =
  /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;
if (!tag || !versionPattern.test(tag) || tag !== `v${manifest.version}`) {
  throw new Error('Release tag must match package.json: v<version>.');
}
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const taggedCommit = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
if (taggedCommit !== git('rev-parse', 'HEAD'))
  throw new Error('Checkout must match the release tag.');
git('merge-base', '--is-ancestor', taggedCommit, 'refs/remotes/origin/main');
if (git('status', '--porcelain', '--untracked-files=no'))
  throw new Error('Tracked files must be clean before packaging.');
const changelog = readFileSync(resolve(root, 'CHANGELOG.md'), 'utf8');
const heading = `## [${manifest.version}]`;
const sectionStart = changelog.indexOf(heading);
if (sectionStart < 0 || (sectionStart > 0 && changelog[sectionStart - 1] !== '\n')) {
  throw new Error(`CHANGELOG.md must contain a section starting with ${heading}.`);
}
const sectionEnd = changelog.indexOf('\n## ', sectionStart + heading.length);
const notes = changelog.slice(sectionStart, sectionEnd < 0 ? undefined : sectionEnd).trim();
if (notes.split('\n').length < 3) throw new Error('Release notes must describe the changes.');

const outputDirectory = resolve(root, 'output/release');
mkdirSync(outputDirectory, { recursive: true });
const archiveName = `calendara-${manifest.version}.tgz`;
const archivePath = resolve(outputDirectory, archiveName);
if (process.platform === 'win32') {
  const corepackYarn = join(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js');
  execFileSync(process.execPath, [corepackYarn, 'pack', '--filename', archivePath], {
    cwd: root,
    stdio: 'inherit',
  });
} else {
  execFileSync('yarn', ['pack', '--filename', archivePath], { cwd: root, stdio: 'inherit' });
}
const digest = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
writeFileSync(resolve(outputDirectory, 'SHA256SUMS'), `${digest}  ${archiveName}\n`);
writeFileSync(
  resolve(outputDirectory, 'release-notes.md'),
  `${notes}\n\nCommit: ${taggedCommit}\n`,
);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `commit=${taggedCommit}\nprerelease=${Boolean(tag.includes('-'))}\n`,
  );
}
console.log(`Prepared ${archiveName} from ${taggedCommit}.`);
