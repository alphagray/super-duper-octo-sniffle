/**
 * Test: Verify vendor actor movement logic stays in sync during pathfinding
 * 
 * This test simulates frame-by-frame updates to check if:
 * 1. Actor's logical grid position progresses through the path correctly
 * 2. Actor's world position interpolates smoothly between waypoints
 * 3. Actor considers itself "arrived" at the correct moment
 * 
 * Note: This tests the movement logic without requiring Phaser rendering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GridManager } from '@/managers/GridManager';
import { GridPathfinder } from '@/managers/GridPathfinder';
import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';
import type { GridPathCell } from '@/managers/interfaces/VendorTypes';

/**
 * Simplified movement simulator that mimics VendorActor.updateMovement logic
 */
class MovementSimulator {
  private position: { x: number; y: number };
  private path: GridPathCell[] = [];
  private currentPathIndex = 0;
  private speed = 64; // pixels per second (2 cells/sec * 32px)

  constructor(startX: number, startY: number) {
    this.position = { x: startX, y: startY };
  }

  setPath(path: GridPathCell[]): void {
    this.path = path;
    this.currentPathIndex = 0;
  }

  hasPath(): boolean {
    return this.path.length > 0 && this.currentPathIndex < this.path.length;
  }

  isAtPathEnd(): boolean {
    return this.currentPathIndex >= this.path.length - 1;
  }

  isAtFinalPosition(): boolean {
    // Must be at the last path index first
    if (this.currentPathIndex < this.path.length - 1) return false;
    
    // Then check if we're close to the final waypoint
    const target = this.path[this.path.length - 1];
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 1.0;
  }

  getCurrentPathIndex(): number {
    return this.currentPathIndex;
  }

  getPosition(): { x: number; y: number } {
    return { ...this.position };
  }

  /**
   * Update movement - matches VendorActor.updateMovement logic
   */
  updateMovement(deltaTime: number): void {
    if (!this.hasPath()) {
      if (this.currentPathIndex >= 17) {
        console.log(`[UPDATE] No path - pathIdx=${this.currentPathIndex} pathLen=${this.path.length}`);
      }
      return;
    }

    const currentSegment = this.path[this.currentPathIndex];
    if (!currentSegment) {
      console.log(`[UPDATE] No current segment at pathIdx=${this.currentPathIndex}`);
      return;
    }

    const targetX = currentSegment.x;
    const targetY = currentSegment.y;
    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const moveDistance = (this.speed * deltaTime) / 1000;

    if (this.currentPathIndex === 18) {
      console.log(`[UPDATE pathIdx=18] pos(${this.position.x.toFixed(1)},${this.position.y.toFixed(1)}) → target(${targetX},${targetY}) dist=${distance.toFixed(2)}px move=${moveDistance.toFixed(2)}px`);
    }

    // Always snap if within moveDistance OR if distance is small (< 3px to avoid Zeno's paradox)
    if (distance <= moveDistance || distance < 3.0) {
      if (this.currentPathIndex >= 15) {
        console.log(`[SNAP] Advancing from pathIdx=${this.currentPathIndex}: pos(${this.position.x.toFixed(1)},${this.position.y.toFixed(1)}) → target(${targetX},${targetY}) dist=${distance.toFixed(2)}px move=${moveDistance.toFixed(2)}px`);
      }
      this.position.x = targetX;
      this.position.y = targetY;
      if (this.currentPathIndex < this.path.length - 1) {
        this.currentPathIndex++;
      }
      return;
    }

    // Calculate new position
    const ratio = Math.min(moveDistance / distance, 1.0);
    const newX = this.position.x + dx * ratio;
    const newY = this.position.y + dy * ratio;
    
    // Calculate distance from new position to target
    const newDx = targetX - newX;
    const newDy = targetY - newY;
    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);
    
    // If moving would increase distance OR new position is very close, snap to target
    if (newDistance >= distance || newDistance < 1.0) {
      if (this.currentPathIndex >= 15) {
        console.log(`[SNAP overshoot] Advancing from pathIdx=${this.currentPathIndex}: pos(${this.position.x.toFixed(1)},${this.position.y.toFixed(1)}) → target(${targetX},${targetY}) newDist=${newDistance.toFixed(2)}px >= dist=${distance.toFixed(2)}px`);
      }
      this.position.x = targetX;
      this.position.y = targetY;
      if (this.currentPathIndex < this.path.length - 1) {
        this.currentPathIndex++;
      }
    } else {
      // Safe to move
      this.position.x = newX;
      this.position.y = newY;
    }
  }
}

