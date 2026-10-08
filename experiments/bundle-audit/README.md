# Bundle audit

Production JavaScript contribution, measured on 2026-10-08. This is an engineering experiment, not a rendering benchmark or a feature-parity ranking.

From the repository root, after `yarn install --frozen-lockfile`:

```powershell
New-Item -ItemType Directory -Force output/bundle-audit | Out-Null
Copy-Item experiments/bundle-audit/package.fixture.json output/bundle-audit/package.json
Copy-Item experiments/bundle-audit/yarn.fixture.lock output/bundle-audit/yarn.lock
yarn --cwd output/bundle-audit install --frozen-lockfile --ignore-scripts
node experiments/bundle-audit/measure.mjs
```

Fixtures, installed dependencies and generated bundles stay in Git-ignored `output/bundle-audit`. Only the recipe, pinned manifest/lockfile and measurements are versioned. No competitor enters Calendara's production dependencies.

Vite 8.3.3 / Rolldown / Oxc, ES2022, production minification and tree shaking. The entry exports a usable React component; React and React DOM, including their subpaths, are external in every scenario. Other required runtimes are included. CSS and application data are excluded. Each chunk is gzipped independently; the total includes optional chunks and is not necessarily the first page download.

Schedule-X requires Temporal 0.3.2, while FullCalendar 7 requires 1.x. The fixture installs both and aliases Schedule-X builds to its required version. Yarn's shared peer warning is expected; resolution in the measured build is explicit.

The Calendara entry targets current public source rather than the entire playground. Small examples deliberately retain all runtime capabilities of each selected component. Empty data does not mean recurrence or drag implementations are removed by the bundler.

Results and limitations: [English](../../docs/en/bundle-comparison.md) / [Português](../../docs/pt-BR/bundle-comparison.md). Rerun after source or dependency changes; byte counts are snapshots, not budgets.
