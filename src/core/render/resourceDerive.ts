import type { TemporalLike } from '../date/temporal.js';
import type { ConstraintSet } from '../types/constraint.js';
import type { EventOccurrence } from '../types/event.js';
import type { CalendarResource } from '../types/resource.js';
import { buildDays, resourceBusyIntervals, type DayData, type Segment } from './derive.js';
import { resourceConstraintSet, resourceSlotBands } from './resourceConstraints.js';
export { resourceConstraintSet } from './resourceConstraints.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

const DEFAULT_CAPACITY = 1;

/** Capacity inheritance inputs.
 * @remarks Português: Entradas de herança da capacidade.
 */
export interface ResourceCapacityInput {
  /** Resource whose capacity may override the default.
   * @remarks Português: Recurso cuja capacidade pode substituir o padrão.
   */
  resource: CalendarResource;
  /** Inherited capacity; default 1, false means unlimited.
   * @remarks Português: Capacidade herdada; padrão 1, false remove o limite.
   */
  defaultCapacity?: number | false;
}

/** Resolve simultaneous capacity; false means unlimited and omission inherits the default.
 * @remarks Português: Resolve capacidade simultânea; false remove o limite e ausência herda o padrão.
 */
export function resourceCapacity({
  resource,
  defaultCapacity = DEFAULT_CAPACITY,
}: ResourceCapacityInput): number {
  const configured = resource.capacity ?? defaultCapacity;
  return configured === false ? Infinity : configured;
}

/** Resource-specific day events, buffers and capacity status.
 * @remarks Português: Eventos do dia, buffers e situação da capacidade por recurso.
 */
export interface ResourceColumnData {
  /** Resource whose availability and occupancy are represented.
   * @remarks Português: Recurso cuja disponibilidade e ocupação estão representadas.
   */
  resource: CalendarResource;
  /** Resolved simultaneous capacity; Infinity means unlimited.
   * @remarks Português: Capacidade simultânea resolvida; Infinity remove o limite.
   */
  capacity?: number;

  /** Display-day data filtered to this resource.
   * @remarks Português: Dados do dia exibido filtrados para este recurso.
   */
  day: DayData;

  /** Preparation intervals clipped to the visible grid.
   * @remarks Português: Intervalos de preparação recortados à grade visível.
   */
  bufferSegments: Segment[];

  /** Peak simultaneous event count for the day.
   * @remarks Português: Maior quantidade de eventos simultâneos no dia.
   */
  maxConcurrency: number;

  /** Whether peak simultaneous occupancy exceeds capacity.
   * @remarks Português: Indica se o pico de ocupação simultânea excede a capacidade.
   */
  overCapacity: boolean;
}

/** Occurrence filtering inputs.
 * @remarks Português: Entradas do filtro de ocorrências.
 */
export interface OccurrencesForResourceInput {
  /** Expanded event occurrences to filter.
   * @remarks Português: Ocorrências expandidas dos eventos a filtrar.
   */
  occurrences: readonly EventOccurrence[];
  /** Assigned resource ID to select.
   * @remarks Português: ID do recurso atribuído a selecionar.
   */
  resourceId: string;
}

/** Select occurrences assigned to the requested resource.
 * @remarks Português: Seleciona ocorrências atribuídas ao recurso solicitado.
 */
export function occurrencesForResource({
  occurrences,
  resourceId,
}: OccurrencesForResourceInput): EventOccurrence[] {
  return occurrences.filter((occurrence) => {
    const resourceIds = occurrence.event.resourceIds ?? [];
    return resourceIds.includes(resourceId);
  });
}

/** Peak simultaneous events including all-day occupancy; touching endpoints do not overlap.
 * @remarks Português: Pico de eventos simultâneos incluindo dia inteiro; extremos que se tocam não sobrepõem.
 */
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

/** Named inputs for bufferSegmentsFor.
 * @remarks Português: Entradas nomeadas de bufferSegmentsFor.
 */
