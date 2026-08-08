/**
 * Interação (Fase 4): drag & drop + resize + seleção. Núcleo puro (geometria/ocupação) +
 * InteractionEngine (Pointer Events, preview → commit → revert).
 */
export {
	minutesToDateTime,
	applyEventTimeChange,
	reassignResource,
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
} from './model.js';

export {
	snapMinute,
	clampSpanToGrid,
	computeMoveDraft,
	computeResizeDraft,
	computeSelectDraft,
	type SnapRounding,
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
