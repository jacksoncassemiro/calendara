/**
 * @meucalendario/core — núcleo headless.
 * Fase 1: tipos canônicos, DateUtils (Temporal), motor de recorrência RFC 5545, ConstraintEngine.
 * Render/views/interação chegam nas Fases 2+.
 */
export * from "./types/index.js";

// Temporal (shim de compatibilidade)
export {
	ensureTemporal,
	getTemporal,
	isTemporalReady,
	type TemporalLike,
} from "./date/temporal.js";

// DateUtils
export {
	createDateUtils,
	dayOfWeekToCode,
	dayOfWeekToJs,
	jsWeekdayToDayOfWeek,
	WEEKDAY_CODES,
	weekdayCodeToDayOfWeek,
	type DateUtils,
} from "./date/dateUtils.js";

// Recorrência
export {
	expandEvent,
	expandRule,
	expandRuleAll,
	parseRRule,
	serializeRRule,
	type ExpandOptions,
	type ExpandWindow,
} from "./recurrence/index.js";

// Constraints
export {
	ConstraintEngine,
	jsDayOfWeek,
	type Slot,
} from "./constraint/index.js";

// Store observável (diff granular)
export { createStore, memoize, type Store, type Listener } from "./store/index.js";

// Geometria (layout de eventos)
export {
	layoutDay,
	gridBodyHeight,
	type GeoInput,
	type GeoGrid,
	type GeoBlock,
} from "./geometry/index.js";

// Views (time grid: Week/Day) + view model
export {
	weekView,
	dayView,
	BUILTIN_VIEWS,
	TimeGrid,
	formatDate,
	formatHourLabel,
	type TimeGridViewDef,
	type ViewContext,
	type ViewRange,
	type GridVM,
	type DayColumnVM,
	type EventVM,
	type AllDayVM,
	type HourLabelVM,
} from "./views/index.js";

// Render headless (Preact isolado) + CalendarApp
export {
	CalendarApp,
	DEFAULT_OPTIONS,
	expandRange,
	buildDays,
	type CalendarConfig,
	type CalendarEventName,
	type RangeChange,
	type CalendarOptions,
	type CalendarState,
	type DayData,
	type Segment,
	type TimedPlacement,
} from "./render/index.js";
