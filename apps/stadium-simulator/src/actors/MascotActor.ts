import { AnimatedActor } from '@/actors/base/Actor';
import { MascotBehavior } from '@/actors/behaviors/MascotBehavior';
import { gameBalance } from '@/config/gameBalance';
import type { MascotPersonality } from '@/types/personalities';
import type { GridManager } from '@/managers/GridManager';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { Mascot } from '@/sprites/Mascot';
import { MascotPerimeterPath } from '@/sprites/MascotPerimeterPath';

/**
 * MascotActor: Logic-layer wrapper for Mascot sprite.
 * All decision making lives in MascotBehavior; Actor handles lifecycle, grid anchoring,
 * event emission, and exposes debug/introspection APIs.
 */
export class MascotActor extends AnimatedActor {
  protected sprite: Mascot; // visual sprite instance (render-only)
  private behavior: MascotBehavior;
  private personality: MascotPersonality | null;
  private gridManager?: GridManager; // optional for world/grid conversions
  private assignedSection: StadiumSection | null = null;
  private perimeterPath: MascotPerimeterPath | null = null;

  // Activation / lifecycle state
  private active: boolean = false;
  private activationEndAt: number = 0; // timestamp when current activation ends
  private cooldownRemainingMs: number = 0; // remaining cooldown before next activation
  private autoRotationCooldownMs: number = 0; // timer for auto-rotation eligibility

  // Movement / mode state
  private movementMode: 'manual' | 'auto' = 'manual';
  private patrolling: boolean = false; // true while assigned & active

  constructor(
    id: string,
    sprite: Mascot,
    personality: MascotPersonality | null,
    gridManager?: GridManager,
    enableLogging = false
  ) {
    // Use sprite current world position mapped to grid if gridManager provided
    super(id, 'mascot', 'mascot', 0, 0, enableLogging);
    this.sprite = sprite;
    this.personality = personality;
    this.gridManager = gridManager;
    // Initialize grid position if grid manager available
    if (gridManager) {
      const worldX = sprite.x;
      const worldY = sprite.y;
      const gridPos = gridManager.worldToGrid(worldX, worldY);
      if (gridPos) {
        this.gridRow = gridPos.row;
        this.gridCol = gridPos.col;
      }
    }
    // Create behavior and attach this actor
    this.behavior = new MascotBehavior();
    this.behavior.attachActor(this);
  }

  /** Register section assignment (patrol context) */
  public assignSection(section: StadiumSection): void {
    this.assignedSection = section;
  }

  public clearSection(): void {
    this.assignedSection = null;
  }

  /** Get assigned section (if any) */
  public getAssignedSection(): StadiumSection | null {
    return this.assignedSection;
  }

  /** Access underlying sprite (for scene visual adjustments) */
  public getSprite(): Mascot {
    return this.sprite;
  }

  // === Activation & Patrol API (replacing legacy sprite logic) ===

  /** Determine if mascot can activate (cooldown finished & not already active) */
  public canActivate(): boolean {
    return !this.active && this.cooldownRemainingMs <= 0;
  }

  /** Activate mascot in a section with chosen movement mode */
  public activateInSection(section: StadiumSection, mode: 'manual' | 'auto' = 'manual'): void {
    if (!this.canActivate()) return;
    this.assignSection(section);
    this.perimeterPath = new MascotPerimeterPath(section);
    this.movementMode = mode;
    this.patrolling = true;
    this.active = true;
    const now = Date.now();
    const minDur = gameBalance.mascot.minDuration;
    const maxDur = gameBalance.mascot.maxDuration;
    const duration = Phaser.Math.Between(minDur, maxDur);
    this.activationEndAt = now + duration;
    // Reset auto-rotation cooldown
    this.autoRotationCooldownMs = gameBalance.mascot.autoRotationSectionCooldown;
    // Visual context
    this.sprite.setVisible(true);
    this.sprite.setContextVisual('hyping');
    
    // Emit activated event for speech bubbles and other effects
    this.emit('activated', { section: section.getId() });
  }

  /** Deactivate current activation (called internally when duration expires) */
  private deactivate(): void {
    if (!this.active) return;
    this.patrolling = false;
    this.active = false;
    // Assign cooldown between min/max
    const cd = Phaser.Math.Between(gameBalance.mascot.minCooldown, gameBalance.mascot.maxCooldown);
    this.cooldownRemainingMs = cd;
    // Clear perimeter path
    this.perimeterPath = null;
    // Clear section assignment (scene will remap)
    this.clearSection();
    this.sprite.setContextVisual('exit');
  }