interface BufferSegmentsForInput {
  /** Resource whose buffers are projected.
   * @remarks Português: Recurso cujos buffers serão projetados.
   */
  resource: CalendarResource;
  /** Full occupied intervals before clipping.
   * @remarks Português: Intervalos completos ocupados antes do recorte.
   */
  intervals: readonly Segment[];
  /** Inclusive grid start in minutes.
   * @remarks Português: Início inclusivo da grade em minutos.
   */
  gridStartMin: number;
  /** Exclusive grid end in minutes.
   * @remarks Português: Fim exclusivo da grade em minutos.
   */
  gridEndMin: number;
}

function bufferSegmentsFor({
  resource,
  intervals,
  gridStartMin,
  gridEndMin,
}: BufferSegmentsForInput): Segment[] {
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

/** Named inputs for buildResourceColumns.
 * @remarks Português: Entradas nomeadas de buildResourceColumns.
 */
export interface BuildResourceColumnsInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Resources available for display.
   * @remarks Português: Recursos disponíveis para exibição.
   */
  resources: readonly CalendarResource[];
  /** Display date receiving the projected intervals.
   * @remarks Português: Data exibida que recebe os intervalos projetados.
   */
  day: PlainDate;
  /** Expanded event occurrences.
   * @remarks Português: Ocorrências expandidas dos eventos.
   */
  occurrences: readonly EventOccurrence[];
  /** Global rules retained for every resource.
   * @remarks Português: Regras gerais preservadas em todos os recursos.
   */
  globalConstraints: ConstraintSet;
  /** Visible hour window.
   * @remarks Português: Janela de horas visíveis.
   */
  grid: { startHour: number; endHour: number };
  /** IANA timezone used to project event intervals.
   * @remarks Português: Fuso IANA usado para projetar intervalos de eventos.
   */
  displayTimeZone: string;
  /** Visible resource filter; omitted shows all.
   * @remarks Português: Filtro de recursos visíveis; ausente exibe todos.
   */
  visibleResourceIds?: readonly string[] | undefined;
  /** Inherited capacity; default 1, false means unlimited.
   * @remarks Português: Capacidade herdada; padrão 1, false remove o limite.
   */
  defaultCapacity?: number | false | undefined;
}

/** Build ordered resource columns for one day, optionally filtering visible resource IDs.
 * @remarks Português: Monta colunas ordenadas de recursos para um dia, com filtro opcional de IDs visíveis.
 */

export function buildResourceColumns({
  temporal,
  resources,
  day,
  occurrences,
  globalConstraints,
  grid,
  displayTimeZone,
  visibleResourceIds,
  defaultCapacity = DEFAULT_CAPACITY,
}: BuildResourceColumnsInput): ResourceColumnData[] {
  const gridStartMin = grid.startHour * 60;
  const gridEndMin = grid.endHour * 60;
  const orderedResources = [...resources].sort(
    (first, second) => (first.order ?? 0) - (second.order ?? 0),
  );

  const columns: ResourceColumnData[] = [];
  for (const resource of orderedResources) {
    const isVisible = visibleResourceIds === undefined || visibleResourceIds.includes(resource.id);
    if (!isVisible) continue;

    const resourceOccurrences = occurrencesForResource({
      occurrences,
      resourceId: resource.id,
    });
    const constraints = resourceConstraintSet({ resource, global: globalConstraints });
    const dayData = buildDays({
      temporal,
      days: [day],
      occurrences: resourceOccurrences,
      constraints,
      grid,
      displayTimeZone,
    })[0]!;
    dayData.nonBusiness = resourceSlotBands({
      constraints,
      date: day.toString(),
      startMin: gridStartMin,
      endMin: gridEndMin,
    });

    const concurrency = maxConcurrency(dayData);
    const capacity = resourceCapacity({ resource, defaultCapacity });
    columns.push({
      resource,
      capacity,
      day: dayData,
      bufferSegments: bufferSegmentsFor({
        resource,
        intervals: resourceBusyIntervals({
          temporal,
          day,
          occurrences: resourceOccurrences.filter((occurrence) => !occurrence.event.time.allDay),
          displayTimeZone,
        }),
        gridStartMin,
        gridEndMin,
      }),
      maxConcurrency: concurrency,
      overCapacity: concurrency > capacity,
    });
  }
  return columns;
}
