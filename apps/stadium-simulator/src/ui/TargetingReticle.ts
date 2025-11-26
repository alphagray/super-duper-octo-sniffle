import Phaser from 'phaser';

/**
 * TargetingReticle: Visual overlay for vendor assignment targeting
 * Shows cursor reticle and section highlights during vendor assignment mode
 */
export class TargetingReticle extends Phaser.GameObjects.Container {
  private reticleCircle: Phaser.GameObjects.Graphics;
  private sectionHighlight: Phaser.GameObjects.Graphics | null = null;
  private isActive: boolean = false;
  private currentSection: number | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // Create reticle circle (crosshair style)
    this.reticleCircle = scene.add.graphics();
    this.drawReticle();
    this.add(this.reticleCircle);

    // Start hidden
    this.setVisible(false);
    this.setDepth(1000); // Always on top

    // Add to scene
    scene.add.existing(this);

    // Listen for pointer movement
    scene.input.on('pointermove', this.handlePointerMove, this);
    
    // Listen for ESC key
    scene.input.keyboard?.on('keydown-ESC', this.handleEscapeKey, this);
  }

  /**
   * Draw reticle graphics
   */
  private drawReticle(): void {
    this.reticleCircle.clear();
    this.reticleCircle.lineStyle(2, 0x00ff00, 1);
    
    // Outer circle
    this.reticleCircle.strokeCircle(0, 0, 20);
    
    // Crosshair lines
    this.reticleCircle.lineBetween(-25, 0, -10, 0);
    this.reticleCircle.lineBetween(10, 0, 25, 0);
    this.reticleCircle.lineBetween(0, -25, 0, -10);
    this.reticleCircle.lineBetween(0, 10, 0, 25);
  }

  /**
   * Show targeting reticle
   */
  public show(): void {
    this.isActive = true;
    this.setVisible(true);
    
    // Hide default cursor
    this.scene.input.setDefaultCursor('none');
  }

  /**
   * Hide targeting reticle
   */
  public hide(): void {
    this.isActive = false;
    this.setVisible(false);
    this.clearSectionHighlight();
    
    // Restore default cursor
    this.scene.input.setDefaultCursor('default');
  }

  /**
   * Set whether current position is a valid target
   * @param isValid True if hovering over valid section
   * @param sectionIdx Section index if valid
   */
  public setTargetable(isValid: boolean, sectionIdx: number | null = null): void {
    // Update reticle color
    this.reticleCircle.clear();
    this.reticleCircle.lineStyle(2, isValid ? 0x00ff00 : 0xff0000, 1);
    
    // Outer circle
    this.reticleCircle.strokeCircle(0, 0, 20);
    
    // Crosshair lines
    this.reticleCircle.lineBetween(-25, 0, -10, 0);
    this.reticleCircle.lineBetween(10, 0, 25, 0);
    this.reticleCircle.lineBetween(0, -25, 0, -10);
    this.reticleCircle.lineBetween(0, 10, 0, 25);

    // Update section highlight
    if (isValid && sectionIdx !== null && sectionIdx !== this.currentSection) {
      this.highlightSection(sectionIdx);
      this.currentSection = sectionIdx;
    } else if (!isValid && this.currentSection !== null) {
      this.clearSectionHighlight();
      this.currentSection = null;
    }
  }

  /**
   * Highlight a section
   * @param sectionIdx Section index to highlight
   */
  private highlightSection(sectionIdx: number): void {
    this.clearSectionHighlight();
    
    // Create semi-transparent highlight overlay
    this.sectionHighlight = this.scene.add.graphics();
    this.sectionHighlight.setDepth(999); // Below reticle but above everything else
    
    // Section bounds (hardcoded for now, should be passed in or queried)
    // Section layout: A (left), B (center), C (right)
    const sectionWidth = 256;
    const sectionHeight = 128;
    const offsetX = 128;
    const offsetY = 480;
    
    const x = offsetX + (sectionIdx * (sectionWidth + 64));
    const y = offsetY;
    
    this.sectionHighlight.fillStyle(0x00ff00, 0.15);
    this.sectionHighlight.fillRect(x, y, sectionWidth, sectionHeight);
    
    this.sectionHighlight.lineStyle(2, 0x00ff00, 0.5);
    this.sectionHighlight.strokeRect(x, y, sectionWidth, sectionHeight);
  }

  /**
   * Clear section highlight
   */
  private clearSectionHighlight(): void {
    if (this.sectionHighlight) {
      this.sectionHighlight.destroy();
      this.sectionHighlight = null;
    }
  }

  /**
   * Handle pointer movement
   */
  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isActive) return;
    
    // Update reticle position
    this.setPosition(pointer.x, pointer.y);
  }

  /**
   * Handle ESC key press
   */
  private handleEscapeKey(): void {
    if (!this.isActive) return;
    
    this.emit('cancelled');
  }

  /**
   * Get current pointer world position
   */
  public getPointerWorldPosition(): { x: number; y: number } {
    const pointer = this.scene.input.activePointer;
    return { x: pointer.worldX, y: pointer.worldY };
  }

  /**
   * Cleanup
   */
  public destroy(fromScene?: boolean): void {
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.handleEscapeKey, this);
    this.clearSectionHighlight();
    super.destroy(fromScene);
  }
}
