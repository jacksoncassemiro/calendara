/**
 * React components, views and controller of @meucalendario/calendar.
 */
export { Calendar } from './Calendar.js';
export { useCalendar, type UseCalendar } from './useCalendar.js';
export { createReactView, type ReactViewConfig } from './createReactView.js';
export type { CalendarProps, CalendarHandle } from './types.js';
export { useCompactCalendar } from './useCompactCalendar.js';
export { useCalendarDraggable, beginExternalEventDrag, type ExternalEventDropHandler, type EventDropOutsideInfo } from './externalDrag.js';
export { CalendarEventEditor, type CalendarEventEditorProps, type CalendarEditorContext, type CalendarEditScope } from './CalendarEventEditor.js';

export * from './views/index.js';
export { CalendarApp, type CalendarConfig, type CalendarEventName, type EventSource, type EventSourceContext, type RangeChange } from './app/calendarApp.js';
