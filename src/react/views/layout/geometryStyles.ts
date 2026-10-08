/**
 * Helpers de APRESENTAÇÃO compartilhados pelas views de time-grid/recurso. Fonte ÚNICA — antes
 * `toPx`, `GUTTER_PX` e o estilo de segmento estavam duplicados em `TimeGrid.tsx` e
 * `resourceViews.tsx` (o segundo chamava o helper de `bandStyle`, idêntico ao `segmentStyle`).
 *
 * Apenas GEOMETRIA (posição/altura absolutas) vive aqui — cor/borda/tipografia vêm das classes
 * `mc-*` do pacote de estilos, não de inline.
 */
import type { CSSProperties } from 'react';
import type { Segment } from '../../../core/index.js';

/** Largura da calha (eixo de horas) em px. */
export const GUTTER_PX = 56;

/** Formata um número como pixels. */
export function toPx(value: number): string {
	return `${value}px`;
}

/** Estilo absoluto (top/height) de um segmento vertical em minutos-do-dia. */
export function segmentStyle(
	segment: Segment,
	minuteToY: (minuteOfDay: number) => number,
	pxPerMinute: number,
): CSSProperties {
	return {
		position: 'absolute',
		left: 0,
		right: 0,
		top: toPx(minuteToY(segment.startMin)),
		height: toPx((segment.endMin - segment.startMin) * pxPerMinute),
	};
}

/** Reserve the creation gutter only at the outer edge of side-by-side lanes. */
export function timedEventWidth(block: { left: number; width: number }, overlap = false): string {
  const width = block.width * 100;
  const touchesOuterEdge = block.left + block.width >= 1 - 1e-6;
  return overlap || touchesOuterEdge
    ? `calc(${width}% - min(var(--mc-event-gap, 8px), ${width / 4}%))`
    : `${width}%`;
}
