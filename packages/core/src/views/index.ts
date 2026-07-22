export type {
  CalendarView,
  ViewContext,
  ViewRange,
  ViewRenderContext,
  EventSlotInfo,
  EventRenderSlot,
  ToolbarContext,
  ToolbarRenderSlot,
} from './viewDef.js';
export {
  weekView,
  dayView,
  createNDaysView,
  BUILTIN_TIME_GRID_VIEWS,
} from './timeGridViews.js';
export { monthView } from './MonthView.js';
export { listView, createListView } from './ListView.js';
export { createResourceDayView, createTimelineView } from './resourceViews.js';
export { TimeGrid } from './TimeGrid.js';
export { buildTimeGridVM } from './timeGridModel.js';
export { CalendarShell, type ShellProps } from './Shell.js';
export { formatDate, formatHourLabel } from './format.js';
export type {
  GridVM,
  DayColumnVM,
  EventVM,
  AllDayVM,
  HourLabelVM,
} from './viewModel.js';

import { weekView, dayView } from './timeGridViews.js';
import { monthView } from './MonthView.js';
import { listView } from './ListView.js';
import type { CalendarView } from './viewDef.js';

/** Views internas registradas por padrão no CalendarApp. */
export const BUILTIN_VIEWS: readonly CalendarView[] = [weekView, dayView, monthView, listView];
