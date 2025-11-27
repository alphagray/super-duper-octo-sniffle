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
    
    // Dynamic section bounds derived from grid seat ranges.
    // Seat grid ranges duplicated from StadiumScene.getSectionAtGridPosition:
    // Section A: cols 2-9, rows 15-18
    // Section B: cols 12-19, rows 15-18
    // Section C: cols 22-29, rows 15-18
    // We compute world-space rectangle by converting the top-left and bottom-right
    // seat cell centers to world coords via gridToWorld and then expanding to cover
    // full cell extents.
    const sceneAny: any = this.scene as any;
    const gridManager = sceneAny.gridManager; // Access private via any (surgical, replace later with injected ref)
    if (!gridManager) {
      console.warn('[TargetingReticle] gridManager unavailable; using legacy hardcoded highlight');
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

    const cellSize = gridManager.getWorldSize().cellSize;

    interface Range { colStart: number; colEnd: number; rowStart: number; rowEnd: number; }
    const ranges: Range[] = [
      { colStart: 2, colEnd: 9, rowStart: 15, rowEnd: 18 },   // A
      { colStart: 12, colEnd: 19, rowStart: 15, rowEnd: 18 }, // B
      { colStart: 22, colEnd: 29, rowStart: 15, rowEnd: 18 }  // C
    ];
    const r = ranges[sectionIdx];
    if (!r) return;

    // Convert top-left seat cell center then adjust by half cell size to get true top-left corner.
    const topLeftCenter = gridManager.gridToWorld(r.rowStart, r.colStart);
    const bottomRightCenter = gridManager.gridToWorld(r.rowEnd, r.colEnd);
    const x = topLeftCenter.x - cellSize / 2;
    const y = topLeftCenter.y - cellSize / 2;
    const width = (r.colEnd - r.colStart + 1) * cellSize;
    const height = (r.rowEnd - r.rowStart + 1) * cellSize;

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
