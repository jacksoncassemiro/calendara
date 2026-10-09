import type { DraftGeometry, GridBounds, PlacementInfo, PointerSlot, ResizeEdge } from './model.js';
import { calendarDayOffset, normalizeCalendarMinute, shiftCalendarDate } from './model.js';

function withResource({
  geometry,
  resourceId,
}: {
  /** Proposed interval geometry. @remarks Português: Geometria do intervalo proposto. */
  geometry: DraftGeometry;
  /** Destination resource; omitted keeps the geometry unchanged. @remarks Português: Recurso de destino; ausente preserva a geometria. */
  resourceId: string | undefined;
}): DraftGeometry {
  if (resourceId === undefined) return geometry;
  return { ...geometry, resourceId };
}

/** Rounding direction when snapping minutes to slots.
 * @remarks Português: Direção do arredondamento de minutos para slots.
 */
export type SnapRounding = 'nearest' | 'floor' | 'ceil';

/** Named inputs for snapMinute.
 * @remarks Português: Entradas nomeadas de snapMinute.
 */
export interface SnapMinuteInput {
  /** Minute value to align to the grid.
   * @remarks Português: Valor em minutos a alinhar à grade.
   */
  minute: number;
  /** Gesture snap step in minutes.
   * @remarks Português: Passo do alinhamento do gesto em minutos.
   */
  slotMinutes: number;
  /** Rounding direction; default nearest.
   * @remarks Português: Direção de arredondamento; padrão nearest.
   */
  rounding?: SnapRounding | undefined;
}

/** Round a minute to slotMinutes; nonpositive steps round to an integer minute.
 * @remarks Português: Arredonda para slotMinutes; passos não positivos arredondam para minuto inteiro.
 */

export function snapMinute({ minute, slotMinutes, rounding = 'nearest' }: SnapMinuteInput): number {
  const hasGrid = slotMinutes > 0;
  if (!hasGrid) return Math.round(minute);
  const ratio = minute / slotMinutes;
  const snappedRatio =
    rounding === 'floor'
      ? Math.floor(ratio)
      : rounding === 'ceil'
        ? Math.ceil(ratio)
        : Math.round(ratio);
  return snappedRatio * slotMinutes;
}

function clamp({
  value,
  lowerBound,
  upperBound,
}: {
  /** Value to constrain. @remarks Português: Valor a limitar. */
  value: number;
  /** Inclusive lower limit. @remarks Português: Limite inferior inclusivo. */
  lowerBound: number;
  /** Inclusive upper limit. @remarks Português: Limite superior inclusivo. */
  upperBound: number;
}): number {
  return Math.max(lowerBound, Math.min(value, upperBound));
}

/** Named inputs for clampSpanToGrid.
 * @remarks Português: Entradas nomeadas de clampSpanToGrid.
 */
export interface ClampSpanToGridInput {
  /** Inclusive minute-of-day window start.
   * @remarks Português: Início inclusivo da janela em minutos do dia.
   */
  startMin: number;
  /** Exclusive minute-of-day window end.
   * @remarks Português: Fim exclusivo da janela em minutos do dia.
   */
  endMin: number;
  /** Visible grid limits in minutes.
   * @remarks Português: Limites visíveis da grade em minutos.
   */
  bounds: GridBounds;
}

/** Move the interval inside grid bounds without shortening its duration.
 * @remarks Português: Move o intervalo para os limites da grade sem reduzir sua duração.
 */

export function clampSpanToGrid({ startMin, endMin, bounds }: ClampSpanToGridInput): {
  startMin: number;
  endMin: number;
} {
  const duration = Math.max(0, endMin - startMin);
  const maxStart = bounds.endMin - duration;
  const overflowsBottom = startMin > maxStart;
  const clampedStart = overflowsBottom ? maxStart : Math.max(startMin, bounds.startMin);
  const finalStart = Math.max(bounds.startMin, clampedStart);
  return { startMin: finalStart, endMin: finalStart + duration };
}

/** Named inputs for computeMoveDraft.
 * @remarks Português: Entradas nomeadas de computeMoveDraft.
 */
