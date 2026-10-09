# Consumer event history

`useCalendarHistory` provides bounded undo/redo for a consumer-owned event array. Connect its `events` to `Calendar` and send each accepted edit through `commit`. The hook does not attach to a calendar store, observe edits automatically, or undo transactions on your server.

```tsx
import { Calendar, monthView, useCalendarHistory } from '@jacksoncassemiro/calendara';
import type { CalendarEvent } from '@jacksoncassemiro/calendara';

const views = [monthView];

function Schedule({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const history = useCalendarHistory({
    initialEvents,
    limit: 50,
    persist: async (events) => {
      const response = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(events),
      });
      if (!response.ok) throw new Error('Could not save schedule');
    },
  });

  const undo = async () => {
    try {
      await history.undo();
    } catch (error) {
      // Present the persistence error using your application UI.
      console.error(error);
    }
  };

  return <>
    <button disabled={!history.canUndo} onClick={undo}>Undo</button>
    <button disabled={!history.canRedo} onClick={() => {
      void history.redo().catch(console.error);
    }}>Redo</button>
    <Calendar views={views} events={history.events} />
  </>;
}
```

In your editor or drag handler, calculate the complete next array and `await history.commit(nextEvents)`. Only a successful persistence callback changes the displayed array and history. A rejected callback rejects the action promise and preserves the current events and both history directions; catch it in your application. Persistence receives an independent copy and the hook uses the latest callback. Omitting `persist` enables local history.

`commit`, `undo` and `redo` resolve `true` when applied and `false` when busy, unavailable, unmounted or superseded by a reload. `pending` disables both availability flags, and a synchronous lock prevents overlapping requests even before React rerenders. Committing after undo discards redo. `limit` defaults to 50 retained snapshots per direction and must be a non-negative integer; zero disables history.

`initialEvents` is read only on initialization. After loading external data, call `history.replaceEvents(loadedEvents)` to replace the current array and clear both stacks without persisting. An in-flight action cannot overwrite this replacement, but `pending` remains true until its persistence settles. The hook cannot cancel a write already sent to the server; coordinate reloads, authorization, version checks and concurrent writes in the consumer backend.

Snapshots are copied independently with `structuredClone`, preserving complete event payloads including exclusive ends, recurrence overrides, resource IDs and nested metadata. Provide `cloneSnapshot` when metadata includes functions or other values that cannot be structured-cloned. That callback must create independent copies of every mutable value. Treat the returned `events` as read-only and edit through `commit`; direct mutations are not recorded. This is session-local history: it is neither durable storage nor a collaborative/server undo protocol.
