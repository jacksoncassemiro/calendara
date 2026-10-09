import { useLayoutEffect, useState, type RefObject } from 'react';

/** Measure intrinsic labels so rendered and virtual row geometry stay aligned.
 * @remarks Português: Mede labels intrínsecos para alinhar a geometria das linhas renderizadas e virtuais.
 */
export function useResourceLabelHeights({
  scrollRef,
}: {
  /** Resource timeline scrollport. @remarks Português: Container de rolagem da timeline de recursos. */
  scrollRef: RefObject<HTMLDivElement | null>;
}): ReadonlyMap<string, number> {
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observed = new Set<HTMLElement>();
    const measure = () => {
      const updates = new Map<string, number>();
      for (const label of observed) {
        const key = label.dataset.mcResourceLabelMeasure;
        if (!key || !label.isConnected || !label.parentElement) continue;
        const labelHeight = label.getBoundingClientRect().height;
        if (labelHeight === 0) continue;
        const labelStyle = getComputedStyle(label);
        const wrapperStyle = getComputedStyle(label.parentElement);
        const spacing = [
          labelStyle.marginTop,
          labelStyle.marginBottom,
          wrapperStyle.paddingTop,
          wrapperStyle.paddingBottom,
          wrapperStyle.borderTopWidth,
          wrapperStyle.borderBottomWidth,
        ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);
        updates.set(key, Math.ceil(labelHeight + spacing));
      }
      setHeights((previous) => {
        if ([...updates].every(([key, height]) => previous.get(key) === height)) return previous;
        return new Map([...previous, ...updates]);
      });
    };
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    const observe = () => {
      for (const label of observed) {
        if (!root.contains(label)) {
          resize?.unobserve(label);
          observed.delete(label);
        }
      }
      root.querySelectorAll<HTMLElement>('[data-mc-resource-label-measure]').forEach((label) => {
        if (observed.has(label)) return;
        observed.add(label);
        resize?.observe(label);
      });
      measure();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(root, { childList: true, subtree: true, characterData: true });
    observe();
    return () => {
      resize?.disconnect();
      mutation.disconnect();
    };
  }, [scrollRef]);
  return heights;
}
