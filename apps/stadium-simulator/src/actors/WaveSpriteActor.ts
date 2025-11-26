import { UtilityActor } from '@/actors/base/Actor';
import type { WaveSprite } from '@/sprites/WaveSprite';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';

/**
 * WaveSpriteActor: Adapter for grid-based WaveSprite.
 * Bridges the sprite-based wave with the Actor registry system.
 */
export class WaveSpriteActor extends UtilityActor {
  private waveSprite: WaveSprite; // Renamed to avoid conflict with Actor.sprite

  constructor(id: string, sprite: WaveSprite, category: ActorCategory = 'wave', enableLogging = false) {
    // WaveSprite doesn't use grid positioning currently, so pass 0,0
    super(id, 'wave', category, 0, 0, enableLogging);
    this.waveSprite = sprite;
    this.logger.debug('WaveSpriteActor adapter created');
  }

  /**
   * Update delegates to the wrapped sprite
   */
  public update(delta: number): void {
    this.waveSprite.update(delta);
    // No position sync needed - WaveSprite manages its own position
  }

  /**
   * Get wrapped WaveSprite object
   */
  public getSprite(): WaveSprite {
    return this.waveSprite;
  }

  /**
   * Get wave state for registry snapshot
   */
  public getState() {
    return {
      state: this.waveSprite.getState(),
      position: this.waveSprite.getPosition(),
      isComplete: this.waveSprite.isComplete(),
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.waveSprite.destroy();
  }

  // UtilityActor required method
  public draw(): void {
    // WaveSprite handles its own visual updates
  }
}
