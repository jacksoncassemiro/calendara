# Calendara 0.1.1

User-approved scope: repair outgoing pointer feedback, distinguish month date/event states, keep month cards on narrow layouts by default, provide focused/resizable examples, organize legacy docs, reset main/develop and replace the 0.1.0 publication with 0.1.1.

## Contracts

- Outgoing drops keep pointer capture on the stable container and show a themed, noninteractive preview; reentry/cancel/drop cleans it up. Consumer callbacks still own removal/persistence.
- `monthCompactBreakpoint` defaults to false. Numeric positive container widths opt into the day-picker/list mode. Today uses an outline, selection uses fill, and event quantity uses a separate dot/count marker.
- Mobile +more uses existing month overflow callbacks/renderers/target-view options.
- Focused examples register only their needed views, expose code and measure their resizable host. Width presets simulate layout space, not physical devices. The event-source example is explicitly simulated; recurrence inspection links to the full scope editor.
- Public EN/PT guides remain canonical. Earlier numbered engineering records move to `docs/history`, with local links updated; preserve referenced experiments and ignored outputs.

## History/publication exception

The maintainer explicitly authorized replacing main/develop with one reviewed initial commit, withdrawing 0.1.0 and publishing 0.1.1. Preserve a verified full Git bundle, pending changes, old package/checksum and protection metadata outside the repository. Temporarily change only necessary protections, use lease-guarded atomic pushes and restore protections in a finally block. Release CI stays read-only until its isolated approval-gated draft job.

Old clones, PR refs and GitHub caches can retain earlier commits. Resetting branch ancestry is not complete data erasure. A new clone is recommended after the reset.

## Validation

- Full `yarn verify`, publication and formatting checks.
- Full browser suite, including boundary reentry/cancel and isolated feature routes.
- Inspect 320/360/460/560/768px screenshots; verify a narrow container inside a wide viewport.
- Install the public 0.1.1 archive into the independent consumer, verify checksum, build and exercise move/resize/month.
- Verify one commit on main/develop, restored branch/tag protections, public release assets and HTTPS Pages deployment.
