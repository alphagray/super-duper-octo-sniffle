import Phaser from 'phaser';
import { UtilityActor } from './helpers/BaseActor';
import { GridManager } from '@/managers/GridManager';
import { gameBalance } from '@/config/gameBalance';

// ...existing code...
export type WaveMovementState = 'idle' | 'moving' | 'complete';

export interface WaveSpriteConfig {
  baseSpeed: number; // base pixels per second
  waveStrength: number; // 0-100, affects actual speed
  debugVisible?: boolean;
  debugColor?: number;
  debugAlpha?: number;
  lineWidth?: number;
}

export interface SectionBounds {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * WaveSprite represents a wave propagating through the stadium as a vertical sweep line.
 * Moves horizontally across sections, triggering wave checks via collision detection.
 * Visual is a vertical line from ground to section top.
 */
export class WaveSprite extends UtilityActor {
  private gridManager: GridManager;
  private config: WaveSpriteConfig;
  private movementState: WaveMovementState = 'idle';
  private targetX: number = 0;
  private direction: 'left' | 'right' = 'right';
  private sections: SectionBounds[] = [];
  private currentSectionIndex: number = -1;
  private hasEnteredSection: Set<string> = new Set();
  
  // Visual bounds
  private lineTop: number = 0;
  private lineBottom: number = 0;
  
  // Debug visuals
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private debugVisible: boolean = false;

  // Event callbacks
  private eventListeners: Map<string, Array<Function>> = new Map();

    /**
   * Reset all state for reuse in a new wave
   */
  public resetState(): void {
    this.movementState = 'idle';
    this.currentSectionIndex = -1;
    this.hasEnteredSection.clear();
    this.sections = [];
    this.lineTop = 0;
    this.lineBottom = 0;
    this.targetX = 0;
    this.direction = 'right';
    this.config.waveStrength = 70;
    if (this.debugGraphics) {
      this.debugGraphics.clear();
      // Don't hide graphics if debug is enabled - just clear them
    }
    this.logger.debug('State reset for reuse');
  }


  constructor(
    scene: Phaser.Scene,
    id: string,
    gridManager: GridManager,
    startX: number,
    startY: number,
    config: Partial<WaveSpriteConfig> = {}
  ) {
    super(scene, id, 'wave', startX, startY, false);
    
    this.gridManager = gridManager;
    this.config = {
      baseSpeed: config.baseSpeed ?? gameBalance.waveSprite.speed,
      waveStrength: config.waveStrength ?? 70,
      debugVisible: config.debugVisible ?? gameBalance.waveSprite.visible,
      debugColor: config.debugColor ?? gameBalance.waveSprite.debugColor,
      debugAlpha: config.debugAlpha ?? gameBalance.waveSprite.debugAlpha,
      lineWidth: config.lineWidth ?? 3,
    };

    this.debugVisible = this.config.debugVisible ?? false;
    
    if (this.debugVisible) {
      this.createDebugVisual();
    }

    this.logger.debug(`WaveSprite created at (${startX}, ${startY})`);
  }

  /**
   * Set section bounds for collision detection
   * @param sections - Array of section boundaries to traverse
   */
  public setSections(sections: SectionBounds[]): void {
    this.sections = [...sections];
    this.logger.debug(`Sections set: ${sections.map(s => s.id).join(', ')}`);
  }

  /**
   * Set the vertical line bounds (top and bottom Y coordinates)
   */
  public setLineBounds(top: number, bottom: number): void {
    this.lineTop = top;
    this.lineBottom = bottom;
    this.logger.debug(`Line bounds set: top=${top}, bottom=${bottom}`);
  }

  /**
   * Set wave direction and target position
   * @param direction - 'left' or 'right'
   * @param targetX - Final X position to reach
   */
  public setTarget(direction: 'left' | 'right', targetX: number): void {
    this.direction = direction;
    this.targetX = targetX;
    this.logger.debug(`Target set: direction=${direction}, targetX=${targetX}`);
  }

