/**
 * Modelo de dados da interação (Fase 4). Puro — sem DOM, sem Preact.
 *
 * Um gesto do ponteiro (mover/redimensionar/selecionar) é descrito por posições em
 * **minutos-do-dia** + a data 'YYYY-MM-DD' da coluna sob o cursor. A geometria calcula um
 * "rascunho" (`InteractionDraft`) que a UI desenha como fantasma; ao soltar, o rascunho vira uma
 * mudança concreta (`EventChange`/`SelectionChange`) que o app consumidor persiste.
 *
 * DIMENSÃO DE RECURSO (Multiagenda/Timeline): `resourceId` é SEMPRE opcional e ADITIVO — ausente
 * nas views de data (Semana/Dia/NDias), onde a única dimensão transversal ao tempo é a data.
 * Nunca se codifica recurso dentro de `dateISO`: essa data é uma data de calendário DE VERDADE,
 * consumida pelo ConstraintEngine (expediente/bloqueios por dia).
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
	allDay?: boolean;
	/** Recurso da coluna/linha sob o cursor (só views de recurso). */
	resourceId?: string;
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
	endDateISO?: string;
	allDay?: boolean;
	durationMinutes?: number;
	occurrence: EventOccurrence;
	/** `event.editable !== false`. */
	editable: boolean;
	/**
	 * Recurso da coluna/linha DE ONDE o bloco foi agarrado. Um evento multi-recurso aparece em
	 * várias colunas; é este campo (não `event.resourceIds`) que diz qual delas o usuário pegou.
	 */
	resourceId?: string;
}

/** Geometria de um rascunho (posição tentativa em minutos-do-dia). */
export interface DraftGeometry {
	dateISO: string;
	startMin: number;
	endMin: number;
	/** Date of the end; exclusive midnight/day for all-day intervals. */
	endDateISO?: string;
	allDay?: boolean;
	/** Recurso-ALVO da posição tentativa (só views de recurso). */
	resourceId?: string;
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
	endDateISO?: string;
	allDay?: boolean;
	/** Novo início como wall-clock ISO na timezone de exibição ('YYYY-MM-DDTHH:mm:00'). */
	startDateTime: string;
	/** Novo fim como wall-clock ISO na timezone de exibição. */
	endDateTime: string;
	/** Timezone IANA dos novos horários wall-clock (normalmente a timezone de exibição). */
	timeZone?: string;
	/** Recurso-alvo do drop (só views de recurso). Igual a `fromResourceId` quando não trocou. */
	resourceId?: string;
	/** Recurso de origem do bloco arrastado (só views de recurso). */
	fromResourceId?: string;
}

/** Seleção de intervalo num dia (drag em área vazia). */
export interface SelectionChange {
	dateISO: string;
	startMin: number;
	endMin: number;
	endDateISO?: string;
	allDay?: boolean;
	/** Recurso da coluna/linha onde a seleção foi feita (só views de recurso). */
	resourceId?: string;
}

/** Payload de drop/click barrado pelo ConstraintEngine. */
export interface BlockedInfo {
	kind: InteractionKind;
	dateISO: string;
	startMin: number;
	endMin: number;
	endDateISO?: string;
	allDay?: boolean;
	reason: DraftReason;
	/** Presente quando o gesto barrado envolvia um evento (move/resize). */
	occurrence?: EventOccurrence;
	/** Recurso-alvo do gesto barrado (só views de recurso). */
	resourceId?: string;
}

/** Retorno permitido dos callbacks de commit: `false`/rejeição ⇒ reverter. */
export type CommitResult = void | boolean | Promise<void | boolean>;

export function shiftCalendarDate(dateISO: string, days: number): string {
	const [year, month, day] = dateISO.split('-').map(Number);
	const date = new Date(0);
	date.setUTCFullYear(year!, month! - 1, day! + days);
	return date.toISOString().slice(0, 10);
}

