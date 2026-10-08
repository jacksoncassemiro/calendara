/** Shared geometry styles; colors and typography belong to the stylesheet. */
import type { CSSProperties } from 'react';
import type { Segment } from '../../../core/index.js';

/** Event accent preserves the default border when a custom color is supplied. */
export function eventAccentStyle(color: string | undefined): CSSProperties {
  return color
    ? { boxShadow: `inset 3px 0 0 ${color}, inset 0 0 0 1px var(--mc-color-event-border)` }
    : {};
}

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
