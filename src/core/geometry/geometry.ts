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

/** Altura mínima visual padrão (minutos) quando o grid não especifica. */
const DEFAULT_MIN_EVENT_MINUTES = 15;
/** Largura mínima de um bloco como fração da coluna (evita blocos "sumirem" ao empacotar). */
const MIN_WIDTH_FRACTION_OF_COLUMN = 0.5;

interface WorkItem extends GeoInput {
  /** Início/fim recortados ao grid (para px). */
  renderStart: number;
  renderEnd: number;
  /** Fim usado para colisão (com altura mínima aplicada). */
  collisionEnd: number;
  column: number;
}

function overlaps(first: WorkItem, second: WorkItem): boolean {
  return first.startMin < second.collisionEnd && second.startMin < first.collisionEnd;
}

/**
 * Posiciona os eventos timed de UM dia. Eventos totalmente fora da janela [startHour,endHour)
 * são descartados; parcialmente fora são recortados.
 */
export function layoutDay(items: readonly GeoInput[], grid: GeoGrid): GeoBlock[] {
  const gridStartMin = grid.startHour * 60;
  const gridEndMin = grid.endHour * 60;
  const minimumMinutes = grid.minEventMinutes ?? DEFAULT_MIN_EVENT_MINUTES;
  const gutter = grid.gutter ?? 0;

  // 1) Recorte ao grid + normalização.
  const workItems: WorkItem[] = [];
  for (const item of items) {
    const clippedStart = Math.max(item.startMin, gridStartMin);
    const clippedEnd = Math.min(item.endMin, gridEndMin);
    const outsideGrid = clippedEnd <= gridStartMin || clippedStart >= gridEndMin;
    if (outsideGrid) continue;
    const renderStart = clippedStart;
    const renderEnd = Math.max(clippedEnd, clippedStart); // nunca negativo
    const collisionEnd = Math.min(gridEndMin, Math.max(renderEnd, renderStart + minimumMinutes));
    workItems.push({
      id: item.id,
      startMin: renderStart,
      endMin: item.endMin,
      renderStart,
      renderEnd,
      collisionEnd,
      column: 0,
    });
  }

  // 2) Ordena por início asc, depois por duração desc (mais longos primeiro), depois id.
  workItems.sort(
    (first, second) =>
      first.startMin - second.startMin ||
      second.collisionEnd - first.collisionEnd ||
      (first.id < second.id ? -1 : first.id > second.id ? 1 : 0),
  );

  const blocks: GeoBlock[] = [];

  // 3) Agrupa em clusters (conjuntos conectados por sobreposição) e resolve cada um.
  let cluster: WorkItem[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = (): void => {
    if (cluster.length === 0) return;
    resolveCluster(cluster, grid, gridStartMin, gutter, blocks);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const workItem of workItems) {
    const startsNewCluster = cluster.length > 0 && workItem.startMin >= clusterEnd;
    if (startsNewCluster) flushCluster();
    cluster.push(workItem);
    clusterEnd = Math.max(clusterEnd, workItem.collisionEnd);
  }
  flushCluster();

  return blocks;
}

function resolveCluster(
  cluster: WorkItem[],
  grid: GeoGrid,
  gridStartMin: number,
  gutter: number,
  blocks: GeoBlock[],
): void {
  // Atribuição gulosa de colunas: reusa a primeira coluna livre.
  const NO_COLUMN = -1;
  const columnEnds: number[] = [];
  for (const workItem of cluster) {
    let placedColumn = NO_COLUMN;
    for (let columnIndex = 0; columnIndex < columnEnds.length; columnIndex++) {
      const columnIsFree = (columnEnds[columnIndex] ?? -Infinity) <= workItem.startMin;
      if (columnIsFree) {
        placedColumn = columnIndex;
        break;
      }
    }
    const needsNewColumn = placedColumn === NO_COLUMN;
    if (needsNewColumn) {
      placedColumn = columnEnds.length;
      columnEnds.push(workItem.collisionEnd);
    } else {
      columnEnds[placedColumn] = workItem.collisionEnd;
    }
    workItem.column = placedColumn;
  }
  const columnCount = columnEnds.length;

  // Expansão waterfall: cada evento cresce à direita enquanto as colunas seguintes
  // não tiverem nenhum evento que o sobreponha no tempo.
  for (const workItem of cluster) {
    let columnSpan = 1;
    for (let columnIndex = workItem.column + 1; columnIndex < columnCount; columnIndex++) {
      const hasConflict = cluster.some(
        (other) => other.column === columnIndex && overlaps(other, workItem),
      );
      if (hasConflict) break;
      columnSpan++;
    }
    const columnWidth = 1 / columnCount;
    const left = workItem.column * columnWidth;
    const expandedWidth = columnSpan * columnWidth - gutter;
    const minimumWidth = columnWidth * MIN_WIDTH_FRACTION_OF_COLUMN;
    const renderedMinutes = workItem.collisionEnd - workItem.renderStart;
    blocks.push({
      id: workItem.id,
      top: (workItem.renderStart - gridStartMin) * grid.pxPerMinute,
      height: renderedMinutes * grid.pxPerMinute,
      left,
      width: Math.max(expandedWidth, minimumWidth),
      column: workItem.column,
      columns: columnCount,
    });
  }
}
