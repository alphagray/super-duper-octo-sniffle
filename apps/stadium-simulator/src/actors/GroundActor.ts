import { SceneryActor } from '@/actors/base/Actor';

/**
 * GroundActor: Represents the ground/field area below the stadium sections.
 * Renders a solid color rectangle from groundLineY to bottom of canvas.
 */
export interface GroundActorConfig {
  id: string;
  scene: Phaser.Scene;
  groundLineY: number;
  width: number;
  height: number;
  color: number;
}

export class GroundActor extends SceneryActor {
  private groundSprite: Phaser.GameObjects.Rectangle;
  private groundLineY: number;
  
  constructor(config: GroundActorConfig) {
    super(
      config.id,
      'ground',
      'scenery',
      0,
      0,
      false
    );
    
    this.groundLineY = config.groundLineY;
    
    // Create ground rectangle from groundLineY to bottom
    const centerY = config.groundLineY + (config.height / 2);
    
    this.groundSprite = config.scene.add.rectangle(
      config.width / 2,
      centerY,
      config.width,
      config.height,
      config.color
    );
    this.groundSprite.setDepth(-100);
    this.groundSprite.setOrigin(0.5, 0.5);
    
    // Store reference in base class sprite field
    this.sprite = this.groundSprite as any;
    
    this.logger.debug(`GroundActor created at y=${config.groundLineY}, height=${config.height}`);
  }
  
  /**
   * Get the Phaser sprite for the ground
   */
  public getSprite(): Phaser.GameObjects.Rectangle {
    return this.groundSprite;
  }
  
  /**
   * Destroy the ground sprite
   */
  public destroy(): void {
    this.groundSprite.destroy();
  }
}