export function calendarDayOffset(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function normalizeCalendarMinute(dateISO: string, minute: number): { dateISO: string; minute: number } {
	const days = Math.floor(minute / 1440);
	return { dateISO: shiftCalendarDate(dateISO, days), minute: minute - days * 1440 };
}

/** Formata data + minuto-do-dia como wall-clock ISO 'YYYY-MM-DDTHH:mm:00'. */
export function minutesToDateTime(dateISO: string, minuteOfDay: number): string {
	const clampedMinute = Math.max(0, Math.min(Math.floor(minuteOfDay), 24 * 60));
	const isNextDay = clampedMinute === 24 * 60;
	if (isNextDay) {
		const [year, month, day] = dateISO.split('-').map(Number);
		// setUTCFullYear evita a conversão de anos 0..99 para 1900..1999 do Date.UTC.
		const nextDay = new Date(0);
		nextDay.setUTCFullYear(year!, month! - 1, day! + 1);
		return `${nextDay.toISOString().slice(0, 10)}T00:00:00`;
	}
	const hours = Math.floor(clampedMinute / 60);
	const minutes = clampedMinute % 60;
	const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);
	return `${dateISO}T${pad(hours)}:${pad(minutes)}:00`;
}

/**
 * Troca o recurso de ORIGEM pelo de DESTINO preservando os demais: um evento pode ocupar
 * sala + profissional ao mesmo tempo, e arrastar entre colunas de profissional não pode
 * evaporar a sala. Idempotente e sem duplicar (se o destino já estava lá, só remove a origem).
 *
 * FONTE ÚNICA: a validação do arrasto (ocupação do candidato) e a aplicação otimista precisam
 * concordar sobre "quais recursos o evento passa a ocupar" — se divergissem, o fantasma diria
 * válido e o commit criaria uma lotação estourada. Exportada também para o consumidor persistir.
 */
export function reassignResource(
	resourceIds: readonly string[],
	fromResourceId: string,
	toResourceId: string,
): string[] {
	const others = resourceIds.filter(
		(id) => id !== fromResourceId && id !== toResourceId,
	);
	return [...others, toResourceId];
}

/**
 * Aplica (otimisticamente) uma mudança a um evento NÃO recorrente do store.
 * Recorrentes não são mutados aqui (exigiriam override) — o consumidor decide via callback.
 * Preserva `timeZone`/`allDay`; troca o wall-clock (`dateTime`) e, quando o gesto atravessou
 * colunas numa view de recurso (`fromResourceId` ≠ `resourceId`), também o `resourceIds`.
 */
export function applyEventTimeChange(
	events: readonly CalendarEvent[],
	change: EventChange,
): CalendarEvent[] {
	const masterId = change.occurrence.masterId;
	const { fromResourceId, resourceId } = change;
	const crossedResource =
		fromResourceId !== undefined && resourceId !== undefined && fromResourceId !== resourceId;
	return events.map((event) => {
		const isTargetMaster = event.id === masterId;
		if (!isTargetMaster) return event;
		const effective = change.occurrence.event;
		const nextTime = change.allDay ? {
			allDay: true,
			start: { date: change.dateISO },
			end: { date: change.endDateISO ?? change.endDateTime.slice(0, 10) },
		} : {
			...effective.time,
			start: { ...effective.time.start, dateTime: change.startDateTime, ...(change.timeZone ? { timeZone: change.timeZone } : {}) },
			end: { ...effective.time.end, dateTime: change.endDateTime, ...(change.timeZone ? { timeZone: change.timeZone } : {}) },
		};
		const nextResources = crossedResource
			? reassignResource(effective.resourceIds ?? [], fromResourceId!, resourceId!)
			: effective.resourceIds;
		if (event.recurrence) {
			const override = event.recurrence.overrides?.[change.occurrence.originalStart];
			return { ...event, recurrence: { ...event.recurrence, overrides: {
				...event.recurrence.overrides,
				[change.occurrence.originalStart]: { ...override, time: nextTime, ...(nextResources ? { resourceIds: nextResources } : {}) },
			} } };
		}
		const next: CalendarEvent = {
			...event,
			time: nextTime,
		};
		if (crossedResource) {
			next.resourceIds = reassignResource(event.resourceIds ?? [], fromResourceId!, resourceId!);
		}
		return next;
	});
}
