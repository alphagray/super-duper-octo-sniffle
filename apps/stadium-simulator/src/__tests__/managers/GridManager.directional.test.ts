import { describe, it, expect, beforeEach } from 'vitest';
import { GridManager } from '@/managers/GridManager';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('GridManager - Directional Passability', () => {
  let gridManager: GridManager;

  beforeEach(() => {
    gridManager = new GridManager({ width: 512, height: 384, cellSize: 32 });
  });

  it('should allow movement between corridor and seat via rowBoundary', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 3,
          rowEnd: 3,
          colStart: 4,
          colEnd: 6,
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

    // Corridor to rowEntry should be allowed
    expect(gridManager.isPassableDirection(3, 4, 4, 4)).toBe(true);

    // rowEntry to seat should be allowed
    expect(gridManager.isPassableDirection(4, 4, 5, 4)).toBe(true);

    // Direct corridor to seat (without rowEntry) should be blocked
    expect(gridManager.isPassableDirection(3, 5, 4, 5)).toBe(false);
    expect(gridManager.isPassableDirection(3, 5, 5, 5)).toBe(false);
  });

  it('should respect directional flags on seat cells', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 3,
          rowEnd: 3,
          colStart: 4,
          colEnd: 6,
          zoneType: 'corridor',
        },
      ],
      cells: [
        {
          row: 4,
          col: 4,
          zoneType: 'rowEntry',
          transitionType: 'rowBoundary',
        },
        {
          row: 5,
          col: 4,
          zoneType: 'seat',
          allowedIncoming: {
            top: true,
            right: false,
            bottom: false,
            left: false,
          },
        },
        {
          row: 5,
          col: 5,
          zoneType: 'seat',
          allowedIncoming: {
            top: true,
            right: false,
            bottom: false,
            left: true,
          },
        },
      ],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // From rowEntry down into seat (top incoming allowed)
    expect(gridManager.isPassableDirection(4, 4, 5, 4)).toBe(true);

    // Lateral movement into first seat (right incoming blocked)
    expect(gridManager.isPassableDirection(5, 3, 5, 4)).toBe(false);

    // Lateral movement into second seat (left incoming allowed)
    expect(gridManager.isPassableDirection(5, 4, 5, 5)).toBe(true);

    // Lateral movement from second seat (right incoming blocked)
    expect(gridManager.isPassableDirection(5, 6, 5, 5)).toBe(false);
  });

  it('should block sky zone access', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 0,
          rowEnd: 2,
          colStart: 0,
          colEnd: 15,
          zoneType: 'sky',
          passable: false,
        },
        {
          rowStart: 3,
          rowEnd: 3,
          colStart: 0,
          colEnd: 15,
          zoneType: 'corridor',
        },
      ],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // Movement within corridor should work
    expect(gridManager.isPassableDirection(3, 5, 3, 6)).toBe(true);

    // Movement into sky should be blocked
    expect(gridManager.isPassableDirection(3, 5, 2, 5)).toBe(false);
    expect(gridManager.isPassableDirection(2, 5, 1, 5)).toBe(false);
  });

  it('should allow stair transitions via stairLanding', () => {
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 3,
          rowEnd: 3,
          colStart: 4,
          colEnd: 8,
          zoneType: 'corridor',
        },
        {
          rowStart: 5,
          rowEnd: 6,
          colStart: 6,
          colEnd: 7,
          zoneType: 'stair',
          transitionType: 'stairLanding',
        },
      ],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    // Corridor to stair landing should work
    expect(gridManager.isPassableDirection(3, 6, 4, 6)).toBe(true);
    expect(gridManager.isPassableDirection(4, 6, 5, 6)).toBe(true);

    // Movement within stairs should work
    expect(gridManager.isPassableDirection(5, 6, 5, 7)).toBe(true);
    expect(gridManager.isPassableDirection(5, 6, 6, 6)).toBe(true);
  });
});
