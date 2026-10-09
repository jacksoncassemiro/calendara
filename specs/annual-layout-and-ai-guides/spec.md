# Annual layout and AI integration guides

## Scope

- Annual planner: synchronized sticky top scrollbar, opaque month labels with a clear divider, equal row heights regardless of event count or expanded overflow.
- Year and quarter panels: compact days, complete grid borders and six weeks by default. `monthFixedWeeks: false` selects natural four-to-six-week month ranges. Adjacent dates remain part of the reported visible range.
- Resource-period timelines: full group and day dividers, including sticky resource labels.
- Today background: distinguish from event cards with readable foreground text in both demonstration themes.
- Consumer AI instructions: concise EN/PT guides, a discoverable `llms.txt`, and Markdown API contracts generated from the existing source model. Keep contributor policy separate.

## Validation

- Range tests cover 28, 35 and 42 natural days; shared year/quarter integration verifies the option.
- Browser regression measures planner row heights, sticky month coverage, pinned top scroll, compact multi-month geometry, grid and timeline borders, light/dark contrast and narrow-container overflow.
- Package consumption compiles both complete AI guide examples against packaged declarations.
- Documentation browser checks resolve every indexed Markdown guide and verify generated bilingual contracts.
- `yarn verify`: 578 tests across 44 files, 50 generated contracts / 368 fields, library build, packaged TypeScript consumption (including both AI-guide examples), and documentation build passed. Log: `output/annual-layout-verify.log`.
- All 34 isolated browser scripts passed across the full run through auto-scroll and the four remaining documentation/playground/touch scripts. A late dependency optimization initially changed the React instance; pre-optimizing the lazy popover dependency resolved it. Logs: `output/annual-layout-browser.log` and `output/annual-layout-browser-remaining.log` (the former records the discovery-link assertion corrected in the latter).
- Production documentation preview passed after preserving the external `llms.txt` discovery link rather than Vite's inlined asset. Log: `output/annual-layout-production-docs.log`. Markdown guide assets are emitted from their original files; the API reference comes from the existing generated model.
- Browser measurements: annual rows 116px before/after overflow expansion, multi-month cells 64px with final 1px border, no panel gap beyond its border, complete timeline group boundaries, today foreground contrast 11.85:1 light / 6.50:1 dark, no page overflow at 360px.
- Screenshots inspected: `output/layout-review/annual-layout-pinned.png`, `annual-layout-year.png`, and `annual-layout-period.png`.
- Final source typecheck, contract audit (zero omissions/positional contracts/single-language comments) and `git diff --check` passed.

Desktop browser checks include narrow viewports; they do not certify physical mobile devices or Safari. The new option and default visible-range change belong in a minor release rather than a patch.
