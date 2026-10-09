export * from './types/index.js';
export {
  importICalendar,
  exportICalendar,
  type ICalendarDiagnostic,
  type ImportICalendarInput,
  type ImportICalendarResult,
  type ExportICalendarInput,
  type ExportICalendarResult,
} from './io/ics.js';

export type { LayoutDayInput } from './geometry/geometry.js';
export type { ResourceConstraintSetInput } from './render/resourceConstraints.js';
export type {
  ResourceCapacityInput,
  OccurrencesForResourceInput,
} from './render/resourceDerive.js';
export type {
  ShiftCalendarDateInput,
  NormalizeCalendarMinuteInput,
  MinutesToDateTimeInput,
  ApplyEventTimeChangeInput,
} from './interaction/model.js';
export type { ValidateOccupancyInput } from './interaction/occupancy.js';

export {
  ensureTemporal,
  getTemporal,
  isTemporalReady,
  type TemporalLike,
} from './date/temporal.js';

export {
  createDateUtils,
  dayOfWeekToCode,
  dayOfWeekToJs,
  jsWeekdayToDayOfWeek,
  WEEKDAY_CODES,
  weekdayCodeToDayOfWeek,
  type DateUtils,
  type StartOfWeekInput,
  type DateRangeInput,
  type NthWeekdayInMonthInput,
  type ZonedDateTimeInput,
} from './date/dateUtils.js';

export type { HasAvailableTimeInput } from './constraint/constraintEngine.js';
export type {
  ComputeMoveDraftInput,
  ComputeResizeDraftInput,
  ComputeSelectDraftInput,
} from './interaction/gestureGeometry.js';
export type {
  ExpandRuleInput,
  ExpandTemporalRuleInput,
  ExpandRuleAllInput,
} from './recurrence/engine.js';
export type { SplitEventSeriesInput } from './recurrence/splitSeries.js';
export type {
  ExpandRangeInput,
  ResourceBusyIntervalsInput,
  BuildDaysInput,
} from './render/derive.js';
export type { ResourceSlotBandsInput } from './render/resourceConstraints.js';
export type { BuildResourceColumnsInput } from './render/resourceDerive.js';

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
  type ExpandEventInput,
  type IterateCivilDatesInput,
} from './recurrence/index.js';

export { ConstraintEngine, jsDayOfWeek, type Slot } from './constraint/index.js';

export { createStore, memoize, type Store, type Listener } from './store/index.js';

export {
  layoutDay,
  gridBodyHeight,
  type GeoInput,
  type GeoGrid,
  type GeoBlock,
  type GridBodyHeightInput,
} from './geometry/index.js';

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
  type SnapMinuteInput,
  type ClampSpanToGridInput,
  type ReassignResourceInput,
  type BusyInterval,
  type ResourceOccupancy,
  type OccupancyResult,
  type EvaluationInput,
  type DraftEvaluation,
  type InteractionCallbacks,
  type InteractionDeps,
} from './interaction/index.js';

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
  type OccurrenceStartInput,
  type ResourceColumnData,
} from './render/index.js';
