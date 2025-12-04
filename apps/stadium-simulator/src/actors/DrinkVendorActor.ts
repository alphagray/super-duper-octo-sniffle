import { VendorActor } from '@/actors/VendorActor';
import type { GridManager } from '@/managers/GridManager';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { AIActorBehavior, AIActorState } from '@/actors/interfaces/AIBehavior';

/**
 * DrinkVendorActor: Vendor actor with drink service behavior.
 * Extends VendorActor and delegates decision-making to DrinkVendorBehavior.
 */
export class DrinkVendorActor extends VendorActor {
  private behavior: AIActorBehavior;

  constructor(
    id: string,
    scene: Phaser.Scene,
    x: number,
    y: number,
    behavior: AIActorBehavior,
    category: ActorCategory = 'vendor',
    enableLogging = false,
    gridManager?: GridManager
  ) {
    super(id, scene, x, y, category, enableLogging, gridManager);
    this.behavior = behavior;
    this.logger.debug('DrinkVendorActor created with behavior');
  }

  /**
   * Update vendor actor - delegates to behavior
   * @param delta - Time elapsed in milliseconds
   * @param roundTime - Time relative to round start (negative = remaining, positive = elapsed)
   */
  public update(delta: number, roundTime: number): void {
    const behaviorState = this.behavior.getState();
    const hasPath = this.hasPath();
    const pathLength = hasPath ? this.getPath().length : 0;
    const pathIndex = hasPath ? this.getCurrentSegmentIndex() : -1;

    // Log state occasionally (every 60 frames ~= 1 second)
    if (Math.random() < 0.017) {
      // console.log('[DrinkVendorActor] State:', behaviorState, '| hasPath:', hasPath, '| path:', pathLength, 'cells | index:', pathIndex);
    }

    // Update behavior state machine first
    this.behavior.tick(delta, roundTime);

    // Only update movement if not splatted (allow animation to run freely during splat)
    const currentState = (this.behavior as any).getState?.();
    const isSplatted = currentState === 'splatted';
    
    if (hasPath && !isSplatted) {
      this.updateMovement(delta);

      if (this.hasReachedFinalWaypoint()) {
        this.handleArrival();
      }
    }
  }

  /**
   * Determines whether the actor has physically reached the final waypoint.
   * Needed because isAtPathEnd flips to true as soon as the final index is targeted,
   * which can happen before the sprite visually occupies that cell.
   */
  private hasReachedFinalWaypoint(): boolean {
    if (!this.hasPath()) return false;
    if (!this.isAtPathEnd()) return false;

    const path = this.getPath();
    if (!path || path.length === 0) return false;

    const target = path[path.length - 1];
    const { x, y } = this.getPosition();
    const dx = target.x - x;
    const dy = target.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Require sprite to be essentially on top of the waypoint (<= 2px tolerance)
    return distance <= 2;
  }

  /**
   * Invokes appropriate arrival logic depending on current behavior state.
   */
  private handleArrival(): void {
    const behaviorState = this.behavior.getState();
    // Use type assertion for DrinkVendorBehavior-specific method
    const behaviorWithDropZone = this.behavior as AIActorBehavior & { getCurrentDropZone?: () => { row: number; col: number } | null };
    if (behaviorState === 'droppingOff' && typeof behaviorWithDropZone.getCurrentDropZone === 'function') {
      const dropZone = behaviorWithDropZone.getCurrentDropZone();
      const pos = this.getGridPosition();
      
      // Allow 1-cell tolerance for drop zone arrival (vendor might stop slightly short)
      const rowDiff = Math.abs(pos.row - (dropZone?.row ?? -999));
      const colDiff = Math.abs(pos.col - (dropZone?.col ?? -999));
      const withinTolerance = rowDiff <= 1 && colDiff <= 1;
      
      if (dropZone && withinTolerance) {
        // console.log('[DrinkVendorActor] ✓ Reached drop zone (tolerance), pos:', pos, 'target:', dropZone, 'calling onArrival()');
        this.behavior.onArrival();
        this.clearPath();
      } else {
        // console.warn('[DrinkVendorActor] At path end but NOT near drop zone:', pos, 'expected:', dropZone, 'rowDiff:', rowDiff, 'colDiff:', colDiff);
      }
      return;
    }

    // console.log('[DrinkVendorActor] ✓ Reached end of path, calling onArrival()');
    this.behavior.onArrival();
    this.clearPath();
  }

  /**
   * Get behavior instance
   */
  public getBehavior(): AIActorBehavior {
    return this.behavior;
  }

  /**
   * Get vendor state (base shape) for registry snapshot consistency.
   */
  public getState() {
    return super.getState();
  }

  /**
   * Get combined vendor + behavior state (extended detail)
   */
  public getCombinedState(): { vendor: ReturnType<VendorActor['getState']>; behavior: AIActorState } {
    return { vendor: super.getState(), behavior: this.behavior.getState() };
  }

  /**
   * Get behavior state only (helper)
   */
  public getBehaviorState(): AIActorState {
    return this.behavior.getState();
  }

  /**
   * Request assignment to target cell
   */
  public requestAssignment(targetCell: { row: number; col: number }): void {
    this.behavior.requestAssignment(targetCell);
  }

  /**
   * Request recall to neutral zone
   */
  public requestRecall(): void {
    this.behavior.requestRecall();
  }

  /**
   * Handle arrival at destination
   */
  public onArrival(): void {
    this.behavior.onArrival();
  }

  /**
   * Handle service completion
   */
  public onServeComplete(): void {
    this.behavior.onServeComplete();
  }
}
