# Choosing a scheduler

[Português](../pt-BR/comparison.md) · Reviewed October 8, 2026

This comparison describes integration contracts, not a measured usability study. Fewer lines do not prove a better user experience.

| Task               | Calendara                                                                     | Integration consideration                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimal agenda     | One package, CSS import, React events and explicitly selected views           | FullCalendar uses a React adapter plus view plugins. Mantine fits applications already using its styles/components. RBC requires a date localizer. |
| Save a move        | Consumer callback, async rejection/rollback, immutable `applyEventTimeChange` | Every scheduler still needs application persistence. Make ownership and errors explicit rather than mixing local and remote authorities.           |
| Rooms and capacity | Resource IDs, global/per-room capacity, buffers and local availability        | Resource rendering alone does not ensure transactional capacity. Compare scheduling rules, not only screenshots.                                   |
| Own form/content   | Independent editor, `evaluateEvent`, React render slots                       | Existing libraries also support consumer rendering/callbacks; this is useful flexibility, not a unique invention.                                  |

Calendara's implemented resource views and editor are MIT, without a separate paid feature gate. It is not the only MIT option: [Mantine Schedule](https://mantine.dev/schedule/getting-started/) is MIT and documents resource components, and [React Big Calendar](https://github.com/bigcalendar/react-big-calendar/blob/master/LICENSE) is MIT.

[FullCalendar Premium](https://fullcalendar.io/docs/premium) places resource views, timelines and printer support under its premium licensing. [Schedule-X's interactive modal](https://schedule-x.dev/docs/calendar/plugins/interactive-event-modal) and [Draw plugin](https://schedule-x.dev/docs/calendar/plugins/draw) require premium licensing; evaluate the actual plugins needed rather than treating the entire product as paid.

The main Calendara advantages are a single native React contract, shared validation for gestures/forms, explicit view selection and per-resource rules. Its disadvantages are a younger implementation, fewer integrations, manual GitHub asset updates, partial recurrence coverage, a built-in editor currently limited to Portuguese/English and incomplete physical browser/accessibility validation. The MIT license does not provide a support SLA.

[FullCalendar's React guide](https://fullcalendar.io/docs/react), [Mantine setup](https://mantine.dev/schedule/getting-started/) and [RBC's README](https://github.com/bigcalendar/react-big-calendar/blob/master/README.md) show their own integration requirements. A mature library may reduce overall project effort even with a larger installation surface.

Before adopting, prototype the same four tasks with realistic room capacity, recurrence, async save failures and a narrow screen. Measure completion, recovery and readability with users. Calendara's audited ownership/initial-view contracts address known integration confusion; they do not prove superior usability without that study.

## View coverage and integration

Use `views={[dayView, monthView]}` to register only the required views and `initialView="month"` to select the first one. `BUILTIN_VIEWS` explicitly supplies week/day/month/list. The application chooses its editor, CSS and persistence; custom content, toolbars and forms do not require replacing the whole calendar. Understanding date contracts and asynchronous confirmation remains an integration cost. [Focused examples](../../examples/features.html) demonstrate these integrations.

| View/capability | Calendara status | Reference and recommendation |
| --- | --- | --- |
| Daily vertical resources | Implemented, MIT | Same category as [Vertical Resource Premium](https://fullcalendar.io/docs/premium), without claiming parity. |
| Daily horizontal resource timeline | Implemented, MIT | Also a FullCalendar premium category. [DayPilot React Scheduler](https://doc.daypilot.org/scheduler/react/) offers free Lite and Pro; timelines are not exclusively paid. |
| Resources × multiple days | Not implemented | High value for comparing rooms/teams throughout a week. First candidate, with navigation, headers, multi-day events and occupancy specified before implementation. |
| Weekly/monthly timeline and grouped resources | Not implemented | Useful for shifts/reservations; grouping and virtualization need their own contracts. Second candidate according to actual resource volume. |
| Year/quarter with multiple months | Not implemented | [FullCalendar Multi-Month](https://fullcalendar.io/docs/multimonth-grid) is a standard view; do not market year views as an advantage over paid features. Useful for leave/holidays/planning, lower priority for daily reception. |
| Daily agenda and year planner | Daily summary is a custom example; year planner absent | [Bryntum documents dayagenda, monthagenda and yearplanner](https://bryntum.com/products/calendar/docs-llm/api/Calendar/view/Calendar.md). A dedicated daily agenda can improve triage without another engine. |
| Printing/PDF | Absent | A FullCalendar premium category; output/export rather than another interactive view. Requires a dedicated print layout. |

The unimplemented capabilities are possible extensions, not current API contracts. Each requires its own scope, interaction rules and tests.

The [bundle and integration comparison](bundle-comparison.md) recommends keeping one package: optional views contribute only a small part of the current cost; shared mechanisms and the Temporal fallback dominate. Splitting packages now adds version coordination without demonstrating a significant reduction. Subpaths/lazy loading remain candidates when measurements justify them.
