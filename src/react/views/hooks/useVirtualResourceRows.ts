import { useEffect, useState, type RefObject } from 'react';

/** Visible row window from the calendar scrollport. PT: Janela de linhas pelo scroll do calendário. */
export function useVirtualResourceRows({
  scrollRef,
  heights,
  height,
  overscan = 4,
}: {
  /** Calendar scrollport. PT: Container de rolagem do calendário. */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Complete ordered row heights in pixels. PT: Alturas de todas as linhas em pixels. */
  heights: readonly number[];
  /** Bounded viewport height; absent disables virtualization. PT: Altura do viewport; ausente desativa virtualização. */
  height?: number;
  /** Extra rows at each edge; default 4. PT: Linhas extras em cada borda; padrão 4. */
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [focusedRow, setFocusedRow] = useState<string>();
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || height === undefined) return;
    const update = () => setScrollTop(scroller.scrollTop);
    const focus = () =>
      setFocusedRow(
        (
          scroller.ownerDocument.activeElement?.closest(
            '[data-mc-resource-key]',
          ) as HTMLElement | null
        )?.dataset.mcResourceKey,
      );
    scroller.addEventListener('scroll', update, { passive: true });
    scroller.addEventListener('focusin', focus);
    const pinPointer = (event: PointerEvent) =>
      setFocusedRow(
        (event.target as Element | null)?.closest<HTMLElement>('[data-mc-resource-key]')?.dataset
          .mcResourceKey,
      );
    scroller.addEventListener('pointerdown', pinPointer, true);
    update();
    return () => {
      scroller.removeEventListener('scroll', update);
      scroller.removeEventListener('focusin', focus);
      scroller.removeEventListener('pointerdown', pinPointer, true);
    };
  }, [scrollRef, height]);
  const offsets = [0];
  heights.forEach((rowHeight) => offsets.push(offsets[offsets.length - 1]! + rowHeight));
  let start = 0;
  let end = heights.length;
  if (height !== undefined) {
    const headerHeight =
      scrollRef.current?.querySelector(':scope > .mc-timeline-header')?.getBoundingClientRect()
        .height ?? 0;
    while (start < heights.length && offsets[start + 1]! <= Math.max(0, scrollTop - headerHeight))
      start++;
    end = start;
    while (end < heights.length && offsets[end]! < scrollTop + height) end++;
    start = Math.max(0, start - overscan);
    end = Math.min(heights.length, end + overscan);
  }
  return { start, end, offsets, focusedRow };
}
