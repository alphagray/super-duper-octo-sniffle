import { AnimatedActor } from '@/actors/base/Actor';
import { Vendor } from '@/sprites/Vendor';
import type { GridManager } from '@/managers/GridManager';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { GridPathCell } from '@/managers/interfaces/VendorTypes';

/**
 * VendorActor: Base adapter wrapping Vendor sprite as an AnimatedActor.
 * Handles position tracking, path following, and movement state.
 * Does NOT contain targeting/assignment logic (that's in behavior layer).
 * Creates and manages its own Vendor sprite internally.
 */
export class VendorActor extends AnimatedActor {
  protected vendor: Vendor;
  protected position: { x: number; y: number };

  constructor(
    id: string,
    scene: Phaser.Scene,
    x: number,
    y: number,
    category: ActorCategory = 'vendor',
    enableLogging = false,
    gridManager?: GridManager
  ) {
    // Initialize base actor with placeholder grid coords (0,0); we'll set real grid below
    super(id, 'vendor', category, 0, 0, enableLogging);
    
    // Create vendor sprite internally
    this.vendor = new Vendor(scene, x, y);
    this.vendor.setDepth(1000); // Render above fans
    scene.add.existing(this.vendor);
    
    this.position = { x, y };

    // Derive grid position from current world position for accurate path queries
    if (gridManager) {
      const gridPos = gridManager.worldToGrid(x, y);
      if (gridPos) {
        this.gridRow = gridPos.row;
        this.gridCol = gridPos.col;
      }
    }
    this.logger.debug(`VendorActor created at world (${x}, ${y}) grid (${this.gridRow}, ${this.gridCol})`);
  }

  /**
   * Set path for vendor to follow
   * @param path Array of grid path cells
   */
  public setPath(path: GridPathCell[]): void {
    super.setPath(path);
    this.logger.debug(`Path set with ${path.length} cells`);
  }

  /**
   * Get current path
   */
  public getPath(): GridPathCell[] {
    return super.getPath() || [];
  }

  /**
   * Check if vendor has an active path
   */
  public hasPath(): boolean {
    const path = this.currentPath;
    return path !== null && path !== undefined && path.length > 0;
  }

  /**
   * Get current segment index
   */
  public getCurrentSegmentIndex(): number {
    return super.getCurrentPathIndex();
  }

  /**
   * Advance to next path segment
   * @returns true if advanced, false if at end of path
   */
  public advanceSegment(): boolean {
    return super.advanceToNextCell();
  }

  /**
   * Check if vendor has reached end of current path
   */
  public isAtPathEnd(): boolean {
    return super.isAtPathEnd();
  }

  /**
   * Clear current path
   */
  public clearPath(): void {
    super.clearPath();
  }

  /**
   * Update movement along path
   * @param deltaTime Time elapsed since last update (ms)
   */
  public updateMovement(deltaTime: number): void {
    const path = this.currentPath;
    if (!path || path.length === 0) return;

    const currentSegment = path[this.currentPathIndex];
    if (!currentSegment) {
      console.warn('[VendorActor] Current segment is null at index', this.currentPathIndex, 'path length:', path.length);
      return;
    }

    // Move toward current waypoint
    const targetX = currentSegment.x;
    const targetY = currentSegment.y;
    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Movement speed: 2 cells per second = 64 pixels/sec (assuming 32px cells)
    const speed = 64; // pixels per second
    const moveDistance = (speed * deltaTime) / 1000;

    if (distance <= moveDistance) {
      // Reached current waypoint - snap to it and advance
      this.position.x = targetX;
      this.position.y = targetY;
      this.vendor.setPosition(targetX, targetY);
      
      const wasLastSegment = this.currentPathIndex >= path.length - 1;
      const advanced = this.advanceSegment();
      
      if (!advanced) {
        // Reached the final waypoint
        console.log('[VendorActor] Reached final waypoint at', this.currentPathIndex);
      }
    } else {
      // Move toward waypoint
      const ratio = moveDistance / distance;
      this.position.x += dx * ratio;
      this.position.y += dy * ratio;
      this.vendor.setPosition(this.position.x, this.position.y);
    }
  }

  /**
   * Get current grid position
   * @returns Grid coordinates from current path cell or base grid position
   */
  public getGridPosition(): { row: number; col: number } {
    const path = this.currentPath;
    if (path && path.length > 0) {
      const cell = path[this.currentPathIndex];
      if (cell) {
        return { row: cell.row, col: cell.col };
      }
    }
    // Fallback to base actor grid position
    return super.getGridPosition();
  }

  /**
   * Get current world position
   */
  public getPosition(): { x: number; y: number } {
    return { ...this.position };
  }

  /**
   * Get wrapped Vendor sprite
   */
  public getVendor(): Vendor {
    return this.vendor;
  }

  /**
   * Update vendor actor (called each frame)
   * Override in subclasses to add behavior
   */
  public update(delta: number): void {
    // Base implementation does nothing
    // Subclasses override to delegate to behavior.tick()
  }

  /**
   * Refresh vendor visual
   */
  public draw(): void {
    // Vendor sprite handles its own rendering
    // Could add visual state updates here if needed
  }

  /**
   * Get vendor state for registry snapshot (unified getState API)
   */
  public getState() {
    const path = this.currentPath;
    return {
      position: { x: this.vendor.x, y: this.vendor.y },
      pathLength: path ? path.length : 0,
      segmentIndex: this.currentPathIndex,
    };
  }
}
