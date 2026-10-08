# Contributing

[Português](CONTRIBUTING.pt-BR.md)

## Setup

Use Node matching `package.json` (`^22.12.0 || ^24.0.0 || >=26.0.0`) and Yarn 1.22.22.

```sh
git clone https://github.com/jacksoncassemiro/calendara.git
cd calendara
corepack enable
yarn install --frozen-lockfile
yarn dev
```

Open `/examples/react.html` through Vite's URL. Library styles are in `styles.css`; playground styles are separate. Keep the single package and React as peers. Commit the lockfile when changing dependencies.

## Small, reviewable changes

Describe the behavior, users affected and observable acceptance criteria before implementation. For a larger change, create a spec, plan and small tasks under `specs/`. Prefer descriptive names and shared logic when it actually removes duplication. Keep useful JSDoc direct, with English and Portuguese explanations. Update both public documentation languages together. Tests should validate behavior/integration, not repeat the implementation.

```sh
yarn verify
yarn test:browser
yarn audit:dependencies
```

`verify` checks types, unit/integration tests, build, packed consumption and demo. Browser scripts exercise interactions/layouts; locally Microsoft Edge is the default, CI uses Chrome. Inspect relevant screenshots and console errors for UI changes. Do not label physical Safari/mobile or screen-reader checks as complete based on these scripts.

## Branches and commits

- `main`: reviewed release-ready commits.
- `develop`: integrated work for the next version.
- `feature/<description>` or `fix/<description>`: small branches from `develop`, merged by PR.
- `release/<version>`: preparation from `develop`, with version, changelog and final fixes.
- `hotfix/<description>`: urgent fixes from `main`, merged back to both long-lived branches.

Use clear commits such as `fix: preserve resource capacity during resize`. PRs explain the resulting behavior, validation and material limits. Use branch protection/rulesets to require PR review and `Verify package`; disable force pushes to long-lived branches. These settings must be configured in GitHub; a YAML file cannot enforce them by itself.

## Release handoff

1. On `release/<version>`, set `package.json` to that SemVer version and add matching `CHANGELOG.md` notes in both languages. Review breaking changes and installation docs.
2. Merge the reviewed release PR into `main`, then merge the released changes back into `develop`.
3. Create an annotated `v<version>` tag on the exact released `main` commit and push that tag. Do not move a published tag.
4. Run **Prepare GitHub release** from `main`, supplying the existing tag. It checks version/tag/main ancestry, runs verification/browser checks, then packages the compiled library and checksum.
5. Review the draft GitHub Release, asset contents, notes and checksum. Publish the draft manually after review.

The workflow does not publish to npm. Its write permission is limited to the draft job, behind the `release` environment. Configure that environment with required reviewers where your GitHub plan supports it. Workflows/actions are pinned, dependencies use the lockfile, and the validated tag is checked again before draft creation. GitHub-hosted execution still needs real CI validation after the files are pushed.

Resetting Git history is not routine release preparation. It discards commit links, tags and audit context and can disrupt collaborators. Keep an offline Git bundle before any separately approved rewrite; prefer a fresh repository if a clean public history is required. Never rewrite published release tags as part of this workflow.
