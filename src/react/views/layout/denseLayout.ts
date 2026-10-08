import type { GeoBlock } from '../../../core/geometry/geometry.js';

export type DenseEventPolicy = 'shrink' | 'scroll' | 'more';

export interface DenseOverflowGroup {
  top: number;
  height: number;
  left: number;
  width: number;
  hiddenIds: string[];
}

export interface DenseLayoutResult {
  blocks: GeoBlock[];
  /** Minimum day/resource width in pixels; zero leaves sizing to the view. */
  minWidth: number;
  groups: DenseOverflowGroup[];
}

/** Applies density policy to layoutDay's geometry without changing event times. */
export function applyDenseLayout(
  blocks: readonly GeoBlock[],
  policy: DenseEventPolicy = 'shrink',
  maxStack = 3,
  minEventWidth = 100,
  slotEventOverlap = false,
): DenseLayoutResult {
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
  // Rendered heights include layoutDay's minimum event height, so short events
  // that visually collide belong to the same connected component too.
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
          // Preserve waterfall expansion within the visible lanes, leaving the
          // reserved last lane clear across the whole overflow group.
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
    // Exclusive end: adjacent events do not create an overflow group together.
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
