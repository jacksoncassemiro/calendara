import { describe, it, expect } from 'vitest';
import { layoutDay, type GeoInput, type GeoGrid } from '../../src/core/geometry/geometry.js';

const grid: GeoGrid = { startHour: 0, endHour: 24, pxPerMinute: 1, minEventMinutes: 15, gutter: 0 };

function byId(blocks: ReturnType<typeof layoutDay>, id: string) {
  const block = blocks.find((candidateBlock) => candidateBlock.id === id);
  if (!block) throw new Error(`bloco ${id} ausente`);
  return block;
}

describe('GeometryEngine.layoutDay', () => {
  it('recorta também a altura mínima na base do grid', () => {
    const [block] = layoutDay([{ id: 'late', startMin: 1439, endMin: 1440 }], grid);
    expect(block!.top + block!.height).toBe(1440);
    expect(block!.height).toBe(1);
  });
  it('posiciona vertical: top/height por minuto', () => {
    const items: GeoInput[] = [{ id: 'a', startMin: 540, endMin: 600 }]; // 09:00–10:00
    const [block] = layoutDay(items, grid);
    expect(block).toBeDefined();
    expect(block!.top).toBe(540);
    expect(block!.height).toBe(60);
    expect(block!.left).toBe(0);
    expect(block!.width).toBe(1);
  });

  it('evento único ocupa largura total', () => {
    const blocks = layoutDay([{ id: 'a', startMin: 540, endMin: 570 }], grid);
    expect(blocks[0]!.width).toBe(1);
    expect(blocks[0]!.columns).toBe(1);
  });

  it('dois sobrepostos → 2 colunas de meia largura', () => {
    const blocks = layoutDay(
      [
        { id: 'a', startMin: 540, endMin: 600 },
        { id: 'b', startMin: 570, endMin: 630 },
      ],
      grid,
    );
    expect(blocks).toHaveLength(2);
    const firstBlock = byId(blocks, 'a');
    const block = byId(blocks, 'b');
    expect(firstBlock.columns).toBe(2);
    expect(firstBlock.width).toBeCloseTo(0.5);
    expect(block.width).toBeCloseTo(0.5);
    expect(new Set([firstBlock.left, block.left])).toEqual(new Set([0, 0.5]));
  });

  it('eventos que só se tocam (fim==início) NÃO colidem', () => {
    const blocks = layoutDay(
      [
        { id: 'a', startMin: 540, endMin: 600 },
        { id: 'b', startMin: 600, endMin: 660 },
      ],
      grid,
    );
    expect(byId(blocks, 'a').width).toBe(1);
    expect(byId(blocks, 'b').width).toBe(1);
  });

  it('expansão waterfall: evento cresce para colunas livres à direita', () => {
    // Cluster de 3 colunas com um "buraco" à direita para C expandir.
    const blocks = layoutDay(
      [
        { id: 'L', startMin: 540, endMin: 660 }, // 09:00–11:00 (col0)
        { id: 'A', startMin: 540, endMin: 560 }, // 09:00–09:20 (col1)
        { id: 'B', startMin: 550, endMin: 570 }, // 09:10–09:30 (col2)
        { id: 'C', startMin: 600, endMin: 620 }, // 10:00–10:20 (col1, expande p/ col2)
      ],
      grid,
    );
    expect(byId(blocks, 'L').columns).toBe(3);
    const expandedBlock = byId(blocks, 'C');
    expect(expandedBlock.column).toBe(1);
    expect(expandedBlock.width).toBeCloseTo(2 / 3); // expandiu por 2 colunas
    expect(expandedBlock.left).toBeCloseTo(1 / 3);
    const block = byId(blocks, 'B');
    expect(block.column).toBe(2);
    expect(block.width).toBeCloseTo(1 / 3);
  });

  it('aplica altura mínima a eventos muito curtos', () => {
    const [block] = layoutDay([{ id: 'a', startMin: 540, endMin: 541 }], grid);
    expect(block!.height).toBe(15); // minEventMinutes * pxPerMinute
  });

  it('recorta ao grid e descarta eventos totalmente fora', () => {
    const clippedGrid: GeoGrid = { startHour: 8, endHour: 18, pxPerMinute: 1 };
    const blocks = layoutDay(
      [
        { id: 'fora', startMin: 0, endMin: 300 }, // 00:00–05:00 (fora)
        { id: 'cruza', startMin: 420, endMin: 540 }, // 07:00–09:00 → recorta p/ 08:00
      ],
      clippedGrid,
    );
    expect(blocks.find((block) => block.id === 'fora')).toBeUndefined();
    const crossingBlock = byId(blocks, 'cruza');
    expect(crossingBlock.top).toBe(0); // recortado ao topo (08:00)
    expect(crossingBlock.height).toBe(60); // 08:00–09:00
  });
});
