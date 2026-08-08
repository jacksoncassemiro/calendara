/**
 * InteractionEngine (Fase 4) — traduz Pointer Events num gesto de mover/redimensionar/selecionar,
 * com o ciclo **preview → commit → revert**.
 *
 * Filosofia do projeto: a MATEMÁTICA é pura (`geometry.ts`/`occupancy.ts`); aqui fica só o
 * acoplamento com o DOM. Usa DELEGAÇÃO no nó raiz (um `pointerdown`), então descobre se o toque
 * caiu num evento (mover), na alça de redimensionamento (`data-mc-resize`) ou em área vazia de uma
 * coluna (selecionar). Durante o arrasto emite um `InteractionDraft` (fantasma) reavaliado a cada
 * movimento; ao soltar, dispara o commit apropriado ou o callback de "barrado".
 *
 * Nada de layout é assumido: a posição do ponteiro vira `PointerSlot` via `locateSlot`, que por
 * padrão lê os retângulos das colunas (`data-mc-day`) — injetável para teste.
 *
 * SUPERFÍCIES DE ARRASTO. Existem dois contratos de DOM, e o motor é UM só (uma instância por
 * CalendarApp, compartilhada por todas as views):
 *  1. `[data-mc-day="YYYY-MM-DD"]` — colunas verticais de DATA (Semana/Dia/NDias). Caminho legado,
 *     intocado: X escolhe a coluna, Y projeta o minuto.
 *  2. `[data-mc-slot]` — superfície GENÉRICA das views de recurso, que declara o próprio eixo:
 *     `data-mc-slot="y"` (Multiagenda: colunas verticais por recurso, Y→minuto) ou
 *     `data-mc-slot="x"` (Timeline: linhas horizontais por recurso, X→minuto), mais
 *     `data-mc-slot-date` (a data REAL da superfície) e `data-mc-slot-resource`.
 * O motor tenta (1) e só cai para (2) se não houver coluna de data — então quem só renderiza
 * TimeGrid não paga nada e não muda de comportamento.
 */
import type {
	BlockedInfo,
	DraftReason,
	EventChange,
	GridBounds,
	InteractionDraft,
	InteractionKind,
	PlacementInfo,
	PointerSlot,
	SelectionChange,
} from './model.js';
import { minutesToDateTime } from './model.js';
import { computeMoveDraft, computeResizeDraft, computeSelectDraft } from './gestureGeometry.js';
import type { EventOccurrence } from '../types/event.js';

/** Entrada de avaliação de um candidato (ConstraintEngine + ocupação). */
export interface EvaluationInput {
	kind: InteractionKind;
	dateISO: string;
	startMin: number;
	endMin: number;
	/** Ocorrência envolvida (move/resize); ausente em seleção. */
	occurrence?: EventOccurrence;
	/**
	 * Recurso-ALVO do candidato (views de recurso). Quando presente, a ocupação (lotação/buffer)
	 * é validada contra ESTE recurso — e não contra os `resourceIds` atuais do evento, que ainda
	 * apontam para a coluna de origem enquanto o arrasto está em curso.
	 */
	resourceId?: string;
	/** Recurso de ORIGEM do bloco: com ele o avaliador reconstrói o conjunto pós-drop. */
	fromResourceId?: string;
}

/** Resultado combinado da avaliação de um candidato. */
export interface DraftEvaluation {
	valid: boolean;
	reason: DraftReason;
}

/** Callbacks disparados pelo motor (o CalendarApp implementa e liga na API pública). */
export interface InteractionCallbacks {
	onDraftChange(draft: InteractionDraft | null): void;
	commitMove(change: EventChange): void;
	commitResize(change: EventChange): void;
	commitSelect(selection: SelectionChange): void;
	clickEvent(placement: PlacementInfo): void;
	clickEmpty(slot: PointerSlot): void;
	blocked(info: BlockedInfo): void;
}

