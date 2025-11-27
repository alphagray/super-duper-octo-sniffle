import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GridManager } from '@/managers/GridManager';
import { GridPathfinder } from '@/managers/GridPathfinder';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('Pathfinding Debug: Ground to Seat', () => {
  let gridManager: GridManager;
  let pathfinder: GridPathfinder;

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

    // Initialize pathfinder
    pathfinder = new GridPathfinder(gridManager);
  });

  it('should find path from ground(20,21) to seat(15,24)', () => {
    // Test coordinates: ground to seat via stairs
    const startRow = 20;
    const startCol = 21;
    const endRow = 15;
    const endCol = 24;

    // Convert to world coordinates
    const startWorld = gridManager.gridToWorld(startRow, startCol);
    const endWorld = gridManager.gridToWorld(endRow, endCol);

    console.log(`[TEST] Finding path from grid(${startRow},${startCol}) world(${startWorld.x},${startWorld.y}) to grid(${endRow},${endCol}) world(${endWorld.x},${endWorld.y})`);

    // Verify start and end cells
    const startCell = gridManager.getCell(startRow, startCol);
    const endCell = gridManager.getCell(endRow, endCol);

    console.log('[TEST] Start cell:', {
      row: startRow,
      col: startCol,
      zone: startCell?.zoneType,
      passable: startCell?.passable,
      allowedOutgoing: startCell?.allowedOutgoing,
    });

    console.log('[TEST] End cell:', {
      row: endRow,
      col: endCol,
      zone: endCell?.zoneType,
      passable: endCell?.passable,
      allowedIncoming: endCell?.allowedIncoming,
    });

    // Check critical cells along expected path
    console.log('[TEST] Checking expected path cells:');
    for (let row = startRow; row >= endRow; row--) {
      const cell = gridManager.getCell(row, startCol);
      console.log(`  (${row},${startCol}): zone=${cell?.zoneType}, passable=${cell?.passable}, allowedIncoming.bottom=${cell?.allowedIncoming.bottom}, allowedOutgoing.top=${cell?.allowedOutgoing.top}`);
    }

    // Attempt pathfinding
    const path = pathfinder.findPath(startWorld.x, startWorld.y, endWorld.x, endWorld.y);

    console.log('[TEST] Path result:', {
      found: path.length > 0,
      length: path.length,
      cells: path.map(cell => `(${cell.row},${cell.col})`),
    });

    // Assertions
    expect(startCell).toBeDefined();
    expect(endCell).toBeDefined();
    expect(startCell?.passable).toBe(true);
    expect(endCell?.passable).toBe(true);
    expect(path.length).toBeGreaterThan(0);

    // Verify path goes through expected zones
    const pathZones = path.map(cell => gridManager.getCell(cell.row, cell.col)?.zoneType);
    console.log('[TEST] Path zones:', pathZones);
    
    // Should start at ground, go through stairs, and end at seat
    expect(pathZones[0]).toBe('ground');
    expect(pathZones[pathZones.length - 1]).toBe('seat');
    expect(pathZones.some(zone => zone === 'stair')).toBe(true);
  });

  it('should verify directional flags on key cells', () => {
    // Check ground(19,21) -> stair(18,21) transition
    const groundRow = 19;
    const stairRow = 18;
    const col = 21;

    const groundCell = gridManager.getCell(groundRow, col);
    const stairCell = gridManager.getCell(stairRow, col);

    console.log('[TEST] Ground->Stair transition check:');
    console.log(`  Ground(${groundRow},${col}):`, {
      zone: groundCell?.zoneType,
      passable: groundCell?.passable,
      allowedOutgoing: groundCell?.allowedOutgoing,
    });
    console.log(`  Stair(${stairRow},${col}):`, {
      zone: stairCell?.zoneType,
      passable: stairCell?.passable,
      allowedIncoming: stairCell?.allowedIncoming,
    });

    expect(groundCell?.passable).toBe(true);
    expect(stairCell?.passable).toBe(true);
    expect(groundCell?.allowedOutgoing.top).toBe(true);
    expect(stairCell?.allowedIncoming.bottom).toBe(true);

    // Test if GridManager allows this transition
    const canMove = gridManager.isPassableDirection(groundRow, col, stairRow, col);
    console.log(`  Can move ground->stair: ${canMove}`);
    expect(canMove).toBe(true);
  });

  it('should verify stair-to-stair vertical movement', () => {
    // Check stair(18,21) -> stair(17,21) transition
    const fromRow = 18;
    const toRow = 17;
    const col = 21;

    const fromCell = gridManager.getCell(fromRow, col);
    const toCell = gridManager.getCell(toRow, col);

    console.log('[TEST] Stair->Stair vertical transition check:');
    console.log(`  Stair(${fromRow},${col}):`, {
      zone: fromCell?.zoneType,
      passable: fromCell?.passable,
      allowedOutgoing: fromCell?.allowedOutgoing,
    });
    console.log(`  Stair(${toRow},${col}):`, {
      zone: toCell?.zoneType,
      passable: toCell?.passable,
      allowedIncoming: toCell?.allowedIncoming,
    });

    expect(fromCell?.zoneType).toBe('stair');
    expect(toCell?.zoneType).toBe('stair');
    expect(fromCell?.passable).toBe(true);
    expect(toCell?.passable).toBe(true);
    expect(fromCell?.allowedOutgoing.top).toBe(true);
    expect(toCell?.allowedIncoming.bottom).toBe(true);

    // Test if GridManager allows this transition
    const canMove = gridManager.isPassableDirection(fromRow, col, toRow, col);
    console.log(`  Can move stair->stair: ${canMove}`);
    expect(canMove).toBe(true);
  });
});
