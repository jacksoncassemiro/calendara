/**
 * Modelo de dados da interação (Fase 4). Puro — sem DOM, sem Preact.
 *
 * Um gesto do ponteiro (mover/redimensionar/selecionar) é descrito por posições em
 * **minutos-do-dia** + a data 'YYYY-MM-DD' da coluna sob o cursor. A geometria calcula um
 * "rascunho" (`InteractionDraft`) que a UI desenha como fantasma; ao soltar, o rascunho vira uma
 * mudança concreta (`EventChange`/`SelectionChange`) que o app consumidor persiste.
 */
import type { CalendarEvent, EventOccurrence } from '../types/event.js';

/** Tipo de gesto em andamento. */
export type InteractionKind = 'move' | 'resize' | 'select';

/**
 * Motivo da (in)validade de um rascunho. Superconjunto de `SlotEvaluation.reason`
 * (ConstraintEngine) + os motivos de ocupação de recurso (lotação/buffer) que a validação
 * DURA da Fase 4 acrescenta. Ficam aqui (e não no contrato do ConstraintEngine) porque são
 * derivados de recursos, não de constraints puros de calendário.
 */
export type DraftReason =
	| 'ok'
	| 'blocked'
	| 'outside-business-hours'
	| 'outside-allowed'
	| 'over-capacity'
	| 'buffer-conflict';

/** Ponto do cursor projetado numa coluna: data do dia + minuto-do-dia. */
export interface PointerSlot {
	dateISO: string;
	minuteOfDay: number;
}

/** Limites verticais do grid, em minutos-do-dia (startHour*60 .. endHour*60). */
export interface GridBounds {
	startMin: number;
	endMin: number;
}

/** Colocação atual de um evento timed numa coluna (origem de um move/resize). */
export interface PlacementInfo {
	/** Chave estável do bloco (`${masterId}@${originalStart}`). */
	eventId: string;
	dateISO: string;
	startMin: number;
	endMin: number;
	occurrence: EventOccurrence;
	/** `event.editable !== false`. */
	editable: boolean;
}

/** Geometria de um rascunho (posição tentativa em minutos-do-dia). */
export interface DraftGeometry {
	dateISO: string;
	startMin: number;
	endMin: number;
}

/** Rascunho vivo do gesto — desenhado como fantasma e reavaliado a cada movimento. */
export interface InteractionDraft extends DraftGeometry {
	kind: InteractionKind;
	/** Slot válido segundo o ConstraintEngine + ocupação de recurso (drop/click permitido). */
	valid: boolean;
	/** Motivo da (in)validade. */
	reason: DraftReason;
	/** Evento sendo movido/redimensionado (ausente em seleção). */
	eventId?: string;
}

/** Mudança concreta de um evento (mover ou redimensionar) entregue ao consumidor. */
export interface EventChange {
	kind: 'move' | 'resize';
	occurrence: EventOccurrence;
	event: CalendarEvent;
	dateISO: string;
	startMin: number;
	endMin: number;
	/** Novo início como wall-clock ISO na timezone de exibição ('YYYY-MM-DDTHH:mm:00'). */
	startDateTime: string;
	/** Novo fim como wall-clock ISO na timezone de exibição. */
	endDateTime: string;
}

/** Seleção de intervalo num dia (drag em área vazia). */
export interface SelectionChange {
	dateISO: string;
	startMin: number;
	endMin: number;
}

/** Payload de drop/click barrado pelo ConstraintEngine. */
export interface BlockedInfo {
	kind: InteractionKind;
	dateISO: string;
	startMin: number;
	endMin: number;
	reason: DraftReason;
	/** Presente quando o gesto barrado envolvia um evento (move/resize). */
	occurrence?: EventOccurrence;
}

/** Retorno permitido dos callbacks de commit: `false`/rejeição ⇒ reverter. */
export type CommitResult = void | boolean | Promise<void | boolean>;

/** Formata data + minuto-do-dia como wall-clock ISO 'YYYY-MM-DDTHH:mm:00'. */
export function minutesToDateTime(dateISO: string, minuteOfDay: number): string {
	const clampedMinute = Math.max(0, Math.min(minuteOfDay, 24 * 60 - 1));
	const hours = Math.floor(clampedMinute / 60);
	const minutes = clampedMinute % 60;
	const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);
	return `${dateISO}T${pad(hours)}:${pad(minutes)}:00`;
}

/**
 * Aplica (otimisticamente) uma mudança de horário a um evento NÃO recorrente do store.
 * Recorrentes não são mutados aqui (exigiriam override) — o consumidor decide via callback.
 * Preserva `timeZone`/`allDay`; troca apenas o wall-clock (`dateTime`).
 */
export function applyEventTimeChange(
	events: readonly CalendarEvent[],
	change: EventChange,
): CalendarEvent[] {
	const masterId = change.occurrence.masterId;
	return events.map((event) => {
		const isTargetMaster = event.id === masterId && event.recurrence === undefined;
		if (!isTargetMaster) return event;
		const isTimedEvent = event.time.allDay === false;
		if (!isTimedEvent) return event;
		return {
			...event,
			time: {
				...event.time,
				start: { ...event.time.start, dateTime: change.startDateTime },
				end: { ...event.time.end, dateTime: change.endDateTime },
			},
		};
	});
}
