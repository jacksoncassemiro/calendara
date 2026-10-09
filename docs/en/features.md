# Feature guide and live scenarios

[Português](../pt-BR/features.md) · [API guide](api.md) · [Live playground](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en)

The playground is an in-memory integration example. Its controls are examples of application configuration, not required library UI. Refreshing restores the fixtures. Default views are explicitly selected; Summary is a custom demonstration view.

| Workflow                           | Public entry point                                                                    | Try it                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Week/day/custom period             | `weekView`, `dayView`, `createNDaysView`                                              | [Week](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=week): change slot duration, size and label interval independently                                                      |
| Month/multi-day events             | `monthView`, `monthMaxEvents`, `onMonthMoreClick`, `renderMonthMore`, `monthMoreView` | [Month](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=month): inspect continuous spans and choose the +more behavior                                                         |
| Agenda/mobile                      | `listView`, `createListView`, `useCompactCalendar`                                    | [Agenda](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=list): date-grouped events; compact behavior is chosen by the application                                             |
| Resources                          | `createResourceDayView`, `resources`, `resourceIds`                                   | [Rooms](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=resources&scenario=capacity): compare inherited, per-room and unlimited capacity                                       |
| Resource timeline                  | `createTimelineView`, `pxPerMinute`, `slotMinutes`                                    | [Timeline](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=timeline): time runs horizontally; room labels remain identifiable                                                  |
| Dense overlaps                     | `slotEventOverlap`, `timedEventOverflow`, `eventMaxStack`, `renderEventMore`          | [Dense events](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=day&scenario=overflow): choose side-by-side, partial overlap or +more; visual stacking does not change capacity |
| Drag/resize/persistence            | `onEventDrop`, `onEventResize`, `applyEventTimeChange`                                | Move/resize an event, then use the reject-next-save control to exercise rollback                                                                                                                      |
| Incoming/outgoing events           | `useCalendarDraggable`, `onExternalEventDrop`, `onEventDropOutside`                   | [Transfers](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=day&scenario=external-drag): drag a template in; drag an existing event to the outside drop area                   |
| Recurrence/editor                  | `recurrence`, `CalendarEventEditor`, `evaluateEvent`, `splitEventSeries`              | [Recurrence](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=day&scenario=recurrence): edit a repetition and its occurrence/series scope                                       |
| Custom view/content                | `createReactView`, `renderEvent`, `customToolbar`                                     | [Summary](https://jacksoncassemiro.me/calendara/examples/react.html?lang=en&view=summary) is application UI, not a built-in view                                                                      |
| Styling/status                     | optional theme CSS, `event.color`, `getDayStyle`                                      | Color is presentation; a custom day background does not make a day unavailable                                                                                                                        |
| Resource hierarchy and large lists | `createResourceTimelineView`, `parentId`, `hierarchy`, `virtualization`               | Configure nested resource rows and automatic vertical rendering in the [extended-view guide](extended-views.md).                                                                                      |
| Import/export                      | `importICalendar`, `exportICalendar` from `/core`                                     | Read the [ICS guide](ics.md), review diagnostics and let the application save or download the result.                                                                                                 |
| Undo/redo                          | `useCalendarHistory`                                                                  | Connect accepted edits to consumer history with optional async persistence; see [history](history.md).                                                                                                |

## Transfer ownership

Set `options.direction` for LTR/RTL layout independently of locale; see [direction and interaction coverage](rtl.md). The option does not translate the consumer editor or certify every custom renderer.

An incoming drag proposes `change.event`; the application inserts and persists it through `onExternalEventDrop`. It must have its own ID and no recurrence rule. An outgoing callback identifies the original occurrence; it does not delete automatically. For recurring events, explicitly decide whether to remove one occurrence or the entire series. Cross-document HTML DataTransfer and automatic calendar-to-calendar transfer are not supported.

```tsx
function Template({ event }: { event: CalendarEvent }) {
  const drag = useCalendarDraggable(event);
  return (
    <button {...drag} style={{ touchAction: 'none' }}>
      {event.title}
    </button>
  );
}

<Calendar
  views={views}
  events={events}
  onExternalEventDrop={async (change) => {
    await saveEvent(change.event);
    setEvents((current) => [...current, change.event]);
  }}
  onEventDropOutside={openTransferDialog}
/>;
```

Import the hook and `CalendarEvent` type from the package. `saveEvent`, state and the transfer dialog belong to the application. Offer equivalent create/edit actions for keyboard users; dragging is not the sole access path.

## Coverage and limits

Year/quarter grids, a year planner, daily agenda, multi-day resource timelines, nested resource rows, vertical timeline virtualization and browser printing are available through explicit view registration. [Extended views](extended-views.md) explains their configuration. Printing can use the browser's Save as PDF action; there is no binary PDF export API.

[Recurrence](recurrence.md) covers all seven frequencies, time filters and yearly week numbers, with explicit expansion limits. [ICS](ics.md) is a strict subset adapter with diagnostics, rather than a complete invitation/CalDAV implementation. [History](history.md) records consumer event snapshots, rather than undoing server transactions automatically. Horizontal virtualization, projection caching and physical Safari/mobile or screen-reader validation remain outside the demonstrated coverage.

Documentation starts with the first calendar, then separates integration guides, focused scenarios, generated API contracts and measured comparisons. This organization follows the practical separation in [FullCalendar's documentation](https://fullcalendar.io/docs), [Schedule-X's plugin guide](https://schedule-x.dev/docs/calendar/plugins) and [Mantine's component setup](https://mantine.dev/schedule/getting-started/); it does not imply feature parity. See [bundle measurements](bundle-comparison.md) before deciding package boundaries.

### Current limits and mitigation

| Area                  | Concrete limit                                                                                            | Mitigation / contract                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Default editor        | EN/PT text; `locale` does not accept custom translations.                                                 | Use a custom form through callbacks and `evaluateEvent`; [API](api.md).                         |
| Recurrence            | Up to 50,000 periods and 100,000 candidates per period; exceeding limits throws.                          | Reduce the range/filters; [combinations and limits](recurrence.md).                             |
| ICS                   | Input up to 5 MiB of UTF-16 code units; no VTIMEZONE, alarms, invitations or CalDAV.                      | Use another adapter for those formats; review diagnostics; [supported/rejected fields](ics.md). |
| Virtualization        | Resource timeline rows only; no horizontal window or projection cache.                                    | Enable `virtualization`, limit loaded periods/resources; [configuration](extended-views.md).    |
| History               | Default 50 snapshots per direction; session events only.                                                  | Configure `limit` and `persist`; coordinate concurrency on the server; [history](history.md).   |
| PDF                   | Browser print/Save as PDF; no binary export API.                                                          | Use `api.print` or a consumer exporter; [printing](extended-views.md).                          |
| External drag         | Same-document integration; no automatic transfer across calendars/documents.                              | Insert/remove through callbacks and provide equivalent keyboard actions.                        |
| RTL and accessibility | Configurable direction; custom components and physical mobile/Safari/screen-reader use are not certified. | Respect `dir` in renderers and validate target devices; [RTL coverage](rtl.md).                 |

These limits still apply. Extended views, hierarchy, vertical virtualization, history, ICS and basic RTL are implemented within these contracts; capabilities outside them are not guaranteed.
