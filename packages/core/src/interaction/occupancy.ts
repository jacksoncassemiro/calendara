/**
 * Validação DURA de ocupação de recurso (Fase 4) — recusa drop/resize por LOTAÇÃO ou BUFFER.
 *
 * Até a Fase 3B `capacity`/`bufferBefore`/`bufferAfter` eram só visuais/informativos. Aqui viram
 * regra: ao mover/redimensionar um evento sobre um recurso, a nova posição precisa caber na
 * lotação e respeitar os buffers do recurso.
 *
 * Ideia central (genérica, sem regra de negócio — ADR-006): o buffer apenas ESTENDE o intervalo
 * ocupado de cada evento (`[start - bufferBefore, end + bufferAfter]`). Assim UMA varredura de
 * concorrência sobre os intervalos estendidos captura lotação e buffer de uma vez. Se a
 * concorrência já estoura SEM os buffers, o motivo é `over-capacity`; se só estoura COM eles,
 * é `buffer-conflict`.
 */
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

/** Estende um intervalo pelos buffers (recortado em 0). */
function expandByBuffer(
	interval: BusyInterval,
	bufferBefore: number,
	bufferAfter: number,
): BusyInterval {
	return {
		startMin: Math.max(0, interval.startMin - bufferBefore),
		endMin: interval.endMin + bufferAfter,
	};
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
	const rawIntervals = [...occupancy.busy, candidate];

	// 1) Concorrência SEM buffers → lotação pura.
	const bareConcurrency = peakConcurrency(rawIntervals);
	const exceedsCapacity = bareConcurrency > capacity;
	if (exceedsCapacity) return { valid: false, reason: 'over-capacity' };

	// 2) Concorrência COM buffers estendidos → conflito de buffer.
	const hasBuffer = occupancy.bufferBefore > 0 || occupancy.bufferAfter > 0;
	if (hasBuffer) {
		const expanded = rawIntervals.map((interval) =>
			expandByBuffer(interval, occupancy.bufferBefore, occupancy.bufferAfter),
		);
		const bufferedConcurrency = peakConcurrency(expanded);
		const violatesBuffer = bufferedConcurrency > capacity;
		if (violatesBuffer) return { valid: false, reason: 'buffer-conflict' };
	}

	return { valid: true, reason: 'ok' };
}
