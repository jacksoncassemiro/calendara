/** Validate capacity first, then repeat with preparation buffers added to each interval. */
import type { DraftReason } from './model.js';

/** Um intervalo ocupado (minutos-do-dia), já sem o evento em movimento. */
export interface BusyInterval {
  startMin: number;
  endMin: number;
}

/** Parâmetros de ocupação de um recurso para o dia avaliado. */
export interface ResourceOccupancy {
  /** Lotação simultânea permitida (default 1). */
  capacity: number;
  /** Minutos de buffer antes de cada evento. */
  bufferBefore: number;
  /** Minutos de buffer depois de cada evento. */
  bufferAfter: number;
  /** Ocupações existentes no MESMO dia/recurso, JÁ excluindo o evento em movimento. */
  busy: readonly BusyInterval[];
}

/** Resultado da validação de ocupação. */
export interface OccupancyResult {
  valid: boolean;
  reason: Extract<DraftReason, 'ok' | 'over-capacity' | 'buffer-conflict'>;
}

/** Pico de concorrência (nº de intervalos simultâneos) por varredura de fronteiras. */
function peakConcurrency(intervals: readonly BusyInterval[]): number {
  const boundaries: { minute: number; delta: number }[] = [];
  for (const interval of intervals) {
    // Fim == início não conta como sobreposição (fecha antes de abrir no mesmo minuto).
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

/** Extend full intervals; negative minutes intentionally reach the preceding date. */
function expandByBuffer(
  interval: BusyInterval,
  bufferBefore: number,
  bufferAfter: number,
): BusyInterval {
  return {
    startMin: interval.startMin - bufferBefore,
    endMin: interval.endMin + bufferAfter,
  };
}

/** Mesma varredura, restrita ao intervalo em que o candidato está ocupando o recurso. */
function concurrencyDuringCandidate(
  candidate: BusyInterval,
  busy: readonly BusyInterval[],
): number {
  const overlapping = busy
    .map((interval) => ({
      startMin: Math.max(interval.startMin, candidate.startMin),
      endMin: Math.min(interval.endMin, candidate.endMin),
    }))
    .filter((interval) => interval.startMin < interval.endMin);
  return peakConcurrency([...overlapping, candidate]);
}

/**
 * O candidato (nova posição do evento) cabe na lotação/buffer do recurso?
 * `valid=false` com `reason` explicando LOTAÇÃO ('over-capacity') ou BUFFER ('buffer-conflict').
 */
export function validateOccupancy(
  candidate: BusyInterval,
  occupancy: ResourceOccupancy,
): OccupancyResult {
  const capacity = occupancy.capacity > 0 ? occupancy.capacity : 1;

  // 1) Concorrência SEM buffers → lotação pura.
  const bareConcurrency = concurrencyDuringCandidate(candidate, occupancy.busy);
  const exceedsCapacity = bareConcurrency > capacity;
  if (exceedsCapacity) return { valid: false, reason: 'over-capacity' };

  // 2) Concorrência COM buffers estendidos → conflito de buffer.
  const hasBuffer = occupancy.bufferBefore > 0 || occupancy.bufferAfter > 0;
  if (hasBuffer) {
    const expanded = occupancy.busy.map((interval) =>
      expandByBuffer(interval, occupancy.bufferBefore, occupancy.bufferAfter),
    );
    const bufferedCandidate = expandByBuffer(
      candidate,
      occupancy.bufferBefore,
      occupancy.bufferAfter,
    );
    const bufferedConcurrency = concurrencyDuringCandidate(bufferedCandidate, expanded);
    const violatesBuffer = bufferedConcurrency > capacity;
    if (violatesBuffer) return { valid: false, reason: 'buffer-conflict' };
  }

  return { valid: true, reason: 'ok' };
}
