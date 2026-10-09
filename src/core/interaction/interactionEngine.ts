/** Pointer gestures with preview, commit and cancellation. @remarks Português: Gestos por ponteiro com prévia, confirmação e cancelamento. */
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
  DraftGeometry,
  ResizeEdge,
  OutsideDropTarget,
} from './model.js';
import { minutesToDateTime, calendarDayOffset } from './model.js';
import { computeMoveDraft, computeResizeDraft, computeSelectDraft } from './gestureGeometry.js';
import { isNestedInteractiveTarget } from './interactiveTarget.js';
import { GestureAutoScroll } from './gestureAutoScroll.js';
import type { EventOccurrence } from '../types/event.js';

export interface EvaluationInput {
  /** Gesture kind. @remarks Português: Tipo de gesto. */
  kind: InteractionKind;
  /** Start date, YYYY-MM-DD. @remarks Português: Data inicial, YYYY-MM-DD. */
  dateISO: string;
  /** Start in minutes of day. @remarks Português: Início em minutos do dia. */
  startMin: number;
  /** Exclusive end in minutes of day. @remarks Português: Fim exclusivo em minutos do dia. */
  endMin: number;
  /** End date when crossing midnight. @remarks Português: Data final ao atravessar meia-noite. */
  endDateISO?: string;
  /** Date-only placement. @remarks Português: Posicionamento de dia inteiro. */
  allDay?: boolean;

  /** Original edited occurrence. @remarks Português: Ocorrência original editada. */
  occurrence?: EventOccurrence;

  /** Target resource ID. @remarks Português: ID do recurso destino. */
  resourceId?: string;

  /** Original resource ID. @remarks Português: ID do recurso original. */
  fromResourceId?: string;
}

export interface DraftEvaluation {
  /** Placement accepted by validation. @remarks Português: Posicionamento aceito pela validação. */
  valid: boolean;
  /** Validation outcome. @remarks Português: Resultado da validação. */
  reason: DraftReason;
}

export interface InteractionCallbacks {
  /** Publish or clear the preview. @remarks Português: Publica ou limpa a prévia. */
  onDraftChange(draft: InteractionDraft | null): void;
  /** Confirm a move. @remarks Português: Confirma movimento. */
  commitMove(change: EventChange): void;
  /** Confirm a resize. @remarks Português: Confirma redimensionamento. */
  commitResize(change: EventChange): void;
  /** Confirm an interval selection. @remarks Português: Confirma seleção de intervalo. */
  commitSelect(selection: SelectionChange): void;
  /** Activate an occurrence. @remarks Português: Ativa ocorrência. */
  clickEvent(placement: PlacementInfo): void;
  /** Activate an empty slot. @remarks Português: Ativa horário vazio. */
  clickEmpty(slot: PointerSlot): void;
  /** Report refused interaction. @remarks Português: Informa interação recusada. */
  blocked(info: BlockedInfo): void;
  /** Accept incoming transfer. @remarks Português: Aceita transferência externa. */
  commitExternal?(change: EventChange): void;
  /** Notify outside release. @remarks Português: Notifica saída do calendário. */
  dropOutside?(placement: PlacementInfo, destination: OutsideDropTarget): void;
}

export interface InteractionDeps {
  /** Visible minute bounds. @remarks Português: Limites visíveis em minutos. */
  getGridBounds(): GridBounds;
  /** Selection step in minutes. @remarks Português: Passo de seleção em minutos. */
  getSlotMinutes(): number;
  /** Minimum event duration in minutes. @remarks Português: Duração mínima em minutos. */
  getMinDurationMin(): number;

