/**
 * Test: Verify vendor pathfinding actually reaches the target seat cell
 * 
 * This test validates that when pathfinding to a seat, the final position
 * in the path matches the intended target coordinates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GridManager } from '@/managers/GridManager';
import { GridPathfinder } from '@/managers/GridPathfinder';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

describe('Vendor Actual Destination Test', () => {
  let gridManager: GridManager;
  let pathfinder: GridPathfinder;

  beforeEach(() => {
    gridManager = new GridManager({ width: 1024, height: 768, cellSize: 32 });
    const configPath = join(__dirname, '../../public/assets/stadium-grid-config.json');
    const configData = readFileSync(configPath, 'utf-8');
    const config: StadiumSceneConfig = JSON.parse(configData);
    gridManager.loadZoneConfig(config);
    pathfinder = new GridPathfinder(gridManager);
  });

  it('should reach the exact target seat cell from ground row', () => {
    // Test seats from each section in row 14
    const testSeats = [
      { row: 14, col: 2, section: 'A' },
      { row: 14, col: 5, section: 'A' },
      { row: 14, col: 9, section: 'A (entry)' },
      { row: 14, col: 12, section: 'B (entry)' },
      { row: 14, col: 15, section: 'B' },
      { row: 14, col: 19, section: 'B (entry)' },
      { row: 14, col: 22, section: 'C (entry)' },
      { row: 14, col: 25, section: 'C' },
      { row: 14, col: 29, section: 'C' },
    ];

    const results: Array<{
      target: string;
      section: string;
      startPos: string;
      finalPos: string;
      matches: boolean;
      pathLength: number;
    }> = [];

    for (const seat of testSeats) {
      // Start from ground row directly below the seat
      const startRow = 20;
      const startCol = seat.col;
      
      const startWorld = gridManager.gridToWorld(startRow, startCol);
      const endWorld = gridManager.gridToWorld(seat.row, seat.col);
      
      const path = pathfinder.findPath(
        startWorld.x,
        startWorld.y,
        endWorld.x,
        endWorld.y
      );

      let finalPos = { row: -1, col: -1 };
      let matches = false;

      if (path && path.length > 0) {
        const lastStep = path[path.length - 1];
        finalPos = { row: lastStep.row, col: lastStep.col };
        matches = finalPos.row === seat.row && finalPos.col === seat.col;
      }

      results.push({
        target: `(${seat.row}, ${seat.col})`,
        section: seat.section,
        startPos: `(${startRow}, ${startCol})`,
        finalPos: path ? `(${finalPos.row}, ${finalPos.col})` : 'NO PATH',
        matches,
        pathLength: path?.length || 0,
      });

      // Log detailed output for debugging
      console.log(`\n[DESTINATION TEST] Target: ${seat.section} seat at (${seat.row}, ${seat.col})`);
      console.log(`  Start: (${startRow}, ${startCol})`);
      console.log(`  Path length: ${path?.length || 0}`);
      
      if (path && path.length > 0) {
        console.log(`  Final position: (${finalPos.row}, ${finalPos.col})`);
        console.log(`  Matches target: ${matches ? '✅ YES' : '❌ NO'}`);
        
        // Show last 5 steps of path
        const lastSteps = path.slice(-5);
        console.log(`  Last 5 steps: ${lastSteps.map((s: { row: number; col: number }) => `(${s.row},${s.col})`).join(' -> ')}`);
      } else {
        console.log(`  ❌ NO PATH FOUND`);
      }
    }

    // Print summary table
    console.log('\n\n=== DESTINATION ACCURACY SUMMARY ===\n');
    console.log('Section      | Target       | Start        | Final        | Match | Steps');
    console.log('-------------|--------------|--------------|--------------|-------|------');
    
    for (const result of results) {
      const sectionPad = result.section.padEnd(12);
      const targetPad = result.target.padEnd(12);
      const startPad = result.startPos.padEnd(12);
      const finalPad = result.finalPos.padEnd(12);
      const matchIcon = result.matches ? '✅' : '❌';
      const steps = result.pathLength.toString().padStart(5);
      
      console.log(`${sectionPad} | ${targetPad} | ${startPad} | ${finalPad} | ${matchIcon}  | ${steps}`);
    }

    // Assert all paths reach exact targets
    const failures = results.filter(r => !r.matches);
    
    if (failures.length > 0) {
      console.log(`\n❌ ${failures.length} seat(s) did NOT reach exact target:`);
      failures.forEach(f => {
        console.log(`  - ${f.section}: aimed for ${f.target}, reached ${f.finalPos}`);
      });
    } else {
      console.log(`\n✅ All ${results.length} seats reached their exact target coordinates!`);
    }

    expect(failures).toHaveLength(0);
  });
});