export interface ComputeMoveDraftInput {
  /** Original grabbed event placement.
   * @remarks Português: Posição original do evento arrastado.
   */
  origin: PlacementInfo;
  /** Current pointer slot.
   * @remarks Português: Slot atual do ponteiro.
   */
  pointer: PointerSlot;
  /** Pointer offset from event start in minutes.
   * @remarks Português: Deslocamento do ponteiro desde o início em minutos.
   */
  grabOffsetMin: number;
  /** Gesture snap step in minutes.
   * @remarks Português: Passo do alinhamento do gesto em minutos.
   */
  slotMinutes: number;
  /** Visible grid limits in minutes.
   * @remarks Português: Limites visíveis da grade em minutos.
   */
  bounds: GridBounds;
  /** Allow timed/all-day conversion; default false.
   * @remarks Português: Permite conversão de horário/dia inteiro; padrão false.
   */
  allowTypeChange?: boolean | undefined;
}

/** Preserve duration and grab offset while proposing a snapped destination.
 * @remarks Português: Preserva duração e deslocamento do ponto de agarre ao propor destino alinhado à grade.
 */

export function computeMoveDraft({
  origin,
  pointer,
  grabOffsetMin,
  slotMinutes,
  bounds,
  allowTypeChange = false,
}: ComputeMoveDraftInput): DraftGeometry {
  if (allowTypeChange && !pointer.dateOnly && Boolean(pointer.allDay) !== Boolean(origin.allDay)) {
    const resourceId = pointer.resourceId ?? origin.resourceId;
    if (pointer.allDay) {
      const civilDuration =
        calendarDayOffset(origin.dateISO, origin.endDateISO ?? origin.dateISO) * 1440 +
        origin.endMin -
        origin.startMin;
      const durationDays = Math.max(1, Math.ceil((origin.durationMinutes ?? civilDuration) / 1440));
      return withResource({
        geometry: {
          dateISO: pointer.dateISO,
          startMin: 0,
          endMin: 0,
          endDateISO: shiftCalendarDate({ dateISO: pointer.dateISO, days: durationDays }),
          allDay: true,
        },
        resourceId,
      });
    }
    const durationDays = Math.max(1, calendarDayOffset(origin.dateISO, origin.endDateISO!));
    const start = normalizeCalendarMinute({
      dateISO: pointer.dateISO,
      minute: snapMinute({ minute: pointer.minuteOfDay, slotMinutes }),
    });
    const end = normalizeCalendarMinute({
      dateISO: start.dateISO,
      minute: start.minute + durationDays * 1440,
    });
    return withResource({
      geometry: {
        dateISO: start.dateISO,
        startMin: start.minute,
        endDateISO: end.dateISO,
        endMin: end.minute,
        allDay: false,
      },
      resourceId,
    });
  }
  if (pointer.dateOnly && !origin.allDay) {
    const grabbedDays = Math.round((grabOffsetMin + origin.startMin) / 1440);
    const dateISO = shiftCalendarDate({ dateISO: pointer.dateISO, days: -grabbedDays });
    return {
      dateISO,
      startMin: origin.startMin,
      endMin: origin.endMin,
      endDateISO: shiftCalendarDate({
        dateISO,
        days: calendarDayOffset(origin.dateISO, origin.endDateISO ?? origin.dateISO),
      }),
    };
  }
  if (origin.allDay) {
    const durationDays = Math.max(1, calendarDayOffset(origin.dateISO, origin.endDateISO!));
    const start = normalizeCalendarMinute({
      dateISO: pointer.dateISO,
      minute: -grabOffsetMin,
    }).dateISO;
    return withResource({
      geometry: {
        dateISO: start,
        startMin: 0,
        endMin: 0,
        endDateISO: shiftCalendarDate({ dateISO: start, days: durationDays }),
        allDay: true,
      },
      resourceId: pointer.resourceId,
    });
  }
  if (origin.endDateISO && origin.endDateISO !== origin.dateISO) {
    const duration =
      calendarDayOffset(origin.dateISO, origin.endDateISO) * 1440 + origin.endMin - origin.startMin;
    const start = normalizeCalendarMinute({
      dateISO: pointer.dateISO,
      minute: snapMinute({ minute: pointer.minuteOfDay - grabOffsetMin, slotMinutes }),
    });
    const end = normalizeCalendarMinute({
      dateISO: start.dateISO,
      minute: start.minute + duration,
    });
    return withResource({
      geometry: {
        dateISO: start.dateISO,
        startMin: start.minute,
        endDateISO: end.dateISO,
        endMin: end.minute,
      },
      resourceId: pointer.resourceId,
    });
  }
  const duration = Math.max(0, origin.endMin - origin.startMin);
  const rawStart = pointer.minuteOfDay - grabOffsetMin;
  const snappedStart = snapMinute({
    minute: rawStart,
    slotMinutes,
    rounding: 'nearest',
  });
  const clamped = clampSpanToGrid({
    startMin: snappedStart,
    endMin: snappedStart + duration,
    bounds,
  });
  return withResource({
    geometry: { dateISO: pointer.dateISO, startMin: clamped.startMin, endMin: clamped.endMin },
    resourceId: pointer.resourceId,
  });
}

