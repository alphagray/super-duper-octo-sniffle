import { describe, it, expect, beforeEach } from 'vitest';
import { GridManager } from '@/managers/GridManager';
import { GridPathfinder } from '@/managers/GridPathfinder';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('GridPathfinder - Manhattan Pathfinding', () => {
  let gridManager: GridManager;
  let gridPathfinder: GridPathfinder;

  beforeEach(() => {
    gridManager = new GridManager({ width: 512, height: 384, cellSize: 32 });
    gridPathfinder = new GridPathfinder(gridManager);
  });

  it('should generate axis-aligned paths (no diagonals)', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 0,
          rowEnd: 11,
          colStart: 0,
          colEnd: 15,
          zoneType: 'ground',
        },
      ],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // Find path from (2,2) to (8,8)
    const fromWorld = gridManager.gridToWorld(2, 2);
    const toWorld = gridManager.gridToWorld(8, 8);
    const path = gridPathfinder.findPath(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);

    expect(path.length).toBeGreaterThan(0);

    // Verify each step is axis-aligned (only one coordinate changes)
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1];
      const to = path[i];

      const rowDiff = Math.abs(to.row - from.row);
      const colDiff = Math.abs(to.col - from.col);

      // Exactly one of rowDiff or colDiff should be 1, the other 0
      const isAxisAligned = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
      expect(isAxisAligned).toBe(true);
    }
  });

  it('should respect zone transitions in pathfinding', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 3,
          rowEnd: 3,
          colStart: 0,
          colEnd: 15,
          zoneType: 'corridor',
        },
        {
          rowStart: 5,
          rowEnd: 7,
          colStart: 4,
          colEnd: 6,
          zoneType: 'seat',
        },
      ],
      cells: [
        {
          row: 4,
          col: 4,
          zoneType: 'rowEntry',
          transitionType: 'rowBoundary',
        },
      ],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // Try to path from corridor to seat
    const fromWorld = gridManager.gridToWorld(3, 4);
    const toWorld = gridManager.gridToWorld(5, 4);
    const path = gridPathfinder.findPath(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);

    expect(path.length).toBeGreaterThan(0);

    // Path should go through rowEntry at (4,4)
    const passesRowEntry = path.some(seg => seg.row === 4 && seg.col === 4);
    expect(passesRowEntry).toBe(true);
  });

  it('should return empty path when no valid route exists', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 0,
          rowEnd: 11,
          colStart: 0,
          colEnd: 7,
          zoneType: 'corridor',
        },
        {
          rowStart: 0,
          rowEnd: 11,
          colStart: 8,
          colEnd: 15,
          zoneType: 'sky',
          passable: false,
        },
      ],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // Try to path from corridor to sky (should fail)
    const fromWorld = gridManager.gridToWorld(5, 5);
    const toWorld = gridManager.gridToWorld(5, 10);
    const path = gridPathfinder.findPath(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);

    expect(path.length).toBe(0);
  });

  it('should use zone-based movement costs', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 5,
          rowEnd: 5,
          colStart: 0,
          colEnd: 15,
          zoneType: 'corridor',
        },
        {
          rowStart: 6,
          rowEnd: 6,
          colStart: 0,
          colEnd: 7,
          zoneType: 'ground',
        },
        {
          rowStart: 6,
          rowEnd: 6,
          colStart: 8,
          colEnd: 15,
          zoneType: 'seat',
        },
      ],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // Pathfinding should prefer ground over seat due to lower cost
    const fromWorld = gridManager.gridToWorld(5, 0);
    const toWorld = gridManager.gridToWorld(5, 15);
    const path = gridPathfinder.findPath(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);

    expect(path.length).toBeGreaterThan(0);

    // Path should stay in corridor (all rowIdx should be 5)
      const staysInCorridor = path.every(seg => seg.row === 5);
    expect(staysInCorridor).toBe(true);
  });
});