/** Dependências injetadas (dados vivos do CalendarApp + política de avaliação). */
export interface InteractionDeps {
	getGridBounds(): GridBounds;
	getSlotMinutes(): number;
	getMinDurationMin(): number;
	evaluate(input: EvaluationInput): DraftEvaluation;
	resolveOccurrence(eventId: string): EventOccurrence | null;
	/** Override de localização do ponteiro (teste). Ausente → retângulos das colunas. */
	locateSlot?: (clientX: number, clientY: number) => PointerSlot | null;
	/** Deslocamento mínimo (min-do-dia) para distinguir clique de arrasto (default 5). */
	dragThresholdMin?: number;
	callbacks: InteractionCallbacks;
}

const DEFAULT_DRAG_THRESHOLD_MIN = 5;

interface ActiveGesture {
	kind: InteractionKind;
	pointerId: number;
	anchor: PointerSlot;
	/** Origem (move/resize); null em seleção. */
	origin: PlacementInfo | null;
	/** Minutos abaixo do topo do evento onde o usuário agarrou (move). */
	grabOffsetMin: number;
	/** Evento editável? (não editável ⇒ só clique, sem arrasto). */
	editable: boolean;
	movedEnough: boolean;
	lastDraft: InteractionDraft | null;
	captureTarget: Element | null;
}

/** Coordenada de um MouseEvent/PointerEvent (o que o motor consome do DOM). */
interface PointerCoords {
	clientX: number;
	clientY: number;
	pointerId: number;
	button: number;
	target: EventTarget | null;
}

export class InteractionEngine {
	private root: HTMLElement | null = null;
	private gesture: ActiveGesture | null = null;
	private readonly deps: InteractionDeps;

	private readonly onPointerDown = (event: Event): void => this.handlePointerDown(event);
	private readonly onPointerMove = (event: Event): void => this.handlePointerMove(event);
	private readonly onPointerUp = (event: Event): void => this.handlePointerUp(event);
	private readonly onPointerCancel = (event: Event): void => this.handlePointerCancel(event);

	constructor(deps: InteractionDeps) {
		this.deps = deps;
	}

	/** Liga os listeners de ponteiro ao nó raiz do calendário. */
	attach(root: HTMLElement): void {
		this.detach();
		this.root = root;
		root.addEventListener('pointerdown', this.onPointerDown);
	}

	/** Desliga tudo (destroy). */
	detach(): void {
		if (this.root) {
			this.root.removeEventListener('pointerdown', this.onPointerDown);
		}
		this.teardownDragListeners();
		this.root = null;
		this.gesture = null;
	}

	// ---- ciclo do gesto --------------------------------------------------------

	private handlePointerDown(event: Event): void {
		if (!this.root) return;
		// Reentrância: já existe um gesto ativo (segundo dedo tocando durante um arrasto, clique
		// perdido etc.) — o calendário só acompanha UM ponteiro por vez. Ignora o novo pointerdown
		// em vez de sobrescrever `this.gesture` (o que faria o gesto original nunca receber seu
		// pointerup, pois o `matchesPointer` do handlePointerUp compararia contra o pointerId novo).
		if (this.gesture) return;
		const coords = readCoords(event);
		const isPrimaryButton = coords.button === 0;
		if (!isPrimaryButton) return;

		const targetElement = coords.target instanceof Element ? coords.target : null;
		if (!targetElement) return;

		const anchor = this.locate(coords.clientX, coords.clientY);
		if (!anchor) return;

		const eventNode = targetElement.closest('[data-mc-event]') as HTMLElement | null;
		const resizeHandle = targetElement.closest('[data-mc-resize]');
		// Alvo de SELEÇÃO em área vazia: coluna de data ou, nas views de recurso, a superfície
		// genérica. Só procura a segunda se a primeira falhou (custo zero no TimeGrid).
		const dayNode = targetElement.closest('[data-mc-day]') as HTMLElement | null;
		const emptyAreaNode = dayNode ?? (targetElement.closest('[data-mc-slot]') as HTMLElement | null);

		if (eventNode) {
			const placement = this.placementFromNode(eventNode);
			if (!placement) return;
			const kind: InteractionKind = resizeHandle ? 'resize' : 'move';
			this.gesture = {
				kind,
				pointerId: coords.pointerId,
				anchor,
				origin: placement,
				grabOffsetMin: anchor.minuteOfDay - placement.startMin,
				editable: placement.editable,
				movedEnough: false,
				lastDraft: null,
				captureTarget: eventNode,
			};
			this.beginDrag(eventNode, coords.pointerId);
			return;
		}

		if (emptyAreaNode) {
			this.gesture = {
				kind: 'select',
				pointerId: coords.pointerId,
				anchor,
				origin: null,
				grabOffsetMin: 0,
				editable: true,
				movedEnough: false,
				lastDraft: null,
				captureTarget: emptyAreaNode,
			};
			this.beginDrag(emptyAreaNode, coords.pointerId);
		}
	}

