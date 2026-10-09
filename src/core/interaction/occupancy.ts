import type { DraftReason } from './model.js';

/** Occupied interval relative to the evaluated day; adjacent-day minutes are allowed.
 * @remarks Português: Intervalo ocupado relativo ao dia avaliado; permite minutos de dias adjacentes.
 */
export interface BusyInterval {
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
}

/** Capacity, buffers and existing intervals for the evaluated resource.
 * @remarks Português: Capacidade, buffers e intervalos existentes do recurso avaliado.
 */
export interface ResourceOccupancy {
  /** Simultaneous resource limit; Infinity represents unlimited capacity.
   * @remarks Português: Limite simultâneo do recurso; Infinity representa capacidade ilimitada.
   */
  capacity: number;

  /** Preparation interval before each event, in minutes.
   * @remarks Português: Intervalo de preparação antes de cada evento, em minutos.
   */
  bufferBefore: number;

  /** Preparation interval after each event, in minutes.
   * @remarks Português: Intervalo de preparação depois de cada evento, em minutos.
   */
  bufferAfter: number;

  /** Existing intervals for this resource, excluding the moving occurrence.
   * @remarks Português: Intervalos existentes do recurso, excluindo a ocorrência movida.
   */
  busy: readonly BusyInterval[];
}

/** Capacity and preparation-buffer validation result.
 * @remarks Português: Resultado da validação de capacidade e buffers de preparação.
 */
export interface OccupancyResult {
  /** Whether the proposed interval satisfies validation.
   * @remarks Português: Indica se o intervalo proposto atende à validação.
   */
  valid: boolean;
  /** Availability or occupancy validation result.
   * @remarks Português: Resultado da validação de disponibilidade ou ocupação.
   */
  reason: Extract<DraftReason, 'ok' | 'over-capacity' | 'buffer-conflict'>;
}

function peakConcurrency(intervals: readonly BusyInterval[]): number {
  const boundaries: { minute: number; delta: number }[] = [];
  for (const interval of intervals) {
    boundaries.push({ minute: interval.startMin, delta: 1 });
    boundaries.push({ minute: interval.endMin, delta: -1 });
  }
  boundaries.sort((first, second) => first.minute - second.minute || first.delta - second.delta);
  let current = 0;
  let peak = 0;
  for (const boundary of boundaries) {
    current += boundary.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

function expandByBuffer({
  interval,
  bufferBefore,
  bufferAfter,
}: {
  /** Reservation interval in minutes. / PT: Intervalo da reserva em minutos. */
  interval: BusyInterval;
  /** Preparation minutes before the start. / PT: Minutos de preparo antes do início. */
  bufferBefore: number;
  /** Preparation minutes after the end. / PT: Minutos de preparo após o fim. */
  bufferAfter: number;
}): BusyInterval {
  return {
    startMin: interval.startMin - bufferBefore,
    endMin: interval.endMin + bufferAfter,
  };
}

function concurrencyDuringCandidate({
  candidate,
  busy,
}: {
  /** Proposed occupied interval. @remarks Português: Intervalo ocupado proposto. */
  candidate: BusyInterval;
  /** Existing reservations. @remarks Português: Reservas existentes. */
  busy: readonly BusyInterval[];
}): number {
  const overlapping = busy
    .map((interval) => ({
      startMin: Math.max(interval.startMin, candidate.startMin),
      endMin: Math.min(interval.endMin, candidate.endMin),
    }))
    .filter((interval) => interval.startMin < interval.endMin);
  return peakConcurrency([...overlapping, candidate]);
}

/** Occupancy-validation parameters. @remarks Português: Parâmetros da validação de ocupação. */
export interface ValidateOccupancyInput {
  /** Proposed occupied interval in minutes. @remarks Português: Intervalo ocupado proposto em minutos. */
  candidate: BusyInterval;
  /** Capacity, buffers and existing reservations. @remarks Português: Capacidade, buffers e reservas existentes. */
  occupancy: ResourceOccupancy;
}

/** Validate capacity and preparation buffers. @remarks Português: Valida capacidade e buffers de preparação. */
export function validateOccupancy({
  candidate,
  occupancy,
}: ValidateOccupancyInput): OccupancyResult {
  const capacity = occupancy.capacity > 0 ? occupancy.capacity : 1;

  const bareConcurrency = concurrencyDuringCandidate({ candidate, busy: occupancy.busy });
  const exceedsCapacity = bareConcurrency > capacity;
  if (exceedsCapacity) return { valid: false, reason: 'over-capacity' };

  const hasBuffer = occupancy.bufferBefore > 0 || occupancy.bufferAfter > 0;
  if (hasBuffer) {
    const expanded = occupancy.busy.map((interval) =>
      expandByBuffer({
        interval,
        bufferBefore: occupancy.bufferBefore,
        bufferAfter: occupancy.bufferAfter,
      }),
    );
    const bufferedCandidate = expandByBuffer({
      interval: candidate,
      bufferBefore: occupancy.bufferBefore,
      bufferAfter: occupancy.bufferAfter,
    });
    const bufferedConcurrency = concurrencyDuringCandidate({
      candidate: bufferedCandidate,
      busy: expanded,
    });
    const violatesBuffer = bufferedConcurrency > capacity;
    if (violatesBuffer) return { valid: false, reason: 'buffer-conflict' };
  }

  return { valid: true, reason: 'ok' };
}
