/**
 * GeometryEngine — posicionamento de eventos "timed" numa coluna de dia (time grid).
 *
 * Puro e sem Temporal: trabalha em **minutos-do-dia**. Duas responsabilidades:
 *  1. Vertical: converter [startMin,endMin] em top/height (px) a partir da escala do grid.
 *  2. Horizontal: empacotar eventos que se sobrepõem em colunas e aplicar **expansão waterfall**
 *     (um evento cresce para a direita ocupando colunas livres à frente — padrão FullCalendar).
 *
 * Colisão usa o intervalo "renderizado com altura mínima" (`collisionEnd`), de modo que eventos
 * que apenas se tocam (fim de A == início de B) NÃO são considerados sobrepostos.
 */

/** Item de entrada: uma ocorrência já reduzida a minutos-do-dia. */
export interface GeoInput {
  /** Chave estável (ex.: `${masterId}@${originalStart}`). */
  id: string;
  /** Minuto de início no dia (0..1440). */
  startMin: number;
  /** Minuto de fim no dia (exclusivo). */
  endMin: number;
}

/** Parâmetros do grid (escala dinâmica de horário). */
export interface GeoGrid {
  /** Hora do topo do grid (0..24). */
  startHour: number;
  /** Hora da base do grid (0..24, > startHour). */
  endHour: number;
  /** Pixels por minuto (escala vertical). */
  pxPerMinute: number;
  /** Altura mínima visual, em minutos (default 15). */
  minEventMinutes?: number;
  /** Folga horizontal entre blocos, fração 0..1 da largura da coluna (default 0). */
  gutter?: number;
}

/** Bloco posicionado. `left/width` são frações 0..1 da largura da coluna do dia. */
export interface GeoBlock {
  id: string;
  top: number;
  height: number;
  left: number;
  width: number;
  /** Índice da coluna atribuída dentro do cluster. */
  column: number;
  /** Total de colunas no cluster (para depuração/estilo). */
  columns: number;
}

interface Work extends GeoInput {
  /** Início/fim recortados ao grid (para px). */
  renderStart: number;
  renderEnd: number;
  /** Fim usado para colisão (com altura mínima aplicada). */
  collisionEnd: number;
  column: number;
}

function overlaps(a: Work, b: Work): boolean {
  return a.startMin < b.collisionEnd && b.startMin < a.collisionEnd;
}

/**
 * Posiciona os eventos timed de UM dia. Eventos totalmente fora da janela [startHour,endHour)
 * são descartados; parcialmente fora são recortados.
 */
export function layoutDay(items: readonly GeoInput[], grid: GeoGrid): GeoBlock[] {
  const gridStart = grid.startHour * 60;
  const gridEnd = grid.endHour * 60;
  const minMin = grid.minEventMinutes ?? 15;
  const gutter = grid.gutter ?? 0;

  // 1) Recorte ao grid + normalização.
  const work: Work[] = [];
  for (const it of items) {
    const s = Math.max(it.startMin, gridStart);
    const e = Math.min(it.endMin, gridEnd);
    if (e <= gridStart || s >= gridEnd) continue; // fora da janela
    const renderStart = s;
    const renderEnd = Math.max(e, s); // nunca negativo
    const collisionEnd = Math.max(renderEnd, renderStart + minMin);
    work.push({
      id: it.id,
      startMin: renderStart,
      endMin: it.endMin,
      renderStart,
      renderEnd,
      collisionEnd,
      column: 0,
    });
  }

  // 2) Ordena por início asc, depois por duração desc (mais longos primeiro), depois id.
  work.sort(
    (a, b) =>
      a.startMin - b.startMin ||
      b.collisionEnd - a.collisionEnd ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const out: GeoBlock[] = [];

  // 3) Agrupa em clusters (conjuntos conectados por sobreposição) e resolve cada um.
  let group: Work[] = [];
  let groupEnd = -Infinity;

  const flush = (): void => {
    if (group.length === 0) return;
    resolveCluster(group, grid, gridStart, gutter, out);
    group = [];
    groupEnd = -Infinity;
  };

  for (const ev of work) {
    if (group.length > 0 && ev.startMin >= groupEnd) flush();
    group.push(ev);
    groupEnd = Math.max(groupEnd, ev.collisionEnd);
  }
  flush();

  return out;
}

function resolveCluster(
  group: Work[],
  grid: GeoGrid,
  gridStart: number,
  gutter: number,
  out: GeoBlock[],
): void {
  // Atribuição gulosa de colunas: reusa a primeira coluna livre.
  const colEnds: number[] = [];
  for (const ev of group) {
    let placed = -1;
    for (let c = 0; c < colEnds.length; c++) {
      if ((colEnds[c] ?? -Infinity) <= ev.startMin) {
        placed = c;
        break;
      }
    }
    if (placed === -1) {
      placed = colEnds.length;
      colEnds.push(ev.collisionEnd);
    } else {
      colEnds[placed] = ev.collisionEnd;
    }
    ev.column = placed;
  }
  const columns = colEnds.length;

  // Expansão waterfall: cada evento cresce à direita enquanto as colunas seguintes
  // não tiverem nenhum evento que o sobreponha no tempo.
  for (const ev of group) {
    let span = 1;
    for (let c = ev.column + 1; c < columns; c++) {
      const conflict = group.some((o) => o.column === c && overlaps(o, ev));
      if (conflict) break;
      span++;
    }
    const colWidth = 1 / columns;
    const left = ev.column * colWidth;
    const width = span * colWidth - gutter;
    out.push({
      id: ev.id,
      top: (ev.renderStart - gridStart) * grid.pxPerMinute,
      height: Math.max(ev.renderEnd - ev.renderStart, grid.minEventMinutes ?? 15) * grid.pxPerMinute,
      left,
      width: Math.max(width, colWidth * 0.5),
      column: ev.column,
      columns,
    });
  }
}
