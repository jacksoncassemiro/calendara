# Extended views

[Português](../pt-BR/extended-views.md)

Register each view explicitly. The extra views do not change `BUILTIN_VIEWS`, which remains the week/day/month/list shortcut.

Month, year and quarter panels show six weeks by default. Set `options={{ monthFixedWeeks: false }}` for four to six weeks according to the month. Load the complete reported visible range, including adjacent-month dates. Annual planner rows keep a uniform height and a synchronized top scrollbar; their day width can be styled with `--mc-year-day-width` (default 120px).

```tsx
import {
  Calendar,
  createResourceView,
  createResourceTimelineView,
  yearView,
  quarterView,
  yearPlannerView,
  dayAgendaView,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const resources = [
  { id: 'building-a', title: 'Building A' },
  { id: 'room-a', title: 'Room A', parentId: 'building-a', capacity: 1 },
  { id: 'team-b', title: 'Team B' },
];

const resourceWeek = createResourceView({
  name: 'resource-week',
  days: 7,
  alignment: 'week',
  groupBy: 'resource',
});
const timelineMonth = createResourceTimelineView({
  name: 'timeline-month',
  duration: 'month',
  dayWidth: 240,
  groupBy: (resource) => (resource.id.startsWith('team') ? 'Teams' : 'Rooms'),
  collapsedGroups: ['Teams'],
  hierarchy: true,
  collapsedResourceIds: ['building-a'],
  virtualization: { height: 320, overscan: 4 },
});

<Calendar
  views={[resourceWeek, timelineMonth, yearView, quarterView, yearPlannerView, dayAgendaView]}
  initialView="resource-week"
  resources={resources}
  events={events}
/>;
```

| View               | Configuration and limits                                                                                                                              |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vertical resources | `createResourceView({ days, alignment, groupBy })`: date/resource outer grouping; availability and capacity remain per resource.                      |
| Resource timeline  | `duration: 'day' \| 'week' \| 'month'`, dated daily tracks, collapsible consumer-defined groups; full occurrences preserve identity across fragments. |
| Multiple months    | `createMultiMonthView({ months, alignment })`: 1–24 month panels; `yearView` and `quarterView` are ready-made choices.                                |
| Year planner       | Months as rows, dates as columns, event indicators and callbacks; no drag or resize in this overview.                                                 |
| Daily agenda       | Chronological event cards and resource information; use the consumer editor for changes.                                                              |

Timeline `dayWidth` is measured in pixels and must be at least 180; defaults are 720 for week/day and 480 for month. Each dated track keeps a 64 px all-day gutter and a visible time axis. Timelines display dated tracks rather than a single continuous multi-day bar.

With `hierarchy: true`, resource `parentId` values form nested rows; `collapsedResourceIds` sets initially collapsed parents. Clicking a parent toggles its descendants. Parents retain their own scheduling rules: children do not inherit parent capacity, buffers or occupancy. Cycles throw; a resource whose parent is absent is treated as a root. Consumer `groupBy` remains a separate one-level grouping mechanism; keep parents and descendants in the same group because hierarchy is resolved inside each group.

`virtualization: { height, overscan }` enables automatic vertical resource-row rendering in a bounded scroll area. `height` is in pixels, at least 120; `overscan` is a nonnegative integer and defaults to four extra rows per edge. Logical spacer height represents all visible logical rows, including rows outside the DOM. Resource title buttons support ArrowUp/ArrowDown navigation across the rendered window. Collapsing a parent changes the logical rows rather than deleting resources from scheduling validation.

The browser fixture with 500 resources, a 320 px scroll area and overscan 2 mounted at most 20 resource rows and retained a 22,103 px scroll height. Capacity validation still rejected an overlapping candidate on the offscreen last resource; scrolling revealed its event, and ArrowUp from its resource title focused the preceding title. This demonstrates bounded rendering and preserved validation in that desktop fixture; it is not a CPU, frame-rate, physical mobile or screen-reader benchmark. See [virtualization evidence and limits](../../specs/extended-views/virtualization.md).

Date/time columns are not virtualized, and daily projection/recurrence work is not cached by this option. Browser find-in-page and DOM queries see mounted rows only. `resourceWindow: { start, count }` remains a separate manual slice **after** resource filtering/order; it restricts the logical input and does not follow scrolling. Remove it when the intended scroll area must cover every resource. Printing derives events from the full requested date range independently of mounted timeline rows.

The month panels reuse the month overflow action, custom content and date styles. View names must be unique in the registry. Consumers still own persistence, recurrence editing and server-side availability enforcement.

Use the [recurrence guide](recurrence.md) for expansion limits, [consumer history](history.md) for undo/redo and [ICS](ics.md) for file interchange; these integration contracts apply independently of the selected view.

## Annual date width

For mirrored layout, configure `options.direction` and follow the [RTL guide](rtl.md), including logical properties in consumer styles and custom content.

The optional theme gives annual-planner dates approximately 120 px each and scrolls horizontally. Event titles stay on one line with ellipsis; their full title remains available through the accessible name and tooltip. Override the width per calendar, for example `[data-mc-root] { --mc-year-day-width: 160px; }`, when longer titles need more space. This setting applies to the year planner, independently of timeline `dayWidth`.

## Printing

Call `api.print({ title: 'Schedule', orientation: 'landscape' })` from an explicit user action. It opens a print layout and the browser's printing flow. Choose **Save as PDF** when the browser supports it. This does not generate or download PDF bytes through an export API.

[Focused examples](../../examples/features.html) cover resource weeks, grouped timelines, year/quarter, planner and daily agenda. The general playground registers the extra views explicitly for exploration.
