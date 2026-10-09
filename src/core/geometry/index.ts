export {
  layoutDay,
  type GeoInput,
  type GeoGrid,
  type GeoBlock,
  type LayoutDayInput,
} from './geometry.js';

/** Named inputs for gridBodyHeight.
 * @remarks Português: Entradas nomeadas de gridBodyHeight.
 */
export interface GridBodyHeightInput {
  /** Inclusive grid start in hours.
   * @remarks Português: Início inclusivo da grade em horas.
   */
  startHour: number;
  /** Exclusive grid end in hours.
   * @remarks Português: Fim exclusivo da grade em horas.
   */
  endHour: number;
  /** Scale in pixels per minute.
   * @remarks Português: Escala em pixels por minuto.
   */
  pxPerMinute: number;
}

/** Grid body height in pixels for the supplied hour window and scale.
 * @remarks Português: Altura do corpo da grade em pixels para a janela e escala fornecidas.
 */

export function gridBodyHeight({ startHour, endHour, pxPerMinute }: GridBodyHeightInput): number {
  return (endHour - startHour) * 60 * pxPerMinute;
}
