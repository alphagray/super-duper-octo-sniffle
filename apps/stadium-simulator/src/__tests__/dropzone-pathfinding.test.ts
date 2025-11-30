import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GridManager } from '@/managers/GridManager';
import { PathfindingService } from '@/services/PathfindingService';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('Drop Zone Pathfinding', () => {
  let gridManager: GridManager;
  let pathfindingService: PathfindingService;

  beforeEach(() => {
    // Initialize grid manager with stadium config
    gridManager = new GridManager({
      width: 1024,
      height: 768,
      cellSize: 32,
    });

    // Load the stadium grid config from filesystem
    const configPath = join(__dirname, '../../public/assets/stadium-grid-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    const config: StadiumSceneConfig = JSON.parse(configData);
    gridManager.loadZoneConfig(config);

    // Initialize pathfinding service
    pathfindingService = new PathfindingService(gridManager);
  });

  it('should find drop zones in grid configuration', () => {
    const dropZones = gridManager.getDropZones();
    
    console.log('[TEST] Drop zones found:', dropZones);
    
    expect(dropZones.length).toBeGreaterThan(0);
    expect(dropZones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: expect.any(Number), col: expect.any(Number) })
      ])
    );
  });

  it('should find path from ground(20,5) to drop zone(14,10)', () => {
    const startRow = 20;
    const startCol = 5;
    const endRow = 14;
    const endCol = 10;

    // Convert to world coordinates
    const startWorld = gridManager.gridToWorld(startRow, startCol);
    const endWorld = gridManager.gridToWorld(endRow, endCol);

    console.log(`\n[TEST] Finding path from grid(${startRow},${startCol}) to drop zone(${endRow},${endCol})`);
    console.log(`[TEST] World coords: (${startWorld.x},${startWorld.y}) -> (${endWorld.x},${endWorld.y})`);

    // Verify cells exist and are passable
    const startCell = gridManager.getCell(startRow, startCol);
    const endCell = gridManager.getCell(endRow, endCol);

    console.log('[TEST] Start cell:', {
      row: startRow,
      col: startCol,
      zone: startCell?.zoneType,
      passable: startCell?.passable,
      dropZone: endCell?.dropZone
    });

    console.log('[TEST] End cell (drop zone):', {
      row: endRow,
      col: endCol,
      zone: endCell?.zoneType,
      passable: endCell?.passable,
      dropZone: endCell?.dropZone
    });

    expect(startCell).toBeDefined();
    expect(endCell).toBeDefined();
    expect(startCell?.passable).toBe(true);
    expect(endCell?.passable).toBe(true);

    // Request path
    const path = pathfindingService.requestPath(
      startWorld.x,
      startWorld.y,
      endWorld.x,
      endWorld.y
    );

    console.log('[TEST] Path result:', path ? `${path.length} waypoints` : 'null');
    
    if (path) {
      console.log('[TEST] Path waypoints:');
      path.forEach((waypoint, idx) => {
        const gridPos = gridManager.worldToGrid(waypoint.x, waypoint.y);
        const cell = gridManager.getCell(gridPos.row, gridPos.col);
        console.log(`  ${idx}: world(${waypoint.x},${waypoint.y}) grid(${gridPos.row},${gridPos.col}) zone=${cell?.zoneType}`);
      });
    }

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
  });

  it('should find path from ground(20,18) to drop zone(14,21)', () => {
    const startRow = 20;
    const startCol = 18;
    const endRow = 14;
    const endCol = 21;

    // Convert to world coordinates
    const startWorld = gridManager.gridToWorld(startRow, startCol);
    const endWorld = gridManager.gridToWorld(endRow, endCol);

    console.log(`\n[TEST] Finding path from grid(${startRow},${startCol}) to drop zone(${endRow},${endCol})`);
    console.log(`[TEST] World coords: (${startWorld.x},${startWorld.y}) -> (${endWorld.x},${endWorld.y})`);

    // Verify cells
    const startCell = gridManager.getCell(startRow, startCol);
    const endCell = gridManager.getCell(endRow, endCol);

    console.log('[TEST] Start cell:', {
      row: startRow,
      col: startCol,
      zone: startCell?.zoneType,
      passable: startCell?.passable
    });

    console.log('[TEST] End cell (drop zone):', {
      row: endRow,
      col: endCol,
      zone: endCell?.zoneType,
      passable: endCell?.passable,
      dropZone: endCell?.dropZone
    });

    expect(startCell).toBeDefined();
    expect(endCell).toBeDefined();
    expect(startCell?.passable).toBe(true);
    expect(endCell?.passable).toBe(true);

    // Request path
    const path = pathfindingService.requestPath(
      startWorld.x,
      startWorld.y,
      endWorld.x,
      endWorld.y
    );

    console.log('[TEST] Path result:', path ? `${path.length} waypoints` : 'null');
    
    if (path) {
      console.log('[TEST] Path waypoints:');
      path.forEach((waypoint, idx) => {
        const gridPos = gridManager.worldToGrid(waypoint.x, waypoint.y);
        const cell = gridManager.getCell(gridPos.row, gridPos.col);
        console.log(`  ${idx}: world(${waypoint.x},${waypoint.y}) grid(${gridPos.row},${gridPos.col}) zone=${cell?.zoneType}`);
      });
    }

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
  });

  it('should find path from ground(20,25) to nearest drop zone', () => {
    const startRow = 20;
    const startCol = 25;

    // Get all drop zones
    const dropZones = gridManager.getDropZones();
    
    console.log(`\n[TEST] Finding path from grid(${startRow},${startCol}) to nearest drop zone`);
    console.log('[TEST] Available drop zones:', dropZones);

    // Find nearest drop zone
    let nearestDropZone = dropZones[0];
    let minDistance = Math.abs(startRow - nearestDropZone.row) + Math.abs(startCol - nearestDropZone.col);

    for (const dropZone of dropZones) {
      const distance = Math.abs(startRow - dropZone.row) + Math.abs(startCol - dropZone.col);
      if (distance < minDistance) {
        minDistance = distance;
        nearestDropZone = dropZone;
      }
    }

    console.log(`[TEST] Nearest drop zone: (${nearestDropZone.row},${nearestDropZone.col}), distance: ${minDistance}`);

    // Convert to world coordinates
    const startWorld = gridManager.gridToWorld(startRow, startCol);
    const endWorld = gridManager.gridToWorld(nearestDropZone.row, nearestDropZone.col);

    console.log(`[TEST] World coords: (${startWorld.x},${startWorld.y}) -> (${endWorld.x},${endWorld.y})`);

    // Verify cells
    const startCell = gridManager.getCell(startRow, startCol);
    const endCell = gridManager.getCell(nearestDropZone.row, nearestDropZone.col);

    console.log('[TEST] Start cell:', {
      row: startRow,
      col: startCol,
      zone: startCell?.zoneType,
      passable: startCell?.passable
    });

    console.log('[TEST] End cell (drop zone):', {
      row: nearestDropZone.row,
      col: nearestDropZone.col,
      zone: endCell?.zoneType,
      passable: endCell?.passable,
      dropZone: endCell?.dropZone
    });

    expect(startCell).toBeDefined();
    expect(endCell).toBeDefined();
    expect(startCell?.passable).toBe(true);
    expect(endCell?.passable).toBe(true);

    // Request path
    const path = pathfindingService.requestPath(
      startWorld.x,
      startWorld.y,
      endWorld.x,
      endWorld.y
    );

    console.log('[TEST] Path result:', path ? `${path.length} waypoints` : 'null');
    
    if (path) {
      console.log('[TEST] Path waypoints:');
      path.forEach((waypoint, idx) => {
        const gridPos = gridManager.worldToGrid(waypoint.x, waypoint.y);
        const cell = gridManager.getCell(gridPos.row, gridPos.col);
        console.log(`  ${idx}: world(${waypoint.x},${waypoint.y}) grid(${gridPos.row},${gridPos.col}) zone=${cell?.zoneType}`);
      });
    }

    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
  });
});
