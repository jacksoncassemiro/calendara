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
- [ ] GitHub Linux/Chrome CI after bounding native number controls at 320 px.
- [ ] Protected feature/release PRs, tagged archive/checksum, independent consumer installation and Pages deployment.

Horizontal virtualization, projection caching, complete iCalendar/invitation semantics and physical-mobile/Safari/screen-reader certification remain explicit product limits. Storybook migration is outside this change. They must not be described as implemented by the vertical row window or simulated touch checks.
