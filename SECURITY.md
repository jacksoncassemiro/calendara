# Security policy

[Português](SECURITY.pt-BR.md)

## Report privately

Report a suspected vulnerability through [GitHub private vulnerability reporting](https://github.com/jacksoncassemiro/calendara/security/advisories/new) when enabled. Include affected version, reproduction, impact and a minimal example without real patient/user data. If private reporting is unavailable, open an issue requesting a private contact without publishing exploit details. No response-time or supported-version guarantee is established yet.

## Consumer boundaries

Calendara is a client library, not an authorization or transactional scheduling service. Validate permissions, inputs, business rules and concurrent capacity on the server. Treat remote events as untrusted data. React text rendering escapes titles; custom renderers must avoid unsafe HTML or URLs. Do not place secrets in event metadata, bundles or browser examples.

For remote sources, pass the provided AbortSignal and handle failures. Cancellation prevents obsolete UI results; it does not undo server writes. Define persistence/rollback behavior for edits and external drops. Supply finite windows when expanding unbounded recurrence. Revalidate every assigned resource before committing a reservation.

## Build and release boundaries

CI uses a read-only token; only the release draft job receives repository write access. The release workflow validates an existing version tag, main ancestry, package checks, browser interactions and checksum. Configure branch protections and release environment reviewers in GitHub. Do not run untrusted contributor code with production secrets or use `pull_request_target` to build a submitted checkout.

Install a pinned release asset and retain `yarn.lock`. Verify its `SHA256SUMS`; checksum and asset share the same publisher boundary, so a checksum alone is not provenance. Audit dependencies with `yarn audit:dependencies` and review the generated report before releases. Absence of known advisories is not proof that dependencies are vulnerability-free.
