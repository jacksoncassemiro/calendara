import { useEffect, useRef, type RefObject } from "react";

/** Keeps the visible header above a horizontally scrolling grid during page scrolling.
 * The original header remains in flow and accessible; its visual copy has no interactions.
 * DOM updates avoid React renders on pointer/scroll frames. */
export function usePageStickyHeaders(): RefObject<HTMLDivElement | null> {
	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const header = scroller.querySelector<HTMLElement>(
			":scope > .mc-header-row, :scope > .mc-resource-header-row, :scope > .mc-timeline-header",
		);
		if (!header) return;
		let allDay = scroller.querySelector<HTMLElement>(
			":scope > .mc-allday-row, :scope > .mc-resource-allday-row",
		);
		const document = scroller.ownerDocument;
		const window = document.defaultView;
		if (!window) return;
		const overlay = document.createElement("div");
		overlay.className = "mc-page-sticky-header";
		overlay.setAttribute("aria-hidden", "true");
		overlay.inert = true;
		scroller.after(overlay);
		const placeholder = document.createElement("div");
		placeholder.className = "mc-page-allday-placeholder";
		placeholder.style.display = "none";
		allDay?.before(placeholder);
		let allDayFixed = false;
		const restoreAllDay = (): void => {
			if (!allDay || !allDayFixed) return;
			allDay.classList.remove("mc-page-sticky-allday");
			for (const name of ["top", "left", "width", "clip-path"])
				allDay.style.removeProperty(name);
			allDay.firstElementChild?.classList.remove("mc-page-allday-corner");
			(allDay.firstElementChild as HTMLElement | null)?.style.removeProperty(
				"transform",
			);
			placeholder.style.display = "none";
			allDayFixed = false;
		};
		let copy: HTMLElement;
		let corner: HTMLElement | null = null;
		let frame = 0;
		let copyDirty = true;
		let disposed = false;
		const refreshCopy = (): void => {
			copy = header.cloneNode(true) as HTMLElement;
			// The visual copy must not become a second event/slot/header in DOM integrations.
			[copy, ...copy.querySelectorAll("*")].forEach((element) => {
				for (const attribute of [...element.attributes]) {
					if (attribute.name === "id" || attribute.name.startsWith("data-mc-"))
						element.removeAttribute(attribute.name);
				}
			});
			copy.classList.add("mc-page-sticky-content");
			corner = copy.firstElementChild as HTMLElement | null;
			corner?.classList.add("mc-page-sticky-corner");
			overlay.replaceChildren(copy);
			copyDirty = false;
		};
		const update = (): void => {
			frame = 0;
			if (disposed) return;
			const currentAllDay = scroller.querySelector<HTMLElement>(
				":scope > .mc-allday-row, :scope > .mc-resource-allday-row",
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
			const offset =
				Number.parseFloat(
					window.getComputedStyle(scroller).getPropertyValue("--mc-sticky-top"),
				) || 0;
			// A consumer can opt into a bounded internal scrollport, whose original header is sticky.
			const internal = scroller.scrollHeight > scroller.clientHeight + 1;
			scroller.classList.toggle("mc-internal-scroll", internal);
			scroller.style.setProperty(
				"--mc-sticky-header-height",
				`${source.height}px`,
			);
			const visible =
				!internal &&
				source.height > 0 &&
				source.top < offset &&
				viewport.bottom > offset + source.height &&
				viewport.right > 0 &&
				viewport.left < window.innerWidth;
			overlay.style.display = visible ? "block" : "none";
			if (!visible) restoreAllDay();
			const pinnedHeight =
				visible || (internal && scroller.scrollTop > 0)
					? source.height + (allDay?.getBoundingClientRect().height ?? 0)
					: 0;
			const contentTop = internal
				? viewport.top + pinnedHeight
				: Math.max(viewport.top, offset + pinnedHeight);
			const axisWidth =
				scroller
					.querySelector(".mc-time-axis,.mc-timeline-label")
					?.getBoundingClientRect().width ?? 0;
			for (const content of scroller.querySelectorAll<HTMLElement>(
				".mc-event-content",
			)) {
				const eventRect = content.parentElement!.getBoundingClientRect();
				const horizontal = Boolean(content.closest(".mc-timeline"));
				const delta = horizontal
					? Math.max(0, viewport.left + axisWidth - eventRect.left)
					: Math.max(0, contentTop - eventRect.top);
				const limit = horizontal
					? Math.max(0, eventRect.width - 60)
					: Math.max(0, eventRect.height - 24);
				content.style.setProperty(
					"--mc-content-offset",
					`${Math.min(delta, limit)}px`,
				);
			}
			if (!visible) return;
			overlay.style.top = `${offset}px`;
			overlay.style.left = `${viewport.left + scroller.clientLeft}px`;
			overlay.style.width = `${scroller.clientWidth}px`;
			copy.style.width = `${source.width}px`;
			copy.style.transform = `translateX(${-scroller.scrollLeft}px)`;
			if (corner)
				corner.style.transform = `translateX(${scroller.scrollLeft}px)`;
			if (allDay) {
				if (!allDayFixed) {
					placeholder.style.height = `${allDay.getBoundingClientRect().height}px`;
					placeholder.style.display = "block";
					allDay.classList.add("mc-page-sticky-allday");
					allDay.firstElementChild?.classList.add("mc-page-allday-corner");
					allDayFixed = true;
				}
				const width = source.width;
				allDay.style.top = `${offset + source.height}px`;
				allDay.style.left = `${viewport.left + scroller.clientLeft - scroller.scrollLeft}px`;
				allDay.style.width = `${width}px`;
				allDay.style.clipPath = `inset(0 ${Math.max(0, width - scroller.clientWidth - scroller.scrollLeft)}px 0 ${scroller.scrollLeft}px)`;
				(allDay.firstElementChild as HTMLElement).style.transform =
					`translateX(${scroller.scrollLeft}px)`;
				placeholder.style.height = `${allDay.getBoundingClientRect().height}px`;
			}
		};
		const schedule = (): void => {
			if (!frame && !disposed) frame = window.requestAnimationFrame(update);
		};
		const observer = new window.MutationObserver((records) => {
			if (
				records.some(
					(record) =>
						header === record.target || header.contains(record.target),
				)
			)
				copyDirty = true;
			schedule();
		});
		// Do not observe styles: content offsets written during scroll must not schedule themselves.
		observer.observe(scroller, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? undefined
				: new ResizeObserver(schedule);
		resizeObserver?.observe(scroller);
		resizeObserver?.observe(header);
		if (allDay) resizeObserver?.observe(allDay);
		window.addEventListener("scroll", schedule, {
			passive: true,
			capture: true,
		});
		window.addEventListener("resize", schedule, { passive: true });
		schedule();
		return () => {
			disposed = true;
			if (frame) window.cancelAnimationFrame(frame);
			observer.disconnect();
			resizeObserver?.disconnect();
			window.removeEventListener("scroll", schedule, true);
			window.removeEventListener("resize", schedule);
			overlay.remove();
			restoreAllDay();
			placeholder.remove();
			scroller.classList.remove("mc-internal-scroll");
			scroller.style.removeProperty("--mc-sticky-header-height");
			scroller
				.querySelectorAll<HTMLElement>(".mc-event-content")
				.forEach((content) =>
					content.style.removeProperty("--mc-content-offset"),
				);
		};
	}, []);
	return scrollRef;
}
