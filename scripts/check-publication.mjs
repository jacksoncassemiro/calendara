import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
check(
  manifest.name === '@jacksoncassemiro/calendara',
  'Package name must be @jacksoncassemiro/calendara.',
);
check(manifest.license === 'MIT', 'Package license must be MIT.');
check(manifest.packageManager === 'yarn@1.22.22', 'Pin Yarn 1.22.22 in packageManager.');
check(
  manifest.repository?.url === 'git+https://github.com/jacksoncassemiro/calendara.git',
  'Repository metadata must point to Calendara.',
);
check(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(manifest.version), 'Package version must use SemVer.');

const publicDocuments = [
  'README.md',
  'README.pt-BR.md',
  'CHANGELOG.md',
  'CHANGELOG.pt-BR.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'CONTRIBUTING.pt-BR.md',
  'SECURITY.md',
  'SECURITY.pt-BR.md',
  'docs/en/README.md',
  'docs/pt-BR/README.md',
];
for (const document of publicDocuments)
  check(existsSync(resolve(root, document)), `Missing ${document}.`);
for (const changelog of ['CHANGELOG.md', 'CHANGELOG.pt-BR.md']) {
  if (!existsSync(resolve(root, changelog))) continue;
  check(
    readFileSync(resolve(root, changelog), 'utf8').includes(`## [${manifest.version}]`),
    `${changelog} must describe version ${manifest.version}.`,
  );
}
if (existsSync(resolve(root, 'LICENSE'))) {
  check(
    readFileSync(resolve(root, 'LICENSE'), 'utf8').startsWith('MIT License'),
    'LICENSE must contain the MIT license.',
  );
}
for (const entry of ['dist/esm', 'dist/cjs', 'styles.css']) {
  check(manifest.files?.includes(entry), `Package files must include ${entry}.`);
}

function inspectPublicDirectory(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) inspectPublicDirectory(path);
    else if (entry.name.endsWith('.md')) publicDocuments.push(path);
  }
}
inspectPublicDirectory(resolve(root, 'docs/en'));
inspectPublicDirectory(resolve(root, 'docs/pt-BR'));
for (const document of new Set(publicDocuments)) {
  const path = resolve(root, document);
  if (!existsSync(path)) continue;
  check(
    !readFileSync(path, 'utf8').includes('@meucalendario/calendar'),
    `Obsolete package name in ${document}.`,
  );
}
if (failures.length) throw new Error(`Publication checks failed:\n- ${failures.join('\n- ')}`);
console.log('Publication metadata, bilingual entry points, changelog and license: OK.');
