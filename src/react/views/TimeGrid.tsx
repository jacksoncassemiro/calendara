/** @jsxImportSource react */
/**
 * Componente React do time-grid (Semana/Dia). Puramente apresentacional: recebe um GridVM já
 * pronto (dias, rótulos, geometria, camada de fundo, linha "agora") e desenha.
 *
 * Estilo: classes `mc-*` para tema (styles.css) + estilos inline apenas para a GEOMETRIA
 * (posições absolutas/alturas), que precisa existir no DOM independente de CSS carregado.
 */
import type { JSX, CSSProperties } from 'react';
import type { GridVM, DayColumnVM, DraftVM } from './viewModel.js';
import { GUTTER_PX, toPx, segmentStyle } from './utils.js';
import { usePageStickyHeaders } from './usePageStickyHeaders.js';
import { EventOverflow } from './EventOverflow.js';
import { SlotCells } from './SlotCells.js';
import { packDateSpans } from './spanLayout.js';
import { calendarDayOffset } from '../../core/interaction/model.js';

export function TimeGrid(props: { vm: GridVM }): JSX.Element {
  const scrollRef=usePageStickyHeaders();
  const vm = props.vm;
  const gridTopMin = vm.startHour * 60;
  const bodyHeight = (vm.endHour - vm.startHour) * 60 * vm.pxPerMinute;
  const minuteToY = (minuteOfDay: number): number => (minuteOfDay - gridTopMin) * vm.pxPerMinute;
  const uniqueAllDay = new Map(vm.columns.flatMap(column=>column.allDay.map(event=>[event.id,event] as const)));
  const allDaySegments = packDateSpans([...uniqueAllDay.values()].map(event=>{
    const dates = vm.columns.filter(column=>column.allDay.some(item=>item.id===event.id)).map(column=>column.dateISO);
    return {event,dates,start:vm.columns.findIndex(column=>column.dateISO===dates[0]),span:dates.length};
  }).sort((a,b)=>a.start-b.start || b.span-a.span));
  const allDayDraftDates=vm.draft?.allDay ? vm.columns.map(column=>column.dateISO).filter(date=>date>=vm.draft!.dateISO && date<vm.draft!.endDateISO!) : [];
  const allDayHeight = Math.max(1,...allDaySegments.map(segment=>segment.lane+1))*26;

  return (
    <div className="mc-timegrid" data-mc-view={vm.viewName}>
      {/* Scroller horizontal ÚNICO das três faixas (cabeçalho + dia-inteiro + corpo). Em tela
          estreita as colunas ganham um piso de largura (`--mc-day-min-width`, ver styles) e o grid
          passa a rolar na horizontal; sem este wrapper compartilhado cada faixa rolaria sozinha e
          os rótulos de dia sairiam do lugar sobre suas colunas. Só estrutura: zero geometria. */}
      <div ref={scrollRef} className="mc-hscroll" data-mc-hscroll>
        {/* Cabeçalho dos dias */}
        <div className="mc-header-row" style={{ display: 'flex' }}>
          <div className="mc-gutter-corner" style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }} />
          {vm.columns.map((column) => (
            <div
              key={column.dateISO}
              className={`mc-day-header${column.isToday ? ' mc-today' : ''}`}
              data-mc-day-header={column.dateISO}
              style={{ ...column.dayStyle,flex: '1 1 0', textAlign: 'center',minWidth:column.minWidth || undefined }}
            >
              <div className="mc-weekday">{column.weekdayLabel}</div>
              <div className="mc-daynum">{column.dayLabel}</div>
            </div>
          ))}
        </div>

        {/* Faixa "dia inteiro" */}
        <div className="mc-allday-row" data-mc-allday style={{ display: 'flex' }}>
          <div
            className="mc-gutter-label mc-allday-label"
            style={{ width: toPx(GUTTER_PX), flex: '0 0 auto' }}
          >
            dia inteiro
          </div>
          {vm.columns.map((column) => (
            <div
              key={column.dateISO}
              className="mc-allday-cell"
              data-mc-allday-cell={column.dateISO}
              style={{ flex: '1 1 0', position:'relative',height:allDayHeight,minWidth:column.minWidth || undefined }}
            >
              {vm.draft?.allDay && column.dateISO===allDayDraftDates[0] && <div className={`mc-allday-event mc-draft${vm.draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid'}`} data-mc-draft={vm.draft.kind} aria-hidden="true" style={{position:'absolute',top:0,left:0,width:`calc(${allDayDraftDates.length*100}% - 4px)`,height:22,pointerEvents:'none',zIndex:4}}>{vm.draft.title ?? 'Dia inteiro'}</div>}
              {allDaySegments.filter(segment=>segment.dates[0]===column.dateISO).map(({event:allDayEvent,dates,span,lane}) => (
                <div
                  key={allDayEvent.id}
                  className="mc-allday-event"
                  data-mc-allday-event={allDayEvent.id}
                  data-mc-allday-dates={dates.join(' ')}
                  data-mc-event={allDayEvent.id}
                  data-mc-editable={allDayEvent.editable ? 'true' : 'false'}
                  data-mc-start-min="0"
                  data-mc-end-min="0"
                  role={allDayEvent.activate ? 'button' : undefined}
                  tabIndex={allDayEvent.activate ? 0 : undefined}
                  onClick={(event) => { if (event.detail === 0) allDayEvent.activate?.(); }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || !allDayEvent.activate) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      allDayEvent.activate();
                    }
                  }}
                  style={{position:'absolute',top:lane*26,left:0,height:22,width:`calc(${span*100}% - 4px)`,zIndex:1,
                    ...(vm.draft?.eventId===allDayEvent.id ? {visibility:'hidden' as const} : {}),
                    ...(allDayEvent.color ? {boxShadow:`inset 3px 0 0 ${allDayEvent.color}`} : {})}}
                  title={allDayEvent.title}
                >
                  {allDayEvent.content ?? allDayEvent.title}
                  {allDayEvent.editable && (!allDayEvent.startDate || dates[0]===allDayEvent.startDate) && <span className="mc-allday-resize mc-resize-start" data-mc-resize="start" aria-hidden="true" />}
                  {allDayEvent.editable && (!allDayEvent.endDate || calendarDayOffset(dates.at(-1)!,allDayEvent.endDate)===1)
                    && <span className="mc-allday-resize" data-mc-resize="end" aria-hidden="true" />}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Corpo com eixo de horas + colunas de dia */}
        <div className="mc-body" data-mc-body style={{ display: 'flex', position: 'relative' }}>
          {/* Eixo de horas */}
          <div
            className="mc-time-axis"
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
                className="mc-hour-label"
                style={{ position: 'absolute', top: toPx(minuteToY(hourLabel.min)), right: '4px' }}
              >
                {hourLabel.label}
              </div>
            ))}
          </div>

          {/* Colunas de dia */}
          {vm.columns.map((column) => {
            const fullDraft = vm.draft;
            const columnDraft = fullDraft && !fullDraft.allDay && column.dateISO >= fullDraft.dateISO && column.dateISO <= (fullDraft.endDateISO ?? fullDraft.dateISO)
              ? { ...fullDraft, dateISO: column.dateISO,
                  startMin: column.dateISO === fullDraft.dateISO ? fullDraft.startMin : vm.startHour * 60,
                  endMin: column.dateISO === (fullDraft.endDateISO ?? fullDraft.dateISO) ? fullDraft.endMin : vm.endHour * 60 }
              : undefined;
            return (
              <DayColumn
                key={column.dateISO}
                activeEventId={vm.draft?.eventId}
                context={vm.context}
                column={column}
                first={column === vm.columns[0]}
                startMin={gridTopMin}
                endMin={vm.endHour * 60}
                slotMinutes={vm.slotMinutes}
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
    </div>
  );
}

function DayColumn(props: {
  activeEventId?: string;
  context?: import("./viewDef.js").ViewRenderContext;
  column: DayColumnVM;
  first: boolean;
  startMin: number;
  endMin: number;
  slotMinutes: number;
  bodyHeight: number;
  hourMinutes: number[];
  minuteToY: (minuteOfDay: number) => number;
  pxPerMinute: number;
  draft?: DraftVM;
}): JSX.Element {
  const { column, bodyHeight, hourMinutes, minuteToY, pxPerMinute, draft } = props;
  return (
    <div
      className={`mc-day-col${column.isToday ? ' mc-today' : ''}`}
      data-mc-day={column.dateISO}
      style={{ flex: '1 1 0', minWidth:column.minWidth || undefined,position: 'relative', height: toPx(bodyHeight), touchAction: 'pan-x pan-y' }}
    >
      {/* Fundo: fora do expediente */}
      {column.nonBusiness.map((segment, index) => (
        <div
          key={`nonbusiness-${index}`}
          className="mc-nonbusiness"
          data-mc-nonbusiness
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}

      {/* Fundo: bloqueios (precedência visual) */}
      {column.blocked.map((segment, index) => (
        <div
          key={`blocked-${index}`}
          className="mc-blocked"
          data-mc-blocked
          style={segmentStyle(segment, minuteToY, pxPerMinute)}
        />
      ))}

      {/* Linhas de hora */}
      {hourMinutes.map((minute) => (
        <div
          key={`hourline-${minute}`}
          className="mc-hour-line"
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(minute)) }}
        />
      ))}

      {/* Eventos posicionados */}
      <SlotCells dateISO={column.dateISO} first={props.first} startMin={props.startMin}
        endMin={props.endMin} slotMinutes={props.slotMinutes} pxPerMinute={pxPerMinute} />
      {column.events.map((eventItem) => (
        <div
          key={eventItem.id}
          className={`mc-event${eventItem.editable ? ' mc-editable' : ''}`}
          data-mc-event={eventItem.id}
          role={eventItem.activate ? 'button' : undefined}
          tabIndex={eventItem.activate ? 0 : undefined}
          aria-label={`${eventItem.timeLabel} ${eventItem.title}`}
          onClick={(clickEvent) => {
            if (clickEvent.detail === 0) eventItem.activate?.();
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget || !eventItem.activate) return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              eventItem.activate();
            }
          }}
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
            zIndex: eventItem.block.column + 1,
            ...(eventItem.editable ? { touchAction: 'none' } : {}),
            ...(props.activeEventId===eventItem.id ? {visibility:'hidden' as const} : {}),
              ...(eventItem.color ? { boxShadow: `inset 3px 0 0 ${eventItem.color}, inset 0 0 0 1px var(--mc-color-event-border)` } : {}),
          }}
        >
          <div className="mc-event-content">{eventItem.content ?? (
            <>
              <span className="mc-event-time">{eventItem.timeLabel}</span>
              <span className="mc-event-title">{eventItem.title}</span>
            </>
            )}</div>
          {/* Alça de redimensionamento (borda inferior) — só em eventos editáveis. */}
          {eventItem.editable && eventItem.resizeStart!==false && <div className="mc-resize-handle mc-resize-start" data-mc-resize="start" style={{position:"absolute",top:0,left:0,right:0,height:6,cursor:"ns-resize",touchAction:"none"}} />}
          {eventItem.editable && eventItem.resizeEnd!==false && (
            <div
              className="mc-resize-handle"
              data-mc-resize="end"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '6px',
                cursor: 'ns-resize',
                touchAction: 'none',
              }}
            />
          )}
        </div>
      ))}

      {props.context && column.overflowGroups?.map((group,index)=><EventOverflow key={index} group={group} dateISO={column.dateISO} context={props.context!} />)}
      {/* Fantasma do gesto (preview de drag/resize/select) */}
      {draft && (
        <div
          className={`mc-draft mc-draft-${draft.kind}${draft.valid ? ' mc-draft-valid' : ' mc-draft-invalid'}`}
          data-mc-draft={draft.kind}
          data-mc-draft-valid={draft.valid ? 'true' : 'false'}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: toPx(minuteToY(draft.startMin)),
            height: toPx((draft.endMin - draft.startMin) * pxPerMinute),
            pointerEvents: 'none',zIndex:4,
          }}
        >{draft.title ?? (draft.kind==='select' ? 'Novo intervalo' : 'Alterando evento')}</div>
      )}

      {/* Linha "agora" */}
      {column.nowMinutes !== null && (
        <div
          className="mc-now-line"
          data-mc-now
          style={{ position: 'absolute', left: 0, right: 0, top: toPx(minuteToY(column.nowMinutes)) }}
        />
      )}
    </div>
  );
}
