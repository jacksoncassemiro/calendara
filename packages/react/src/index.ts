/**
 * @meucalendario/react — adapter React fino sobre o core headless.
 * Fase 5: <Calendar/> (instância única + sync de props), useCalendar (API imperativa),
 * createReactView (view com corpo em React) e a ponte ReactIsland.
 */
export { Calendar } from './Calendar.js';
export { useCalendar, type UseCalendar } from './useCalendar.js';
export { createReactView, type ReactViewConfig } from './createReactView.js';
export { ReactIsland, type ReactIslandProps } from './ReactIsland.js';
export type { CalendarProps, CalendarHandle } from './types.js';
