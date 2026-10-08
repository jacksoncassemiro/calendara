import { describe, expect, it } from 'vitest';
import { layoutDay } from '../../src/core/geometry/geometry.js';
import { applyDenseLayout } from '../../src/react/views/layout/denseLayout.js';

const grid = { startHour: 8, endHour: 12, pxPerMinute: 1, minEventMinutes: 15 };
const simultaneous = (count: number, startMin = 540) => Array.from({ length: count }, (_, index) => ({
  id: `${startMin}-${index}`, startMin, endMin: startMin + 60,
}));

describe('dense event geometry policy', () => {
  it('allows partial overlap independently of shrink, scroll and more without covering the more lane', () => {
    const blocks = layoutDay(simultaneous(5), grid);
    for (const policy of ['shrink', 'scroll', 'more'] as const) {
      const plain = applyDenseLayout(blocks, policy, 3, 120);
      const overlap = applyDenseLayout(blocks, policy, 3, 120, true);
      expect(overlap.groups).toEqual(plain.groups);
      expect(overlap.minWidth).toBe(plain.minWidth);
      expect(overlap.blocks.map(block => block.id)).toEqual(plain.blocks.map(block => block.id));
      overlap.blocks.forEach((block, index) => {
        const original = plain.blocks[index]!;
        expect(block.left).toBe(original.left);
        expect(block.top).toBe(original.top);
        expect(block.height).toBe(original.height);
        expect(block.width).toBeLessThanOrEqual(original.width * 2);
        expect(block.width + 1e-12).toBeGreaterThanOrEqual(original.width);
        const boundary = overlap.groups[0]?.left ?? 1;
        expect(block.left + block.width).toBeLessThanOrEqual(boundary);
      });
      expect(overlap.blocks[0]!.width).toBeCloseTo(plain.blocks[0]!.width * 2);
    }
  });
  it('keeps shrink geometry and scroll geometry unchanged, while scroll reserves readable widths', () => {
    const blocks = layoutDay([...simultaneous(5), ...simultaneous(2, 660)], grid);
    const original = structuredClone(blocks);
    expect(applyDenseLayout(blocks)).toEqual({ blocks, minWidth: 0, groups: [] });
    expect(applyDenseLayout(blocks, 'scroll', 3, 120)).toEqual({ blocks, minWidth: 600, groups: [] });
    expect(blocks).toEqual(original);
  });

  it('reserves one lane for more and separates adjacent overflow clusters', () => {
    const blocks = layoutDay([...simultaneous(5), ...simultaneous(4, 600)], grid);
    const result = applyDenseLayout(blocks, 'more', 3);
    expect(result.blocks).toHaveLength(4);
    expect(result.groups).toEqual([
      { top: 60, height: 60, left: 2 / 3, width: 1 / 3, hiddenIds: ['540-2', '540-3', '540-4'] },
      { top: 120, height: 60, left: 2 / 3, width: 1 / 3, hiddenIds: ['600-2', '600-3'] },
    ]);
    for (const block of result.blocks) {
      expect(block.columns).toBe(3);
      expect(block.width).toBeCloseTo(1 / 3);
      expect(block.left + block.width).toBeLessThanOrEqual(2 / 3);
    }
  });

  it('joins connected intervals and respects visual minimum height for short events', () => {
    const blocks = layoutDay([
      ...simultaneous(4).map(event => ({ ...event, endMin: 541 })),
      { id: 'bridge', startMin: 550, endMin: 590 },
      { id: 'last', startMin: 580, endMin: 600 },
    ], grid);
    const result = applyDenseLayout(blocks, 'more', 3);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ top: 60, height: 60 });
    expect(result.groups[0].hiddenIds).toEqual(['540-2', '540-3', 'bridge']);
    expect(result.blocks.find(block => block.id === 'last')!.left + result.blocks.find(block => block.id === 'last')!.width)
      .toBeLessThanOrEqual(2 / 3);
  });

  it('keeps sparse clusters at their original width and can show only more for a one-lane limit', () => {
    const blocks = layoutDay([...simultaneous(4), ...simultaneous(1, 660)], grid);
    const result = applyDenseLayout(blocks, 'more', 1);
    expect(result.blocks).toEqual([blocks.find(block => block.id === '660-0')]);
    expect(result.groups).toEqual([
      { top: 60, height: 60, left: 0, width: 1, hiddenIds: ['540-0', '540-1', '540-2', '540-3'] },
    ]);
    expect(applyDenseLayout([], 'scroll')).toEqual({ blocks: [], minWidth: 0, groups: [] });
  });
});
