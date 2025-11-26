import { UtilityActor } from '@/actors/base/Actor';
import type { Wave } from '@/managers/Wave';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';

/**
 * WaveActor: Non-visual adapter for wave state.
 * Tracks active wave properties without rendering.
 */
export class WaveActor extends UtilityActor {
  private wave: Wave;

  constructor(id: string, wave: Wave, x: number = 0, y: number = 0, category: ActorCategory = 'wave', enableLogging = false) {
    super(id, 'wave', category, x, y, enableLogging);
    this.wave = wave;
    this.logger.debug('WaveActor created for active wave');
  }

  /**
   * Update wave state each frame (if needed).
   */
  public update(delta: number): void {
    // Wave updates are driven by WaveManager; UtilityActor just tracks state
  }

  /**
   * Get wrapped Wave object.
   */
  public getWave(): Wave {
    return this.wave;
  }

  /**
   * Get wave state for registry snapshot.
   */
  public getState() {
    return {
      origin: this.wave.originSection,
      id: this.wave.id
    };
  }
}