  /** Allow timed/all-day conversion; default false. @remarks Português: Permite converter horário/dia inteiro; padrão false. */
  allowEventTypeChange?: () => boolean;
  /** Enable outgoing transfers. @remarks Português: Habilita transferências para fora. */
  allowOutsideDrop?: () => boolean;
  /** Enable edge scrolling. @remarks Português: Habilita scroll nas bordas. */
  autoScroll?: () => boolean;
  /** Validate complete candidate placement. @remarks Português: Valida posicionamento completo do candidato. */
  evaluate(input: EvaluationInput): DraftEvaluation;
  /** Resolve a rendered occurrence ID. @remarks Português: Resolve ID da ocorrência renderizada. */
  resolveOccurrence(eventId: string): EventOccurrence | null;
  /** Resolve original complete interval. @remarks Português: Resolve intervalo original completo. */
  resolveSpan?: (
    occurrence: EventOccurrence,
  ) => Pick<
    PlacementInfo,
    'dateISO' | 'startMin' | 'endDateISO' | 'endMin' | 'allDay' | 'durationMinutes'
  >;
  /** Preserve original time-zone duration. @remarks Português: Preserva duração no fuso original. */
  normalizeDraft?: (input: {
    /** Candidate gesture geometry. @remarks Português: Geometria candidata do gesto. */
    draft: DraftGeometry;
    /** Original grabbed placement. @remarks Português: Posicionamento original arrastado. */
    origin: PlacementInfo;
    /** Gesture operation. @remarks Português: Operação do gesto. */
    kind: InteractionKind;
  }) => DraftGeometry;

  /** Custom pointer locator; default uses DOM bounds. @remarks Português: Localizador próprio; padrão usa limites do DOM. */
  locateSlot?: (clientX: number, clientY: number) => PointerSlot | null;

  /** Click/drag threshold in minutes; default 5. @remarks Português: Limite clique/arrasto em minutos; padrão 5. */
  dragThresholdMin?: number;
  /** Consumer interaction handlers. @remarks Português: Tratadores de interação do consumidor. */
  callbacks: InteractionCallbacks;
}

const DEFAULT_DRAG_THRESHOLD_MIN = 5;
const TOUCH_HOLD_DELAY_MS = 450;
const TOUCH_SCROLL_DISTANCE_PX = 8;

interface ActiveGesture {
  kind: InteractionKind;
  pointerId: number;
  anchor: PointerSlot;

  origin: PlacementInfo | null;

  grabOffsetMin: number;
  resizeEdge?: ResizeEdge;

  editable: boolean;
  movedEnough: boolean;
  lastDraft: InteractionDraft | null;
  captureTarget: Element | null;

  pointerOrigin?: { x: number; y: number };

  sourceOnly?: boolean;
  touchStart?: { x: number; y: number; readyAt: number };
}

interface PointerCoords {
  clientX: number;
  clientY: number;
  pointerId: number;
  button: number;
  target: EventTarget | null;
  pointerType: string;
}

export class InteractionEngine {
  private root: HTMLElement | null = null;
  private gesture: ActiveGesture | null = null;
  private readonly deps: InteractionDeps;
  private autoScroller: GestureAutoScroll | null = null;
  private lastPointerMove: Event | null = null;
  private outsidePreview: HTMLElement | null = null;