/** Named inputs for computeResizeDraft.
 * @remarks Português: Entradas nomeadas de computeResizeDraft.
 */
export interface ComputeResizeDraftInput {
  /** Original grabbed event placement.
   * @remarks Português: Posição original do evento arrastado.
   */
  origin: PlacementInfo;
  /** Current pointer slot.
   * @remarks Português: Slot atual do ponteiro.
   */
  pointer: PointerSlot;
  /** Gesture snap step in minutes.
   * @remarks Português: Passo do alinhamento do gesto em minutos.
   */
  slotMinutes: number;
  /** Minimum permitted interval length in minutes.
   * @remarks Português: Duração mínima permitida do intervalo em minutos.
   */
  minDurationMin: number;
  /** Visible grid limits in minutes.
   * @remarks Português: Limites visíveis da grade em minutos.
   */
  bounds: GridBounds;
  /** Resize endpoint; default end.
   * @remarks Português: Extremo do redimensionamento; padrão end.
   */
  edge?: ResizeEdge | undefined;
}

/** Move one endpoint, preserving the opposite endpoint and original resource.
 * @remarks Português: Move um extremo, preservando o extremo oposto e o recurso original.
 */

export function computeResizeDraft({
  origin,
  pointer,
  slotMinutes,
  minDurationMin,
  bounds,
  edge = 'end',
}: ComputeResizeDraftInput): DraftGeometry {
  if (edge === 'start') {
    const endDate = origin.endDateISO ?? origin.dateISO;
    if (origin.allDay) {
      const latestStart = shiftCalendarDate({ dateISO: endDate, days: -1 });
      return withResource({
        geometry: {
          dateISO: pointer.dateISO < latestStart ? pointer.dateISO : latestStart,
          startMin: 0,
          endMin: 0,
          endDateISO: endDate,
          allDay: true,
        },
        resourceId: origin.resourceId,
      });
    }
    const endAbsolute = calendarDayOffset(origin.dateISO, endDate) * 1440 + origin.endMin;
    const requestedStart =
      calendarDayOffset(origin.dateISO, pointer.dateISO) * 1440 +
      (pointer.dateOnly
        ? origin.startMin
        : snapMinute({ minute: pointer.minuteOfDay, slotMinutes }));
    const minimumDuration = pointer.dateOnly
      ? minDurationMin
      : Math.max(minDurationMin, slotMinutes);
    let startAbsolute = Math.min(requestedStart, endAbsolute - minimumDuration);
    if (!pointer.dateOnly && pointer.dateISO === origin.dateISO && endDate === origin.dateISO) {
      startAbsolute = Math.min(
        Math.max(startAbsolute, bounds.startMin),
        endAbsolute - minimumDuration,
      );
    }
    const start = normalizeCalendarMinute({ dateISO: origin.dateISO, minute: startAbsolute });
    return withResource({
      geometry: {
        dateISO: start.dateISO,
        startMin: start.minute,
        endMin: origin.endMin,
        ...(origin.endDateISO || start.dateISO !== endDate ? { endDateISO: endDate } : {}),
      },
      resourceId: origin.resourceId,
    });
  }
  if (pointer.dateOnly && !origin.allDay) {
    const endDate = shiftCalendarDate({
      dateISO: pointer.dateISO,
      days: origin.endMin === 0 ? 1 : 0,
    });
    const requestedEnd = calendarDayOffset(origin.dateISO, endDate) * 1440 + origin.endMin;
    const end = normalizeCalendarMinute({
      dateISO: origin.dateISO,
      minute: Math.max(requestedEnd, origin.startMin + minDurationMin),
    });
    return withResource({
      geometry: {
        dateISO: origin.dateISO,
        startMin: origin.startMin,
        endDateISO: end.dateISO,
        endMin: end.minute,
      },
      resourceId: origin.resourceId,
    });
  }
  if (origin.allDay) {
    const days = Math.max(1, calendarDayOffset(origin.dateISO, pointer.dateISO) + 1);
    return withResource({
      geometry: {
        dateISO: origin.dateISO,
        startMin: 0,
        endMin: 0,
        endDateISO: shiftCalendarDate({ dateISO: origin.dateISO, days }),
        allDay: true,
      },
      resourceId: origin.resourceId,
    });
  }
  if (
    pointer.dateISO !== origin.dateISO ||
    (origin.endDateISO && origin.endDateISO !== origin.dateISO)
  ) {
    const requestedEnd =
      calendarDayOffset(origin.dateISO, pointer.dateISO) * 1440 +
      snapMinute({ minute: pointer.minuteOfDay, slotMinutes });
    const end = normalizeCalendarMinute({
      dateISO: origin.dateISO,
      minute: Math.max(requestedEnd, origin.startMin + Math.max(minDurationMin, slotMinutes)),
    });
    return withResource({
      geometry: {
        dateISO: origin.dateISO,
        startMin: origin.startMin,
        endDateISO: end.dateISO,
        endMin: end.minute,
      },
      resourceId: origin.resourceId,
    });
  }
  const snappedEnd = snapMinute({
    minute: pointer.minuteOfDay,
    slotMinutes,
    rounding: 'nearest',
  });
  const minimumEnd = origin.startMin + Math.max(minDurationMin, slotMinutes);
  const boundedEnd = clamp({
    value: Math.max(snappedEnd, minimumEnd),
    lowerBound: minimumEnd,
    upperBound: bounds.endMin,
  });
  return withResource({
    geometry: { dateISO: origin.dateISO, startMin: origin.startMin, endMin: boundedEnd },
    resourceId: origin.resourceId,
  });
}