  /** Is currently patrolling inside a section */
  public isPatrolling(): boolean {
    return this.patrolling && this.active;
  }

  /** Movement mode accessor */
  public getMovementMode(): 'manual' | 'auto' {
    return this.movementMode;
  }

  /** Set movement mode */
  public setMovementMode(mode: 'manual' | 'auto'): void {
    this.movementMode = mode;
  }

  /** Remaining cooldown until next auto rotation eligibility */
  public getAutoRotationCooldown(): number {
    return this.autoRotationCooldownMs;
  }

  /** Remaining activation cooldown (for UI) */
  public getActivationCooldown(): number {
    return this.cooldownRemainingMs;
  }

  /** Depth factor placeholder (future: compute based on patrol path / section geometry) */
  public getDepthFactor(): number {
    if (!this.assignedSection) return gameBalance.mascot.depthFactorFrontSides;
    // Simple heuristic: random until pathing implemented
    return Phaser.Math.FloatBetween(gameBalance.mascot.depthFactorFrontSides, gameBalance.mascot.depthFactorBack);
  }

  /** Expose behavior for manager integrations */
  public getBehavior(): MascotBehavior {
    return this.behavior;
  }

  /** Provide personality info */
  public getPersonality(): MascotPersonality | null {
    return this.personality;
  }

  /** Emit events; sprite or external listeners may subscribe */
  public emit(event: string, payload: any): void {
    // Relay through sprite for existing scene event wiring if available
    if ((this.sprite as any).emit) {
      (this.sprite as any).emit(event, payload);
    }
  }

  /** Update per frame: delegate to behavior tick */
  public update(delta: number): void {
    // Tick behavior (internal cadence-based logic)
    this.behavior.tick(delta);
    const deltaMs = delta;

    // Update perimeter movement if active
    if (this.active && this.patrolling && this.perimeterPath && this.assignedSection) {
      const speed = gameBalance.mascot.movementSpeed; // pixels per second
      this.perimeterPath.advance(deltaMs, speed);
      const position = this.perimeterPath.getCurrentPosition();
      this.sprite.setPosition(position.x, position.y);
      this.sprite.setFlipX(position.facing === 'left');
    }

    // Cooldown decrement
    if (this.cooldownRemainingMs > 0) {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - deltaMs);
    }
    if (this.autoRotationCooldownMs > 0) {
      this.autoRotationCooldownMs = Math.max(0, this.autoRotationCooldownMs - deltaMs);
    }
    // Activation duration check
    if (this.active && Date.now() >= this.activationEndAt) {
      this.deactivate();
    }

    // Update depth continuously based on current world position if available
    if (this.gridManager) {
      const depth = this.gridManager.getDepthForWorld(this.sprite.x, this.sprite.y);
      if (typeof depth === 'number') {
        this.sprite.setDepth(depth);
      }
    }
  }

  /** Draw/refresh visuals based on behavior state */
  public draw(): void {
    // Minimal placeholder: flip tint / alpha based on state
    const debugState = this.behavior.getDebugState();
    switch (debugState.state) {
      case 'ultimate':
        this.sprite.setAlpha(1.0);
        this.sprite.setTintFill();
        break;
      case 'executingAbility':
      case 'hyping':
        this.sprite.setAlpha(0.95);
        break;
      case 'patrolling':
        this.sprite.setAlpha(0.9);
        break;
      case 'entrance':
        this.sprite.setAlpha(1);
        break;
      case 'exit':
        this.sprite.setAlpha(0.5);
        break;
    }
  }

  /** Convenience: return debug state snapshot */
  public getDebugState() {
    return this.behavior.getDebugState();
  }

  /** Hook from wave results to update momentum chain */
  public onWaveCompleted(success: boolean): void {
    if (success) {
      this.behavior.onWaveSuccess();
    } else {
      this.behavior.onWaveFailure();
    }
  }

  /** Soft destroy: clear path & references (sprite destruction handled externally) */
  public destroy(): void {
    this.clearPath();
    this.assignedSection = null;
    this.active = false;
  }
}