  private readonly onPointerDown = (event: Event): void => this.handlePointerDown(event);
  private readonly onPointerMove = (event: Event): void => this.handlePointerMove(event);
  private readonly onPointerUp = (event: Event): void => this.handlePointerUp(event);
  private readonly onPointerCancel = (event: Event): void => this.handlePointerCancel(event);
  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.gesture?.touchStart && Date.now() >= this.gesture.touchStart.readyAt)
      event.preventDefault();
  };
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !this.gesture) return;
    this.finishDrag(this.gesture);
    this.gesture = null;
    this.deps.callbacks.onDraftChange(null);
    event.preventDefault();
  };

  private readonly onNativeDragStart = (event: Event): void => {
    if (this.gesture) event.preventDefault();
  };

  constructor(deps: InteractionDeps) {
    this.deps = deps;
  }

  attach(root: HTMLElement): void {
    this.detach();
    this.root = root;
    this.autoScroller = new GestureAutoScroll(root, () => {
      if (this.lastPointerMove) this.handlePointerMove(this.lastPointerMove);
    });
    root.addEventListener('pointerdown', this.onPointerDown);
  }

  detach(): void {
    if (this.root) {
      this.root.removeEventListener('pointerdown', this.onPointerDown);
    }
    if (this.gesture) {
      this.finishDrag(this.gesture);
      this.deps.callbacks.onDraftChange(null);
    } else this.teardownDragListeners();
    this.root = null;
    this.autoScroller = null;
    this.gesture = null;
  }

  startExternalDrag(origin: PlacementInfo, event: PointerEvent): boolean {
    if (
      !this.root ||
      this.gesture ||
      !origin.editable ||
      (event.button !== 0 && !(event.buttons & 1))
    )
      return false;
    const captureTarget = event.target instanceof Element ? event.target : this.root;
    const externalOrigin = { ...origin, external: true };
    this.gesture = {
      kind: 'move',
      pointerId: event.pointerId ?? 0,
      anchor: { dateISO: origin.dateISO, minuteOfDay: origin.startMin, allDay: origin.allDay },
      origin: externalOrigin,
      grabOffsetMin: 0,
      editable: true,
      movedEnough: true,
      lastDraft: null,
      captureTarget,
    };
    this.beginDrag(captureTarget, event.pointerId ?? 0);
    this.handlePointerMove(event);
    return true;
  }

  cancelDrag(): void {
    if (!this.gesture) return;
    this.finishDrag(this.gesture);
    this.gesture = null;
    this.deps.callbacks.onDraftChange(null);
  }

  locatePointerSlot(clientX: number, clientY: number): PointerSlot | null {
    if (!this.isCalendarSurface(clientX, clientY)) return null;
    return this.locate(clientX, clientY);
  }

  private handlePointerDown(event: Event): void {
    if (!this.root) return;

    if (this.gesture) return;
    const coords = readCoords(event);
    const isPrimaryButton = coords.button === 0;
    if (!isPrimaryButton) return;

    const targetElement = coords.target instanceof Element ? coords.target : null;
    if (!targetElement) return;
    const touchStart =
      coords.pointerType === 'touch'
        ? { x: coords.clientX, y: coords.clientY, readyAt: Date.now() + TOUCH_HOLD_DELAY_MS }
        : undefined;
    if (targetElement.closest('button.mc-month-daynum, button.mc-month-more, [data-mc-more]'))
      return;
    if (
      targetElement.closest('.mc-month-detail, .mc-month-popover') &&
      !targetElement.closest('[data-mc-event]')
    )
      return;

    const eventNode = targetElement.closest('[data-mc-event]') as HTMLElement | null;
    const sourceOnly = eventNode?.hasAttribute('data-mc-drag-source') ?? false;
    const sourcePlacement = sourceOnly ? this.placementFromNode(eventNode!) : null;
    const allDayCell = targetElement.closest('[data-mc-allday-cell]');
    const anchor = sourcePlacement
      ? {
          dateISO: sourcePlacement.dateISO,
          minuteOfDay: sourcePlacement.startMin,
          allDay: sourcePlacement.allDay,
        }
      : allDayCell
        ? this.locateAllDay({ clientX: coords.clientX, clientY: coords.clientY })
        : this.locate(coords.clientX, coords.clientY);
    if (!anchor) return;

    const resizeHandle = targetElement.closest('[data-mc-resize]');

    if (eventNode && !resizeHandle && isNestedInteractiveTarget(targetElement, eventNode)) return;

    const dayNode = targetElement.closest('[data-mc-day]') as HTMLElement | null;
    const emptyAreaNode =
      allDayCell ??
      dayNode ??
      targetElement.closest('[data-mc-month-day]') ??
      (targetElement.closest('[data-mc-slot]') as HTMLElement | null);

    if (eventNode) {
      const placement = this.placementFromNode(eventNode);
      if (!placement) return;
      const kind: InteractionKind = resizeHandle ? 'resize' : 'move';
      const fromPopover = Boolean(eventNode.closest('.mc-month-popover'));
      this.gesture = {
        kind,
        resizeEdge:
          (resizeHandle as HTMLElement | null)?.dataset.mcResize === 'start' ? 'start' : 'end',
        pointerId: coords.pointerId,
        anchor,
        origin: placement,
        grabOffsetMin: fromPopover
          ? anchor.dateOnly
            ? -placement.startMin
            : 0
          : calendarDayOffset(placement.dateISO, anchor.dateISO) * 1440 +
            anchor.minuteOfDay -
            placement.startMin,
        editable: placement.editable,
        movedEnough: false,
        lastDraft: null,
        captureTarget: eventNode,
        pointerOrigin:
          fromPopover || sourceOnly ? { x: coords.clientX, y: coords.clientY } : undefined,
        sourceOnly,
        touchStart,
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
        touchStart,
      };
      this.beginDrag(emptyAreaNode, coords.pointerId);
    }
  }

  private handlePointerMove(event: Event): void {
    const gesture = this.gesture;
    if (!gesture) return;
    const coords = readCoords(event);
    if (coords.pointerId !== gesture.pointerId) return;
    if (gesture.touchStart && Date.now() < gesture.touchStart.readyAt) {
      const distance = Math.hypot(
        coords.clientX - gesture.touchStart.x,
        coords.clientY - gesture.touchStart.y,
      );
      if (distance >= TOUCH_SCROLL_DISTANCE_PX) this.cancelDrag();
      return;
    }
    this.lastPointerMove = event;
    if (gesture.sourceOnly) {
      if (
        gesture.pointerOrigin &&
        Math.hypot(
          coords.clientX - gesture.pointerOrigin.x,
          coords.clientY - gesture.pointerOrigin.y,
        ) >= 5
      )
        gesture.movedEnough = true;
      if (gesture.movedEnough) {
        this.captureMovedGesture(gesture);
        this.showOutsidePreview(gesture, coords);
      }
      return;
    }
    const strictDestination =
      gesture.origin?.external ||
      (gesture.kind === 'move' &&
        this.deps.callbacks.dropOutside &&
        (this.deps.allowOutsideDrop?.() ?? true));
    const point = strictDestination
      ? this.locatePointerSlot(coords.clientX, coords.clientY)
      : this.locate(coords.clientX, coords.clientY);
    if (!point) {
      this.autoScroller?.stop();
      if (strictDestination) {
        if (gesture.origin && gesture.editable) gesture.movedEnough = true;
        if (gesture.movedEnough) this.captureMovedGesture(gesture);
        if (gesture.lastDraft !== null) {
          gesture.lastDraft = null;
          this.deps.callbacks.onDraftChange(null);
        }
        if (gesture.movedEnough) this.showOutsidePreview(gesture, coords);
      }
      return;
    }
    this.clearOutsidePreview();

    const crossedDay = point.dateISO !== gesture.anchor.dateISO;

    const crossedResource = point.resourceId !== gesture.anchor.resourceId;
    const crossedType =
      gesture.kind === 'move' &&
      this.deps.allowEventTypeChange?.() &&
      !point.dateOnly &&
      Boolean(point.allDay) !== Boolean(gesture.anchor.allDay);
    const movedMinutes = Math.abs(point.minuteOfDay - gesture.anchor.minuteOfDay);
    const threshold = this.deps.dragThresholdMin ?? DEFAULT_DRAG_THRESHOLD_MIN;
    const passedThreshold = gesture.pointerOrigin
      ? Math.hypot(
          coords.clientX - gesture.pointerOrigin.x,
          coords.clientY - gesture.pointerOrigin.y,
        ) >= 5
      : crossedDay || crossedResource || crossedType || movedMinutes >= threshold;
    if (passedThreshold) gesture.movedEnough = true;

    const readOnlyEventDrag =
      (gesture.kind === 'move' || gesture.kind === 'resize') && !gesture.editable;
    if (!gesture.movedEnough || readOnlyEventDrag) {
      this.autoScroller?.stop();
      gesture.lastDraft = null;
      this.deps.callbacks.onDraftChange(null);
      return;
    }

    const draft = this.buildDraft(gesture, point);
    this.captureMovedGesture(gesture);
    gesture.lastDraft = draft;
    this.deps.callbacks.onDraftChange(draft);
    if (this.deps.autoScroll?.() ?? true) this.autoScroller?.update(coords);
    else this.autoScroller?.stop();
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
    const outside = !this.isCalendarSurface(coords.clientX, coords.clientY);
    if (
      gesture.kind === 'move' &&
      gesture.origin &&
      gesture.editable &&
      outside &&
      (gesture.origin.external ||
        (gesture.movedEnough && callbacks.dropOutside && (this.deps.allowOutsideDrop?.() ?? true)))
    ) {
      if (!gesture.origin.external)
        callbacks.dropOutside?.(gesture.origin, {
          clientX: coords.clientX,
          clientY: coords.clientY,
          target:
            this.root?.ownerDocument.elementFromPoint?.(coords.clientX, coords.clientY) ?? null,
        });
      callbacks.onDraftChange(null);
      return;
    }
    const draft = gesture.lastDraft;
    if (gesture.sourceOnly && gesture.movedEnough) {
      callbacks.onDraftChange(null);
      return;
    }
    if (gesture.origin?.external && !draft) {
      callbacks.onDraftChange(null);
      return;
    }
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
      if (draft.endDateISO) selection.endDateISO = draft.endDateISO;
      if (draft.allDay) selection.allDay = true;
      if (draft.resourceId) selection.resourceId = draft.resourceId;
      callbacks.commitSelect(selection);
      return;
    }

    const origin = gesture.origin;
    if (!origin) return;
    const change = buildEventChange({ kind: gesture.kind, origin, draft });
    if (origin.external) callbacks.commitExternal?.(change);
    else if (gesture.kind === 'move') callbacks.commitMove(change);
    else callbacks.commitResize(change);
  }

  private isCalendarSurface(clientX: number, clientY: number): boolean {
    if (!this.root) return false;
    const selector =
      '[data-mc-day], [data-mc-slot], [data-mc-month-day], [data-mc-allday-cell], [data-mc-list-day]';
    const documentRef = this.root.ownerDocument;
    const hit = documentRef.elementFromPoint?.(clientX, clientY);
    if (hit) return this.root.contains(hit) && hit.closest(selector) !== null;

    return Array.from(this.root.querySelectorAll(selector)).some((surface) => {
      const rect = surface.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    });
  }

  private buildDraft(gesture: ActiveGesture, point: PointerSlot): InteractionDraft {
    const slotMinutes = this.deps.getSlotMinutes();
    const minDuration = this.deps.getMinDurationMin();
    const bounds = this.deps.getGridBounds();

    let geometry;
    if (gesture.kind === 'move' && gesture.origin) {
      geometry = computeMoveDraft({
        origin: gesture.origin,
        pointer: point,
        grabOffsetMin: gesture.grabOffsetMin,
        slotMinutes,
        bounds,
        allowTypeChange: this.deps.allowEventTypeChange?.() ?? false,
      });
    } else if (gesture.kind === 'resize' && gesture.origin) {
      geometry = computeResizeDraft({
        origin: gesture.origin,
        pointer: point,
        slotMinutes,
        minDurationMin: minDuration,
        bounds,
        edge: gesture.resizeEdge,
      });
    } else {
      geometry = computeSelectDraft({
        anchor: gesture.anchor,
        cursor: point,
        slotMinutes,
        minDurationMin: minDuration,
        bounds,
      });
    }
    if (gesture.origin && this.deps.normalizeDraft)
      geometry = this.deps.normalizeDraft({
        draft: geometry,
        origin: gesture.origin,
        kind: gesture.kind,
      });

    const evaluationInput: EvaluationInput = {
      kind: gesture.kind,
      dateISO: geometry.dateISO,
      startMin: geometry.startMin,
      endMin: geometry.endMin,
    };
    if (geometry.endDateISO) evaluationInput.endDateISO = geometry.endDateISO;
    if (geometry.allDay !== undefined) evaluationInput.allDay = geometry.allDay;
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
    if (geometry.endDateISO) draft.endDateISO = geometry.endDateISO;
    if (geometry.allDay !== undefined) draft.allDay = geometry.allDay;
    if (gesture.origin) {
      draft.eventId = gesture.origin.eventId;
      draft.title = gesture.origin.occurrence.event.title;
      if (gesture.origin.occurrence.event.color)
        draft.color = gesture.origin.occurrence.event.color;
    }
    if (geometry.resourceId) draft.resourceId = geometry.resourceId;
    return draft;
  }

  private placementFromNode(eventNode: HTMLElement): PlacementInfo | null {
    const eventId = eventNode.dataset.mcEvent;
    if (!eventId) return null;
    const dayNode = eventNode.closest('[data-mc-day]') as HTMLElement | null;

    const slotNode = dayNode ? null : (eventNode.closest('[data-mc-slot]') as HTMLElement | null);
    const allDayCell = eventNode.closest('[data-mc-allday-cell]') as HTMLElement | null;
    const monthCell = eventNode.closest<HTMLElement>('[data-mc-month-day]');
    const dateISO =
      monthCell?.dataset.mcMonthDay ??
      allDayCell?.dataset.mcAlldayCell ??
      dayNode?.dataset.mcDay ??
      slotNode?.dataset.mcSlotDate ??
      eventNode.dataset.mcEventDate;
    if (!dateISO) return null;
    const occurrence = this.deps.resolveOccurrence(eventId);
    if (!occurrence) return null;
    const span = this.deps.resolveSpan?.(occurrence);
    const startMin = Number(eventNode.dataset.mcStartMin ?? span?.startMin);
    const endMin = Number(eventNode.dataset.mcEndMin ?? span?.endMin);
    const hasNumericSpan = Number.isFinite(startMin) && Number.isFinite(endMin);
    if (!hasNumericSpan) return null;
    const editable = eventNode.dataset.mcEditable !== 'false';
    const placement: PlacementInfo = { eventId, dateISO, startMin, endMin, occurrence, editable };
    if (span) Object.assign(placement, span);
    const resourceId =
      slotNode?.dataset.mcSlotResource ??
      allDayCell?.dataset.mcSlotResource ??
      eventNode.closest<HTMLElement>('[data-mc-slot-resource]')?.dataset.mcSlotResource;
    if (resourceId) placement.resourceId = resourceId;
    return placement;
  }

  private locate(clientX: number, clientY: number): PointerSlot | null {
    const month = this.locateMonth(clientX, clientY);
    if (month) return month;
    if (this.gesture?.kind === 'move' && this.deps.allowEventTypeChange?.()) {
      const allDay = this.locateAllDay({ clientX, clientY, insideOnly: true });
      if (allDay) return allDay;
      return (
        this.deps.locateSlot?.(clientX, clientY) ??
        this.locateByRects(clientX, clientY) ??
        this.locateBySlots(clientX, clientY)
      );
    }
    if (this.gesture?.anchor.allDay) return this.locateAllDay({ clientX, clientY });
    if (this.deps.locateSlot) return this.deps.locateSlot(clientX, clientY);

    return this.locateByRects(clientX, clientY) ?? this.locateBySlots(clientX, clientY);
  }

  private locateMonth(clientX: number, clientY: number): PointerSlot | null {
    if (this.root?.querySelector('.mc-month-compact')) return null;
    let best: { dateISO: string; distance: number } | null = null;
    for (const cell of this.root?.querySelectorAll<HTMLElement>('[data-mc-month-day]') ?? []) {
      const rect = cell.getBoundingClientRect();
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const distance = dx * dx + dy * dy;
      if (!best || distance < best.distance) best = { dateISO: cell.dataset.mcMonthDay!, distance };
    }
    return best
      ? {
          dateISO: best.dateISO,
          minuteOfDay: 0,
          dateOnly: true,
          allDay: this.gesture?.origin ? this.gesture.origin.allDay : true,
        }
      : null;
  }

  private locateAllDay({
    clientX,
    clientY,
    insideOnly = false,
  }: {
    clientX: number;
    clientY: number;
    insideOnly?: boolean;
  }): PointerSlot | null {
    if (!this.root) return null;
    let best: { cell: HTMLElement; distance: number } | null = null;
    for (const cell of this.root.querySelectorAll<HTMLElement>('[data-mc-allday-cell]')) {
      const rect = cell.getBoundingClientRect();
      const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
      const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
      const distance = dx * dx + dy * dy;
      if (insideOnly && distance > 0) continue;
      if (!best || distance < best.distance) best = { cell, distance };
    }
    if (!best) return null;
    const slot: PointerSlot = {
      dateISO: best.cell.dataset.mcAlldayCell!,
      minuteOfDay: 0,
      allDay: true,
    };
    if (best.cell.dataset.mcSlotResource) slot.resourceId = best.cell.dataset.mcSlotResource;
    return slot;
  }

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
      documentRef.addEventListener('dragstart', this.onNativeDragStart);
      documentRef.addEventListener('keydown', this.onKeyDown);
      documentRef.addEventListener('touchmove', this.onTouchMove, { passive: false });
    }
    this.capturePointer(captureTarget, pointerId);
  }

  private captureMovedGesture(gesture: ActiveGesture): void {
    if (!this.root || gesture.captureTarget === this.root || !gesture.editable) return;

    gesture.captureTarget = this.root;
    this.capturePointer(this.root, gesture.pointerId);
  }

  private capturePointer(captureTarget: Element, pointerId: number): void {
    const canCapture =
      typeof (
        captureTarget as Element & {
          setPointerCapture?: (id: number) => void;
        }
      ).setPointerCapture === 'function';
    if (canCapture) {
      try {
        (captureTarget as Element & { setPointerCapture(id: number): void }).setPointerCapture(
          pointerId,
        );
      } catch {
        /* Capture may be unavailable. PT: Captura pode não estar disponível. */
      }
    }
  }

  private finishDrag(gesture: ActiveGesture): void {
    this.teardownDragListeners();
    const captureTarget = gesture.captureTarget as
      (Element & { releasePointerCapture?: (id: number) => void }) | null;
    const canRelease = captureTarget && typeof captureTarget.releasePointerCapture === 'function';
    if (canRelease) {
      try {
        captureTarget!.releasePointerCapture(gesture.pointerId);
      } catch {
        /* Capture may already be released. PT: Captura pode já ter sido liberada. */
      }
    }
  }

  private teardownDragListeners(): void {
    this.clearOutsidePreview();
    this.autoScroller?.stop();
    this.lastPointerMove = null;
    const documentRef = this.root?.ownerDocument;
    if (!documentRef) return;
    documentRef.removeEventListener('pointermove', this.onPointerMove);
    documentRef.removeEventListener('pointerup', this.onPointerUp);
    documentRef.removeEventListener('pointercancel', this.onPointerCancel);
    documentRef.removeEventListener('dragstart', this.onNativeDragStart);
    documentRef.removeEventListener('keydown', this.onKeyDown);
    documentRef.removeEventListener('touchmove', this.onTouchMove);
  }

  private showOutsidePreview(gesture: ActiveGesture, coords: PointerCoords): void {
    if (!this.root || !gesture.origin || !gesture.editable) return;
    const documentRef = this.root.ownerDocument;
    if (typeof documentRef.createElement !== 'function') return;
    if (!this.outsidePreview) {
      this.outsidePreview = documentRef.createElement('div');
      this.outsidePreview.className = 'mc-outside-preview';
      this.outsidePreview.setAttribute('aria-hidden', 'true');
      this.outsidePreview.textContent = gesture.origin.occurrence.event.title;
      Object.assign(this.outsidePreview.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '10000',
      });
      const themeRoot = this.root.querySelector('[data-mc-root]') ?? this.root;
      themeRoot.append(this.outsidePreview);
    }
    this.outsidePreview.style.left = `${Math.max(0, Math.min(coords.clientX + 12, documentRef.documentElement.clientWidth - 220))}px`;
    this.outsidePreview.style.top = `${Math.max(0, Math.min(coords.clientY + 12, documentRef.documentElement.clientHeight - 48))}px`;
  }

  private clearOutsidePreview(): void {
    this.outsidePreview?.remove();
    this.outsidePreview = null;
  }
}

