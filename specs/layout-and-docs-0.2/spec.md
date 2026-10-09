# Layout and example-source review

## Scope

- Distinguish resource-relative preparation buffers from fixed civil-date closures.
- Keep annual event titles inside date cells, sticky resource boundaries visible and current-time lines below the fixed time axis.
- Present one horizontal scrollbar when the synchronized top control is available; retain internal vertical-scroll behavior.
- Share a highlighted/copyable example panel without adding Prism to the library runtime.
- Document current competitor registration/loading patterns and remaining capability limits in EN/PT.

## Evidence

- Resource-week fixture updates an event to another date: the fixed 12:00–13:00 closure geometry remains unchanged and the event remains rendered. Brown preparation follows Room 1 occupancy by design, rather than representing the fixed closure.
- Annual view uses bounded single-line titles with ellipsis, full accessible names/tooltips and wider date cells.
- Annual cells default to approximately 120 px through `--mc-year-day-width`; the browser regression requires at least 110 px and verifies title containment. Consumers may increase the CSS token for longer titles.
- Browser checks cover seven extended views, 24 focused examples, combined page/horizontal scroll, fixed all-day alignment, syntax tokens and container widths.
- Initial layout validation: 522 tests in 39 suites, packaged ESM/CJS/CSS and external TypeScript consumption, plus the browser suite. This count precedes the expanded capabilities below.

## Expanded capability acceptance

- [x] Vertical resource timeline window with full logical height; a 500-resource fixture mounts at most 20 rows and keeps offscreen capacity checks.
- [x] Nested parentId resource rows, explicit initial collapse and independent resource capacity.
- [x] Consumer snapshot history with asynchronous rejection, stale-request protection, reload reset and detached metadata.
- [x] Strict ICS import/export with exclusive ends, zoned recurrence and moved/cancelled occurrence identity; unsupported semantics rejected with explicit limits.
- [x] Seven recurrence frequencies, time filters and BYWEEKNO; 117 targeted differential/integration cases before full validation.
- [x] Explicit RTL option, logical geometry, mirrored keyboard navigation and signed sticky scroll; targeted integration and Chromium geometry checks.
- [x] Shared highlighted/copyable source panel, 27 catalog-driven examples, feature search and category filtering, EN/PT contracts and guides.
- [x] Simulated Chromium touch: native swipes produce no draft/commit in day/week/resource columns and horizontal timeline; held drag produces a commit.
- [x] Final local verification: 567 tests in 44 suites, 41 generated contracts, package consumption and complete browser suite (138.35 s). Additional horizontal timeline swipe passed.
- [x] Inspect annual event containment, searchable feature directory and resource-window/RTL screenshots.
- [x] GitHub Linux/Chrome CI after bounding native number controls at 320 px: run 37959495682 passed (commit de92ff0).
- [ ] Protected feature/release PRs, tagged archive/checksum, independent consumer installation and Pages deployment.

Horizontal virtualization, projection caching, complete iCalendar/invitation semantics and physical-mobile/Safari/screen-reader certification remain explicit product limits. Storybook migration is outside this change. They must not be described as implemented by the vertical row window or simulated touch checks.

Brand review: documentation and playground share petrol/mint brand tokens with neutral surfaces. EN/PT READMEs reuse exported site logos and separate language navigation. Browser checks verify sampled brand/body/primary-button contrast >= 4.5:1 in both themes, plus bounded 320/375 px layouts; this is not full WCAG certification. Public features guides now list concrete limits and mitigations.


Editor follow-up: partial CalendarEditorMessages overrides, EN/PT fallback, Intl month/weekday labels and intraday options are validated by 13 editor integration cases. Complete verification passed 573 tests in 44 suites with 42 generated contracts; the full browser suite passed in 115.89 s, including the 28th focused translation example. A finite-count default mitigates accidental unbounded intraday expansion. Transparent 3x site-logo exports replace opaque README captures.

Grouped editor dictionary: fields/actions/scope/recurrence/validation/feedback expose partial per-section overrides; dynamic validation receives a named context object. Final local verification passed 573 tests in 44 suites and 50 generated contracts (367 fields); the complete browser suite passed in 117.54 s. Limiting concurrent test workers to four prevents a monthly timeline timeout observed only in the full parallel suite. The measured Month + Day fixture stays at 72,856 gzip bytes; the optional editor fixture totals 82,073 gzip bytes across its chunks.