  /**
   * Update wave strength (affects movement speed)
   */
  public setWaveStrength(strength: number): void {
    this.config.waveStrength = Math.max(0, Math.min(100, strength));
    this.logger.debug(`Wave strength updated: ${this.config.waveStrength}`);
  }

  /**
   * Calculate current movement speed based on wave strength
   * Higher strength = faster wave
   * Uses new gameBalance.waveSprite speed scaling config
   */
  private getCurrentSpeed(): number {
    const cfg = gameBalance.waveSprite;
    
    // Get current wave strength (0-100)
    const strength = this.config.waveStrength;
    
    // Formula: baseSpeed + (strength * speedMultiplier)
    const calculatedSpeed = cfg.baseSpeed + (strength * cfg.speedMultiplier);
    
    // Clamp to min/max
    return Math.max(cfg.minSpeed, Math.min(cfg.maxSpeed, calculatedSpeed));
  }

  /**
   * Reset sprite state for reuse (called by WaveManager)
   */
  public _resetState(): void {
    this.movementState = 'idle';
    this.hasEnteredSection.clear();
    this.currentSectionIndex = -1;
    this.targetX = 0;
    this.logger.debug('State reset for reuse');
  }

  /**
   * Configure sprite for new wave (called by WaveManager)
   */
  public configure(startX: number, direction: 'left' | 'right', targetX: number): void {
    this.x = startX;
    this.direction = direction;
    this.targetX = targetX;
    this.movementState = 'idle';
    this.logger.debug(`Configured: x=${startX} direction=${direction} target=${targetX}`);
  }

  /**
   * Start wave movement toward target
   */
  public startMovement(): void {
    this.movementState = 'moving';
    this.currentSectionIndex = -1;
    this.hasEnteredSection.clear();
    // Ensure debug graphics are visible if debug mode is enabled
    if (this.debugVisible && this.debugGraphics) {
      this.debugGraphics.setVisible(true);
    }
    this.emit('movementStarted', { actorId: this.id, x: this.x });
    this.logger.debug('Movement started');
  }

  /**
   * Check if wave has reached its destination
   */
  public isComplete(): boolean {
    return this.movementState === 'complete';
  }

  /**
   * Get current movement state
   */
  public getState(): WaveMovementState {
    return this.movementState;
  }

  /**
   * Update wave position and check for section collisions
   * Recalculates speed dynamically each frame based on current wave strength
   */
  public update(delta: number): void {
    if (this.movementState !== 'moving') return;

    const deltaSeconds = delta / 1000;
    // Recalculate speed dynamically (allows mid-wave changes)
    const currentSpeed = this.getCurrentSpeed();
    const moveDistance = currentSpeed * deltaSeconds;

    // Move horizontally toward target
    const dx = this.targetX - this.x;
    const distance = Math.abs(dx);

    // console.log(`[WaveSprite.update] x=${this.x.toFixed(1)} target=${this.targetX} dx=${dx.toFixed(1)} distance=${distance.toFixed(1)} moveDistance=${moveDistance.toFixed(1)} direction=${this.direction}`);

    if (distance <= moveDistance) {
      // Reached target
      // console.log(`[WaveSprite.update] REACHED TARGET - completing`);
      this.x = this.targetX;
      this.onMovementComplete();
    } else {
      // Move toward target (smooth interpolation)
      const direction = this.direction === 'right' ? 1 : -1;
      this.x += moveDistance * direction;
    }

    // Check section collisions
    this.checkSectionCollisions();

    // Update debug visual (check config in case it changed)
    const configVisible = gameBalance.waveSprite.visible;
    if (configVisible !== this.debugVisible) {
      this.setDebugVisible(configVisible);
    }
    if (this.debugVisible && this.debugGraphics) {
      this.updateDebugVisual();
    }
  }

