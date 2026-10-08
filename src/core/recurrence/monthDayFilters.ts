const MAX_DAYS_BY_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** Includes leap years; actual dates are still checked by the recurrence backend. */
export function hasPossibleMonthDay(
  months: readonly number[],
  monthDays: readonly number[],
): boolean {
  return (
    months.length === 0 ||
    monthDays.length === 0 ||
    months.some((month) =>
      monthDays.some((monthDay) => Math.abs(monthDay) <= MAX_DAYS_BY_MONTH[month - 1]!),
    )
  );
}
