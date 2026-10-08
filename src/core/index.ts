/**
 * ./index.js — núcleo headless.
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
	iterateCivilDates,
	splitEventSeries,
	type SplitSeriesResult,
	type CivilWindow,
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
	reassignResource,
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
	type OutsideDropTarget,
	type SnapRounding,
	type BusyInterval,
	type ResourceOccupancy,
	type OccupancyResult,
	type EvaluationInput,
	type DraftEvaluation,
	type InteractionCallbacks,
	type InteractionDeps,
} from "./interaction/index.js";

// Pure state and render derivations (no renderer dependency)
export {
	DEFAULT_OPTIONS,
	resolveHour,
	expandRange,
	occurrenceKey,
	validateCalendarOptions,
	buildDays,
	occurrenceStart,
	buildResourceColumns,
	occurrencesForResource,
	resourceConstraintSet,
	maxConcurrency,
	type GridHour,
	type CalendarOptions,
	type CalendarState,
	type DayData,
	type Segment,
	type TimedPlacement,
	type OccurrenceStart,
	type ResourceColumnData,
} from "./render/index.js";
