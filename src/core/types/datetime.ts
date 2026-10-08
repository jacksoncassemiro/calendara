/** RFC 5545 weekday code.
 * @remarks Português: Código RFC 5545 do dia da semana.
 */
export type WeekdayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

/** Date or local-time endpoint of an event.
 * @remarks Português: Extremo de evento como data ou horário local.
 */
export interface EventDateTime {
  /** All-day endpoint in YYYY-MM-DD format.
   * @remarks Português: Extremo de dia inteiro em YYYY-MM-DD.
   */
  date?: string;
  /** Local ISO wall time without offset: YYYY-MM-DDTHH:mm:ss.
   * @remarks Português: Horário local ISO sem offset; o fuso vem de timeZone.
   */
  dateTime?: string;
  /** IANA zone for dateTime; omitted uses the calendar zone.
   * @remarks Português: Fuso IANA de dateTime; ausente usa o fuso do calendário.
   */
  timeZone?: string;
}

/** Event interval with an exclusive end.
 * @remarks Português: Intervalo do evento com fim exclusivo.
 */
export interface EventTime {
  /** Use date endpoints for all-day events; dateTime otherwise.
   * @remarks Português: Usa extremos date para dia inteiro; dateTime nos demais.
   */
  allDay: boolean;
  /** Inclusive event start.
   * @remarks Português: Início inclusivo do evento.
   */
  start: EventDateTime;
  /** Exclusive event end, including all-day dates.
   * @remarks Português: Fim exclusivo; em dia inteiro, a data final não é ocupada.
   */
  end: EventDateTime;
}
