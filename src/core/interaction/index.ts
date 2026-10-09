export {
  minutesToDateTime,
  applyEventTimeChange,
  reassignResource,
  type InteractionKind,
  type ResizeEdge,
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
  type ReassignResourceInput,
  type ShiftCalendarDateInput,
  type NormalizeCalendarMinuteInput,
  type MinutesToDateTimeInput,
  type ApplyEventTimeChangeInput,
} from './model.js';

export {
  snapMinute,
  clampSpanToGrid,
  computeMoveDraft,
  computeResizeDraft,
  computeSelectDraft,
  type SnapRounding,
  type SnapMinuteInput,
  type ClampSpanToGridInput,
} from './gestureGeometry.js';

export {
  validateOccupancy,
  type BusyInterval,
  type ResourceOccupancy,
  type OccupancyResult,
} from './occupancy.js';

export {
  InteractionEngine,
  type EvaluationInput,
  type DraftEvaluation,
  type InteractionCallbacks,
  type InteractionDeps,
} from './interactionEngine.js';
