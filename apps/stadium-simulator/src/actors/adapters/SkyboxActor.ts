import { SceneryActor } from '@/actors/Actor';

/**
 * SkyboxActor: Represents the sky background above the stadium.
 * Renders a gradient rectangle from top of canvas to groundLineY.
 */
export interface SkyboxActorConfig {
  id: string;
  scene: Phaser.Scene;
  groundLineY: number;
  width: number;
  topColor: number;
  bottomColor: number;
}

export class SkyboxActor extends SceneryActor {
  private skySprite: Phaser.GameObjects.Rectangle;
  private groundLineY: number;
  
  constructor(config: SkyboxActorConfig) {
    super(
      config.id,
      'skybox',
      'scenery',
      0,
      0,
      false
    );
    
    this.groundLineY = config.groundLineY;
    
    // Create sky rectangle from top to groundLineY
    const centerY = config.groundLineY / 2;
    
    // Create rectangle with gradient fill
    // Note: Phaser rectangles don't support gradients directly,
    // so we'll use a simple solid color for now (can upgrade to Graphics later)
    this.skySprite = config.scene.add.rectangle(
      config.width / 2,
      centerY,
      config.width,
      config.groundLineY,
      config.topColor // Using top color for now
    );
    this.skySprite.setDepth(-101);
    this.skySprite.setOrigin(0.5, 0.5);
    
    // Store reference in base class sprite field
    this.sprite = this.skySprite as any;
    
    this.logger.debug(`SkyboxActor created, height=${config.groundLineY}`);
  }
  
  /**
   * Get the Phaser sprite for the skybox
   */
  public getSprite(): Phaser.GameObjects.Rectangle {
    return this.skySprite;
  }
  
  /**
   * Destroy the skybox sprite
   */
  public destroy(): void {
    this.skySprite.destroy();
  }
}
