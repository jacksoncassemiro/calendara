/**
 * @meucalendario/react — native React renderer, views and calendar controller.
 */
export { Calendar } from './Calendar.js';
export { useCalendar, type UseCalendar } from './useCalendar.js';
export { createReactView, type ReactViewConfig } from './createReactView.js';
export type { CalendarProps, CalendarHandle } from './types.js';
export { useCompactCalendar } from './useCompactCalendar.js';
export { CalendarEventEditor, type CalendarEventEditorProps, type CalendarEditorContext, type CalendarEditScope } from './CalendarEventEditor.js';

export * from './views/index.js';
export { CalendarApp, type CalendarConfig, type CalendarEventName, type EventSource, type RangeChange } from './app/calendarApp.js';
