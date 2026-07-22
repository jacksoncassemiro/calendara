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
