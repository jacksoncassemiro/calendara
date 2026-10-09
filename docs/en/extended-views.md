# Extended views

[Português](../pt-BR/extended-views.md)

Register each view explicitly. The extra views do not change `BUILTIN_VIEWS`, which remains the week/day/month/list shortcut.

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
  groupBy: (resource) => (resource.id.startsWith('room') ? 'Rooms' : 'Teams'),
  collapsedGroups: ['Teams'],
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

Timeline `dayWidth` is measured in pixels and must be at least 180; defaults are 720 for week/day and 480 for month. Each dated track keeps a 64 px all-day gutter and a visible time axis. `resourceWindow: { start, count }` selects an explicit slice **after** resource filtering/order. It bounds rendered rows but does not track scroll position or provide automatic virtualization. Grouping is one level, not a nested resource tree. Timelines display dated tracks rather than a single continuous multi-day bar.

The month panels reuse the month overflow action, custom content and date styles. View names must be unique in the registry. Consumers still own persistence, recurrence editing and server-side availability enforcement.

## Printing

Call `api.print({ title: 'Schedule', orientation: 'landscape' })` from an explicit user action. It opens a print layout and the browser's printing flow. Choose **Save as PDF** when the browser supports it. This does not generate or download PDF bytes through an export API.

[Focused examples](../../examples/features.html) cover resource weeks, grouped timelines, year/quarter, planner and daily agenda. The general playground registers the extra views explicitly for exploration.
