# Publication tasks

- [x] Prepare read-only CI with frozen Yarn lockfile.
- [x] Prepare main-only manual release workflow, existing tag validation and draft-only upload.
- [x] Isolate write permission from dependency installation/build.
- [x] Pin and verify official Actions commit SHAs.
- [x] Generate versioned tarball, SHA256 and changelog release notes.
- [x] Document bilingual installation and branch flow. One-time history-reset instructions were retired after migration; see [cleanup evidence](../extended-views/docs-cleanup.md).
- [x] Record security controls and remote requirements.
- [x] Validate script syntax and rejection of malformed release tags.
- [x] Validate scripts and package locally with final package name/version.
- [x] Validate static Pages build under /calendara/ in Edge, API search, languages and mobile widths.
- [x] Configure Prettier, verify browser-expression compatibility and add format check to CI.
- [x] Inspect remote settings; record unprotected main, missing rulesets/environments and private visibility.
- [x] Configure main/develop CI/PR protection, immutable version tags and main-only environments.
- [ ] Required environment reviewers: unavailable for current private repository plan (GitHub HTTP 422).
- [ ] Run first release workflow and review draft (remote maintainer action).
- [ ] Publish reviewed draft (explicit maintainer action).

Verified official action tag refs on 2026-10-08: checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, download-artifact v8.0.2. Their full commit SHAs are recorded directly in the workflows. Local `node --check scripts/prepare-release.mjs` and `git diff --check` passed. Full YAML/remote workflow validation remains part of the first protected draft run.
