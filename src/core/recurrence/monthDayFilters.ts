const MAX_DAYS_BY_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Whether month/day filters can intersect, including leap years.
 * @remarks Português: Indica se filtros de mês e dia podem se cruzar, incluindo anos bissextos.
 */
export function hasPossibleMonthDay({
  months,
  monthDays,
}: {
  /** Month numbers, 1..12; empty allows all months. / PT: Meses de 1 a 12; vazio permite todos. */
  months: readonly number[]; /** Signed month days, -31..-1 or 1..31; empty allows all. / PT: Dias do mês de -31 a -1 ou 1 a 31; vazio permite todos. */
  monthDays: readonly number[];
}): boolean {
  return (
    months.length === 0 ||
    monthDays.length === 0 ||
    months.some((month) =>
      monthDays.some((monthDay) => Math.abs(monthDay) <= MAX_DAYS_BY_MONTH[month - 1]!),
    )
  );
}