	private handlePointerMove(event: Event): void {
		const gesture = this.gesture;
		if (!gesture) return;
		const coords = readCoords(event);
		const point = this.locate(coords.clientX, coords.clientY);
		if (!point) return;

		const crossedDay = point.dateISO !== gesture.anchor.dateISO;
		// Atravessar de coluna/linha de recurso conta como arrasto mesmo sem mexer no horário:
		// mover uma consulta de um profissional para outro no MESMO horário é o caso central da
		// Multiagenda, e sem isto o gesto seria interpretado como clique.
		const crossedResource = point.resourceId !== gesture.anchor.resourceId;
		const movedMinutes = Math.abs(point.minuteOfDay - gesture.anchor.minuteOfDay);
		const threshold = this.deps.dragThresholdMin ?? DEFAULT_DRAG_THRESHOLD_MIN;
		const passedThreshold = crossedDay || crossedResource || movedMinutes >= threshold;
		if (passedThreshold) gesture.movedEnough = true;

		const readOnlyEventDrag =
			(gesture.kind === 'move' || gesture.kind === 'resize') && !gesture.editable;
		if (!gesture.movedEnough || readOnlyEventDrag) {
			gesture.lastDraft = null;
			this.deps.callbacks.onDraftChange(null);
			return;
		}

		const draft = this.buildDraft(gesture, point);
		gesture.lastDraft = draft;
		this.deps.callbacks.onDraftChange(draft);
	}

	private handlePointerUp(event: Event): void {
		const gesture = this.gesture;
		if (!gesture) return;
		const coords = readCoords(event);
		const matchesPointer = coords.pointerId === gesture.pointerId;
		if (!matchesPointer) return;

		this.finishDrag(gesture);
		this.gesture = null;

		const callbacks = this.deps.callbacks;
		const draft = gesture.lastDraft;
		const wasClick = !gesture.movedEnough || draft === null;

		if (wasClick) {
			if (gesture.origin) callbacks.clickEvent(gesture.origin);
			else callbacks.clickEmpty(gesture.anchor);
			callbacks.onDraftChange(null);
			return;
		}

		this.commitDraft(gesture, draft);
		callbacks.onDraftChange(null);
	}

	/**
	 * `pointercancel` — o browser assumiu o ponteiro (scroll nativo, long-press de menu de contexto,
	 * mudança de orientação, chrome do browser). Diferente do `pointerup`, isto NÃO é um "soltar":
	 * é um aborto. Nada de commit/click — só limpar o estado e o fantasma, do jeito que o
	 * `handlePointerUp` limparia, mas sem tentar interpretar a intenção do usuário.
	 */
	private handlePointerCancel(event: Event): void {
		const gesture = this.gesture;
		if (!gesture) return;
		const coords = readCoords(event);
		const matchesPointer = coords.pointerId === gesture.pointerId;
		if (!matchesPointer) return;

		this.finishDrag(gesture);
		this.gesture = null;
		this.deps.callbacks.onDraftChange(null);
	}

