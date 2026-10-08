# Polish and publication follow-up

Scope: issues reported after the first Pages deployment. This slice does not promise competitor parity or publish to a package registry.

## Acceptance criteria

- Documentation/playground provide Portuguese and English navigation and a persistent light/dark/system theme.
- Resource guides link to real scenarios; generated API contracts remain authoritative.
- Sticky date/all-day/time/resource regions stay aligned through page and horizontal scrolling; boundaries are legible. No extra vertical calendar scrollbar is introduced.
- Incoming/outgoing pointer transfers work from the live demo with persistence ownership explicit; cancellation/rejection preserve the source.
- Summary demonstrates useful custom-view composition instead of an unstyled title list.
- GitHub distribution state is explicit: site deployment, draft preparation and package publication are separate actions.

## Tasks and evidence

`[~]` means implemented with integration/browser evidence pending; it is not release approval.

- [x] POLISH-01: documentation dark/light/system theme, shared preference and accessible controls. Verify system changes, explicit overrides, reload and narrow widths.
- [x] POLISH-02: playground/editor EN/PT and improved Summary; verify editor recurrence fields, validation messages and navigation in both languages.
- [x] POLISH-03: sticky geometry/boundaries and external transfer corrections. Reproduce scroll alignment and incoming/outgoing/cancel/reject scenarios in a real browser.
- [x] POLISH-04: live feature catalog and EN/PT guides; verify every view/scenario link, generated API reference and package measurement link.
- [x] PUB-01: repository is public; remote Pages `https_enforced: true` and HTTPS site response confirmed by the coordinating agent on 2026-10-08. `github-pages` accepts `main` only.
- [x] PUB-02: release environment reviewer is the owner, self-review allowed, administrator bypass disabled, `main` only. Record the sole-maintainer limitation in `docs/publishing-security.md`.
- [x] PUB-03: after integration checks, prepare a version-consistent draft `.tgz` and checksum. Confirm draft contents/consumer install before deciding manual publication. No registry publishing is authorized by this slice.
- [x] QA-01: coordinating agent records final type/unit/package/browser checks and screenshots after all concurrent edits finish.

Public bundle comparison remains in `docs/en/bundle-comparison.md` and its Portuguese counterpart: preserve one package; explore optional loading/subpath boundaries only when consumer measurements justify them. Grouped resources and multi-day resource timelines are candidates for future operational scenarios; year/print views need their own scope.

## Final local evidence (2026-10-08)

- Type/unit/ESM/CJS/packed consumer checks: passed, 345 tests across 33 files.
- Sticky geometry: zero column/event/all-day displacement in desktop and narrow horizontal scrolling; month and agenda sticky headers checked.
- Production site under /calendara/: documentation and playground scenarios passed in Edge, including themes, English/Portuguese, feature links and transfer rejection.
- Screenshots inspected: dark English documentation and playground; narrow 320/375px layouts. Physical mobile/Safari and screen-reader validation are not claimed.
- Full browser rerun passed: all 28 scripts in Edge, with no runtime errors. PR #13 passed required CI in Chrome (run 37828822314) and merged into develop; main deployment and live HTTPS browser checks passed. Release workflow 37830018625 passed; the owner explicitly approved draft creation and publication.

## Reported follow-up (2026-10-08)

The mobile-looking hatched segment is the resource preparation buffer, which intentionally follows its event; fixed blocked intervals must stay at their configured time. A receptionist browser regression verifies both after a move. Header continuity, working documentation return, compact toggles and dark editor contrast were corrected and passed local verification (345 tests, all 28 browser scripts, dark editor contrast >= 4.5:1). Remote integration and deployment follow. The immutable v0.1.0 release is published with a verified downloaded archive/checksum.

Independent consumer: C:\Users\jackson\calendara-consumer is outside GitHub and installs the public v0.1.0 .tgz using Yarn, without workspace links/source aliases. Installation and Vite production build passed. Edge verified imported CSS, movement to 10:00, resize to 11:30, and state preservation after month/day navigation. Log: output/independent-consumer-browser.log.