  /**
   * Check if wave sprite has entered or exited any section bounds
   */
  private checkSectionCollisions(): void {
    if (this.sections.length === 0) return;

    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      const isInside = this.x >= section.left && this.x <= section.right;

      if (isInside && !this.hasEnteredSection.has(section.id)) {
        // Just entered this section
        this.hasEnteredSection.add(section.id);
        this.currentSectionIndex = i;
        this.emit('waveSpriteEntersSection', {
          actorId: this.id,
          sectionId: section.id,
          sectionIndex: i,
          x: this.x
        });
        this.logger.debug(`Entered section ${section.id}`);
      } else if (!isInside && this.hasEnteredSection.has(section.id)) {
        // Just exited this section
        this.emit('waveSpriteExitsSection', {
          actorId: this.id,
          sectionId: section.id,
          sectionIndex: i,
          x: this.x
        });
        // Allow future re-entry triggers (for reverse/double waves)
        this.hasEnteredSection.delete(section.id);
        this.logger.debug(`Exited section ${section.id}`);
      }
    }
  }

  /**
   * Handle wave reaching target position
   */
  private onMovementComplete(): void {
    this.movementState = 'complete';
    this.emit('pathComplete', { actorId: this.id, finalX: this.x });
    this.logger.debug('Movement complete');
  }

  /**
   * Toggle debug visual visibility
   */
  public setDebugVisible(visible: boolean): void {
    this.debugVisible = visible;
    if (visible && !this.debugGraphics) {
      this.createDebugVisual();
    }
    if (this.debugGraphics) {
      this.debugGraphics.setVisible(visible);
    }
  }

  /**
   * Toggle debug visual visibility (for W key)
   */
  public toggleDebugVisible(): void {
    this.setDebugVisible(!this.debugVisible);
    this.logger.debug(`Debug visibility toggled to: ${this.debugVisible}`);
  }

  /**
   * Subscribe to wave events
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from wave events
   */
  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit wave event
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  /**
   * Create debug visual (vertical line)
   */
  private createDebugVisual(): void {
    if (this.debugGraphics) return;

    this.debugGraphics = this.scene.add.graphics();
    this.debugGraphics.setDepth(1000);
    this.logger.debug('Debug visual created');
  }

  /**
   * Update debug visual rendering (vertical line with direction indicator)
   */
  private updateDebugVisual(): void {
    if (!this.debugGraphics) return;

    this.debugGraphics.clear();

    // Draw vertical line from lineTop to lineBottom
    this.debugGraphics.lineStyle(
      this.config.lineWidth!,
      this.config.debugColor!,
      this.config.debugAlpha!
    );
    this.debugGraphics.lineBetween(
      this.x,
      this.lineTop,
      this.x,
      this.lineBottom
    );

    // Draw direction indicator (small horizontal arrow at mid-height)
    const arrowY = (this.lineTop + this.lineBottom) / 2;
    const arrowLength = 15;
    const arrowOffset = this.direction === 'right' ? arrowLength : -arrowLength;
    
    this.debugGraphics.lineStyle(2, this.config.debugColor!, this.config.debugAlpha!);
    this.debugGraphics.lineBetween(this.x, arrowY, this.x + arrowOffset, arrowY);
    
    // Arrow head
    const headSize = 5;
    const headDir = this.direction === 'right' ? 1 : -1;
    this.debugGraphics.lineBetween(
      this.x + arrowOffset,
      arrowY,
      this.x + arrowOffset - headSize * headDir,
      arrowY - headSize
    );
    this.debugGraphics.lineBetween(
      this.x + arrowOffset,
      arrowY,
      this.x + arrowOffset - headSize * headDir,
      arrowY + headSize
    );
  }

  /**
   * Cleanup resources
   */
  public override destroy(): void {
    if (this.debugGraphics) {
      this.debugGraphics.destroy();
      this.debugGraphics = undefined;
    }
    this.eventListeners.clear();
    super.destroy();
  }
}
