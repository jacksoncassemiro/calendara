import type { GeoBlock } from '../../../core/geometry/geometry.js';

export type DenseEventPolicy = 'shrink' | 'scroll' | 'more';

export interface DenseOverflowGroup {
  /** Vertical offset in px. @remarks Português: Deslocamento vertical em px. */
  top: number;
  /** Group height in px. @remarks Português: Altura do grupo em px. */
  height: number;
  /** Horizontal offset as a column fraction. @remarks Português: Deslocamento horizontal como fração da coluna. */
  left: number;
  /** Width as a column fraction. @remarks Português: Largura como fração da coluna. */
  width: number;
  /** IDs omitted from visible lanes. @remarks Português: IDs ocultos das colunas visíveis. */
  hiddenIds: string[];
}

export interface DenseLayoutResult {
  /** Visible positioned event cards. @remarks Português: Cartões visíveis e posicionados. */
  blocks: GeoBlock[];
  /** Minimum column width in px. @remarks Português: Largura mínima da coluna em px. */
  minWidth: number;
  /** Overflow groups with hidden IDs. @remarks Português: Grupos excedentes com IDs ocultos. */
  groups: DenseOverflowGroup[];
}

/** Density inputs without event-time changes. @remarks Português: Entradas de densidade sem mudar horários. */
export interface DenseLayoutInput {
  /** Visible positioned event cards. @remarks Português: Cartões visíveis e posicionados. */
  blocks: readonly GeoBlock[];
  /** Density behavior; default shrink. @remarks Português: Comportamento de densidade; padrão shrink. */
  policy?: DenseEventPolicy;
  /** Visible lanes including +more; default 3. @remarks Português: Colunas visíveis incluindo ver mais; padrão 3. */
  maxStack?: number;
  /** Minimum card width in px; default 100. @remarks Português: Largura mínima do cartão em px; padrão 100. */
  minEventWidth?: number;
  /** Partial overlaps; default false. @remarks Português: Sobreposição parcial; padrão false. */
  slotEventOverlap?: boolean;
}

/** Apply density without changing times. @remarks Português: Aplica densidade sem mudar horários. */
export function applyDenseLayout({
  blocks,
  policy = 'shrink',
  maxStack = 3,
  minEventWidth = 100,
  slotEventOverlap = false,
}: DenseLayoutInput): DenseLayoutResult {
  const result: DenseLayoutResult = { blocks: [...blocks], minWidth: 0, groups: [] };
  const finish = (): DenseLayoutResult => {
    if (!slotEventOverlap) return result;
    result.blocks = result.blocks.map((block) => {
      const boundary =
        result.groups.find(
          (group) => block.top < group.top + group.height && group.top < block.top + block.height,
        )?.left ?? 1;
      return { ...block, width: Math.min(block.width * 2, boundary - block.left) };
    });
    return result;
  };
  if (policy === 'shrink' || blocks.length === 0) return finish();
  if (policy === 'scroll') {
    const columns = Math.max(1, ...blocks.map((block) => block.columns));
    result.minWidth = columns * (Number.isFinite(minEventWidth) ? Math.max(0, minEventWidth) : 100);
    return finish();
  }

  const limit = Number.isFinite(maxStack) ? Math.max(1, Math.floor(maxStack)) : 3;

  const sorted = [...blocks].sort(
    (a, b) => a.top - b.top || b.height - a.height || a.id.localeCompare(b.id),
  );
  const replacements = new Map<string, GeoBlock>();
  const hidden = new Set<string>();
  let cluster: GeoBlock[] = [];
  let end = -Infinity;

  const flush = (): void => {
    if (!cluster.length) return;
    const columns = Math.max(...cluster.map((block) => block.columns));
    if (columns > limit) {
      const hiddenIds: string[] = [];
      const visibleColumns = limit - 1;
      for (const block of cluster) {
        if (block.column >= visibleColumns) {
          hidden.add(block.id);
          hiddenIds.push(block.id);
        } else {
          const span = Math.min(visibleColumns - block.column, block.width * columns);
          replacements.set(block.id, {
            ...block,
            left: block.column / limit,
            width: Math.max(0, span / limit),
            columns: limit,
          });
        }
      }
      result.groups.push({
        top: cluster[0]!.top,
        height: end - cluster[0]!.top,
        left: visibleColumns / limit,
        width: 1 / limit,
        hiddenIds,
      });
    }
    cluster = [];
    end = -Infinity;
  };

  for (const block of sorted) {
    if (cluster.length && block.top >= end) flush();
    cluster.push(block);
    end = Math.max(end, block.top + block.height);
  }
  flush();
  result.blocks = blocks
    .filter((block) => !hidden.has(block.id))
    .map((block) => replacements.get(block.id) ?? block);
  return finish();
}
