/** Shared presentation geometry. @remarks Português: Geometria compartilhada de apresentação. */
import type { CSSProperties } from 'react';
import type { Segment } from '../../../core/index.js';

export function eventAccentStyle(color: string | undefined): CSSProperties {
  return color
    ? { boxShadow: `inset 3px 0 0 ${color}, inset 0 0 0 1px var(--mc-color-event-border)` }
    : {};
}

export const GUTTER_PX = 56;

export function toPx(value: number): string {
  return `${value}px`;
}

/** Vertical segment geometry. @remarks Português: Geometria vertical do segmento. */
export interface SegmentStyleInput {
  /** Interval in minutes of day. @remarks Português: Intervalo em minutos do dia. */
  segment: Segment;
  /** Convert minutes of day to vertical px. @remarks Português: Converte minutos do dia em px verticais. */
  minuteToY: (minuteOfDay: number) => number;
  /** Pixels per minute. @remarks Português: Pixels por minuto. */
  pxPerMinute: number;
}
/** Absolute vertical geometry. @remarks Português: Geometria vertical absoluta. */
export function segmentStyle({
  segment,
  minuteToY,
  pxPerMinute,
}: SegmentStyleInput): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    top: toPx(minuteToY(segment.startMin)),
    height: toPx((segment.endMin - segment.startMin) * pxPerMinute),
  };
}

/** Reserve an outer gutter without separating internal lanes. @remarks Português: Reserva margem externa sem separar linhas internas. */
export function timedEventWidth({
  block,
  overlap = false,
}: {
  /** Fractional left position and width within the column. @remarks Português: Posição esquerda e largura proporcionais à coluna. */
  block: { left: number; width: number };
  /** Partial overlap reserves space on each event; defaults to false. @remarks Português: Sobreposição parcial reserva espaço em cada evento; padrão false. */
  overlap?: boolean;
}): string {
  const width = block.width * 100;
  const touchesOuterEdge = block.left + block.width >= 1 - 1e-6;
  return overlap || touchesOuterEdge
    ? `calc(${width}% - min(var(--mc-event-gap, 8px), ${width / 4}%))`
    : `${width}%`;
}
