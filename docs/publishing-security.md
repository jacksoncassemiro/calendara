# Release security review / Revisão de segurança da publicação

Scope: repository CI, GitHub Release preparation and installation. This does not certify every runtime dependency or replace repository settings inspection.

## Implemented controls / Controles aplicados

- CI uses `pull_request`, never `pull_request_target`, with read-only permissions and no repository secrets. Checkout does not persist credentials.
- Actions are pinned to full commit SHAs verified against their official GitHub tag refs; Dependabot proposes reviewed updates.
- Dependencies use Yarn 1.22.22 and `--frozen-lockfile`; types, tests, package consumer and Chrome interaction checks precede draft creation. The workflow does not publish to any package registry.
- Release dispatch is restricted to `main`. Existing version tags must resolve to a commit contained in `origin/main`; the checked-out manifest and changelog must match.
- Build/test/package run with read-only permissions. Only the final job gets `contents: write`; it downloads the current run's artifact and executes no repository code.
- User-controlled tag values are passed through environment variables, validated, and quoted. No PR title/body is interpolated into shell code.
- The final job checks one SHA256 line against the expected archive basename, rechecks the remote tag commit, refuses overwriting an existing release through `gh release create`, and creates a draft. Publication is manual.

## Remaining operational requirements / Requisitos operacionais

Repository settings must enforce PRs, up-to-date CI, resolved conversations, protected release tags and restricted deployment environments. Workflows do not configure these remote settings.

**REL-01 — Manual checkpoint / Checkpoint manual:** require review on the `release` environment, restricted to `main`. Self-review for a sole maintainer is a checkpoint rather than independent review; add another reviewer when available.

**REL-02 — Medium / Média:** SHA256 and GitHub artifact digests protect transfer integrity, not against a malicious maintainer or compromised GitHub account. Use account MFA, least privilege and never replace a published asset. Signed tags/attestations can be added later with a defined trust policy.

**REL-03 — Medium / Média:** build-time dependency install scripts run third-party code, with no write token/secrets in that job. Lockfiles pin resolution, not dependency safety. Review dependency changes and advisories. CI runners still need outbound access to registries.

**REL-04 — Low / Baixa:** GitHub Release URL installation is simple for public projects. Private downloads require authentication outside the dependency URL. Document fixed versions and retain released assets to avoid broken installs.

Repository settings are applied remotely; workflow changes are reviewed through PRs.

The Pages workflow also separates a read-only build from deployment. Only `dist/playground` is uploaded; its deploy job receives `pages: write` and `id-token: write`, executes no project code and runs only after a main build. The `github-pages` environment is configured for `main`; enable HTTPS enforcement and verify the deployed site. Treat bundled demo content as public even when repository access is restricted.

Português: restringir branches/tags e ambientes de publicação. CI/empacotamento usam leitura; somente o job final recebe escrita, sem executar código do repositório. Exigir revisão e conferir HTTPS antes da publicação.

Sources: [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [release assets](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
