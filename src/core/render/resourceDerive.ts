/**
 * Derivações resource-aware (Fase 3B / Agenda Desvinculada, ADR-006).
 *
 * A lib trata `Resource` como conceito GENÉRICO: filtra ocorrências por `resourceIds`, aplica o
 * horário comercial PRÓPRIO do recurso (se houver), calcula bandas de buffer e a lotação
 * (concorrência máxima vs. `capacity`). Nenhuma regra de negócio — só o padrão de calendário.
 */
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarResource } from '../types/resource.js';
import type { EventOccurrence } from '../types/event.js';
import type { ConstraintSet } from '../types/constraint.js';
import { buildDays, resourceBusyIntervals, type DayData, type Segment } from './derive.js';
import { resourceConstraintSet, resourceSlotBands } from './resourceConstraints.js';
export { resourceConstraintSet } from './resourceConstraints.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Capacidade padrão de um recurso quando não especificada. */
const DEFAULT_CAPACITY = 1;
export function resourceCapacity(resource:CalendarResource,defaultCapacity:number|false=DEFAULT_CAPACITY):number {
 const configured=resource.capacity ?? defaultCapacity;return configured===false ? Infinity : configured;
}

export interface ResourceColumnData {
  resource: CalendarResource;
  capacity?: number;
  /** Dados do dia (timed/allDay/fundo) já filtrados para este recurso. */
  day: DayData;
  /** Bandas de buffer (antes/depois de cada evento) do recurso. */
  bufferSegments: Segment[];
  /** Maior número de eventos simultâneos no dia. */
  maxConcurrency: number;
  /** Lotação estourada (concorrência > capacity). */
  overCapacity: boolean;
}

/** Ocorrências que ocupam um dado recurso (via `event.resourceIds`). */
export function occurrencesForResource(
  occurrences: readonly EventOccurrence[],
  resourceId: string,
): EventOccurrence[] {
  return occurrences.filter((occurrence) => {
    const resourceIds = occurrence.event.resourceIds ?? [];
    return resourceIds.includes(resourceId);
  });
}

/** Maior concorrência (nº de eventos simultâneos) entre os timed de um dia. */
export function maxConcurrency(day: DayData): number {
  const boundaries: { minute: number; delta: number }[] = [];
  for (const placement of day.timed) {
    boundaries.push({ minute: placement.startMin, delta: 1 });
    boundaries.push({ minute: placement.endMin, delta: -1 });
  }
  boundaries.sort((first, second) => first.minute - second.minute || first.delta - second.delta);
  let current = day.allDay.length;
  let peak = current;
  for (const boundary of boundaries) {
    current += boundary.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

/** Bandas de buffer (antes/depois) de cada evento do recurso, recortadas ao grid. */
function bufferSegmentsFor(
  resource: CalendarResource,
  intervals: readonly Segment[],
  gridStartMin: number,
  gridEndMin: number,
): Segment[] {
  const bufferBefore = resource.bufferBefore ?? 0;
  const bufferAfter = resource.bufferAfter ?? 0;
  const hasBuffer = bufferBefore > 0 || bufferAfter > 0;
  if (!hasBuffer) return [];
  const segments: Segment[] = [];
  for (const placement of intervals) {
    if (bufferBefore > 0) {
      const start = Math.max(gridStartMin, placement.startMin - bufferBefore);
      const end = Math.min(gridEndMin, placement.startMin);
      const hasSpan = end > start;
      if (hasSpan) segments.push({ startMin: start, endMin: end });
    }
    if (bufferAfter > 0) {
      const end = Math.min(gridEndMin, placement.endMin + bufferAfter);
      const start = Math.max(gridStartMin, placement.endMin);
      const hasSpan = end > start;
      if (hasSpan) segments.push({ startMin: start, endMin: end });
    }
  }
  return segments;
}

/**
 * Monta uma coluna por recurso para um único dia (base da Multiagenda e da Timeline).
 * `visibleResourceIds` (se dado) filtra quais recursos entram.
 */
export function buildResourceColumns(
  temporal: TemporalLike,
  resources: readonly CalendarResource[],
  day: PlainDate,
  occurrences: readonly EventOccurrence[],
  globalConstraints: ConstraintSet,
  grid: { startHour: number; endHour: number },
  displayTimeZone: string,
  visibleResourceIds?: readonly string[],
  defaultCapacity:number|false=DEFAULT_CAPACITY,
): ResourceColumnData[] {
  const gridStartMin = grid.startHour * 60;
  const gridEndMin = grid.endHour * 60;
  const orderedResources = [...resources].sort(
    (first, second) => (first.order ?? 0) - (second.order ?? 0),
  );

  const columns: ResourceColumnData[] = [];
  for (const resource of orderedResources) {
    const isVisible = visibleResourceIds === undefined || visibleResourceIds.includes(resource.id);
    if (!isVisible) continue;

    const resourceOccurrences = occurrencesForResource(occurrences, resource.id);
    const constraints = resourceConstraintSet(resource, globalConstraints);
    const dayData = buildDays(temporal, [day], resourceOccurrences, constraints, grid, displayTimeZone)[0]!;
    dayData.nonBusiness = resourceSlotBands(constraints, day.toString(), gridStartMin, gridEndMin);

    const concurrency = maxConcurrency(dayData);
    const capacity = resourceCapacity(resource,defaultCapacity);
    columns.push({
      resource,
      capacity,
      day: dayData,
      bufferSegments: bufferSegmentsFor(resource,
        resourceBusyIntervals(temporal,day,resourceOccurrences.filter(occurrence=>!occurrence.event.time.allDay),displayTimeZone),
        gridStartMin,gridEndMin),
      maxConcurrency: concurrency,
      overCapacity: concurrency > capacity,
    });
  }
  return columns;
}