	private commitDraft(gesture: ActiveGesture, draft: InteractionDraft): void {
		const callbacks = this.deps.callbacks;
		if (!draft.valid) {
			const blockedInfo: BlockedInfo = {
				kind: gesture.kind,
				dateISO: draft.dateISO,
				startMin: draft.startMin,
				endMin: draft.endMin,
				reason: draft.reason,
			};
			if (gesture.origin) blockedInfo.occurrence = gesture.origin.occurrence;
			if (draft.resourceId) blockedInfo.resourceId = draft.resourceId;
			callbacks.blocked(blockedInfo);
			return;
		}

		if (gesture.kind === 'select') {
			const selection: SelectionChange = {
				dateISO: draft.dateISO,
				startMin: draft.startMin,
				endMin: draft.endMin,
			};
			if (draft.resourceId) selection.resourceId = draft.resourceId;
			callbacks.commitSelect(selection);
			return;
		}

		const origin = gesture.origin;
		if (!origin) return;
		const change = buildEventChange(gesture.kind, origin, draft);
		if (gesture.kind === 'move') callbacks.commitMove(change);
		else callbacks.commitResize(change);
	}

	// ---- helpers ---------------------------------------------------------------

	private buildDraft(gesture: ActiveGesture, point: PointerSlot): InteractionDraft {
		const slotMinutes = this.deps.getSlotMinutes();
		const minDuration = this.deps.getMinDurationMin();
		const bounds = this.deps.getGridBounds();

		let geometry;
		if (gesture.kind === 'move' && gesture.origin) {
			geometry = computeMoveDraft(gesture.origin, point, gesture.grabOffsetMin, slotMinutes, bounds);
		} else if (gesture.kind === 'resize' && gesture.origin) {
			geometry = computeResizeDraft(gesture.origin, point, slotMinutes, minDuration, bounds);
		} else {
			geometry = computeSelectDraft(gesture.anchor, point, slotMinutes, minDuration, bounds);
		}

		const evaluationInput: EvaluationInput = {
			kind: gesture.kind,
			dateISO: geometry.dateISO,
			startMin: geometry.startMin,
			endMin: geometry.endMin,
		};
		if (gesture.origin) evaluationInput.occurrence = gesture.origin.occurrence;
		if (geometry.resourceId) evaluationInput.resourceId = geometry.resourceId;
		if (gesture.origin?.resourceId) evaluationInput.fromResourceId = gesture.origin.resourceId;
		const evaluation = this.deps.evaluate(evaluationInput);

		const draft: InteractionDraft = {
			kind: gesture.kind,
			dateISO: geometry.dateISO,
			startMin: geometry.startMin,
			endMin: geometry.endMin,
			valid: evaluation.valid,
			reason: evaluation.reason,
		};
		if (gesture.origin) draft.eventId = gesture.origin.eventId;
		if (geometry.resourceId) draft.resourceId = geometry.resourceId;
		return draft;
	}

	private placementFromNode(eventNode: HTMLElement): PlacementInfo | null {
		const eventId = eventNode.dataset.mcEvent;
		if (!eventId) return null;
		const dayNode = eventNode.closest('[data-mc-day]') as HTMLElement | null;
		// Nas views de recurso o bloco não está dentro de nenhuma coluna de data — a data (e o
		// recurso de ORIGEM) vêm da superfície genérica que o contém.
		const slotNode = dayNode
			? null
			: (eventNode.closest('[data-mc-slot]') as HTMLElement | null);
		const dateISO = dayNode?.dataset.mcDay ?? slotNode?.dataset.mcSlotDate;
		if (!dateISO) return null;
		const startMin = Number(eventNode.dataset.mcStartMin);
		const endMin = Number(eventNode.dataset.mcEndMin);
		const hasNumericSpan = Number.isFinite(startMin) && Number.isFinite(endMin);
		if (!hasNumericSpan) return null;
		const occurrence = this.deps.resolveOccurrence(eventId);
		if (!occurrence) return null;
		const editable = eventNode.dataset.mcEditable !== 'false';
		const placement: PlacementInfo = { eventId, dateISO, startMin, endMin, occurrence, editable };
		const resourceId = slotNode?.dataset.mcSlotResource;
		if (resourceId) placement.resourceId = resourceId;
		return placement;
	}

