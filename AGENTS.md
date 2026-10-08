# Calendara: repository instructions

Personal, experimental React library developed with Codex assistance. Follow the user's current scope; do not turn the product backlog into unrequested work.

## Structure

- `src/core`: dates, recurrence, constraints, occupancy, geometry, store and gestures.
- `src/react`: React API/controller/editor; view contracts in `viewTypes.ts`.
- `src/react/views`: actual views; shared presentation, formatting, layout, models and hooks live in their named subfolders.
- `styles.css`: optional library theme. `examples`: documentation site and playground.
- `docs/en` and `docs/pt-BR`: public documentation. `specs`: scoped decisions/tasks/evidence. Older audit/experiment files are engineering records, not the public getting-started guide.

## Invariants

- Use Yarn 1.22.22 and the Node versions in `package.json`. Keep one native React package; no Preact migration or worktree unless requested.
- Event ends are exclusive. Preserve all-day dates, timed zones, original occurrence identity and the full multi-day duration.
- Business-hour restrictions, visual overlap and resource capacity are separate concepts. Validate every assigned resource and buffers; the backend still enforces concurrent writes.
- Consumers own persistence. Preserve async rejection/rollback, stale-request protection and latest callbacks.
- Keep hooks inside React components/hooks, not callbacks such as `renderEvent`.
- Public JSDoc is short EN + PT. Explain units/defaults/limits; remove historical comments and avoid narrating obvious code.
- Name values by intention and units. Extract shared rules only when their semantics match; do not add flags to force unrelated views through one abstraction.

## Validation and changes

- For calendar audits, read [the calendar review skill](.agents/skills/calendara-review/SKILL.md).
- Reproduce behavioral bugs and test integration, not implementation details. Use existing browser scripts; inspect screenshots for layout changes. Never claim physical mobile/Safari or screen-reader validation from a desktop viewport.
- `yarn verify` checks types, tests, builds and package consumption. `yarn test:browser` owns its isolated server/browser; do not run browser suites simultaneously.
- When using subagents, assign nonoverlapping files and centralize browser/build outputs. Do not require agents for small changes.
- Remove dead code only with evidence. Preserve referenced experiments and Git-ignored outputs unless the user asks otherwise.
- Keep public EN/PT docs and changelogs aligned. Generated API data comes from TypeScript contracts, not a second handwritten prop catalog.

## Git and publication

- Feature/fix branch → `develop`; stabilize `release/<version>` → `main`; merge release fixes back to `develop`. Use PRs and protected refs as described in `docs/publishing.md`.
- GitHub Releases distribute a versioned `.tgz`; do not publish to a registry. Keep package/tag/changelog versions consistent.
- CI is read-only. Draft creation and Pages deployment have isolated write jobs. Never use untrusted PR code with secrets/write tokens.
- A request to prepare a release does not authorize publishing it, pushing unrelated changes or rewriting history. History reset requires a reviewed snapshot, backup and explicit destination.
