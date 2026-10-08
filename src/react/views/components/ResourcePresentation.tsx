/** @jsxImportSource react */
import { occurrenceKey } from '../../../core/render/derive.js';
import { isNestedInteractiveTarget } from "../../../core/interaction/interactiveTarget.js";
import { type JSX } from "react";
import type { ViewRenderContext } from "../../viewTypes.js";
import type { InteractionDraft } from "../../../core/index.js";
import { type ResourceColumnData } from "../../../core/index.js";
import { type GeoGrid } from "../../../core/index.js";
import { formatDraftInterval } from "../formatting/timeLabels.js";
import { occurrenceEdges } from "../layout/occurrenceDays.js";
import { resolveHour } from "../../../core/index.js";

/**
 * Fantasma que pertence a ESTA coluna/linha. Um rascunho sem `resourceId` veio de uma view de
 * data (o motor é um só, compartilhado) e não deve ser desenhado aqui.
 */
export function getResourceDraftSegment(
  draft: InteractionDraft | undefined,
  resourceId: string,
  dateISO: string,
): InteractionDraft | undefined {
  const belongsHere =
    draft !== undefined && !draft.allDay && draft.resourceId === resourceId && dateISO >= draft.dateISO && dateISO <= (draft.endDateISO ?? draft.dateISO);
  return belongsHere ? { ...draft, dateISO, startMin: dateISO === draft!.dateISO ? draft!.startMin : 0,
    endMin: dateISO === (draft!.endDateISO ?? draft!.dateISO) ? draft!.endMin : 1440 } : undefined;
}

/** Classe do fantasma (mesma convenção do TimeGrid). */
export function getDraftClassName(draft: InteractionDraft): string {
  const validity = draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid';
  return `mc-draft mc-draft-${draft.kind}${validity}`;
}

export function createResourceGeometryGrid(context: ViewRenderContext): GeoGrid {
  return {
    startHour: resolveHour(context.options.startHour),
    endHour: resolveHour(context.options.endHour),
    pxPerMinute: context.options.pxPerMinute,
    minEventMinutes: context.options.minEventMinutes,
    gutter: 0,
  };
}

export function ResourceAllDay({ column, context }: { column: ResourceColumnData; context: ViewRenderContext }): JSX.Element {
  return <div className="mc-resource-allday" data-mc-allday-cell={column.day.dateISO} data-mc-slot-resource={column.resource.id}>
    {column.day.allDay.map((occurrence) => {
      const event = occurrence.event;
      const editable = event.editable !== false;
      return <div key={occurrenceKey(occurrence)} className="mc-allday-event"
        data-mc-event={occurrenceKey(occurrence)} data-mc-start-min="0" data-mc-end-min="0"
        data-mc-editable={editable ? 'true' : 'false'} title={event.title} style={context.draft?.eventId===occurrenceKey(occurrence) ? {visibility:'hidden'} : undefined}
        role={context.onEventClick ? 'button' : undefined} tabIndex={context.onEventClick ? 0 : undefined}
        onClick={(click) => { if (!isNestedInteractiveTarget(click.target,click.currentTarget) && click.detail === 0) context.onEventClick?.(occurrence); }}
        onKeyDown={(key) => {
          if (key.target === key.currentTarget && (key.key === 'Enter' || key.key === ' ')) {
            key.preventDefault(); context.onEventClick?.(occurrence);
          }
        }}>
        {context.renderEvent ? context.renderEvent({ occurrence, event, timeLabel: '', isAllDay: true }) : event.title}
        {editable && occurrenceEdges(occurrence,column.day.dateISO,context).start && <span className="mc-allday-resize mc-resize-start" data-mc-resize="start" aria-hidden="true" />}
        {editable && occurrenceEdges(occurrence,column.day.dateISO,context).end && <span className="mc-allday-resize" data-mc-resize="end" aria-hidden="true" />}
      </div>;
    })}
    {context.draft?.allDay && context.draft.resourceId===column.resource.id && column.day.dateISO>=context.draft.dateISO && column.day.dateISO<context.draft.endDateISO! && <div className={getDraftClassName(context.draft)} data-mc-draft={context.draft.kind} aria-hidden="true" style={{pointerEvents:'none'}}><span className="mc-draft-time">{formatDraftInterval(context.draft,context.options.locale)}</span>{' · '}<span className="mc-draft-title">{context.occurrences.find(occurrence=>occurrenceKey(occurrence)===context.draft!.eventId)?.event.title ?? 'Novo intervalo'}</span></div>}
  </div>;
}
