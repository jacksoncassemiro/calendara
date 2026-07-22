/**
 * Helper de tempo compartilhado (puro, sem Temporal): converte 'HH:mm' em minutos-do-dia.
 * Fonte ÚNICA — antes estava duplicado no ConstraintEngine e no derive.
 */
export function hhmmToMinutes(hhmm: string): number {
	const [hours, minutes] = hhmm.split(':');
	return parseInt(hours ?? '0', 10) * 60 + parseInt(minutes ?? '0', 10);
}
