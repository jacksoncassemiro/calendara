/**
 * Geometria de GESTO (Fase 4) — pura, sem DOM, sem Temporal. Trabalha em minutos-do-dia.
 *
 * NÃO confundir com `geometry/geometry.ts` (o GeometryEngine de RENDER, que empacota eventos
 * existentes em colunas). Aqui é o inverso: converte o gesto do ponteiro
 * (mover/redimensionar/selecionar) numa NOVA posição tentativa, com SNAP à grade (`slotMinutes`),
 * duração mínima e recorte aos limites do grid. O resultado alimenta o fantasma e a avaliação.
 *
 * A dimensão de RECURSO não tem matemática nenhuma: é só carregada adiante (mover ⇒ recurso do
 * ponteiro, pois atravessar colunas reatribui; redimensionar/selecionar ⇒ recurso de origem/âncora).
 * Por isso a Timeline (eixo transposto) reusa estas funções sem mudança: quem decide se o minuto
 * veio de X ou de Y é o localizador do motor, não a geometria.
 */
import type { DraftGeometry, GridBounds, PlacementInfo, PointerSlot } from './model.js';

/** Copia o recurso para a geometria só quando existe (views de data ficam sem a chave). */
function withResource(geometry: DraftGeometry, resourceId: string | undefined): DraftGeometry {
	if (resourceId === undefined) return geometry;
	return { ...geometry, resourceId };
}

/** Modo de arredondamento ao snap. */
export type SnapRounding = 'nearest' | 'floor' | 'ceil';

/** Arredonda um minuto à grade de `slotMinutes`. */
export function snapMinute(
	minute: number,
	slotMinutes: number,
	rounding: SnapRounding = 'nearest',
): number {
	const hasGrid = slotMinutes > 0;
	if (!hasGrid) return Math.round(minute);
	const ratio = minute / slotMinutes;
	const snappedRatio =
		rounding === 'floor' ? Math.floor(ratio) : rounding === 'ceil' ? Math.ceil(ratio) : Math.round(ratio);
	return snappedRatio * slotMinutes;
}

/** Limita um valor a [lowerBound, upperBound]. */
function clamp(value: number, lowerBound: number, upperBound: number): number {
	return Math.max(lowerBound, Math.min(value, upperBound));
}

/**
 * Recorta [startMin, endMin] aos limites do grid PRESERVANDO a duração: se transbordar,
 * desliza a janela para dentro em vez de cortá-la (comportamento esperado ao arrastar).
 */
export function clampSpanToGrid(
	startMin: number,
	endMin: number,
	bounds: GridBounds,
): { startMin: number; endMin: number } {
	const duration = Math.max(0, endMin - startMin);
	const maxStart = bounds.endMin - duration;
	const overflowsBottom = startMin > maxStart;
	const clampedStart = overflowsBottom ? maxStart : Math.max(startMin, bounds.startMin);
	const finalStart = Math.max(bounds.startMin, clampedStart);
	return { startMin: finalStart, endMin: finalStart + duration };
}

/**
 * MOVER: mantém a duração do evento e reposiciona o início sob o ponto de agarre.
 * `grabOffsetMin` = quanto abaixo do topo do evento o usuário agarrou (mantém o agarre no lugar).
 */
export function computeMoveDraft(
	origin: PlacementInfo,
	pointer: PointerSlot,
	grabOffsetMin: number,
	slotMinutes: number,
	bounds: GridBounds,
): DraftGeometry {
	const duration = Math.max(0, origin.endMin - origin.startMin);
	const rawStart = pointer.minuteOfDay - grabOffsetMin;
	const snappedStart = snapMinute(rawStart, slotMinutes, 'nearest');
	const clamped = clampSpanToGrid(snappedStart, snappedStart + duration, bounds);
	// Recurso vem do PONTEIRO (não da origem): arrastar para outra coluna reatribui o recurso.
	return withResource(
		{ dateISO: pointer.dateISO, startMin: clamped.startMin, endMin: clamped.endMin },
		pointer.resourceId,
	);
}

/**
 * REDIMENSIONAR (borda inferior): mantém o início, move o fim para o ponteiro, respeitando a
 * duração mínima e o fundo do grid. O dia (e o recurso) não mudam — redimensiona na coluna de origem.
 */
export function computeResizeDraft(
	origin: PlacementInfo,
	pointer: PointerSlot,
	slotMinutes: number,
	minDurationMin: number,
	bounds: GridBounds,
): DraftGeometry {
	const snappedEnd = snapMinute(pointer.minuteOfDay, slotMinutes, 'nearest');
	const minimumEnd = origin.startMin + Math.max(minDurationMin, slotMinutes);
	const boundedEnd = clamp(Math.max(snappedEnd, minimumEnd), minimumEnd, bounds.endMin);
	return withResource(
		{ dateISO: origin.dateISO, startMin: origin.startMin, endMin: boundedEnd },
		origin.resourceId,
	);
}

/**
 * SELECIONAR: intervalo num único dia (o da âncora) e, nas views de recurso, num único recurso
 * (o da âncora — seleção não atravessa colunas). Ordena âncora/cursor, faz snap para fora
 * (floor no início, ceil no fim), garante duração mínima e recorta ao grid.
 */
export function computeSelectDraft(
	anchor: PointerSlot,
	cursor: PointerSlot,
	slotMinutes: number,
	minDurationMin: number,
	bounds: GridBounds,
): DraftGeometry {
	const lowerMinute = Math.min(anchor.minuteOfDay, cursor.minuteOfDay);
	const upperMinute = Math.max(anchor.minuteOfDay, cursor.minuteOfDay);
	const snappedStart = snapMinute(lowerMinute, slotMinutes, 'floor');
	const snappedEnd = snapMinute(upperMinute, slotMinutes, 'ceil');
	const minimumSpan = Math.max(minDurationMin, slotMinutes);
	const start = clamp(snappedStart, bounds.startMin, bounds.endMin - minimumSpan);
	const end = clamp(Math.max(snappedEnd, start + minimumSpan), start + minimumSpan, bounds.endMin);
	return withResource({ dateISO: anchor.dateISO, startMin: start, endMin: end }, anchor.resourceId);
}
