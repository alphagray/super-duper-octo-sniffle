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
    
    // Get actual section bounds from SectionActors instead of hardcoding
    const sceneAny: any = this.scene as any;
    const actorRegistry = sceneAny.actorRegistry;
    const gridManager = sceneAny.gridManager;
    
    if (!actorRegistry || !gridManager) {
      console.warn('[TargetingReticle] actorRegistry or gridManager unavailable; using legacy hardcoded highlight');
      const legacyWidth = 256;
      const legacyHeight = 128;
      const legacyOffsetX = 128;
      const legacyOffsetY = 480;
      const lx = legacyOffsetX + (sectionIdx * (legacyWidth + 64));
      const ly = legacyOffsetY;
      this.sectionHighlight.fillStyle(0x00ff00, 0.15);
      this.sectionHighlight.fillRect(lx, ly, legacyWidth, legacyHeight);
      this.sectionHighlight.lineStyle(2, 0x00ff00, 0.5);
      this.sectionHighlight.strokeRect(lx, ly, legacyWidth, legacyHeight);
      return;
    }

    // Query SectionActors from registry
    const sectionActors = actorRegistry.getByCategory('section');
    if (!sectionActors || sectionActors.length <= sectionIdx) {
      console.warn(`[TargetingReticle] Section ${sectionIdx} not found in registry`);
      return;
    }

    const sectionActor = sectionActors[sectionIdx];
    const sectionData = sectionActor.getSectionData();
    if (!sectionData) {
      console.warn(`[TargetingReticle] Section ${sectionIdx} has no data`);
      return;
    }

    const cellSize = gridManager.getWorldSize().cellSize;
    
    // Get seat row bounds from actual section data (e.g., rows 14-17)
    const rowStart = sectionData.gridTop;
    const rowEnd = sectionData.gridTop + 3; // 4 seat rows
    const colStart = sectionData.gridLeft;
    const colEnd = sectionData.gridRight;

    // Convert top-left seat cell center then adjust by half cell size to get true top-left corner.
    const topLeftCenter = gridManager.gridToWorld(rowStart, colStart);
    const bottomRightCenter = gridManager.gridToWorld(rowEnd, colEnd);
    const x = topLeftCenter.x - cellSize / 2;
    const y = topLeftCenter.y - cellSize / 2;
    const width = (colEnd - colStart + 1) * cellSize;
    const height = (rowEnd - rowStart + 1) * cellSize;

    this.sectionHighlight.fillStyle(0x00ff00, 0.15);
    this.sectionHighlight.fillRect(x, y, width, height);
    this.sectionHighlight.lineStyle(2, 0x00ff00, 0.5);
    this.sectionHighlight.strokeRect(x, y, width, height);
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
