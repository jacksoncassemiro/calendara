/**
 * Componente Preact do time-grid (Semana/Dia). Puramente apresentacional: recebe um GridVM já
 * pronto (dias, rótulos, geometria, camada de fundo, linha "agora") e desenha.
 *
 * Estilo: classes `mc-*` para tema (packages/styles) + estilos inline apenas para a GEOMETRIA
 * (posições absolutas/alturas), que precisa existir no DOM independente de CSS carregado.
 */
import type { JSX } from 'preact';
import type { GridVM, DayColumnVM } from './viewModel.js';
import type { Segment } from '../render/derive.js';

const GUTTER_PX = 56;

function px(n: number): string {
  return `${n}px`;
}

export function TimeGrid(props: { vm: GridVM }): JSX.Element {
  const vm = props.vm;
  const gridTopMin = vm.startHour * 60;
  const bodyHeight = (vm.endHour - vm.startHour) * 60 * vm.pxPerMinute;
  const yOf = (min: number): number => (min - gridTopMin) * vm.pxPerMinute;

  return (
    <div class="mc-timegrid" data-mc-root data-mc-view={vm.viewName}>
      <div class="mc-toolbar" data-mc-toolbar>
        <span class="mc-title" data-mc-title>
          {vm.title}
        </span>
      </div>

      {/* Cabeçalho dos dias */}
      <div class="mc-header-row" style={{ display: 'flex' }}>
        <div class="mc-gutter-corner" style={{ width: px(GUTTER_PX), flex: '0 0 auto' }} />
        {vm.columns.map((col) => (
          <div
            key={col.dateISO}
            class={`mc-day-header${col.isToday ? ' mc-today' : ''}`}
            data-mc-day-header={col.dateISO}
            style={{ flex: '1 1 0', textAlign: 'center' }}
          >
            <div class="mc-weekday">{col.weekdayLabel}</div>
            <div class="mc-daynum">{col.dayLabel}</div>
          </div>
        ))}
      </div>

      {/* Faixa "dia inteiro" */}
      <div class="mc-allday-row" data-mc-allday style={{ display: 'flex' }}>
        <div
          class="mc-gutter-label mc-allday-label"
          style={{ width: px(GUTTER_PX), flex: '0 0 auto' }}
        >
          dia inteiro
        </div>
        {vm.columns.map((col) => (
          <div
            key={col.dateISO}
            class="mc-allday-cell"
            data-mc-allday-cell={col.dateISO}
            style={{ flex: '1 1 0' }}
          >
            {col.allDay.map((a) => (
              <div
                key={a.id}
                class="mc-allday-event"
                data-mc-allday-event={a.id}
                style={a.color ? { borderLeft: `3px solid ${a.color}` } : undefined}
                title={a.title}
              >
                {a.title}
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
          style={{ width: px(GUTTER_PX), flex: '0 0 auto', position: 'relative', height: px(bodyHeight) }}
        >
          {vm.hourLabels.map((hl) => (
            <div
              key={hl.min}
              class="mc-hour-label"
              style={{ position: 'absolute', top: px(yOf(hl.min)), right: '4px' }}
            >
              {hl.label}
            </div>
          ))}
        </div>

        {/* Colunas de dia */}
        {vm.columns.map((col) => (
          <DayColumn
            key={col.dateISO}
            col={col}
            bodyHeight={bodyHeight}
            hourMins={vm.hourLabels.map((h) => h.min)}
            yOf={yOf}
            pxPerMinute={vm.pxPerMinute}
          />
        ))}
      </div>
    </div>
  );
}

function segStyle(seg: Segment, yOf: (m: number) => number, pxPerMinute: number): JSX.CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    top: px(yOf(seg.startMin)),
    height: px((seg.endMin - seg.startMin) * pxPerMinute),
  };
}

function DayColumn(props: {
  col: DayColumnVM;
  bodyHeight: number;
  hourMins: number[];
  yOf: (m: number) => number;
  pxPerMinute: number;
}): JSX.Element {
  const { col, bodyHeight, hourMins, yOf, pxPerMinute } = props;
  return (
    <div
      class={`mc-day-col${col.isToday ? ' mc-today' : ''}`}
      data-mc-day={col.dateISO}
      style={{ flex: '1 1 0', position: 'relative', height: px(bodyHeight) }}
    >
      {/* Fundo: fora do expediente */}
      {col.nonBusiness.map((seg, i) => (
        <div
          key={`nb-${i}`}
          class="mc-nonbusiness"
          data-mc-nonbusiness
          style={segStyle(seg, yOf, pxPerMinute)}
        />
      ))}

      {/* Fundo: bloqueios (precedência visual) */}
      {col.blocked.map((seg, i) => (
        <div
          key={`bl-${i}`}
          class="mc-blocked"
          data-mc-blocked
          style={segStyle(seg, yOf, pxPerMinute)}
        />
      ))}

      {/* Linhas de hora */}
      {hourMins.map((m) => (
        <div
          key={`ln-${m}`}
          class="mc-hour-line"
          style={{ position: 'absolute', left: 0, right: 0, top: px(yOf(m)) }}
        />
      ))}

      {/* Eventos posicionados */}
      {col.events.map((ev) => (
        <div
          key={ev.id}
          class="mc-event"
          data-mc-event={ev.id}
          title={ev.title}
          style={{
            position: 'absolute',
            top: px(ev.block.top),
            height: px(ev.block.height),
            left: `${ev.block.left * 100}%`,
            width: `${ev.block.width * 100}%`,
            ...(ev.color ? { backgroundColor: ev.color } : {}),
          }}
        >
          <span class="mc-event-time">{ev.timeLabel}</span>
          <span class="mc-event-title">{ev.title}</span>
        </div>
      ))}

      {/* Linha "agora" */}
      {col.nowMinutes !== null && (
        <div
          class="mc-now-line"
          data-mc-now
          style={{ position: 'absolute', left: 0, right: 0, top: px(yOf(col.nowMinutes)) }}
        />
      )}
    </div>
  );
}
