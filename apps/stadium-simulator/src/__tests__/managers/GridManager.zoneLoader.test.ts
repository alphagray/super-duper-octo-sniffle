import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GridManager } from '@/managers/GridManager';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('GridManager - Zone Configuration', () => {
  let gridManager: GridManager;

  beforeEach(() => {
    gridManager = new GridManager({ width: 512, height: 384, cellSize: 32 });
  });

  describe('Zone Loader', () => {
    it('should load zone configuration with cellRanges', () => {
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
            rowStart: 10,
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

      // Verify sky zone
      expect(gridManager.getZoneType(0, 0)).toBe('sky');
      expect(gridManager.getZoneType(2, 15)).toBe('sky');
      expect(gridManager.getCell(0, 0)?.passable).toBe(false);

      // Verify ground zone
      expect(gridManager.getZoneType(10, 0)).toBe('ground');
      expect(gridManager.getZoneType(11, 15)).toBe('ground');
      expect(gridManager.getCell(10, 0)?.passable).toBe(true);
    });

    it('should override cellRanges with individual cells', () => {
      const config: StadiumSceneConfig = {
        gridConfig: { rows: 12, cols: 16, cellSize: 32 },
        cellRanges: [
          {
            rowStart: 4,
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

      // Cell override should apply
      expect(gridManager.getZoneType(4, 4)).toBe('rowEntry');
      expect(gridManager.isTransition(4, 4, 'rowBoundary')).toBe(true);

      // Range default should apply elsewhere
      expect(gridManager.getZoneType(5, 4)).toBe('seat');
      expect(gridManager.getZoneType(7, 6)).toBe('seat');
    });

    it('should build boundary caches correctly', () => {
      const config: StadiumSceneConfig = {
        gridConfig: { rows: 12, cols: 16, cellSize: 32 },
        cellRanges: [
          {
            rowStart: 5,
            rowEnd: 6,
            colStart: 7,
            colEnd: 8,
            zoneType: 'stair',
            transitionType: 'stairLanding',
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
            row: 4,
            col: 6,
            zoneType: 'rowEntry',
            transitionType: 'rowBoundary',
          },
        ],
        sections: [],
        stairs: [],
        fans: [],
      };

      gridManager.loadZoneConfig(config);

      const rowEntries = gridManager.getBoundarySet('rowBoundary');
      expect(rowEntries.length).toBe(2);
      expect(rowEntries.some(b => b.row === 4 && b.col === 4)).toBe(true);
      expect(rowEntries.some(b => b.row === 4 && b.col === 6)).toBe(true);

      const stairLandings = gridManager.getBoundarySet('stairLanding');
      expect(stairLandings.length).toBe(4); // 2x2 range
    });

    it('should apply directional flags from cell descriptors', () => {
      const config: StadiumSceneConfig = {
        gridConfig: { rows: 12, cols: 16, cellSize: 32 },
        cellRanges: [],
        cells: [
          {
            row: 5,
            col: 5,
            zoneType: 'seat',
            allowedIncoming: {
              top: true,
              right: false,
              bottom: false,
              left: false,
            },
          },
        ],
        sections: [],
        stairs: [],
        fans: [],
      };

      gridManager.loadZoneConfig(config);

      const cell = gridManager.getCell(5, 5);
      expect(cell?.allowedIncoming?.top).toBe(true);
      expect(cell?.allowedIncoming?.right).toBe(false);
      expect(cell?.allowedIncoming?.bottom).toBe(false);
      expect(cell?.allowedIncoming?.left).toBe(false);
    });

    it('should emit zonesLoaded event', () => {
      const mockHandler = vi.fn();
      gridManager.on('zonesLoaded', mockHandler);

      const config: StadiumSceneConfig = {
        gridConfig: { rows: 12, cols: 16, cellSize: 32 },
        cellRanges: [],
        cells: [],
        sections: [],
        stairs: [],
        fans: [],
      };

      gridManager.loadZoneConfig(config);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });
});
