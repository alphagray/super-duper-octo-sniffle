import { SceneryActor } from '@/actors/base/Actor';

/**
 * StairsActor: Represents a stairway connecting two stadium sections.
 * Used for navigation graph building and rendering.
 */
export interface StairsActorConfig {
  id: string;
  gridBounds: { left: number; top: number; width: number; height: number };
  connectsSections: [string, string]; // e.g., ['A', 'B']
  worldBounds: { x: number; y: number; width: number; height: number };
  scene: Phaser.Scene;
}

export class StairsActor extends SceneryActor {
  public readonly gridBounds: StairsActorConfig['gridBounds'];
  public readonly connectsSections: StairsActorConfig['connectsSections'];
  public readonly worldBounds: StairsActorConfig['worldBounds'];
  private stairSprite: Phaser.GameObjects.Rectangle;
  
  constructor(config: StairsActorConfig) {
    // SceneryActor constructor: (id, type, category, x, y, enableLogging)
    // Use center of grid bounds for position
    super(
      config.id,
      'stairs',
      'scenery',
      config.gridBounds.top,
      config.gridBounds.left,
      false
    );
    
    this.gridBounds = config.gridBounds;
    this.connectsSections = config.connectsSections;
    this.worldBounds = config.worldBounds;
    
    // Create white rectangle sprite for stairs
    this.stairSprite = config.scene.add.rectangle(
      config.worldBounds.x,
      config.worldBounds.y,
      config.worldBounds.width,
      config.worldBounds.height,
      0xffffff,
      0.8 // Slight transparency
    );
    this.stairSprite.setDepth(-50);
    this.stairSprite.setOrigin(0.5, 0.5);
    
    // Store reference in base class sprite field
    this.sprite = this.stairSprite as any;
    
    this.logger.debug(`StairsActor created: ${config.id} connecting ${config.connectsSections.join(' and ')}`);
  }
  
  /**
   * Get snapshot of stairs state for registry
   */
  public getSnapshot() {
    return {
      id: this.id,
      type: this.type,
      category: this.category,
      gridBounds: this.gridBounds,
      connectsSections: this.connectsSections,
      worldBounds: this.worldBounds
    };
  }
  
  /**
   * Get the Phaser sprite for this stairway
   */
  public getSprite(): Phaser.GameObjects.Rectangle {
    return this.stairSprite;
  }
  
  /**
   * Destroy the stairs sprite
   */
  public destroy(): void {
    this.stairSprite.destroy();
  }
}
