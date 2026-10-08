import { formatHourLabel } from "../formatting/timeLabels.js";

/** Focusable background slots; pointer gestures continue through the column. */
export function SlotCells(props: {
	dateISO: string;
	resourceId?: string;
	first: boolean;
	startMin: number;
	endMin: number;
	slotMinutes: number;
	pxPerMinute: number;
	locale?: string;
	horizontal?: boolean;
}) {
	const cells = [];
	for (
		let minute = props.startMin;
		minute < props.endMin;
		minute += props.slotMinutes
	) {
		const end = Math.min(minute + props.slotMinutes, props.endMin);
		const offset = (minute - props.startMin) * props.pxPerMinute;
		const size = (end - minute) * props.pxPerMinute;
		cells.push(
			<button
				key={minute}
				type="button"
				className="mc-slot-cell"
				tabIndex={props.first && minute === props.startMin ? 0 : -1}
				data-mc-cell-date={props.dateISO}
				data-mc-cell-start={minute}
				data-mc-cell-end={end}
				data-mc-cell-resource={props.resourceId}
				aria-label={`${props.dateISO}, ${formatHourLabel(minute, props.locale ?? "pt-BR")}${props.resourceId ? `, ${props.resourceId}` : ""}`}
				style={
					props.horizontal
						? { left: offset, width: size, top: 0, bottom: 0 }
						: { top: offset, height: size, left: 0, right: 0 }
				}
			/>,
		);
	}
	return <>{cells}</>;
}
