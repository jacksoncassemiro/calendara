import { weekView, dayView } from '../timeGridViews.js';
import { monthView } from '../MonthView.js';
import { listView } from '../ListView.js';
import type { CalendarView } from '../../viewTypes.js';

/** Standard views to pass explicitly. PT: Atalho para passar as views padrão explicitamente. */
export const BUILTIN_VIEWS: readonly CalendarView[] = [weekView, dayView, monthView, listView];
