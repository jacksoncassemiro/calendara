import { describe, expect, it } from 'vitest';
import { resourceTreeRows } from '../../src/react/views/models/resourceTree.js';

describe('resource hierarchy', () => {
  const resources = [
    { id: 'root', title: 'Clinic', capacity: 1 },
    { id: 'room', title: 'Room', parentId: 'root', capacity: false as const },
    { id: 'device', title: 'Device', parentId: 'room' },
    { id: 'other', title: 'Other', parentId: 'missing' },
  ];
  it('keeps descendant rules independent and presents nesting', () => {
    const rows = resourceTreeRows({ resources, collapsed: new Set(), hierarchy: true });
    expect(rows.map((row) => [row.resource.id, row.depth])).toEqual([
      ['root', 0],
      ['room', 1],
      ['device', 2],
      ['other', 0],
    ]);
    expect(rows[1]!.resource.capacity).toBe(false);
  });
  it('collapses descendants without removing their data', () => {
    expect(
      resourceTreeRows({ resources, collapsed: new Set(['room']), hierarchy: true }).map(
        (row) => row.resource.id,
      ),
    ).toEqual(['root', 'room', 'other']);
    expect(resources).toHaveLength(4);
  });
  it('rejects cyclic parents', () => {
    expect(() =>
      resourceTreeRows({
        resources: [
          { id: 'a', title: 'A', parentId: 'b' },
          { id: 'b', title: 'B', parentId: 'a' },
        ],
        collapsed: new Set(),
        hierarchy: true,
      }),
    ).toThrow('cycle');
  });
});
