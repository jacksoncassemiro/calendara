/** Pin visual headers and synchronize horizontal scrolling. @remarks Português: Fixa cabeçalhos visuais e sincroniza scroll horizontal. */
import { useEffect, useRef, type RefObject } from 'react';

export function usePageStickyHeaders(
  locale?: string,
  direction?: 'ltr' | 'rtl',
): RefObject<HTMLDivElement | null> {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const header = scroller.querySelector<HTMLElement>(
      ':scope > .mc-header-row, :scope > .mc-resource-header-row, :scope > .mc-timeline-header, :scope > .mc-year-planner > thead',
    );
    if (!header) return;
    let allDay = scroller.querySelector<HTMLElement>(
      ':scope > .mc-allday-row, :scope > .mc-resource-allday-row',
    );
    const document = scroller.ownerDocument;
    const window = document.defaultView;
    if (!window) return;
    const overlay = document.createElement('div');
    overlay.className = 'mc-page-sticky-header';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.inert = true;
    scroller.after(overlay);
    const scrollbarHost = document.createElement('div');
    scrollbarHost.className = 'mc-header-scrollbar-host';
    const scrollbar = document.createElement('div');
    scrollbar.className = 'mc-header-scrollbar';
    scrollbar.tabIndex = 0;
    scrollbar.setAttribute('role', 'region');
    scrollbar.setAttribute(
      'aria-label',
      (locale ?? document.documentElement.lang).startsWith('pt')
        ? 'Rolagem horizontal do calendário'
        : 'Calendar horizontal scrolling',
    );
    const scrollbarContent = document.createElement('div');
    scrollbarContent.style.height = '1px';
    scrollbar.append(scrollbarContent);
    scrollbarHost.append(scrollbar);
    scroller.before(scrollbarHost);
    scroller.classList.add('mc-top-scrollbar');
    let pendingScrollbarPosition: number | null = null;
    const syncScroll = (): void => {
      // Ignore queued events from synchronization. PT: Ignora eventos enfileirados pela sincronização.
      if (
        pendingScrollbarPosition !== null &&
        Math.abs(scrollbar.scrollLeft - pendingScrollbarPosition) <= 1
      ) {
        pendingScrollbarPosition = null;
        return;
      }
      pendingScrollbarPosition = null;
      if (Math.abs(scroller.scrollLeft - scrollbar.scrollLeft) > 1)
        scroller.scrollLeft = scrollbar.scrollLeft;
    };
    scrollbar.addEventListener('scroll', syncScroll, { passive: true });
    const placeholder = document.createElement('div');
    placeholder.className = 'mc-page-allday-placeholder';
    placeholder.style.display = 'none';
    allDay?.before(placeholder);
    let allDayFixed = false;
    const restoreAllDay = (): void => {
      if (!allDay || !allDayFixed) return;
      allDay.classList.remove('mc-page-sticky-allday');
      for (const name of ['top', 'left', 'width', 'clip-path']) allDay.style.removeProperty(name);
      allDay.firstElementChild?.classList.remove('mc-page-allday-corner');
      (allDay.firstElementChild as HTMLElement | null)?.style.removeProperty('transform');
      placeholder.style.display = 'none';
      allDayFixed = false;
    };
    let copy: HTMLElement;
    let corners: HTMLElement[] = [];
    let frame = 0;
    let copyDirty = true;
    let disposed = false;
    const refreshCopy = (): void => {
      copy = header.cloneNode(true) as HTMLElement;
      // Exclude visual copies from DOM integrations. PT: Exclui cópias visuais das integrações DOM.
      [copy, ...copy.querySelectorAll('*')].forEach((element) => {
        for (const attribute of [...element.attributes]) {
          if (attribute.name === 'id' || attribute.name.startsWith('data-mc-'))
            element.removeAttribute(attribute.name);
        }
      });
      copy.classList.add('mc-page-sticky-content');
      if (header.tagName === 'THEAD') copy.classList.add('mc-year-planner');
      corners = [
        ...copy.querySelectorAll<HTMLElement>(
          '.mc-gutter-corner, .mc-timeline-corner, .mc-year-planner-corner',
        ),
      ];
      if (!corners.length && copy.firstElementChild)
        corners = [copy.firstElementChild as HTMLElement];
      corners.forEach((corner) => corner.classList.add('mc-page-sticky-corner'));
      overlay.replaceChildren(copy);
      copyDirty = false;
    };
    const update = (): void => {
      frame = 0;
      if (disposed) return;
      const currentAllDay = scroller.querySelector<HTMLElement>(
        ':scope > .mc-allday-row, :scope > .mc-resource-allday-row',
      );
      if (currentAllDay !== allDay) {
        restoreAllDay();
        if (allDay) resizeObserver?.unobserve(allDay);
        placeholder.remove();
        allDay = currentAllDay;
        allDay?.before(placeholder);
        if (allDay) resizeObserver?.observe(allDay);
      }
      if (copyDirty) refreshCopy();
      const viewport = scroller.getBoundingClientRect();
      const source = header.getBoundingClientRect();
      const rtl = window.getComputedStyle(scroller).direction === 'rtl';
      const viewportLeft = viewport.left + scroller.clientLeft;
      const viewportRight = viewportLeft + scroller.clientWidth;
      const sourceOffset = source.left - viewportLeft;
      const cornerOffset = rtl ? viewportRight - source.right : viewportLeft - source.left;
      overlay.dir = rtl ? 'rtl' : 'ltr';
      scrollbar.dir = rtl ? 'rtl' : 'ltr';
      const offset =
        Number.parseFloat(window.getComputedStyle(scroller).getPropertyValue('--mc-sticky-top')) ||
        0;
      // Internal scrollports retain their original sticky header. PT: Rolagem interna mantém o cabeçalho fixo original.
      const internal = scroller.scrollHeight > scroller.clientHeight + 1;
      scroller.classList.toggle('mc-internal-scroll', internal);
      scroller.style.setProperty('--mc-sticky-header-height', `${source.height}px`);
      const visible =
        !internal &&
        source.height > 0 &&
        source.top < offset &&
        viewport.bottom > offset + source.height &&
        viewport.right > 0 &&
        viewport.left < window.innerWidth;
      const hasHorizontalOverflow = scroller.scrollWidth > scroller.clientWidth + 1;
      scrollbarHost.style.display = hasHorizontalOverflow ? 'block' : 'none';
      scrollbarContent.style.width = `${scroller.scrollWidth}px`;
      scrollbar.style.position = visible ? 'fixed' : 'relative';
      scrollbar.style.top = visible
        ? `${offset + source.height + (allDay?.getBoundingClientRect().height ?? 0)}px`
        : '0px';
      scrollbar.style.left = visible ? `${viewport.left + scroller.clientLeft}px` : '0px';
      scrollbar.style.width = `${scroller.clientWidth}px`;
      if (Math.abs(scrollbar.scrollLeft - scroller.scrollLeft) > 1) {
        scrollbar.scrollLeft = scroller.scrollLeft;
        pendingScrollbarPosition = scrollbar.scrollLeft;
      }
      overlay.style.display = visible ? 'block' : 'none';
      if (!visible) restoreAllDay();
      const pinnedHeight =
        visible || (internal && scroller.scrollTop > 0)
          ? source.height +
            (allDay?.getBoundingClientRect().height ?? 0) +
            (visible && hasHorizontalOverflow ? scrollbar.offsetHeight : 0)
          : 0;
      const contentTop = internal
        ? viewport.top + pinnedHeight
        : Math.max(viewport.top, offset + pinnedHeight);
      const axisWidth =
        scroller.querySelector('.mc-time-axis,.mc-timeline-label')?.getBoundingClientRect().width ??
        0;
      for (const content of scroller.querySelectorAll<HTMLElement>('.mc-event-content')) {
        const eventRect = content.parentElement!.getBoundingClientRect();
        const horizontal = Boolean(content.closest('.mc-timeline'));
        const delta = horizontal
          ? rtl
            ? Math.max(0, eventRect.right - viewportRight + axisWidth)
            : Math.max(0, viewportLeft + axisWidth - eventRect.left)
          : Math.max(0, contentTop - eventRect.top);
        const limit = horizontal
          ? Math.max(0, eventRect.width - 60)
          : Math.max(0, eventRect.height - 24);
        content.style.setProperty(
          '--mc-content-offset',
          `${Math.min(delta, limit) * (horizontal && rtl ? -1 : 1)}px`,
        );
      }
      if (!visible) return;
      overlay.style.top = `${offset}px`;
      overlay.style.left = `${viewport.left + scroller.clientLeft}px`;
      overlay.style.width = `${scroller.clientWidth}px`;
      overlay.style.height = `${source.height}px`;
      copy.style.width = `${source.width}px`;
      copy.style.position = 'absolute';
      copy.style.left = '0px';
      copy.style.transform = `translateX(${sourceOffset}px)`;
      corners.forEach((corner) => {
        corner.style.transform = `translateX(${cornerOffset}px)`;
      });
      if (allDay) {
        if (!allDayFixed) {
          placeholder.style.height = `${allDay.getBoundingClientRect().height}px`;
          placeholder.style.display = 'block';
          allDay.classList.add('mc-page-sticky-allday');
          allDay.firstElementChild?.classList.add('mc-page-allday-corner');
          allDayFixed = true;
        }
        const width = source.width;
        allDay.style.top = `${offset + source.height}px`;
        allDay.style.left = `${source.left}px`;
        allDay.style.width = `${width}px`;
        allDay.style.clipPath = `inset(0 ${Math.max(0, source.right - viewportRight)}px 0 ${Math.max(0, viewportLeft - source.left)}px)`;
        (allDay.firstElementChild as HTMLElement).style.transform = `translateX(${cornerOffset}px)`;
        placeholder.style.height = `${allDay.getBoundingClientRect().height}px`;
      }
    };
    const schedule = (): void => {
      if (!frame && !disposed) frame = window.requestAnimationFrame(update);
    };
    const observer = new window.MutationObserver((records) => {
      if (records.some((record) => header === record.target || header.contains(record.target)))
        copyDirty = true;
      schedule();
    });
    // Ignore style mutations to prevent scroll-update loops. PT: Ignora mudanças de estilo para evitar ciclos de atualização na rolagem.
    observer.observe(scroller, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    resizeObserver?.observe(scroller);
    resizeObserver?.observe(header);
    if (allDay) resizeObserver?.observe(allDay);
    window.addEventListener('scroll', schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener('resize', schedule, { passive: true });
    schedule();
    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      overlay.remove();
      scrollbar.removeEventListener('scroll', syncScroll);
      scrollbarHost.remove();
      scroller.classList.remove('mc-top-scrollbar');
      restoreAllDay();
      placeholder.remove();
      scroller.classList.remove('mc-internal-scroll');
      scroller.style.removeProperty('--mc-sticky-header-height');
      scroller
        .querySelectorAll<HTMLElement>('.mc-event-content')
        .forEach((content) => content.style.removeProperty('--mc-content-offset'));
    };
  }, [locale, direction]);
  return scrollRef;
}
