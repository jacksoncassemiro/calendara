/** Keep a date span in one lane, allowing disjoint spans to reuse that lane. */
export function packDateSpans<
  T extends {
    start: number;
    span: number;
  },
>(
  segments: readonly T[],
): (T & {
  lane: number;
})[] {
  const occupiedDatesByLane: boolean[][] = [];
  return segments.map((segment) => {
    const dateIndices = Array.from({ length: segment.span }, (_, offset) => segment.start + offset);
    let lane = occupiedDatesByLane.findIndex((occupiedDates) =>
      dateIndices.every((dateIndex) => !occupiedDates[dateIndex]),
    );
    if (lane < 0) {
      lane = occupiedDatesByLane.length;
      occupiedDatesByLane.push([]);
    }
    for (const dateIndex of dateIndices) occupiedDatesByLane[lane]![dateIndex] = true;
    return { ...segment, lane };
  });
}
