import { useEffect, useRef, useState } from 'react';

/** Observe container width, including narrow desktop panels. @remarks Português: Observa a largura do container, incluindo painéis estreitos no desktop.
 * @param breakpoint Container-width threshold in pixels; default 640. PT: Limite de largura do container em pixels; padrão 640. */
export function useCompactCalendar(breakpoint = 640) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = (width: number) => setCompact(width > 0 && width < breakpoint);
    update(container.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => update(container.getBoundingClientRect().width);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) update(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [breakpoint]);
  return { containerRef, compact };
}
