import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GridManager } from '@/managers/GridManager';
import { GridPathfinder } from '@/managers/GridPathfinder';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('GridPathfinder - Cache Invalidation', () => {
  let gridManager: GridManager;
  let gridPathfinder: GridPathfinder;

  beforeEach(() => {
    gridManager = new GridManager({ width: 512, height: 384, cellSize: 32 });
    gridPathfinder = new GridPathfinder(gridManager);
  });

  it('should clear cache on gridChanged event', () => {
    // Spy on clearCache method
    const clearCacheSpy = vi.spyOn(gridPathfinder, 'clearCache');

    // Trigger gridChanged event
    gridManager.emit('gridChanged', {});

    expect(clearCacheSpy).toHaveBeenCalledTimes(1);
  });

  it('should clear cache on zonesLoaded event', () => {
    // Spy on clearCache method
    const clearCacheSpy = vi.spyOn(gridPathfinder, 'clearCache');

    // Load zone configuration (which emits zonesLoaded)
    const config: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config);

    expect(clearCacheSpy).toHaveBeenCalledTimes(1);
  });

  it('should recalculate paths after zone config changes', () => {
    // Initial config: open corridor
    const config1: StadiumSceneConfig = {
      gridConfig: { rows: 12, cols: 16, cellSize: 32 },
      cellRanges: [
        {
          rowStart: 5,
          rowEnd: 5,
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

    gridManager.loadZoneConfig(config1);

    const fromWorld = gridManager.gridToWorld(5, 2);
    const toWorld = gridManager.gridToWorld(5, 10);
    const path1 = gridPathfinder.findPath(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);

    expect(path1.length).toBeGreaterThan(0);

    // Updated config: add sky barrier in the middle
    const config2: StadiumSceneConfig = {
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
          rowStart: 5,
          rowEnd: 5,
          colStart: 5,
          colEnd: 7,
          zoneType: 'sky',
          passable: false,
        },
      ],
      cells: [],
      sections: [],
      stairs: [],
      fans: [],
    };

    gridManager.loadZoneConfig(config2);

    // Path should now fail because sky blocks the route
    const path2 = gridPathfinder.findPath(fromWorld.x, fromWorld.y, toWorld.x, toWorld.y);

    expect(path2.length).toBe(0);
  });
});
