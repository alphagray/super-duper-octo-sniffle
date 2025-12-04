import { AnimatedActor } from '@/actors/base/Actor';
import { MascotBehavior } from '@/actors/behaviors/MascotBehavior';
import { gameBalance } from '@/config/gameBalance';
import type { MascotPersonality } from '@/types/personalities';
import type { GridManager } from '@/managers/GridManager';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { Mascot } from '@/sprites/Mascot';
import type { PathfindingService } from '@/services/PathfindingService';
import type { GridPathCell } from '@/managers/interfaces/VendorTypes';

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
  private pathfindingService?: PathfindingService;
  private assignedSection: StadiumSection | null = null;
  private eventListeners: Map<string, Function[]> = new Map();

  // Activation / lifecycle state
  private active: boolean = false;
  private activationEndAt: number = 0; // timestamp when current activation ends
  private cooldownRemainingMs: number = 0; // remaining cooldown before next activation
  private autoRotationCooldownMs: number = 0; // timer for auto-rotation eligibility

  // Movement / mode state
  private movementMode: 'manual' | 'auto' = 'manual';
  private patrolling: boolean = false; // true while assigned & active
  private moveTween?: Phaser.Tweens.Tween; // Current movement tween
  
  // Per-section ability cooldowns (sectionId -> timestamp when cooldown expires)
  private sectionCooldowns: Map<string, number> = new Map();
  private readonly SECTION_COOLDOWN_MS = 10000; // 10 seconds

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

  /** Attach pathfinding service for proper grid-based movement */
  public attachPathfindingService(service: PathfindingService): void {
    this.pathfindingService = service;
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
  }

  /** Deactivate current activation (called internally when duration expires) */
  private deactivate(): void {
    if (!this.active) return;
    this.patrolling = false;
    this.active = false;
    // Assign cooldown between min/max
    const cd = Phaser.Math.Between(gameBalance.mascot.minCooldown, gameBalance.mascot.maxCooldown);
    this.cooldownRemainingMs = cd;
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
    // Emit to registered listeners
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(payload));
    }
    // Also relay through sprite for backward compatibility
    if ((this.sprite as any).emit) {
      (this.sprite as any).emit(event, payload);
    }
  }

  /** Subscribe to events */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /** Unsubscribe from events */
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
   * Update per frame: delegate to behavior tick 
   * @param delta - Time elapsed in milliseconds
   * @param roundTime - Time relative to round start (negative = remaining, positive = elapsed)
   */
  public update(delta: number, roundTime: number): void {
    // Tick behavior (internal cadence-based logic)
    this.behavior.tick(delta, roundTime);
    const deltaMs = delta;
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

  // === T-Shirt Cannon Ability ===

  /**
   * Check if section is on cooldown
   */
  public isSectionOnCooldown(sectionId: string): boolean {
    const cooldownExpiry = this.sectionCooldowns.get(sectionId);
    if (!cooldownExpiry) return false;
    return Date.now() < cooldownExpiry;
  }

  /**
   * Get remaining cooldown for section in milliseconds
   */
  public getSectionCooldownRemaining(sectionId: string): number {
    const cooldownExpiry = this.sectionCooldowns.get(sectionId);
    if (!cooldownExpiry) return 0;
    const remaining = cooldownExpiry - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Start cooldown for a section
   */
  private startSectionCooldown(sectionId: string): void {
    this.sectionCooldowns.set(sectionId, Date.now() + this.SECTION_COOLDOWN_MS);
  }

  /**
   * Fire t-shirt cannon at specific target coordinates
   * @param targetX - World X coordinate (target fan position)
   * @param targetY - World Y coordinate (target fan position)
   * @param sectionId - Section ID for cooldown tracking
   * @param sectionIdx - Section index for calculating center column
   * @param scene - Phaser scene reference
   */
  public fireTShirtCannonAt(targetX: number, targetY: number, sectionId: string, sectionIdx: number, scene: Phaser.Scene): void {
    // Check section cooldown
    if (this.isSectionOnCooldown(sectionId)) {
      console.log(`[Mascot] Section ${sectionId} is on cooldown`);
      return;
    }

    // Start cooldown for this section
    this.startSectionCooldown(sectionId);

    // Pathfind to corridor and fire
    this.pathfindToFirePosition(targetX, targetY, sectionIdx, scene, () => {
      this.playWobbleAndFire(targetX, targetY, scene);
    });
  }

  /**
   * Fire ultimate ability: enhanced t-shirt cannon to all sections
   * @param scene - Phaser scene reference
   * @param sections - Array of StadiumSection sprites
   */
  public fireUltimate(scene: Phaser.Scene, sections: any[], ultimatePower: number): void {
    const behavior = this.behavior;
    if (!behavior.isUltimateReady()) {
      console.log('[MascotActor] Ultimate not ready');
      return;
    }

    console.log('[MascotActor] Firing ultimate ability with power:', ultimatePower);

    // Drain attention bank to 0
    behavior.drainAttentionBank();

    // Fire enhanced t-shirt cannon at each section
    ['A', 'B', 'C'].forEach((sectionId) => {
      const sectionIdx = sectionId.charCodeAt(0) - 65;
      if (sectionIdx >= 0 && sectionIdx < sections.length) {
        const section = sections[sectionIdx];
        const fans = section.getFans();
        
        if (fans && fans.length > 0) {
          // Pick random fan as target
          const randomFan = fans[Math.floor(Math.random() * fans.length)];
          const targetX = randomFan.x;
          const targetY = randomFan.y;
          
          // Fire with enhanced effects (handled in fireParticle via isUltimate flag)
          this.fireParticle(targetX, targetY, scene, true);
        }
      }
    });

    // Stadium white flash
    this.createStadiumFlash(scene);
    
    // Trigger "crowd goes wild" animation proportional to ultimate power
    // Power range: 30-100 → intensity range: 0.3-1.0
    const crowdIntensity = (ultimatePower - 30) / 70; // 0.0 at 30, 1.0 at 100
    this.emit('crowdGoesWild', { intensity: crowdIntensity });
  }

  /**
   * Create stadium-wide white flash effect
   */
  private createStadiumFlash(scene: Phaser.Scene): void {
    const flash = scene.add.rectangle(
      scene.cameras.main.centerX,
      scene.cameras.main.centerY,
      scene.cameras.main.width,
      scene.cameras.main.height,
      0xffffff,
      0.3
    );
    flash.setDepth(400);
    flash.setScrollFactor(0); // Fixed to camera
    
    scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy()
    });
  }

  /**
   * Fire t-shirt cannon at target section (legacy method for button controls)
   * @param targetSectionId - Section ID to target ('A', 'B', 'C', or 'global')
   * @param scene - Phaser scene reference
   * @param sections - Array of StadiumSection sprites for position lookup
   */
  public fireTShirtCannon(targetSectionId: string, scene: Phaser.Scene, sections: any[]): void {
    if (!this.gridManager) return;
    
    // Check cooldown for this section
    if (this.isSectionOnCooldown(targetSectionId)) {
      console.log(`[Mascot] Section ${targetSectionId} is on cooldown`);
      return;
    }
    
    // Get target section and pick a random cluster of fans within it
    let targetWorldX = scene.cameras.main.centerX;
    let targetWorldY = scene.cameras.main.centerY;
    
    if (targetSectionId !== 'global' && sections.length > 0) {
      // Map section ID to index (A=0, B=1, C=2)
      const sectionIndex = targetSectionId.charCodeAt(0) - 65; // 'A' = 65
      if (sectionIndex >= 0 && sectionIndex < sections.length) {
        const section = sections[sectionIndex];
        const fans = section.getFans();
        
        if (fans && fans.length > 0) {
          // Pick a random fan as the cluster center
          const randomFan = fans[Math.floor(Math.random() * fans.length)];
          targetWorldX = randomFan.x;
          targetWorldY = randomFan.y;
        } else {
          // Fallback to section center
          targetWorldX = section.x;
          targetWorldY = section.y;
        }
      }
    } else if (targetSectionId === 'global') {
      // For global, pick a random section then a random fan cluster
      const randomSection = sections[Math.floor(Math.random() * sections.length)];
      const fans = randomSection.getFans();
      if (fans && fans.length > 0) {
        const randomFan = fans[Math.floor(Math.random() * fans.length)];
        targetWorldX = randomFan.x;
        targetWorldY = randomFan.y;
      } else {
        targetWorldX = randomSection.x;
        targetWorldY = randomSection.y;
      }
    }
    
    // Start cooldown for this section
    this.startSectionCooldown(targetSectionId);
    
    // Map section ID to index (A=0, B=1, C=2)
    const sectionIdx = targetSectionId === 'global' ? 1 : targetSectionId.charCodeAt(0) - 65;
    
    // Pathfind to corridor in front of section
    this.pathfindToFirePosition(targetWorldX, targetWorldY, sectionIdx, scene, () => {
      // Once arrived, play wobble animation and fire
      this.playWobbleAndFire(targetWorldX, targetWorldY, scene);
    });
  }

  /**
   * Pathfind to firing position (corridor in front of section center)
   */
  private pathfindToFirePosition(targetX: number, targetY: number, sectionIdx: number, scene: Phaser.Scene, onArrival: () => void): void {
    if (!this.gridManager || !this.pathfindingService) {
      onArrival();
      return;
    }

    // Get section data to find center column
    const actorRegistry = (scene as any).actorRegistry;
    const sectionActors = actorRegistry?.getByCategory('section');
    const sectionActor = sectionActors?.[sectionIdx] as any;
    const sectionData = sectionActor?.getSectionData?.();
    
    if (!sectionData) {
      console.warn('[MascotActor] Could not get section data');
      onArrival();
      return;
    }
    
    // Calculate section center column
    const centerCol = Math.floor((sectionData.gridLeft + sectionData.gridRight) / 2);
    
    // Find corridor cell in section center column (rows 15-22 are typically corridor/ground area)
    let corridorRow = 18; // Default fallback
    let corridorCol = centerCol;
    
    for (let checkRow = 15; checkRow < 22; checkRow++) {
      const cell = this.gridManager.getCell(checkRow, centerCol);
      if (cell && (cell.zoneType === 'corridor' || cell.zoneType === 'stair')) {
        corridorRow = checkRow;
        break;
      }
    }
    
    // Convert target cell to world position
    const targetWorldPos = this.gridManager.gridToWorld(corridorRow, corridorCol);
    if (!targetWorldPos) {
      onArrival();
      return;
    }
    
    // Use pathfinding service to get grid-based path
    const path = this.pathfindingService.requestPath(
      this.sprite.x,
      this.sprite.y,
      targetWorldPos.x,
      targetWorldPos.y
    );
    
    if (!path || path.length === 0) {
      console.log('[MascotActor] No path found to target');
      onArrival();
      return;
    }
    
    // Set the path and start moving
    this.setPath(path);
    this.moveAlongPath(scene, onArrival);
  }

  /**
   * Move along the current path, cell by cell with bobble animation
   */
  private moveAlongPath(scene: Phaser.Scene, onComplete: () => void): void {
    const path = this.getPath();
    if (!path || this.isAtPathEnd()) {
      onComplete();
      return;
    }
    
    // Get next cell in path
    const nextIndex = this.getCurrentPathIndex() + 1;
    if (nextIndex >= path.length) {
      onComplete();
      return;
    }
    
    const nextCell = path[nextIndex];
    const targetX = nextCell.x;
    const targetY = nextCell.y;
    
    // Mascot's visual bottom is at y=0 in container coords, but container origin is at center
    // So we need to offset Y downward by half the mascot height (~32px) so feet land at cell center
    const mascotHalfHeight = 32; // Approximate half-height of mascot visual
    const adjustedTargetY = targetY + mascotHalfHeight;
    
    // Calculate duration - much slower (5x slower than normal)
    const startX = this.sprite.x;
    const startY = this.sprite.y;
    const distance = Math.sqrt((targetX - startX) ** 2 + (adjustedTargetY - startY) ** 2);
    const duration = distance * 5; // Much slower movement
    
    // Move container to next cell
    this.moveTween = scene.tweens.add({
      targets: this.sprite,
      x: targetX,
      y: adjustedTargetY,
      duration: duration,
      ease: 'Linear',
      onComplete: () => {
        // Advance to next cell
        this.advanceToNextCell();
        
        // Continue along path or complete
        if (this.isAtPathEnd()) {
          this.clearPath();
          onComplete();
        } else {
          this.moveAlongPath(scene, onComplete);
        }
      }
    });
  }

  /**
   * Play wobble animation and fire particle
   */
  private playWobbleAndFire(targetX: number, targetY: number, scene: Phaser.Scene): void {
    const originalX = this.sprite.x;
    const originalAngle = this.sprite.angle;
    
    // Wobble animation (shorter side-to-side shake with rotation jitter)
    scene.tweens.add({
      targets: this.sprite,
      x: originalX - 6, // Reduced from 10 to 6
      angle: originalAngle - 8, // Rotation jitter
      duration: 100,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Fire particle (normal shot, not ultimate)
        this.fireParticle(targetX, targetY, scene, false);
        
        // Reset position and rotation
        scene.tweens.add({
          targets: this.sprite,
          x: originalX,
          angle: originalAngle,
          duration: 200,
          ease: 'Back.easeOut'
        });
      }
    });
  }

  /**
   * Fire particle that travels to target and creates ripple effect
   * @param isUltimate - If true, apply enhanced ultimate effects
   */
  private fireParticle(targetX: number, targetY: number, scene: Phaser.Scene, isUltimate: boolean = false): void {
    // Create t-shirt particle (simple circle)
    const particle = scene.add.circle(this.sprite.x, this.sprite.y - 40, 8, 0xffffff);
    particle.setStrokeStyle(2, 0xffaa00); // Gold outline
    particle.setDepth(600); // Above mascot
    
    const startX = this.sprite.x;
    const startY = this.sprite.y - 40;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate arc height (higher arc for longer distances)
    const arcHeight = Math.min(200, distance * 0.3);
    const midX = startX + dx * 0.5;
    const midY = startY + dy * 0.5 - arcHeight; // Arc peak
    
    // Animate along bezier curve for arc trajectory
    const path = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(startX, startY),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(targetX, targetY)
    );
    
    let progress = 0;
    const duration = 800;
    const startTime = Date.now();
    
    const updateParticle = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(1, elapsed / duration);
      
      const point = path.getPoint(progress);
      particle.setPosition(point.x, point.y);
      
      if (progress < 1) {
        scene.time.delayedCall(16, updateParticle); // ~60fps
      } else {
        // Create splash/ripple effect (enhanced for ultimate)
        const rippleMultiplier = isUltimate ? 1.5 : 1.0;
        this.createRippleEffect(targetX, targetY, scene, rippleMultiplier);
        particle.destroy();
      }
    };
    
    updateParticle();
    
    // Add rotation to particle
    scene.tweens.add({
      targets: particle,
      angle: 360 * 2,
      duration: 800,
      ease: 'Linear'
    });
  }

  /**
   * Create ripple effect on fans when particle hits
   * @param multiplier - Scale factor for ripple size (1.5 for ultimate)
   */
  private createRippleEffect(x: number, y: number, scene: Phaser.Scene, multiplier: number = 1.0): void {
    // Create expanding ring effect (scaled for ultimate)
    for (let i = 0; i < 3; i++) {
      const ring = scene.add.circle(x, y, 10, 0xffaa00, 0);
      ring.setStrokeStyle(3, 0xffaa00, 0.8);
      ring.setDepth(550);
      
      scene.tweens.add({
        targets: ring,
        radius: (100 + (i * 30)) * multiplier,
        alpha: 0,
        delay: i * 150,
        duration: 600,
        ease: 'Power2.easeOut',
        onComplete: () => {
          ring.destroy();
        }
      });
    }
    
    // Emit event for fan stat application
    this.emit('tShirtCannonHit', { x, y, timestamp: Date.now() });
  }
}