	private locate(clientX: number, clientY: number): PointerSlot | null {
		if (this.deps.locateSlot) return this.deps.locateSlot(clientX, clientY);
		// Colunas de data primeiro (caminho legado, inalterado); superfícies de recurso só quando
		// não há nenhuma — as duas famílias de view nunca coexistem num mesmo render.
		return this.locateByRects(clientX, clientY) ?? this.locateBySlots(clientX, clientY);
	}

	/** Localizador padrão: escolhe a coluna sob (ou mais próxima de) clientX e projeta clientY. */
	private locateByRects(clientX: number, clientY: number): PointerSlot | null {
		if (!this.root) return null;
		const bounds = this.deps.getGridBounds();
		const spanMinutes = Math.max(1, bounds.endMin - bounds.startMin);
		const columns = this.root.querySelectorAll('[data-mc-day]');
		let best: { dateISO: string; rect: DOMRect; distance: number } | null = null;
		for (const column of Array.from(columns)) {
			const dateISO = (column as HTMLElement).dataset.mcDay;
			if (!dateISO) continue;
			const rect = column.getBoundingClientRect();
			const insideColumn = clientX >= rect.left && clientX <= rect.right;
			const horizontalDistance = insideColumn
				? 0
				: Math.min(Math.abs(clientX - rect.left), Math.abs(clientX - rect.right));
			const isBetter = best === null || horizontalDistance < best.distance;
			if (isBetter) best = { dateISO, rect, distance: horizontalDistance };
			if (insideColumn) break;
		}
		if (!best) return null;
		const usableHeight = best.rect.height > 0 ? best.rect.height : spanMinutes;
		const minutesFromTop = ((clientY - best.rect.top) / usableHeight) * spanMinutes;
		const rawMinute = bounds.startMin + minutesFromTop;
		const clampedMinute = Math.max(bounds.startMin, Math.min(rawMinute, bounds.endMin));
		return { dateISO: best.dateISO, minuteOfDay: clampedMinute };
	}

	/**
	 * Localizador das views de RECURSO. Cada superfície `[data-mc-slot]` declara qual eixo é o do
	 * tempo (`'y'` = Multiagenda, `'x'` = Timeline); o eixo TRANSVERSAL é o que escolhe a
	 * superfície. Com isso a Timeline (layout transposto) não precisa de motor nem de geometria
	 * própria — só troca qual coordenada é qual.
	 */
	private locateBySlots(clientX: number, clientY: number): PointerSlot | null {
		if (!this.root) return null;
		const bounds = this.deps.getGridBounds();
		const spanMinutes = Math.max(1, bounds.endMin - bounds.startMin);
		const surfaces = this.root.querySelectorAll('[data-mc-slot]');
		let best: { surface: HTMLElement; rect: DOMRect; distance: number } | null = null;
		for (const node of Array.from(surfaces)) {
			const surface = node as HTMLElement;
			const dateISO = surface.dataset.mcSlotDate;
			if (!dateISO) continue;
			const rect = surface.getBoundingClientRect();
			const transposed = surface.dataset.mcSlot === 'x';
			const crossPosition = transposed ? clientY : clientX;
			const crossStart = transposed ? rect.top : rect.left;
			const crossEnd = transposed ? rect.bottom : rect.right;
			const insideSurface = crossPosition >= crossStart && crossPosition <= crossEnd;
			const crossDistance = insideSurface
				? 0
				: Math.min(Math.abs(crossPosition - crossStart), Math.abs(crossPosition - crossEnd));
			const isBetter = best === null || crossDistance < best.distance;
			if (isBetter) best = { surface, rect, distance: crossDistance };
			if (insideSurface) break;
		}
		if (!best) return null;

		const transposed = best.surface.dataset.mcSlot === 'x';
		const timePosition = transposed ? clientX : clientY;
		const timeOrigin = transposed ? best.rect.left : best.rect.top;
		const rawSize = transposed ? best.rect.width : best.rect.height;
		const usableSize = rawSize > 0 ? rawSize : spanMinutes;
		const minutesFromOrigin = ((timePosition - timeOrigin) / usableSize) * spanMinutes;
		const rawMinute = bounds.startMin + minutesFromOrigin;
		const slot: PointerSlot = {
			dateISO: best.surface.dataset.mcSlotDate!,
			minuteOfDay: Math.max(bounds.startMin, Math.min(rawMinute, bounds.endMin)),
		};
		const resourceId = best.surface.dataset.mcSlotResource;
		if (resourceId) slot.resourceId = resourceId;
		return slot;
	}

