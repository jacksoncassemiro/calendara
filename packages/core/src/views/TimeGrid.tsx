/**
 * Componente Preact do time-grid (Semana/Dia). Puramente apresentacional: recebe um GridVM já
 * pronto (dias, rótulos, geometria, camada de fundo, linha "agora") e desenha.
 *
 * Estilo: classes `mc-*` para tema (packages/styles) + estilos inline apenas para a GEOMETRIA
 * (posições absolutas/alturas), que precisa existir no DOM independente de CSS carregado.
 */
import type { JSX } from 'preact';
import type { GridVM, DayColumnVM, DraftVM } from './viewModel.js';
import type { Segment } from '../render/derive.js';

const GUTTER_PX = 56;

function toPx(value: number): string {
  return `${value}px`;
}

export function TimeGrid(props: { vm: GridVM }): JSX.Element {
  const vm = props.vm;
  const gridTopMin = vm.startHour * 60;
  const bodyHeight = (vm.endHour - vm.startHour) * 60 * vm.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number => (minuteOfDay - gridTopMin) * vm.pxPerMinute;

  return (
    <div class="mc-timegrid" data-mc-view={vm.viewName}>
      {/* Cabeçalho dos dias */}
      <div class="mc-header-row" style={{ display: 'flex' }}>
        <div class="mc-gutter-corner" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }} />
        {vm.columns.map((column) => (
          <div
            key={column.dateISO}
            class={`mc-day-header${column.isToday ? ' mc-today' : ''}`}
            data-mc-day-header={column.dateISO}
            style={{ flex: '1 1 0', textAlign: 'center' }}
          >
            <div class="mc-weekday">{column.weekdayLabel}</div>
            <div class="mc-daynum">{column.dayLabel}</div>
          </div>
        ))}
      </div>

      {/* Faixa "dia inteiro" */}
      <div class="mc-allday-row" data-mc-allday style={{ display: 'flex' }}>
        <div
          class="mc-gutter-label mc-allday-label"
          style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}
        >
          dia inteiro
        </div>
        {vm.columns.map((column) => (
          <div
            key={column.dateISO}
            class="mc-allday-cell"
            data-mc-allday-cell={column.dateISO}
            style={{ flex: '1 1 0' }}
          >
            {column.allDay.map((allDayEvent) => (
              <div
                key={allDayEvent.id}
                class="mc-allday-event"
                data-mc-allday-event={allDayEvent.id}
                style={allDayEvent.color ? { borderLeft: `3px solid ${allDayEvent.color}` } : undefined}
                title={allDayEvent.title}
              >
                {allDayEvent.content ?? allDayEvent.title}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Corpo com eixo de horas + colunas de dia */}
      <div class="mc-body" data-mc-body style={{ display: 'flex', position: 'relative' }}>
        {/* Eixo de horas */}
        <div
          class="mc-time-axis"
          style={{
            width: toPx(GUTTER_PX),
            flex: '0 0 auto',
            position: 'relative',
            height: toPx(bodyHeight),
          }}
        >
          {vm.hourLabels.map((hourLabel) => (
            <div
              key={hourLabel.min}
              class="mc-hour-label"
              style={{ position: 'absolute', top: toPx(minuteToY(hourLabel.min)), right: '4px' }}
            >
              {hourLabel.label}
            </div>
          ))}
        </div>

        {/* Colunas de dia */}
        {vm.columns.map((column) => {
          const columnDraft =
            vm.draft && vm.draft.dateISO === column.dateISO ? vm.draft : undefined;
          return (
            <DayColumn
              key={column.dateISO}
              column={column}
              bodyHeight={bodyHeight}
              hourMinutes={vm.hourLabels.map((hourLabel) => hourLabel.min)}
              minuteToY={minuteToY}
              pxPerMinute={vm.pxPerMinute}
              draft={columnDraft}
            />
          );
        })}
      </div>
    </div>
  );
}

function segmentStyle(
  segment: Segment,
  minuteToY: (minuteOfDay: number) => number,
  pxPerMinute: number,
): JSX.CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${minuteToY(segment.startMin)}px`,
    height: `${(segment.endMin - segment.startMin) * pxPerMinute}px`,
  };
}

function DayColumn(props: {
  column: DayColumnVM;
  bodyHeight: number;
  hourMinutes: number[];
  minuteToY: (minuteOfDay: number) => number;
  pxPerMinute: number;
  draft?: DraftVM;
}): JSX.Element {
  const { column, bodyHeight, hourMinutes, minuteToY, pxPerMinute, draft } = props;
  return (
    <div
      class={`mc-day-col${column.isToday ? ' mc-today' : ''}`}
      data-mc-day={column.dateISO}
      style={{ flex: '1 1 0', position: 'relative', height: toPx(bodyHeight) }}
    >
      {/* Fundo: fora do expediente */}
      {column.nonBusiness.map((segment, index) => (
        <div
          key={`nonbusiness-${index}`}
          class="mc-nonbusiness"
          data-mc-nonbusiness
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}

      {/* Fundo: bloqueios (precedência visual) */}
      {column.blocked.map((segment, index) => (
        <div
          key={`blocked-${index}`}
          class="mc-blocked"
          data-mc-blocked
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}

      {/* Linhas de hora */}
      {hourMinutes.map((minute) => (
        <div
          key={`hourline-${minute}`}
          class="mc-hour-line"
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(minute)) }}
        />
      ))}

      {/* Eventos posicionados */}
      {column.events.map((eventItem) => (
        <div
          key={eventItem.id}
          class={`mc-event${eventItem.editable ? ' mc-editable' : ''}`}
          data-mc-event={eventItem.id}
          data-mc-start-min={eventItem.startMin}
          data-mc-end-min={eventItem.endMin}
          data-mc-editable={eventItem.editable ? 'true' : 'false'}
          title={eventItem.title}
          style={{
            position: 'absolute',
            top: toPx(eventItem.block.top),
            height: toPx(eventItem.block.height),
            left: `${eventItem.block.left * 100}%`,
            width: `${eventItem.block.width * 100}%`,
            ...(eventItem.editable ? { touchAction: 'none' } : {}),
            ...(eventItem.color ? { backgroundColor: eventItem.color } : {}),
          }}
        >
          {eventItem.content ?? (
            <>
              <span class="mc-event-time">{eventItem.timeLabel}</span>
              <span class="mc-event-title">{eventItem.title}</span>
            </>
          )}
          {/* Alça de redimensionamento (borda inferior) — só em eventos editáveis. */}
          {eventItem.editable && (
            <div
              class="mc-resize-handle"
              data-mc-resize
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '6px', cursor: 'ns-resize' }}
            />
          )}
        </div>
      ))}

      {/* Fantasma do gesto (preview de drag/resize/select) */}
      {draft && (
        <div
          class={`mc-draft mc-draft-${draft.kind}${draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid'}`}
          data-mc-draft={draft.kind}
          data-mc-draft-valid={draft.valid ? 'true' : 'false'}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: toPx(minuteToY(draft.startMin)),
            height: toPx((draft.endMin - draft.startMin) * pxPerMinute),
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Linha "agora" */}
      {column.nowMinutes !== null && (
        <div
          class="mc-now-line"
          data-mc-now
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(column.nowMinutes)) }}
        />
      )}
    </div>
  );
}
