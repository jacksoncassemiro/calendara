# API guide

[Português](../pt-BR/api.md) · [Documentation](README.md)

## Views and navigation

```tsx
import {
  Calendar,
  dayView,
  monthView,
  createResourceDayView,
  createTimelineView,
  useCalendar,
} from '@jacksoncassemiro/calendara';

const views = [dayView, monthView, createResourceDayView(), createTimelineView()];

function Agenda() {
  const { ref, api } = useCalendar();
  return (
    <>
      <button onClick={() => api.today()}>Today</button>
      <Calendar
        apiRef={ref}
        views={views}
        initialView="resources"
        initialDate="2026-10-08"
        options={{ timeZone: 'America/Sao_Paulo' }}
      />
    </>
  );
}
```

Keep definitions outside render or memoize them. `views` is required and defines the complete set; names must be unique and the list cannot be empty. Pass `BUILTIN_VIEWS` for week/day/month/list, or import only the definitions you need. `createNDaysView(3)` adds a three-day view. `createReactView` builds a view from a React component, range and navigation functions.

`initialView`/`initialDate` only configure mount. `view`/`date` request navigation when their value changes; they are not strictly controlled state. Toolbar navigation persists through rerenders with the same value. Observe `onViewChange`, `onDateChange`, `onRangeChange`, or query `api.getState()`. The initial date defaults to today in the configured time zone.

## Events and persistence

Events require `id`, `calendarId`, `title` and `time`. Timed boundaries contain local ISO `dateTime` plus an IANA `timeZone`; all-day boundaries contain ISO `date`. End dates are exclusive: one all-day event on October 8 ends on October 9.

```tsx
import { useState } from 'react';
import { Calendar, applyEventTimeChange, type EventChange } from '@jacksoncassemiro/calendara';

function Agenda() {
  const [events, setEvents] = useState(initialEvents);

  async function commit(change: EventChange) {
    await persistChange(change);
    setEvents((current) => applyEventTimeChange(current, change));
  }

  return <Calendar views={views} events={events} onEventDrop={commit} onEventResize={commit} />;
}
```

`initialEvents` and `persistChange` belong to your application. Gestures are optimistic; returning `false` or rejecting the promise reverts the internal candidate. `applyEventTimeChange` updates immutable state and records an occurrence override for recurring events. Persist that result or implement equivalent server behavior. Do not mutate prop collections. The library does not store data on a server.

For remote data, use a stable source:

```tsx
<Calendar
  views={views}
  eventSource={async ({ start, end }, { signal }) => {
    const response = await fetch(`/api/events?start=${start}&end=${end}`, { signal });
    if (!response.ok) throw new Error('Event fetch failed');
    return response.json();
  }}
  onError={handleError}
  onLoadingChange={setLoading}
/>
```

The visible range endpoints are inclusive. Navigation/source changes/unmount cancel stale requests; pass `signal` to your HTTP client. Stale results are discarded even if the source ignores it. Prefer either React `events` or `eventSource` as the authority: source results replace loaded events. After a remote edit, persist and call `api.refetch()`. Handle loading/error in your application.

## Resources and availability

```tsx
import type { CalendarResource, ConstraintSet } from '@jacksoncassemiro/calendara';

const resources: CalendarResource[] = [
  { id: 'triage', title: 'Triage' },
  { id: 'consultation', title: 'Consultation', capacity: 1, bufferAfter: 15 },
  { id: 'collection', title: 'Collection', capacity: false },
];
const constraints: ConstraintSet = {
  businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
  blocked: [{ scope: 'day', date: '2026-10-12', description: 'Closed' }],
};

<Calendar
  views={views}
  resources={resources}
  constraints={constraints}
  options={{ defaultResourceCapacity: 3 }}
/>;
```

Assign `event.resourceIds` to reserve rooms/equipment/professionals together. Missing resource capacity inherits the global default (1 if omitted); `false` means unlimited. Numeric local capacity overrides the default. Buffers are minutes before/after occupancy. Resource `constraints` add local rules: availability intersects global availability, blocks are combined. Legacy resource `businessHours` also participates in this composition. All assigned resources are evaluated. Server transactions must enforce final capacity during concurrent writes.

