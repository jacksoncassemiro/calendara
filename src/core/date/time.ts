/** Convert HH:mm to minutes since midnight.
 * @remarks Português: Converte HH:mm em minutos desde a meia-noite.
 */
export function hhmmToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':');
  return parseInt(hours ?? '0', 10) * 60 + parseInt(minutes ?? '0', 10);
}
