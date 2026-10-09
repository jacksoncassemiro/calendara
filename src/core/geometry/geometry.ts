/** Event interval projected into minutes of a display day.
 * @remarks Português: Intervalo do evento projetado em minutos do dia exibido.
 */
export interface GeoInput {
  /** Stable event placement identifier.
   * @remarks Português: Identificador estável da posição do evento.
   */
  id: string;

  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;

  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
}

/** Visible time window and event layout scale.
 * @remarks Português: Janela de horário visível e escala do layout de eventos.
 */
export interface GeoGrid {
  /** Visible grid start in hours, from 0 to 24.
   * @remarks Português: Início visível da grade em horas, de 0 a 24.
   */
  startHour: number;

  /** Exclusive grid end in hours, greater than startHour and at most 24.
   * @remarks Português: Fim exclusivo em horas, maior que startHour e no máximo 24.
   */
  endHour: number;

  /** Vertical scale in pixels per minute.
   * @remarks Português: Escala vertical em pixels por minuto.
   */
  pxPerMinute: number;

  /** Minimum visual duration in minutes; default 15.
   * @remarks Português: Duração visual mínima em minutos; padrão 15.
   */
  minEventMinutes?: number;

  /** Gap as a fraction of the day-column width; default 0.
   * @remarks Português: Espaçamento como fração da largura da coluna do dia; padrão 0.
   */
  gutter?: number;
}

/** Positioned event; horizontal values are fractions of the day column.
 * @remarks Português: Evento posicionado; valores horizontais são frações da coluna do dia.
 */
export interface GeoBlock {
  /** Stable event placement identifier.
   * @remarks Português: Identificador estável da posição do evento.
   */
  id: string;
  /** Vertical offset from the grid start in pixels.
   * @remarks Português: Deslocamento vertical desde o início da grade em pixels.
   */
  top: number;
  /** Rendered event height in pixels.
   * @remarks Português: Altura renderizada do evento em pixels.
   */
  height: number;
  /** Horizontal offset as a fraction of the day-column width.
   * @remarks Português: Deslocamento horizontal como fração da largura da coluna do dia.
   */
  left: number;
  /** Rendered width as a fraction of the day-column width.
   * @remarks Português: Largura renderizada como fração da largura da coluna do dia.
   */
  width: number;

  /** Zero-based assigned column within the overlap cluster.
   * @remarks Português: Coluna atribuída no grupo de sobreposição, começando em zero.
   */
  column: number;

  /** Total columns in the overlap cluster.
   * @remarks Português: Total de colunas no grupo de sobreposição.
   */
  columns: number;
}

const DEFAULT_MIN_EVENT_MINUTES = 15;

const MIN_WIDTH_FRACTION_OF_COLUMN = 0.5;

interface WorkItem extends GeoInput {
  renderStart: number;
  renderEnd: number;

  collisionEnd: number;
  column: number;
}

function overlaps(first: WorkItem, second: WorkItem): boolean {
  return first.startMin < second.collisionEnd && second.startMin < first.collisionEnd;
}

/** Day event layout inputs.
 * @remarks Português: Entradas do layout de eventos do dia.
 */
export interface LayoutDayInput {
  /** Event intervals in minutes of the display day.
   * @remarks Português: Intervalos dos eventos em minutos do dia exibido.
   */
  items: readonly GeoInput[];
  /** Visible time window and pixel scale.
   * @remarks Português: Janela visível de horário e escala em pixels.
   */
  grid: GeoGrid;
}

/** Clip timed events to the grid and pack overlapping intervals into columns.
 * @remarks Português: Recorta eventos à grade e distribui intervalos sobrepostos em colunas.
 */
export function layoutDay({ items, grid }: LayoutDayInput): GeoBlock[] {
  const gridStartMin = grid.startHour * 60;
  const gridEndMin = grid.endHour * 60;
  const minimumMinutes = grid.minEventMinutes ?? DEFAULT_MIN_EVENT_MINUTES;
  const gutter = grid.gutter ?? 0;

  const workItems: WorkItem[] = [];
  for (const item of items) {
    const clippedStart = Math.max(item.startMin, gridStartMin);
    const clippedEnd = Math.min(item.endMin, gridEndMin);
    const outsideGrid = clippedEnd <= gridStartMin || clippedStart >= gridEndMin;
    if (outsideGrid) continue;
    const renderStart = clippedStart;
    const renderEnd = Math.max(clippedEnd, clippedStart);
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

  workItems.sort(
    (first, second) =>
      first.startMin - second.startMin ||
      second.collisionEnd - first.collisionEnd ||
      (first.id < second.id ? -1 : first.id > second.id ? 1 : 0),
  );

  const blocks: GeoBlock[] = [];

  let cluster: WorkItem[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = (): void => {
    if (cluster.length === 0) return;
    resolveCluster({
      cluster,
      grid,
      gridStartMin,
      gutter,
      blocks,
    });
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

/** Named inputs for resolveCluster.
 * @remarks Português: Entradas nomeadas de resolveCluster.
 */
interface ResolveClusterInput {
  /** Connected group of overlapping intervals.
   * @remarks Português: Grupo conectado de intervalos sobrepostos.
   */
  cluster: WorkItem[];
  /** Visible hour window.
   * @remarks Português: Janela de horas visíveis.
   */
  grid: GeoGrid;
  /** Inclusive grid start in minutes.
   * @remarks Português: Início inclusivo da grade em minutos.
   */
  gridStartMin: number;
  /** Horizontal gap fraction of the day column.
   * @remarks Português: Fração de espaçamento horizontal da coluna do dia.
   */
  gutter: number;
  /** Output collection receiving positioned events.
   * @remarks Português: Coleção de saída que recebe eventos posicionados.
   */
  blocks: GeoBlock[];
}

function resolveCluster({
  cluster,
  grid,
  gridStartMin,
  gutter,
  blocks,
}: ResolveClusterInput): void {
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
