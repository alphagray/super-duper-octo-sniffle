import { AnimatedActor } from '@/actors/base/Actor';
import { Vendor } from '@/sprites/Vendor';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { GridPathCell } from '@/managers/interfaces/VendorTypes';

/**
 * VendorActor: Base adapter wrapping Vendor sprite as an AnimatedActor.
 * Handles position tracking, path following, and movement state.
 * Does NOT contain targeting/assignment logic (that's in behavior layer).
 */
export class VendorActor extends AnimatedActor {
  protected vendor: Vendor;
  protected position: { x: number; y: number };

  constructor(
    id: string,
    vendor: Vendor,
    category: ActorCategory = 'vendor',
    enableLogging = false
  ) {
    // Initialize with vendor sprite's current position
    super(id, 'vendor', category, vendor.x, vendor.y, enableLogging);
    this.vendor = vendor;
    this.position = { x: vendor.x, y: vendor.y };
    this.logger.debug(`VendorActor created at (${vendor.x}, ${vendor.y})`);
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
    // Base implementation - override in subclasses for custom movement
    // or delegate to behavior layer
    const path = this.currentPath;
    if (!path || path.length === 0) return;

    const currentSegment = path[this.currentPathIndex];
    if (!currentSegment) return;

    // Update vendor sprite position
    // (actual movement logic delegated to behavior or movement system)
    this.position.x = currentSegment.x;
    this.position.y = currentSegment.y;
    this.vendor.setPosition(currentSegment.x, currentSegment.y);
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
