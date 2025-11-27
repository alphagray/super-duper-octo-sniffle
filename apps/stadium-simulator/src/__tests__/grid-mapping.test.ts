import { describe, it, expect } from 'vitest';
import { GridManager } from '@/managers/GridManager';

// Simple verification that gridToWorld -> worldToGrid round-trip preserves indices
// across a sampling of rows/cols (center, edges, stairs, seats, ground).

describe('Grid Mapping Round-Trip', () => {
  const gridManager = new GridManager({ width: 1024, height: 768, cellSize: 32 });

  it('round-trips a sampling of coordinates', () => {
    const samples: Array<{ row: number; col: number }> = [
      { row: 0, col: 0 },
      { row: 12, col: 16 }, // center
      { row: 23, col: 31 }, // bottom-right corner
      { row: 19, col: 21 }, // ground stair landing
      { row: 18, col: 21 }, // stair column
      { row: 15, col: 24 }, // seat row
    ];

    for (const s of samples) {
      const world = gridManager.gridToWorld(s.row, s.col);
      const back = gridManager.worldToGrid(world.x, world.y);
      expect(back).toBeTruthy();
      expect(back!.row).toBe(s.row);
      expect(back!.col).toBe(s.col);
    }
  });
});