/** Named inputs for computeSelectDraft.
 * @remarks Português: Entradas nomeadas de computeSelectDraft.
 */
export interface ComputeSelectDraftInput {
  /** Selection starting slot.
   * @remarks Português: Slot inicial da seleção.
   */
  anchor: PointerSlot;
  /** Current selection pointer slot.
   * @remarks Português: Slot atual do ponteiro de seleção.
   */
  cursor: PointerSlot;
  /** Gesture snap step in minutes.
   * @remarks Português: Passo do alinhamento do gesto em minutos.
   */
  slotMinutes: number;
  /** Minimum permitted interval length in minutes.
   * @remarks Português: Duração mínima permitida do intervalo em minutos.
   */
  minDurationMin: number;
  /** Visible grid limits in minutes.
   * @remarks Português: Limites visíveis da grade em minutos.
   */
  bounds: GridBounds;
}

/** Snap selection outward within the anchor day and resource, respecting minimum duration.
 * @remarks Português: Alinha a seleção para fora no dia e recurso da âncora, respeitando a duração mínima.
 */

export function computeSelectDraft({
  anchor,
  cursor,
  slotMinutes,
  minDurationMin,
  bounds,
}: ComputeSelectDraftInput): DraftGeometry {
  if (anchor.allDay) {
    const start = anchor.dateISO < cursor.dateISO ? anchor.dateISO : cursor.dateISO;
    const last = anchor.dateISO > cursor.dateISO ? anchor.dateISO : cursor.dateISO;
    return withResource({
      geometry: {
        dateISO: start,
        startMin: 0,
        endMin: 0,
        endDateISO: shiftCalendarDate({ dateISO: last, days: 1 }),
        allDay: true,
      },
      resourceId: anchor.resourceId,
    });
  }
  const lowerMinute = Math.min(anchor.minuteOfDay, cursor.minuteOfDay);
  const upperMinute = Math.max(anchor.minuteOfDay, cursor.minuteOfDay);
  const snappedStart = snapMinute({
    minute: lowerMinute,
    slotMinutes,
    rounding: 'floor',
  });
  const snappedEnd = snapMinute({
    minute: upperMinute,
    slotMinutes,
    rounding: 'ceil',
  });
  const minimumSpan = Math.max(minDurationMin, slotMinutes);
  const start = clamp({
    value: snappedStart,
    lowerBound: bounds.startMin,
    upperBound: bounds.endMin - minimumSpan,
  });
  const end = clamp({
    value: Math.max(snappedEnd, start + minimumSpan),
    lowerBound: start + minimumSpan,
    upperBound: bounds.endMin,
  });
  return withResource({
    geometry: { dateISO: anchor.dateISO, startMin: start, endMin: end },
    resourceId: anchor.resourceId,
  });
}
