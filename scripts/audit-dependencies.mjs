import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const windows = process.platform === 'win32';
const result = spawnSync(
  windows ? process.execPath : 'yarn',
  windows
    ? [join(dirname(process.execPath), 'node_modules/corepack/dist/yarn.js'), 'audit', '--json']
    : ['audit', '--json'],
  { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
);
const advisories = new Map();
let summary;
for (const line of (result.stdout ?? '').split('\n')) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }
  if (entry.type === 'auditAdvisory') {
    const item = entry.data.advisory;
    advisories.set(item.github_advisory_id, {
      id: item.github_advisory_id,
      package: item.module_name,
      severity: item.severity,
      title: item.title,
      patched: item.patched_versions,
      url: item.url,
      versions: item.findings.map((f) => f.version),
      paths: item.findings.flatMap((f) => f.paths),
    });
  } else if (entry.type === 'auditSummary') summary = entry.data;
}
if (!summary) throw new Error(`Yarn audit did not return a summary: ${result.stderr}`);
mkdirSync('output/security', { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  summary,
  advisories: [...advisories.values()],
};
writeFileSync('output/security/dependency-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exitCode = result.status ?? 1;
