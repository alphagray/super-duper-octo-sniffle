import { AnimatedActor } from '@/actors/Actor';
import { Fan } from '@/sprites/Fan';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';

/**
 * FanActor: Adapter wrapping Fan sprite as an AnimatedActor.
 * Delegates update/draw to existing Fan logic without rewriting it.
 */
export class FanActor extends AnimatedActor {
  private fan: Fan;

  constructor(id: string, fan: Fan, category: ActorCategory = 'fan', enableLogging = false) {
    // Fan sprite has x/y, but we're not using grid positioning for fans currently
    super(id, 'fan', category, 0, 0, enableLogging); 
    this.fan = fan;
    this.logger.debug('FanActor created, wrapping Fan sprite');
  }

  /**
   * Update fan stats each frame.
   */
  public update(delta: number): void {
    // Fan.update() already handles stat decay, so just call it
    // In future, may delegate to SeatManager or direct calls
    // No need to sync x/y - Fan sprite handles its own position
  }

  /**
   * Refresh fan visual based on internal state.
   */
  public draw(): void {
    // Fan already updates intensity visually
    // In future, may call fan.refreshVisual() or similar
  }

  /**
   * Get wrapped Fan sprite.
   */
  public getFan(): Fan {
    return this.fan;
  }

  /**
   * Get fan stats for registry snapshot.
   */
  public getStats() {
    return {
      happiness: this.fan.getHappiness?.(),
      thirst: this.fan.getThirst?.(),
      attention: this.fan.getAttention?.()
    };
  }
}
