import { formatHourLabel } from '../formatting/timeLabels.js';

/** Focusable slots that preserve column pointer gestures. @remarks Português: Slots focáveis que preservam os gestos de ponteiro da coluna. */
export function SlotCells(props: {
  /** Visible date in YYYY-MM-DD format. @remarks Português: Data visível no formato YYYY-MM-DD. */
  dateISO: string;
  /** Resource associated with this surface. @remarks Português: Recurso associado a esta superfície. */
  resourceId?: string;
  /** Allow initial keyboard focus in this column. @remarks Português: Permite o foco inicial por teclado nesta coluna. */
  first: boolean;
  /** Inclusive start in minutes since midnight. @remarks Português: Início inclusivo em minutos desde meia-noite. */
  startMin: number;
  /** Exclusive end in minutes since midnight. @remarks Português: Fim exclusivo em minutos desde meia-noite. */
  endMin: number;
  /** Minutes represented by each background slot. @remarks Português: Minutos representados por cada slot de fundo. */
  slotMinutes: number;
  /** Pixels per minute along the time axis. @remarks Português: Pixels por minuto no eixo de tempo. */
  pxPerMinute: number;
  /** Language tag for labels. @remarks Português: Código de idioma dos rótulos. */
  locale?: string;
  /** Place slots on the horizontal time axis. @remarks Português: Posiciona os slots no eixo de tempo horizontal. */
  horizontal?: boolean;
}) {
  const cells = [];
  for (let minute = props.startMin; minute < props.endMin; minute += props.slotMinutes) {
    const end = Math.min(minute + props.slotMinutes, props.endMin);
    const offset = (minute - props.startMin) * props.pxPerMinute;
    const size = (end - minute) * props.pxPerMinute;
    cells.push(
      <button
        key={minute}
        type="button"
        className="mc-slot-cell"
        tabIndex={props.first && minute === props.startMin ? 0 : -1}
        data-mc-cell-date={props.dateISO}
        data-mc-cell-start={minute}
        data-mc-cell-end={end}
        data-mc-cell-resource={props.resourceId}
        aria-label={`${props.dateISO}, ${formatHourLabel({ minuteOfDay: minute, locale: props.locale ?? 'pt-BR' })}${props.resourceId ? `, ${props.resourceId}` : ''}`}
        style={
          props.horizontal
            ? { insetInlineStart: offset, width: size, top: 0, bottom: 0 }
            : { top: offset, height: size, left: 0, right: 0 }
        }
      />,
    );
  }
  return <>{cells}</>;
}
