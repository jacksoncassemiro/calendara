export {
  layoutDay,
  type GeoInput,
  type GeoGrid,
  type GeoBlock,
} from './geometry.js';

/** Altura total (px) do corpo do grid para uma escala. */
export function gridBodyHeight(startHour: number, endHour: number, pxPerMinute: number): number {
  return (endHour - startHour) * 60 * pxPerMinute;
}
