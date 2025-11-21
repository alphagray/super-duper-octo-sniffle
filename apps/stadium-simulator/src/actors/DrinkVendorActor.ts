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
    // Update movement (if path active)
    if (this.hasPath() && !this.isAtPathEnd()) {
      this.updateMovement(delta);
      
      // Check if arrived at destination
      if (this.isAtPathEnd()) {
        this.behavior.onArrival();
      }
    }
    
    // Update behavior state machine
    this.behavior.tick(delta);
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
