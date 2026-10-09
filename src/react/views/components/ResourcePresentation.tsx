/** @jsxImportSource react */
import { occurrenceKey } from '../../../core/render/derive.js';
import { isNestedInteractiveTarget } from '../../../core/interaction/interactiveTarget.js';
import { type JSX } from 'react';
import type { ViewRenderContext } from '../../viewTypes.js';
import type { InteractionDraft } from '../../../core/index.js';
import { type ResourceColumnData } from '../../../core/index.js';
import { type GeoGrid } from '../../../core/index.js';
import { formatDraftInterval } from '../formatting/timeLabels.js';
import { getViewLabels } from '../formatting/viewLabels.js';
import { occurrenceEdges } from '../layout/occurrenceDays.js';
import { resolveHour } from '../../../core/index.js';

/** Crop a timed preview to its resource and visible date. @remarks Português: Recorta a prévia horária para o recurso e a data visível. */
export function getResourceDraftSegment({
  draft,
  resourceId,
  dateISO,
}: {
  /** Current gesture preview. @remarks Português: Prévia do gesto atual. */
  draft: InteractionDraft | undefined;
  /** Resource whose preview is requested. @remarks Português: Recurso da prévia solicitada. */
  resourceId: string;
  /** Visible date, YYYY-MM-DD. @remarks Português: Data visível, YYYY-MM-DD. */
  dateISO: string;
}): InteractionDraft | undefined {
  if (!draft || draft.allDay || draft.resourceId !== resourceId) return undefined;
  const lastDateISO = draft.endDateISO ?? draft.dateISO;
  if (dateISO < draft.dateISO || dateISO > lastDateISO) return undefined;
  return {
    ...draft,
    dateISO,
    startMin: dateISO === draft.dateISO ? draft.startMin : 0,
    endMin: dateISO === lastDateISO ? draft.endMin : 1440,
  };
}

/** Build the preview class from gesture kind and validity. @remarks Português: Define a classe da prévia pelo gesto e sua validade. */
export function getDraftClassName(draft: InteractionDraft): string {
  const validity = draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid';
  return `mc-draft mc-draft-${draft.kind}${validity}`;
}

/** Resolve the time-axis geometry from calendar options.
 * @remarks Português: Resolve a geometria do eixo de tempo pelas opções do calendário.
 */
export function createResourceGeometryGrid(context: ViewRenderContext): GeoGrid {
  return {
    startHour: resolveHour(context.options.startHour),
    endHour: resolveHour(context.options.endHour),
    pxPerMinute: context.options.pxPerMinute,
    minEventMinutes: context.options.minEventMinutes,
    gutter: 0,
  };
}

/** Render resource all-day events and gesture preview. @remarks Português: Renderiza eventos de dia inteiro do recurso e a prévia do gesto. */
export function ResourceAllDay({
  column,
  context,
}: {
  /** Resolved event and availability data for the column. @remarks Português: Dados resolvidos dos eventos e disponibilidade da coluna. */
  column: ResourceColumnData;
  /** Resolved view data and consumer callbacks. @remarks Português: Dados resolvidos da view e callbacks do consumidor. */
  context: ViewRenderContext;
}): JSX.Element {
  const draft = context.draft;
  const hasAllDayDraft =
    draft?.allDay &&
    draft.resourceId === column.resource.id &&
    column.day.dateISO >= draft.dateISO &&
    column.day.dateISO < draft.endDateISO!;
  const draftTitle =
    draft?.title ??
    context.occurrences.find((occurrence) => occurrenceKey(occurrence) === draft?.eventId)?.event
      .title ??
    getViewLabels(context.options.locale).newInterval;
  return (
    <div
      className="mc-resource-allday"
      data-mc-allday-cell={column.day.dateISO}
      data-mc-slot-resource={column.resource.id}
    >
      {column.day.allDay.map((occurrence) => {
        const event = occurrence.event;
        const editable = event.editable !== false;
        const resizeEdges = occurrenceEdges({
          occurrence,
          dayISO: column.day.dateISO,
          context,
        });
        return (
          <div
            key={occurrenceKey(occurrence)}
            className="mc-allday-event"
            data-mc-event={occurrenceKey(occurrence)}
            data-mc-start-min="0"
            data-mc-end-min="0"
            data-mc-editable={editable ? 'true' : 'false'}
            title={event.title}
            style={
              context.draft?.eventId === occurrenceKey(occurrence)
                ? { visibility: 'hidden' }
                : undefined
            }
            role={context.onEventClick ? 'button' : undefined}
            tabIndex={context.onEventClick ? 0 : undefined}
            onClick={(click) => {
              if (
                !isNestedInteractiveTarget(click.target, click.currentTarget) &&
                click.detail === 0
              )
                context.onEventClick?.(occurrence);
            }}
            onKeyDown={(key) => {
              if (key.target === key.currentTarget && (key.key === 'Enter' || key.key === ' ')) {
                key.preventDefault();
                context.onEventClick?.(occurrence);
              }
            }}
          >
            {context.renderEvent
              ? context.renderEvent({ occurrence, event, timeLabel: '', isAllDay: true })
              : event.title}
            {editable && resizeEdges.start && (
              <span
                className="mc-allday-resize mc-resize-start"
                data-mc-resize="start"
                aria-hidden="true"
              />
            )}
            {editable && resizeEdges.end && (
              <span className="mc-allday-resize" data-mc-resize="end" aria-hidden="true" />
            )}
          </div>
        );
      })}
      {hasAllDayDraft && draft && (
        <div
          className={getDraftClassName(draft)}
          data-mc-draft={draft.kind}
          aria-hidden="true"
          style={{ pointerEvents: 'none' }}
        >
          <span className="mc-draft-time">
            {formatDraftInterval({ draft, locale: context.options.locale })}
          </span>
          {' · '}
          <span className="mc-draft-title">{draftTitle}</span>
        </div>
      )}
    </div>
  );
}