describe('Vendor Movement Synchronization', () => {
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

  it('should keep position in sync with path during movement', () => {
    // Start position: ground row
    const startRow = 20;
    const startCol = 5;
    const targetRow = 14;
    const targetCol = 5;

    const startWorld = gridManager.gridToWorld(startRow, startCol);
    const targetWorld = gridManager.gridToWorld(targetRow, targetCol);

    // Create movement simulator
    const simulator = new MovementSimulator(startWorld.x, startWorld.y);

    // Get path
    const path = pathfinder.findPath(
      startWorld.x,
      startWorld.y,
      targetWorld.x,
      targetWorld.y
    );

    expect(path.length).toBeGreaterThan(0);
    console.log(`\n[SYNC TEST] Path from (${startRow},${startCol}) to (${targetRow},${targetCol})`);
    console.log(`  Path length: ${path.length} cells`);
    console.log(`  Full path:`);
    path.forEach((cell, idx) => {
      console.log(`    [${idx}] (${cell.row},${cell.col}) @ (${cell.x},${cell.y})`);
    });
    console.log(`  Path preview: ${path.slice(0, 5).map(c => `(${c.row},${c.col})`).join(' -> ')} ... ${path.slice(-3).map(c => `(${c.row},${c.col})`).join(' -> ')}`);

    simulator.setPath(path);

    // Simulate frame updates (60 FPS = ~16.67ms per frame)
    const deltaTime = 16.67;
    const maxFrames = 600; // Safety limit (10 seconds at 60fps)
    let frameCount = 0;

    const snapshots: Array<{
      frame: number;
      position: { x: number; y: number };
      gridPos: { row: number; col: number } | null;
      pathIndex: number;
      targetCell: { row: number; col: number };
      distanceToTarget: number;
      atPathEnd: boolean;
    }> = [];

    // Run simulation until vendor reaches target or timeout
    let lastDistance = -1;
    let stuckFrames = 0;
    
    while (frameCount < maxFrames && !simulator.isAtFinalPosition()) {
      frameCount++;

      // Update movement
      simulator.updateMovement(deltaTime);

      // Get current state
      const position = simulator.getPosition();
      const gridPos = gridManager.worldToGrid(position.x, position.y);
      const pathIndex = simulator.getCurrentPathIndex();
      const targetCell = path[Math.min(pathIndex, path.length - 1)];
      
      const distToTarget = Math.sqrt(
        Math.pow(targetCell.x - position.x, 2) +
        Math.pow(targetCell.y - position.y, 2)
      );

      // Detect if stuck (distance not changing)
      if (Math.abs(distToTarget - lastDistance) < 0.01) {
        stuckFrames++;
        if (stuckFrames > 50) {
          console.log(`\n[WARNING] Stuck for 50 frames at:`);
          console.log(`  Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)})`);
          console.log(`  Grid: (${gridPos?.row}, ${gridPos?.col})`);
          console.log(`  Path index: ${pathIndex}`);
          console.log(`  Target cell: (${targetCell.row}, ${targetCell.col}) at (${targetCell.x}, ${targetCell.y})`);
          console.log(`  Distance: ${distToTarget.toFixed(2)}px`);
          console.log(`  Move distance per frame: ${(64 * deltaTime / 1000).toFixed(2)}px`);
          break;
        }
      } else {
        stuckFrames = 0;
      }
      lastDistance = distToTarget;

      // Record snapshot every 10 frames or when switching cells
      const prevSnapshot = snapshots[snapshots.length - 1];
      const cellChanged = !prevSnapshot || 
        prevSnapshot.gridPos?.row !== gridPos?.row || 
        prevSnapshot.gridPos?.col !== gridPos?.col;
      const pathIndexChanged = !prevSnapshot || prevSnapshot.pathIndex !== pathIndex;

      // Record all frames near the problem area (pathIdx 15-18)
      const isNearEnd = pathIndex >= 15;
      
      if (frameCount % 10 === 0 || cellChanged || pathIndexChanged || isNearEnd) {
        snapshots.push({
          frame: frameCount,
          position,
          gridPos,
          pathIndex,
          targetCell: { row: targetCell.row, col: targetCell.col },
          distanceToTarget: distToTarget,
          atPathEnd: simulator.isAtPathEnd(),
        });
      }

      // Break if reached final destination (at last path index AND close to target)
      if (simulator.isAtPathEnd() && distToTarget < 1) {
        console.log(`  Reached final destination at frame ${frameCount}`);
        break;
      }
    }

    // Final state
    const finalPos = simulator.getPosition();
    const finalGrid = gridManager.worldToGrid(finalPos.x, finalPos.y);
    const finalPathIndex = simulator.getCurrentPathIndex();
    const expectedFinalCell = path[path.length - 1];

    console.log(`\n[SYNC TEST] Final state after ${frameCount} frames:`);
    console.log(`  Final grid: (${finalGrid?.row}, ${finalGrid?.col})`);
    console.log(`  Final world: (${finalPos.x.toFixed(1)}, ${finalPos.y.toFixed(1)})`);
    console.log(`  Target grid: (${targetRow}, ${targetCol})`);
    console.log(`  Target world: (${expectedFinalCell.x.toFixed(1)}, ${expectedFinalCell.y.toFixed(1)})`);
    console.log(`  Path index: ${finalPathIndex} / ${path.length - 1}`);
    console.log(`  At path end: ${simulator.isAtPathEnd()}`);

    // Calculate distance to expected final position
    const finalDistance = Math.sqrt(
      Math.pow(expectedFinalCell.x - finalPos.x, 2) +
      Math.pow(expectedFinalCell.y - finalPos.y, 2)
    );
    console.log(`  Distance to target: ${finalDistance.toFixed(2)}px`);

    // Print grid progression through path
    const gridProgression = snapshots
      .filter(s => s.gridPos !== null)
      .map(s => `(${s.gridPos!.row},${s.gridPos!.col})`)
      .filter((val, idx, arr) => arr.indexOf(val) === idx); // unique values

    console.log(`\n[SYNC TEST] Grid progression (${gridProgression.length} unique cells):`);
    console.log(`  ${gridProgression.join(' -> ')}`);

    // Print sample movement snapshots
    console.log(`\n[SYNC TEST] Detailed snapshots near path end (pathIdx >= 15):`);
    const endSnapshots = snapshots.filter(s => s.pathIndex >= 15);
    for (const s of endSnapshots.slice(0, 30)) {
      const gridStr = s.gridPos ? `(${s.gridPos.row},${s.gridPos.col})` : 'null';
      const posStr = `(${s.position.x.toFixed(1)},${s.position.y.toFixed(1)})`;
      console.log(`  F${s.frame}: pos${posStr} grid${gridStr} → tgt(${s.targetCell.row},${s.targetCell.col}) dist=${s.distanceToTarget.toFixed(1)}px idx=${s.pathIndex} atEnd=${s.atPathEnd}`);
    }

    console.log(`\n[SYNC TEST] Overall sample snapshots:`);
    const step = Math.max(1, Math.floor(snapshots.length / 10));
    for (let i = 0; i < snapshots.length; i += step) {
      const s = snapshots[i];
      const gridStr = s.gridPos ? `(${s.gridPos.row},${s.gridPos.col})` : 'null';
      console.log(`  Frame ${s.frame}: grid${gridStr} targeting(${s.targetCell.row},${s.targetCell.col}) dist=${s.distanceToTarget.toFixed(1)}px pathIdx=${s.pathIndex} atEnd=${s.atPathEnd}`);
    }

    // Assertions
    expect(finalGrid?.row).toBe(targetRow);
    expect(finalGrid?.col).toBe(targetCol);
    expect(finalDistance).toBeLessThan(1); // Should be within 1 pixel
    expect(simulator.isAtPathEnd()).toBe(true);
    expect(frameCount).toBeLessThan(600); // Should reach within 10 seconds

    console.log(`\n✅ Movement stayed in sync throughout ${frameCount} frames`);
  });
});
