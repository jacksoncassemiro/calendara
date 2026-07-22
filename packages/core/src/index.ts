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

// Views (Week/Day/NDays/Month/List) + shell + view model
export {
	weekView,
	dayView,
	monthView,
	listView,
	createNDaysView,
	createListView,
	createResourceDayView,
	createTimelineView,
	BUILTIN_VIEWS,
	BUILTIN_TIME_GRID_VIEWS,
	TimeGrid,
	CalendarShell,
	buildTimeGridVM,
	formatDate,
	formatHourLabel,
	type CalendarView,
	type ViewContext,
	type ViewRange,
	type ViewRenderContext,
	type EventSlotInfo,
	type EventRenderSlot,
	type ToolbarContext,
	type ToolbarRenderSlot,
	type ShellProps,
	type GridVM,
	type DayColumnVM,
	type EventVM,
	type AllDayVM,
	type HourLabelVM,
	type DraftVM,
} from "./views/index.js";

// Interação (Fase 4): drag & drop + resize + seleção
export {
	InteractionEngine,
	snapMinute,
	clampSpanToGrid,
	computeMoveDraft,
	computeResizeDraft,
	computeSelectDraft,
	validateOccupancy,
	applyEventTimeChange,
	minutesToDateTime,
	type InteractionKind,
	type DraftReason,
	type PointerSlot,
	type GridBounds,
	type PlacementInfo,
	type DraftGeometry,
	type InteractionDraft,
	type EventChange,
	type SelectionChange,
	type BlockedInfo,
	type CommitResult,
	type SnapRounding,
	type BusyInterval,
	type ResourceOccupancy,
	type OccupancyResult,
	type EvaluationInput,
	type DraftEvaluation,
	type InteractionCallbacks,
	type InteractionDeps,
} from "./interaction/index.js";

// Render headless (Preact isolado) + CalendarApp
export {
	CalendarApp,
	DEFAULT_OPTIONS,
	resolveHour,
	expandRange,
	buildDays,
	occurrenceStart,
	buildResourceColumns,
	occurrencesForResource,
	resourceConstraintSet,
	maxConcurrency,
	type CalendarConfig,
	type CalendarEventName,
	type EventSource,
	type RangeChange,
	type GridHour,
	type CalendarOptions,
	type CalendarState,
	type DayData,
	type Segment,
	type TimedPlacement,
	type OccurrenceStart,
	type ResourceColumnData,
} from "./render/index.js";
