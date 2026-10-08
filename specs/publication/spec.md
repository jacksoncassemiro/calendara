# Calendara publication specification

- PUB-01: GitHub Release distributes a built Yarn-installable `.tgz`, without npm publication.
- PUB-02: branch flow uses reviewed main/develop/release PRs and explicit SemVer/changelog entries.
- PUB-03: release requires an existing tag contained in main, matching package version and changelog.
- PUB-04: CI is read-only; write access is isolated to draft creation after validation.
- PUB-05: installation and maintainer documentation is available in Portuguese and English.
- PUB-06: history reset is documented with recovery and collaboration implications; no rewrite occurs implicitly.

Acceptance: `yarn verify`, script syntax validation, tag/version/changelog rejection checks, workflow review and a first remote dry run creating only a draft after remote protections are configured.
