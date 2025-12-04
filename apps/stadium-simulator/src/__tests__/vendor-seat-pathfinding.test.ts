import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GridManager } from '@/managers/GridManager';
import { GridPathfinder } from '@/managers/GridPathfinder';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

// Helper to get all seat cells from config
function getAllSeatCells(config: StadiumSceneConfig) {
  const seats: Array<{ row: number; col: number }> = [];
  if (!config.cellRanges) return seats;
  for (const range of config.cellRanges) {
    if (range.zoneType === 'seat' && range.passable !== false) {
      for (let row = range.rowStart; row <= range.rowEnd; row++) {
        for (let col = range.colStart; col <= range.colEnd; col++) {
          seats.push({ row, col });
        }
      }
    }
  }
  return seats;
}

describe('Vendor Pathfinding: All Seats Reachable', () => {
  let gridManager: GridManager;
  let pathfinder: GridPathfinder;
  let config: StadiumSceneConfig;

  beforeEach(() => {
    gridManager = new GridManager({ width: 1024, height: 768, cellSize: 32 });
    const configPath = join(__dirname, '../../public/assets/stadium-grid-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData);
    gridManager.loadZoneConfig(config);
    pathfinder = new GridPathfinder(gridManager);
  });

  it('should find a path from ground row to every seat', () => {
    const groundRow = 20; // Standard vendor spawn row (adjust if needed)
    const seats = getAllSeatCells(config);
    let failures: Array<{ row: number; col: number }> = [];
    
    // Debug: Test one specific seat (14, 5) first
    const testSeat = { row: 14, col: 5 };
    const testStart = gridManager.gridToWorld(groundRow, testSeat.col);
    const testEnd = gridManager.gridToWorld(testSeat.row, testSeat.col);
    const testPath = pathfinder.findPath(testStart.x, testStart.y, testEnd.x, testEnd.y);
    console.log(`\n[DEBUG] Test seat (14, 5):`);
    console.log(`  Start: grid(${groundRow}, ${testSeat.col}) world(${testStart.x}, ${testStart.y})`);
    console.log(`  End: grid(${testSeat.row}, ${testSeat.col}) world(${testEnd.x}, ${testEnd.y})`);
    console.log(`  Path length: ${testPath.length}`);
    if (testPath.length > 0) {
      console.log(`  Path:`, testPath.slice(0, 10).map(c => `(${c.row},${c.col})`).join(' -> '));
    }
    
    // Check seat cell config
    const seatCell = gridManager.getCell(testSeat.row, testSeat.col);
    console.log(`  Seat cell (14, 5):`, {
      zone: seatCell?.zoneType,
      passable: seatCell?.passable,
      allowedIncoming: seatCell?.allowedIncoming,
      allowedOutgoing: seatCell?.allowedOutgoing
    });
    
    // Check row entry seat at (14, 9) - should connect to stair at (14, 10)
    const rowEntry9 = gridManager.getCell(14, 9);
    const stair10 = gridManager.getCell(14, 10);
    console.log(`  Row entry seat (14, 9):`, {
      zone: rowEntry9?.zoneType,
      passable: rowEntry9?.passable,
      allowedIncoming: rowEntry9?.allowedIncoming,
      allowedOutgoing: rowEntry9?.allowedOutgoing
    });
    console.log(`  Adjacent stair (14, 10):`, {
      zone: stair10?.zoneType,
      passable: stair10?.passable,
      allowedIncoming: stair10?.allowedIncoming,
      allowedOutgoing: stair10?.allowedOutgoing
    });
    console.log(`  Can move from stair(14,10) to seat(14,9)?`, gridManager.isPassableDirection(14, 10, 14, 9));
    console.log(`  Can move from seat(14,9) to seat(14,5)?`, gridManager.isPassableDirection(14, 9, 14, 8));
    
    for (const seat of seats) {
      const startWorld = gridManager.gridToWorld(groundRow, seat.col);
      const endWorld = gridManager.gridToWorld(seat.row, seat.col);
      const path = pathfinder.findPath(startWorld.x, startWorld.y, endWorld.x, endWorld.y);
      if (!path || path.length === 0) {
        failures.push(seat);
      }
    }
    if (failures.length > 0) {
      console.error('Unreachable seats:', failures);
    }
    expect(failures.length).toBe(0);
  });
});