## Your form and content

`Calendar` does not mount or open `CalendarEventEditor`. Open your own modal/drawer/route through `onEventClick`, `onDateSelect`, or your application. Validate with `api.evaluateEvent(draft, originalOccurrence?)`; pass the original occurrence on edits to exclude its reservation. Validation checks the candidate's whole interval/resources, not all future repetitions, and throws before the engine is ready. Persist, update state, then close your form.

The optional editor accepts `event`, `occurrence`, `resources`, `timeZone`, `locale`, `validate`, `onSave`, `onDelete` and `onCancel`. Set `key={occurrenceKey(occurrence)}` when switching edited occurrences. Callbacks choose persistence and recurrence scope. Set `locale="en-US"` or `locale="pt-BR"` for the built-in editor; its default is Portuguese. Custom forms own their translations.

`renderEvent={info => <YourEvent {...info} />}` replaces card content while preserving its geometry. Hooks belong inside `YourEvent`, not directly in the render callback. `customToolbar` replaces navigation content. `renderMonthMore`/`renderEventMore` customize overflow; corresponding click callbacks can return `false` to open your own component. `monthMoreView`/`eventMoreView` can target another registered view.

## Interaction and layout

```tsx
<Calendar
  views={views}
  options={{
    slotMinutes: 30,
    pxPerMinute: 2,
    timeLabelInterval: 60,
    timedEventOverflow: 'more',
    eventMaxStack: 3,
    slotEventOverlap: false,
    monthMaxEvents: 3,
    monthCompactBreakpoint: 480,
  }}
/>
```

`slotMinutes` controls cells and snapping; `pxPerMinute` controls the time scale; `timeLabelInterval` only controls labels. An explicit interval is preserved even at dense scales. Automatic labels adapt when omitted. Timed overflow accepts `shrink`, `scroll` or `more`; horizontal timeline stacks rows. `slotEventOverlap` enables partial overlap in vertical grids. `allowEventTypeChange` optionally converts timed/all-day events across their strips. Check typed `CalendarOptions` for all defaults.

The page owns vertical scrolling; wide grids may scroll horizontally. Compact month offers a selected-day list. Toolbar and keyboard slot activation support narrow layouts; use a form/action alternative for moving/resizing by keyboard or touch. Do not assume touch has been physically validated.

For external cards use `useCalendarDraggable(event)` on a pointer source; provide `onExternalEventDrop` to insert/persist its validated candidate. `onEventDropOutside` enables outgoing callbacks and does not remove automatically. IDs must be unique. Incoming templates must be nonrecurring; materialize a selected occurrence yourself. Escape cancels. Cross-document HTML DataTransfer and automatic calendar-to-calendar transfer are not provided.

## Recurrence

Month keeps event cards and +more at every width by default (`monthCompactBreakpoint: false`). Opt into a selected-day list with a container threshold such as 480 CSS pixels; the window width does not trigger this switch. The toolbar has a separate 640px container breakpoint. Touch target and editor media queries can still depend on the viewport/input device.

```ts
recurrence: {
  rule: { freq: 'WEEKLY', byDay: [{ weekday: 'MO' }, { weekday: 'WE' }], count: 12 },
  exDates: ['2026-10-12T09:00:00'],
}
```

All seven frequencies are supported: SECONDLY/MINUTELY/HOURLY/DAILY/WEEKLY/MONTHLY/YEARLY. Public rule parts include INTERVAL, COUNT, UNTIL, BYMONTH, BYWEEKNO, BYYEARDAY, BYMONTHDAY, BYDAY, BYHOUR, BYMINUTE, BYSECOND, BYSETPOS and WKST. Intraday frequencies require timed events; BYWEEKNO requires YEARLY, while BYYEARDAY supports YEARLY and intraday frequencies. COUNT and UNTIL are mutually exclusive. `rDates` adds occurrences; `exDates` excludes them; overrides are keyed by `originalStart`. A date-only exclusion removes a day; a datetime exclusion targets its exact original start. The civil iterators generate local candidates; injected Temporal handles zones and event composition. Native Temporal takes priority, with a lazy `temporal-polyfill` fallback. Nonexistent recurring local times are skipped before BYSETPOS and COUNT. See [recurrence](recurrence.md) for supported combinations, work limits and explicit RFC limitations.

