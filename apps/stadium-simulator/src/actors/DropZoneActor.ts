import { SceneryActor } from '@/actors/base/Actor';
import { gameBalance } from '@/config/gameBalance';

/**
 * DropZoneActor: Represents a vendor dropoff point in the corridor.
 * Displays a dark square with white outline flash effect when activated.
 */
export interface DropZoneActorConfig {
  id: string;
  scene: Phaser.Scene;
  x: number;
  y: number;
  cellSize: number;
  gridRow: number;
  gridCol: number;
}

export class DropZoneActor extends SceneryActor {
  private dropZoneSprite: Phaser.GameObjects.Rectangle;
  private outlineGraphics: Phaser.GameObjects.Graphics;
  protected gridRow: number;
  protected gridCol: number;
  private scene: Phaser.Scene;
  private cellSize: number;
  
  constructor(config: DropZoneActorConfig) {
    super(
      config.id,
      'dropzone',
      'scenery',
      config.x,
      config.y,
      false
    );
    
    this.scene = config.scene;
    this.cellSize = config.cellSize;
    this.gridRow = config.gridRow;
    this.gridCol = config.gridCol;
    
    // Create dark square (1x1 cell)
    this.dropZoneSprite = config.scene.add.rectangle(
      config.x,
      config.y,
      config.cellSize,
      config.cellSize,
      0x333333 // Dark gray
    );
    this.dropZoneSprite.setDepth(100); // Scenery depth
    this.dropZoneSprite.setOrigin(0.5, 0.5);
    this.dropZoneSprite.setAlpha(0.8);
    
    // Create outline graphics for flash effect
    this.outlineGraphics = config.scene.add.graphics();
    this.outlineGraphics.setDepth(101); // Above drop zone sprite
    this.drawOutline(0); // Initially invisible
    
    // Store reference in base class sprite field
    this.sprite = this.dropZoneSprite as any;
    
    this.logger.debug(`DropZoneActor created at (${config.gridRow},${config.gridCol}), world (${config.x},${config.y})`);
  }
  
  /**
   * Draw white outline with specified alpha
   */
  private drawOutline(alpha: number): void {
    this.outlineGraphics.clear();
    
    if (alpha > 0) {
      this.outlineGraphics.lineStyle(2, gameBalance.dropZone.flashColor, alpha);
      this.outlineGraphics.strokeRect(
        this.dropZoneSprite.x - this.cellSize / 2,
        this.dropZoneSprite.y - this.cellSize / 2,
        this.cellSize,
        this.cellSize
      );
    }
  }
  
  /**
   * Flash white outline effect (500ms pulse)
   */
  public flash(): void {
    const flashDuration = gameBalance.dropZone.flashDuration;
    
    // Pulse alpha from 0 to 1 and back to 0
    this.scene.tweens.add({
      targets: { alpha: 0 },
      alpha: 1,
      duration: flashDuration / 2,
      yoyo: true,
      onUpdate: (tween, target: { alpha: number }) => {
        this.drawOutline(target.alpha);
      },
      onComplete: () => {
        this.drawOutline(0);
      }
    });
    
    this.logger.debug('Flash effect triggered');
  }
  
  /**
   * Get grid position
   */
  public getGridPosition(): { row: number; col: number } {
    return { row: this.gridRow, col: this.gridCol };
  }
  
  /**
   * Get the Phaser sprite for the drop zone
   */
  public getSprite(): Phaser.GameObjects.Rectangle {
    return this.dropZoneSprite;
  }
  
  /**
   * Destroy the drop zone sprites
   */
  public destroy(): void {
    this.dropZoneSprite.destroy();
    this.outlineGraphics.destroy();
  }
}
