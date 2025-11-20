import { describe, it, expect } from 'vitest';
import { GridManager } from '@/managers/GridManager';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

// Helper to build and load a minimal zone configuration into GridManager
function buildGrid(): GridManager {
  // World size derives row/col count via cell size (default 32). We want 24x32 grid.
  const width = 32 * 32; // cols * cellSize
  const height = 24 * 32; // rows * cellSize
  const grid = new GridManager({ width, height });

  const config: StadiumSceneConfig = {
    version: 'test',
    gridDimensions: { rows: 24, cols: 32 },
    cellRanges: [
      // Seat zone: two rows (rows 15 & 16) two columns (5 & 6)
      { zoneType: 'seat', startRow: 15, endRow: 16, startCol: 5, endCol: 6 },
      // Row entry interior cell at row 16 col 4
      { zoneType: 'rowEntry', transitionType: 'rowBoundary', startRow: 16, endRow: 16, startCol: 4, endCol: 4 },
    ],
    cells: [],
    sections: [],
    stairs: [],
    vendors: [],
    fans: []
  } as any;

  grid.loadZoneConfig(config);
  return grid;
}

describe('GridManager directional passability', () => {
  const grid = buildGrid();

  it('allows horizontal movement between adjacent seat cells', () => {
    expect(grid.isPassableDirection(5, 5, 5, 6)).toBe(true);
    expect(grid.isPassableDirection(5, 6, 5, 5)).toBe(true);
  });


  it('allows entry from rowEntry cell into seat cell horizontally', () => {
    // rowEntry at (16,4) into seat at (16,5)
    expect(grid.isPassableDirection(16, 4, 16, 5)).toBe(true);
  });

  it('allows exit from seat cell back to rowEntry cell horizontally', () => {
    expect(grid.isPassableDirection(16, 5, 16, 4)).toBe(true);
  });

  it('prevents diagonal movement (seat to rowEntry diagonally)', () => {
    // Attempt diagonal from (16,6) to (15,5)
    expect(grid.isPassableDirection(16, 6, 15, 5)).toBe(false);
  });
});