function readCoords(event: Event): PointerCoords {
  const pointerLike = event as Event & {
    clientX?: number;
    clientY?: number;
    pointerId?: number;
    button?: number;
    pointerType?: string;
  };
  return {
    clientX: pointerLike.clientX ?? 0,
    clientY: pointerLike.clientY ?? 0,
    pointerId: pointerLike.pointerId ?? 0,
    button: pointerLike.button ?? 0,
    target: event.target,
    pointerType: pointerLike.pointerType ?? 'mouse',
  };
}

function buildEventChange({
  kind,
  origin,
  draft,
}: {
  kind: 'move' | 'resize';
  origin: PlacementInfo;
  draft: InteractionDraft;
}): EventChange {
  const change: EventChange = {
    kind,
    occurrence: origin.occurrence,
    event: origin.occurrence.event,
    dateISO: draft.dateISO,
    startMin: draft.startMin,
    endMin: draft.endMin,
    startDateTime: minutesToDateTime({ dateISO: draft.dateISO, minuteOfDay: draft.startMin }),
    endDateTime: minutesToDateTime({
      dateISO: draft.endDateISO ?? draft.dateISO,
      minuteOfDay: draft.endMin,
    }),
  };
  if (draft.endDateISO) change.endDateISO = draft.endDateISO;
  if (draft.allDay !== undefined) change.allDay = draft.allDay;
  if (draft.resourceId) change.resourceId = draft.resourceId;
  if (origin.resourceId) change.fromResourceId = origin.resourceId;
  return change;
}
