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

Configured on 2026-10-08: repository remains private. Main/develop require PRs, up-to-date `Verify package` CI and resolved conversations; administrators are included, and force pushes/deletion are blocked. Version tags (`v*`) cannot be updated/deleted. Release and github-pages environments accept only main. Issues remain enabled, the duplicate wiki is disabled, and merged branches are deleted automatically. Squash and merge commits remain available; rebase merge is disabled. Actions default to read-only and cannot approve PRs. Issue templates request reproduction without personal/patient data.

**REL-01 — Remaining limitation / Limitação:** GitHub rejected required environment reviewers for this private repository's billing plan (HTTP 422). The environment restricts the branch but does not require human approval. Draft-only release creation, manual publication and protected PR/CI remain the available controls. A sole maintainer cannot approve their own PR; required PR approvals are zero, while PRs and CI remain mandatory. Add independent review when another maintainer joins or the plan supports environment reviewers.

**REL-02 — Medium / Média:** SHA256 and GitHub artifact digests protect transfer integrity, not against a malicious maintainer or compromised GitHub account. Use account MFA, least privilege and never replace a published asset. Signed tags/attestations can be added later with a defined trust policy.

**REL-03 — Medium / Média:** build-time dependency install scripts run third-party code, with no write token/secrets in that job. Lockfiles pin resolution, not dependency safety. Review dependency changes and advisories. CI runners still need outbound access to registries.

**REL-04 — Low / Baixa:** GitHub Release URL installation is simple for public projects. Private downloads require authentication outside the dependency URL. Document fixed versions and retain released assets to avoid broken installs.

Repository settings are applied remotely; workflows are delivered through PRs. No version tag, published release or history rewrite was performed during this setup.

The Pages workflow also separates a read-only build from deployment. Only `dist/playground` is uploaded; its deploy job receives `pages: write` and `id-token: write`, executes no project code and runs only after a main build. Configure the `github-pages` environment before enabling deployment. Treat bundled demo content as public even when repository access is restricted.

Português: branches/tags estão protegidas e ambientes aceitam apenas main. O plano recusou revisão obrigatória no ambiente privado; esse controle não está ativo. O fluxo cria somente rascunhos e exige publicação manual. CI/empacotamento usam leitura; apenas o job final recebe escrita, sem executar código do repositório.

Sources: [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments), [release assets](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