`splitEventSeries` supports this-and-following from an active RRULE occurrence. RDATE-only cuts, incompatible filters, timezone changes and all-day/timed conversions are rejected. Persist the two masters atomically and define a validation window for infinite series. Expanding an unbounded rule directly requires a finite window.

## Theme

### API-driven day status and headers

Use consumer state to map date/resource IDs to statuses. `getDayStyle` applies colors to the day header and body; `renderDayHeader` receives `dateISO`, `viewName`, optional `resourceId`, `isToday`, optional `isSelected`, and `defaultContent`. Preserve `defaultContent` when adding a caption or icon to retain the standard date controls. Keep hooks inside a returned component.

```tsx
<Calendar
  views={[weekView]}
  events={events}
  getDayStyle={({ dateISO }) =>
    statuses[dateISO]
      ? {
          backgroundColor: `var(--status-${statuses[dateISO]}-bg)`,
          color: `var(--status-${statuses[dateISO]}-fg)`,
          '--mc-color-muted': `var(--status-${statuses[dateISO]}-fg)`,
          '--mc-color-btn-active-bg': `var(--status-${statuses[dateISO]}-fg)`,
        }
      : undefined
  }
  renderDayHeader={({ dateISO, defaultContent }) => (
    <>
      {defaultContent}
      {statuses[dateISO] && <small>{statusLabels[statuses[dateISO]]}</small>}
    </>
  )}
/>
```

Update `statuses` from an API response using application state; the library neither fetches nor classifies these values. Define light/dark foreground and background tokens with readable contrast. A “full” or “unavailable” decoration is visual: use `constraints` or resource capacity for actual scheduling restrictions. The [focused example](../../examples/features.html?demo=day-style) simulates an asynchronous response.

Touch swipes preserve native scrolling; hold approximately 450 ms before dragging an event or selecting an interval. Overflowing time grids/resource timelines provide a synchronized top horizontal scrollbar. Month cards remain the default on narrow containers; optional indicators use `monthCompactBreakpoint`, measured from the calendar container.

Import the library CSS; the playground CSS is separate. Override tokens after import:

```css
[data-mc-root] {
  --mc-color-event-bg: #eaf4e7;
  --mc-color-event-fg: #244d20;
  --mc-color-now: #b45309;
  --mc-font-family: system-ui, sans-serif;
}
```

`event.color` sets the event accent, not availability. `getDayStyle` decorates a day without blocking it; use constraints for restrictions. Avoid geometric overrides in card/day decorations. `options` replaces declarative values over defaults; removing a field restores its default. Imperative `setOptions` applies a patch.

## Named utility inputs

Core utilities support named inputs when several values form one operation:

```ts
import { expandRange } from '@jacksoncassemiro/calendara/core';

const occurrences = expandRange({
  temporal,
  events,
  startISO: '2026-10-01',
  endISO: '2026-10-31',
  displayTimeZone: 'America/Sao_Paulo',
});
```

Use the named-input form for these operations; positional overloads are removed. Unary conversions and binary comparisons keep their usual signatures. Custom views navigate with `navigate({ direction, date, context })`.

## Features and limits

React/React DOM 18 and 19 are declared peers; current runtime tests use React 19, with React 18 type checks. SSR emits the initial container. [Extended views](extended-views.md) provides resource hierarchy, vertical timeline virtualization and browser printing. [ICS](ics.md) provides strict subset import/export, [history](history.md) provides consumer undo/redo and [direction](rtl.md) documents RTL layout and interaction. [Recurrence](recurrence.md) supports all seven frequencies with explicit work/semantic limits; complete iCalendar scheduling, horizontal virtualization and binary PDF export are outside the contract. Additional editor hooks/slots in specifications remain proposals. Automated browser checks use Edge; physical mobile/Safari and screen-reader validation remain pending. Consult release notes and implementation specs for version-specific evidence.
