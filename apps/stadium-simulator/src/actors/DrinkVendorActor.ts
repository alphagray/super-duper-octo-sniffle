import { VendorActor } from '@/actors/VendorActor';
import { Vendor } from '@/sprites/Vendor';
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
    vendor: Vendor,
    behavior: AIActorBehavior,
    category: ActorCategory = 'vendor',
    enableLogging = false
  ) {
    super(id, vendor, category, enableLogging);
    this.behavior = behavior;
    this.logger.debug('DrinkVendorActor created with behavior');
  }

  /**
   * Update vendor actor - delegates to behavior
   */
  public update(delta: number): void {
    const behaviorState = this.behavior.getState();
    const hasPath = this.hasPath();
    const pathLength = hasPath ? this.getPath().length : 0;
    const pathIndex = hasPath ? this.getCurrentSegmentIndex() : -1;
    
    // Log state occasionally (every 60 frames ~= 1 second)
    if (Math.random() < 0.017) {
      console.log('[DrinkVendorActor] State:', behaviorState, '| hasPath:', hasPath, '| path:', pathLength, 'cells | index:', pathIndex);
    }
    
    // Update behavior state machine first
    this.behavior.tick(delta);
    
    // Update movement (if path active)
    if (this.hasPath() && !this.isAtPathEnd()) {
      this.updateMovement(delta);
      
      // Check if we just reached the end after movement
      if (this.isAtPathEnd()) {
        console.log('[DrinkVendorActor] ✓ Reached end of path, calling onArrival()');
        this.behavior.onArrival();
        this.clearPath(); // Clear the completed path
      }
    }
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