	private beginDrag(captureTarget: Element, pointerId: number): void {
		const documentRef = this.root?.ownerDocument;
		if (documentRef) {
			documentRef.addEventListener('pointermove', this.onPointerMove);
			documentRef.addEventListener('pointerup', this.onPointerUp);
			documentRef.addEventListener('pointercancel', this.onPointerCancel);
		}
		const canCapture = typeof (captureTarget as Element & {
			setPointerCapture?: (id: number) => void;
		}).setPointerCapture === 'function';
		if (canCapture) {
			try {
				(captureTarget as Element & { setPointerCapture(id: number): void }).setPointerCapture(
					pointerId,
				);
			} catch {
				/* captura é best-effort */
			}
		}
	}

	private finishDrag(gesture: ActiveGesture): void {
		this.teardownDragListeners();
		const captureTarget = gesture.captureTarget as
			| (Element & { releasePointerCapture?: (id: number) => void })
			| null;
		const canRelease = captureTarget && typeof captureTarget.releasePointerCapture === 'function';
		if (canRelease) {
			try {
				captureTarget!.releasePointerCapture(gesture.pointerId);
			} catch {
				/* release é best-effort */
			}
		}
	}

	private teardownDragListeners(): void {
		const documentRef = this.root?.ownerDocument;
		if (!documentRef) return;
		documentRef.removeEventListener('pointermove', this.onPointerMove);
		documentRef.removeEventListener('pointerup', this.onPointerUp);
		documentRef.removeEventListener('pointercancel', this.onPointerCancel);
	}
}

/** Lê coordenadas de um Event que na prática é Mouse/PointerEvent. */
function readCoords(event: Event): PointerCoords {
	const pointerLike = event as Event & {
		clientX?: number;
		clientY?: number;
		pointerId?: number;
		button?: number;
	};
	return {
		clientX: pointerLike.clientX ?? 0,
		clientY: pointerLike.clientY ?? 0,
		pointerId: pointerLike.pointerId ?? 0,
		button: pointerLike.button ?? 0,
		target: event.target,
	};
}

/** Monta o `EventChange` a partir da origem + rascunho final. */
function buildEventChange(
	kind: 'move' | 'resize',
	origin: PlacementInfo,
	draft: InteractionDraft,
): EventChange {
	const change: EventChange = {
		kind,
		occurrence: origin.occurrence,
		event: origin.occurrence.event,
		dateISO: draft.dateISO,
		startMin: draft.startMin,
		endMin: draft.endMin,
		startDateTime: minutesToDateTime(draft.dateISO, draft.startMin),
		endDateTime: minutesToDateTime(draft.dateISO, draft.endMin),
	};
	if (draft.resourceId) change.resourceId = draft.resourceId;
	if (origin.resourceId) change.fromResourceId = origin.resourceId;
	return change;
}
