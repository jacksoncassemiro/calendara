---
name: calendara-review
description: Audit Calendara calendar behavior, React integration or layout against its documented contracts; reproduce and fix confirmed defects with integration evidence.
---

# Calendara review

Read `AGENTS.md`, the relevant public API guide and the current scoped tasks. Resolve paths from the repository root. Work from the user's scenario, not from an assumption that every competitor feature is required.

1. Record expected behavior, reproduction and affected views. Use a small fixture containing the interaction between relevant features.
2. Trace data → occurrence expansion → availability/occupancy → layout → gesture → consumer persistence. Check interval endpoints, time zone and occurrence identity at each boundary.
3. For gestures, verify preview, commit, rejection/rollback and cancellation. Include multi-resource or recurring behavior only when it affects the defect.
4. For layout, inspect the actual browser at desktop and narrow widths; verify sticky headers, page scroll, overflow, labels and access to hidden events. Record the screenshot and what was checked.
5. Fix the shared rule or responsible component. Prefer extending an existing integration test; add a regression only when it catches a previously untested decision.
6. Run checks proportional to the change, then the required release checks before claiming release readiness. Report confirmed fixes separately from optional features and unavailable physical-device checks.

Useful cases: chained overlaps, midnight/exclusive end, resource-local closures, global/per-resource/unlimited capacity, buffers, recurring overrides, pending persistence failure and source replacement during navigation.

For competitor comparisons, cite current primary sources, separate free/premium terms and compare concrete integration tasks. Individual issues are qualitative evidence, not a ranking. Do not claim faster, smaller or easier without a matching measurement or user study.

Output: concise finding/fix/evidence, updated scoped tasks and relevant EN/PT guidance. Do not automatically commit, publish, install tools or change remote protections.
