import { UtilityActor } from '@/actors/Actor';
import type { WaveSprite } from '@/sprites/WaveSprite';
import type { ActorCategory } from '@/actors/ActorTypes';

/**
 * WaveSpriteActor: Adapter for grid-based WaveSprite.
 * Bridges the sprite-based wave with the Actor registry system.
 */
export class WaveSpriteActor extends UtilityActor {
  private sprite: WaveSprite;

  constructor(id: string, sprite: WaveSprite, category: ActorCategory = 'wave', enableLogging = false) {
    const pos = sprite.getPosition();
    super(id, 'wave', category, pos.x, pos.y, enableLogging);
    this.sprite = sprite;
    this.logger.debug('WaveSpriteActor adapter created');
  }

  /**
   * Update delegates to the wrapped sprite
   */
  public update(delta: number): void {
    this.sprite.update(delta);
    const pos = this.sprite.getPosition();
    this.setPosition(pos.x, pos.y);
  }

  /**
   * Get wrapped WaveSprite object
   */
  public getSprite(): WaveSprite {
    return this.sprite;
  }

  /**
   * Get wave state for registry snapshot
   */
  public getState() {
    return {
      state: this.sprite.getState(),
      position: this.sprite.getPosition(),
      isComplete: this.sprite.isComplete(),
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.sprite.destroy();
  }
}
