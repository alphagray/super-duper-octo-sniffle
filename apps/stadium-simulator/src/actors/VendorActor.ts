import { AnimatedActor } from '@/actors/base/Actor';
import { Vendor } from '@/sprites/Vendor';
import { gameBalance } from '@/config/gameBalance';
import PersonalityIntegrationManager from '@/systems/PersonalityIntegrationManager';
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
  protected personality: any;
  protected position: { x: number; y: number };
  protected gridManager?: GridManager;

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
    

    // Fetch personality (by id, index, or random; here: by index if id is numeric)
    let personality = undefined;
    const manager = PersonalityIntegrationManager();
    // If id is of form 'actor:vendor-<n>', try to use n as index
    const match = id.match(/vendor-(\d+)/);
    if (match) {
      const idx = parseInt(match[1], 10);
      personality = manager.getVendorPersonalityByIndex(idx);
    } else {
      personality = manager.getVendorPersonalityByIndex();
    }
    this.personality = personality;
    this.vendor = new Vendor(scene, x, y, personality, manager.getDialogueManager());
    scene.add.existing(this.vendor);
    this.position = { x, y };

    // Store grid manager reference
    this.gridManager = gridManager;
    // Derive grid position from current world position for accurate path queries
    if (this.gridManager) {
      const gridPos = this.gridManager.worldToGrid(x, y);
      if (gridPos) {
        this.gridRow = gridPos.row;
        this.gridCol = gridPos.col;
        const depth = this.gridManager.getDepthForPosition(gridPos.row, gridPos.col);
        this.vendor.setDepth(depth);
        if (gameBalance.debug.vendorActorLogs) console.log(`[VendorActor] Init depth for vendor at grid (${gridPos.row},${gridPos.col}): ${depth}`);
      } else {
        const fallbackDepth = this.gridManager.getDepthForWorld(x, y);
        if (typeof fallbackDepth === 'number') {
          this.vendor.setDepth(fallbackDepth);
          if (gameBalance.debug.vendorActorLogs) console.log(`[VendorActor] Init fallback depth: ${fallbackDepth}`);
        }
      }
    }
    this.logger.debug(`VendorActor created at world (${x}, ${y}) grid (${this.gridRow}, ${this.gridCol})`);
  }

  /**
   * Get the assigned personality (for UI, dialogue, etc)
   */
  public getPersonality() {
    return this.personality;
  }

  /**
   * Get the personality name for UI display
   */
  public getPersonalityName(): string {
    if (this.personality && this.personality.name) return this.personality.name;
    if (this.personality && this.personality.id) return this.personality.id;
    return '';
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
      // console.warn('[VendorActor] Current segment is null at index', this.currentPathIndex, 'path length:', path.length);
      return;
    }

    // Move toward current waypoint
    let targetX = currentSegment.x;
    let targetY = currentSegment.y;
    
    // Add visual offset to make sprite appear fully in the target cell
    // Vendor sprite is 20px wide, so offset by 8px in movement direction
    // This ensures 75% of the sprite bounding box is in the target cell
    const isLastWaypoint = this.currentPathIndex >= path.length - 1;
    if (isLastWaypoint) {
      const prevSegment = path[Math.max(0, this.currentPathIndex - 1)];
      const dirX = Math.sign(targetX - prevSegment.x);
      const dirY = Math.sign(targetY - prevSegment.y);
      targetX += dirX * 8; // 8px offset = 75% into cell for 32px cells
      targetY += dirY * 8;
    }
    
    const dx = targetX - this.position.x;
    const dy = targetY - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Movement speed: 2 cells per second = 64 pixels/sec (assuming 32px cells)
    const speed = 64; // pixels per second
    const moveDistance = (speed * deltaTime) / 1000;

    // Always snap if within moveDistance OR if distance is small (< 3px to avoid Zeno's paradox)
    if (distance <= moveDistance || distance < 3.0) {
      this.position.x = targetX;
      this.position.y = targetY;
      this.vendor.setPosition(targetX, targetY);
      this.updateDepthForPosition(targetX, targetY);
      this.advanceSegment();
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
      this.position.x = targetX;
      this.position.y = targetY;
      this.vendor.setPosition(targetX, targetY);
      this.updateDepthForPosition(targetX, targetY);
      this.advanceSegment();
    } else {
      // Safe to move
      this.position.x = newX;
      this.position.y = newY;
      this.vendor.setPosition(this.position.x, this.position.y);
      this.updateDepthForPosition(this.position.x, this.position.y);
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
   * Move vendor to new position (world coordinates)
   * Updates both actor position and sprite
   * @param x World X coordinate
   * @param y World Y coordinate
   */
  public moveToPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
    this.vendor.setPosition(x, y);
    
    // Update grid position
    if (this.gridManager) {
      const gridPos = this.gridManager.worldToGrid(x, y);
      if (gridPos) {
        this.gridRow = gridPos.row;
        this.gridCol = gridPos.col;
        // Update depth for new position
        const depth = this.gridManager.getDepthForPosition(gridPos.row, gridPos.col);
        this.vendor.setDepth(depth);
      }
    }
  }

  /**
   * Update grid position only (without moving sprite)
   * Used when sprite is animating and we need to update logical grid coordinates
   * Assumes sprite is already at the target world position
   * @param gridRow Grid row
   * @param gridCol Grid column
   */
  public updateGridPosition(gridRow: number, gridCol: number): void {
    this.gridRow = gridRow;
    this.gridCol = gridCol;
    
    // Update depth for new position
    if (this.gridManager) {
      const depth = this.gridManager.getDepthForPosition(gridRow, gridCol);
      this.vendor.setDepth(depth);
    }
  }

  /**
   * Complete splat animation by syncing grid and position after sprite animation
   * Called after splat tween completes to finalize actor state
   * @param gridRow Target grid row
   * @param gridCol Target grid column
   */
  public completeSplatAnimation(gridRow: number, gridCol: number): void {
    this.gridRow = gridRow;
    this.gridCol = gridCol;
    
    // Sync actor position with sprite's current position (where tween left it)
    this.position.x = this.vendor.x;
    this.position.y = this.vendor.y;
    
    // Update depth for new position
    if (this.gridManager) {
      const depth = this.gridManager.getDepthForPosition(gridRow, gridCol);
      this.vendor.setDepth(depth);
    }
  }

  /**
   * Update vendor actor (called each frame)
   * Override in subclasses to add behavior
   * @param delta - Time elapsed in milliseconds
   * @param roundTime - Time relative to round start (negative = remaining, positive = elapsed)
   */
  public update(delta: number, roundTime: number): void {
    // Base implementation does nothing
    // Subclasses override to delegate to behavior.tick(delta, roundTime)
  }

  /**
   * Refresh vendor visual
   */
  public draw(): void {
    // Vendor sprite handles its own rendering
    // Could add visual state updates here if needed
  }

  /**
   * Update vendor sprite depth based on current world position using GridManager.
   */
  private updateDepthForPosition(x: number, y: number): void {
    if (!this.gridManager) return;
    const coords = this.gridManager.worldToGrid(x, y);
    if (coords) {
      // Vendors render slightly in front of fans in the same row (+2 depth offset)
      const baseDepth = this.gridManager.getDepthForPosition(coords.row, coords.col);
      const depth = baseDepth + 2;
      this.vendor.setDepth(depth);
      // Debug log occasionally
      if (Math.random() < 0.01) {
        if (gameBalance.debug.vendorActorLogs) console.log(`[VendorActor] Update depth at grid (${coords.row},${coords.col}): ${depth} (base: ${baseDepth}), actual depth: ${this.vendor.depth}`);
      }
    } else {
      const depth = this.gridManager.getDepthForWorld(x, y);
      if (typeof depth === 'number') this.vendor.setDepth(depth + 2);
    }
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
