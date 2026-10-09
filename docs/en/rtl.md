# Calendar direction

Set `options.direction` explicitly to mirror the calendar layout independently of its date-label locale. The default is `ltr`; an Arabic or Hebrew locale does not select RTL automatically.

```tsx
import { Calendar, monthView, weekView } from '@jacksoncassemiro/calendara';

const views = [monthView, weekView];

export function Schedule() {
  return <Calendar views={views} events={[]} options={{
    direction: 'rtl',
    locale: 'ar',
    timeZone: 'Asia/Riyadh',
  }} />;
}
```

The option applies `dir` to the calendar root and updates when options change. Built-in navigation keeps previous/next date semantics and mirrors its arrow symbols. Month cells, year-planner dates and timed slots follow the displayed horizontal direction when using arrow keys. Up/down retains its vertical meaning. Horizontal timelines read increasing time from the inline start edge: the right edge in RTL. Slot hit-testing uses this edge for selection, movement and resizing; vertical timed axes still increase downwards.

The bundled theme uses logical positioning for columns, event lanes and inline controls. Horizontal scrolling and pinned header copies retain the signed native scroll offset and use physical viewport rectangles for clipping. Consumer styles, custom views, custom toolbars and `renderEvent` content must also use logical properties such as `inset-inline-start`, `padding-inline` and `text-align: start`. Avoid forcing a physical `left` position on calendar elements that follow the time axis.

Direction does not translate editor text or toolbar labels into Arabic/Hebrew. The built-in editor currently provides Portuguese and English; use your own editor for additional languages. Application content may need `dir="auto"` or `<bdi>` around mixed-direction titles. Printing, every custom renderer, physical touch devices, Safari and screen-reader behavior require scenario-specific validation; setting direction alone does not certify complete RTL accessibility coverage.
