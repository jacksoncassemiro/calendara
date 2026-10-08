# Feature guide and live scenarios

[Português](../pt-BR/features.md) · [API guide](api.md) · [Live playground](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en)

The playground is an in-memory integration example. Its controls are examples of application configuration, not required library UI. Refreshing restores the fixtures. Default views are explicitly selected; Summary is a custom demonstration view.

| Workflow                 | Public entry point                                                                    | Try it                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Week/day/custom period   | `weekView`, `dayView`, `createNDaysView`                                              | [Week](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=week): change slot duration, size and label interval independently                                                      |
| Month/multi-day events   | `monthView`, `monthMaxEvents`, `onMonthMoreClick`, `renderMonthMore`, `monthMoreView` | [Month](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=month): inspect continuous spans and choose the +more behavior                                                         |
| Agenda/mobile            | `listView`, `createListView`, `useCompactCalendar`                                    | [Agenda](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=list): date-grouped events; compact behavior is chosen by the application                                             |
| Resources                | `createResourceDayView`, `resources`, `resourceIds`                                   | [Rooms](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=resources&scenario=capacity): compare inherited, per-room and unlimited capacity                                       |
| Resource timeline        | `createTimelineView`, `pxPerMinute`, `slotMinutes`                                    | [Timeline](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=timeline): time runs horizontally; room labels remain identifiable                                                  |
| Dense overlaps           | `slotEventOverlap`, `timedEventOverflow`, `eventMaxStack`, `renderEventMore`          | [Dense events](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=day&scenario=overflow): choose side-by-side, partial overlap or +more; visual stacking does not change capacity |
| Drag/resize/persistence  | `onEventDrop`, `onEventResize`, `applyEventTimeChange`                                | Move/resize an event, then use the reject-next-save control to exercise rollback                                                                                                                             |
| Incoming/outgoing events | `useCalendarDraggable`, `onExternalEventDrop`, `onEventDropOutside`                   | [Transfers](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=day&scenario=external-drag): drag a template in; drag an existing event to the outside drop area                   |
| Recurrence/editor        | `recurrence`, `CalendarEventEditor`, `evaluateEvent`, `splitEventSeries`              | [Recurrence](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=day&scenario=recurrence): edit a repetition and its occurrence/series scope                                       |
| Custom view/content      | `createReactView`, `renderEvent`, `customToolbar`                                     | [Summary](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=en&view=summary) is application UI, not a built-in view                                                                      |
| Styling/status           | optional theme CSS, `event.color`, `getDayStyle`                                      | Color is presentation; a custom day background does not make a day unavailable                                                                                                                               |

## Transfer ownership

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

## What is not included

There is no year/quarter grid, multi-day resource timeline, grouped resource tree, virtualization, print/PDF view, ICS import/export, undo/redo or complete RTL. Full RFC 5545 coverage and physical Safari/mobile validation are not claimed. Adding a new view should solve a specific task, not only copy a competitor menu.

For operational scheduling, grouped rooms and a multi-day resource timeline would be useful next views. A year view helps leave planning; printing helps paper workflows. [FullCalendar Premium](https://fullcalendar.io/docs/premium) documents resource timelines and print support; [Schedule-X plugins](https://schedule-x.dev/docs/calendar/plugins) organize extensions separately. These are prioritization references, not parity claims. Mantine exposes [standalone schedule components](https://mantine.dev/schedule/getting-started/), while [React Big Calendar](https://github.com/bigcalendar/react-big-calendar#readme) separates examples/localizers/addons.

Our navigation follows that practical separation: first calendar, integration workflows, live scenarios, generated API contracts, measured comparison and explicit limitations. See [bundle measurements](bundle-comparison.md) before deciding package boundaries.
