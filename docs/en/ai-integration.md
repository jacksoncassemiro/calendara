# Integrating Calendara with an AI assistant

[Português](../pt-BR/ai-integration.md) · [Documentation](README.md)

Use this guide when generating application code that consumes Calendara. Repository maintenance instructions live in `AGENTS.md`; they are not application integration requirements.

## Establish the API first

- Check the installed package version and its exported TypeScript declarations. Website documentation may describe changes newer than your installation.
- Follow the [installation guide](getting-started.md). Distribution uses versioned GitHub Release archives; do not invent an npm registry installation or an unpublished release URL.
- Consult the [API guide](api.md), [generated contract reference](https://jacksoncassemiro.me/calendara/docs/en/api-reference.md) and [feature guide](features.md). The contract reference is generated from source types and JSDoc.
- Import from `@jacksoncassemiro/calendara`, its `/core` export or `/styles.css`; avoid private source paths. The optional stylesheet is separate from documentation-site styling.

## Preserve the integration contracts

- Pass a nonempty `views` array with unique names. Keep view definitions stable, outside the component or memoized. Register only the views your application needs.
- `initialView` and `initialDate` configure mounting. `view` and `date` request navigation when their values change; they are not strictly controlled state. Observe navigation callbacks or the calendar handle.
- Events need `id`, `calendarId`, `title` and `time`. Timed boundaries use local ISO `dateTime` plus an IANA `timeZone`; all-day boundaries use ISO `date`. Ends are exclusive. Preserve the entire duration and original recurring occurrence identity when editing.
- The application owns persistence. Returning `false` or rejecting an async gesture callback rolls back its candidate. Persist before updating authoritative application state; handle loading and errors. Forward event-source cancellation signals and load the complete visible range.
- Resource capacity, business-hour restrictions, visual overlap and buffers are separate rules. Validate every assigned resource; the backend must enforce concurrent writes. Coloring a day does not block scheduling.
- Put hooks in React components or hooks, never directly inside `renderEvent` callbacks. Return a component from the callback when custom content needs hooks.
- Let `locale` format dates and numbers. Supply the grouped translation dictionary for interface wording; dynamic messages accept values through functions. See the API guide for supported keys.
- Responsiveness follows the calendar container. Test a narrow container inside a wide page as well as small viewports. Automatic edge scrolling is enabled by default; ordinary touch swipes remain native scrolling before a drag starts.
- Month, year and quarter panels use six weeks by default. `options.monthFixedWeeks: false` permits four to six weeks. Fetch adjacent dates included in the visible range.
- Read [extended-view limits](extended-views.md), [recurrence](recurrence.md) and [ICS support](ics.md) before promising unsupported behavior. Do not assume that every view supports dragging or every ICS property round-trips.

## Minimal stateful example

This example keeps data in memory. Replace its commit function with your application's persistence before using it with remote data.

```tsx
import { useState } from 'react';
import {
  Calendar,
  applyEventTimeChange,
  monthView,
  weekView,
  type CalendarEvent,
  type EventChange,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [weekView, monthView];
const initialEvents: CalendarEvent[] = [
  {
    id: 'appointment-1',
    calendarId: 'appointments',
    title: 'Appointment',
    time: {
      allDay: false,
      start: { dateTime: '2026-10-09T09:00:00', timeZone: 'America/Sao_Paulo' },
      end: { dateTime: '2026-10-09T10:00:00', timeZone: 'America/Sao_Paulo' },
    },
  },
];

export function Schedule() {
  const [events, setEvents] = useState(initialEvents);
  function commit(change: EventChange) {
    setEvents((current) => applyEventTimeChange({ events: current, change }));
    return true;
  }
  return (
    <Calendar
      views={views}
      events={events}
      initialDate="2026-10-09"
      options={{ timeZone: 'America/Sao_Paulo' }}
      onEventDrop={commit}
      onEventResize={commit}
    />
  );
}
```

Validate generated code with the installed types and a production build. Exercise navigation, a rejected edit, time-zone boundaries and the narrow-container layout relevant to your application.
