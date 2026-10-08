# Publicação / Publishing

[Português](publishing.pt-BR.md) · English

Calendara ships as a built `.tgz` attached to a GitHub Release. This is separate from GitHub Packages and does not publish the library to npm. Yarn still downloads React and other dependencies from their configured registry. GitHub's automatic source ZIP is not the installable built package.

## Branches and versions

- `main`: reviewed release history. Require PRs and the `Verify package` check; prohibit force pushes and deletion.
- `develop`: integration branch, with the same PR/check requirements.
- `feature/*` and `fix/*`: branches from `develop`, merged back by PR.
- `release/0.1.0`: stabilization branch from `develop`. Update `package.json` and `CHANGELOG.md`, then PR to `main`; merge the release changes back to `develop`.
- `hotfix/*`: branch from `main`, PR to `main`, then integrate into `develop`.

Use SemVer. Keep one changelog section per version, for example `## [0.1.0] - 2026-10-08`, with English and Portuguese changes. Breaking API changes must be explicit. CI does not infer a version from commit messages or bump it silently.

## Remote configuration verified on October 8, 2026

The repository is public. Main/develop require PRs, up-to-date `Verify package` CI and resolved conversations; administrators are included. Force pushes/deletion are blocked, and version tags cannot be updated/deleted. The `release` environment accepts only `main` and requires the owner as reviewer. Self-review is allowed for the sole maintainer; administrator bypass is disabled. This is a manual checkpoint, not independent review. Add another reviewer when a second maintainer joins.

GitHub Pages is published from the Actions artifact built on `main`. HTTPS enforcement is enabled (`https_enforced: true`), and the published site resolves over HTTPS. The `github-pages` environment is restricted to `main`. Publishing the site does not create or publish a package release.

## Maintainer release steps

1. Configure repository rulesets and an environment named `release` **before** running the workflow. Require a reviewer, prevent self-review if available, and restrict the environment to `main`. Environment protections depend on the repository visibility and GitHub plan.
2. Merge the release PR into `main`; verify its CI result.
3. Create an annotated tag on that reviewed commit: `git tag -a v0.1.0 -m "Calendara 0.1.0"`. Push only that tag: `git push origin v0.1.0`.
4. In Actions, run **Prepare GitHub release**, select branch `main`, and enter `v0.1.0`.
5. The workflow verifies tag ancestry, package version, changelog, types, tests, build and consumer package. It creates a draft containing `calendara-0.1.0.tgz` and `SHA256SUMS` after the environment gate.
6. Inspect the draft, download the archive, check the digest and try it in a consumer project. Publish the draft manually. Never replace a published tag/archive; release a new version.

Creating a workflow file does not configure branch protection or required reviewers. An unconfigured environment is created without protection by GitHub. The current remote configuration is recorded above; verify it again before a release, especially after visibility or plan changes.

## Releases and GitHub Packages

Public GitHub Packages usage is free, but the GitHub npm registry requires authentication to install even public packages. Calendara currently chooses public GitHub Release assets so consumers can install the fixed `.tgz` URL without configuring that registry. A published documentation site is not a published library release. A release draft is not publicly installable until published.

Sources: [Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages), [npm registry authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).

## Install without npm publication

For a public repository, after the release is published:

```sh
yarn add https://github.com/jacksoncassemiro/calendara/releases/download/v0.1.0/calendara-0.1.0.tgz
yarn add react react-dom
```

Import using the package name `@jacksoncassemiro/calendara`, including `@jacksoncassemiro/calendara/styles.css`. Use a fixed version URL and commit `yarn.lock`. For a private repository, download the asset through authenticated GitHub UI/CLI, verify `SHA256SUMS`, then run `yarn add ./calendara-0.1.0.tgz`. Do not place access tokens in dependency URLs or lockfiles.

Windows digest: `Get-FileHash ./calendara-0.1.0.tgz -Algorithm SHA256`. Linux/macOS: `shasum -a 256 calendara-0.1.0.tgz`. Compare against the published checksum; the checksum detects a changed download, but is not an independent author signature.

## Start with fresh Git history

It is possible, but not required for publishing. A **new repository from a reviewed source snapshot** preserves the old repository for recovery and starts with one new commit. Export a reviewed snapshot of tracked and nonignored source files, initialize Git in a separate directory, inspect the result, then create the new repository. Preserve copyright/license notices and credit third-party work. The old history is not a secret-removal strategy: rotate exposed credentials and follow GitHub's sensitive-data guidance.

Rewriting the current repository with an orphan branch and force pushing affects collaborators, tags, PR references and releases; old clones can retain the history. Do this only after choosing the target, making a verified backup and coordinating collaborators. No history was rewritten by this preparation.

Sources: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases), [environment protections](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [secure Actions](https://docs.github.com/en/actions/reference/security/secure-use), [removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).
