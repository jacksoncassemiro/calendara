# Starting with fresh Git history

[Português](history-reset.pt-BR.md) · English

A fresh history is possible and optional. It does not improve package correctness or remove credentials from old clones. No history rewrite or force push is part of the release workflow.

## Recommended: reviewed snapshot in a new repository

`node scripts/export-clean-repository.mjs` copies current working files into `output/fresh-repository`, without `.git` or ignored untracked files. It includes tracked files and new non-ignored files, skips deleted files, rejects non-regular files and refuses to replace an existing export. It preserves your current checkout, branches, commits and remotes.

Review the exported files before initializing Git. Tracked files remain part of the export even if a later `.gitignore` rule matches them; remove accidental tracked secrets/artifacts from the reviewed source first. Keep MIT notices and third-party credits. Then run in the export directory:

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Initial Calendara release"
```

These commands create local history only. Creating another GitHub repository and pushing to it is a separate decision. The current remote is `jacksoncassemiro/calendara`; do not point an initial snapshot at it and force push without an explicit migration plan.

After choosing the new remote, configure protected `main`/`develop`, tag rules, CI and the release environment. Recreate `develop` from the reviewed initial commit. Existing releases, issues, PRs, stars and integrations belong to the old repository and do not move with a source copy.

## Rewriting the existing repository

An orphan branch plus force push can replace the visible default history, but impacts collaborators, PR references, existing branches, tags and releases. It does not erase old clones, forks, caches or every GitHub reference. A rename of the repository also does not reset commits.

Before any rewrite: create a verified full repository backup, inventory all branches/tags and releases, choose what to preserve, coordinate collaborators, temporarily plan protection changes, and define rollback. Require fresh clones afterward; old branches can reintroduce old commits. Do not run destructive commands until that exact migration is approved.

For exposed secrets, rotate credentials and use [GitHub's sensitive-data removal procedure](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). A cosmetic history reset is insufficient.
