import { weekView, dayView } from '../timeGridViews.js';
import { monthView } from '../MonthView.js';
import { listView } from '../ListView.js';
import type { CalendarView } from '../../viewTypes.js';

/** Standard convenience set used only when the consumer omits views. */
export const BUILTIN_VIEWS: readonly CalendarView[] = [weekView, dayView, monthView, listView];
