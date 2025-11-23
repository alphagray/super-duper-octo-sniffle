import Phaser from 'phaser';
import type { MascotPersonality, MascotAbility, AbilityEffect } from '@/types/personalities';
import type { DialogueManager } from '@/systems/DialogueManager';
import type { StadiumSection } from './StadiumSection';
import type { Fan } from './Fan';
import { BaseActorSprite } from './helpers/BaseActor';
import { MascotPerimeterPath } from './MascotPerimeterPath';
import { MascotTargetingAI } from '@/systems/MascotTargetingAI';
import { RipplePropagationEngine } from '@/systems/RipplePropagationEngine';
import { MascotAnalytics } from '@/systems/MascotAnalytics';
import { CatchParticles } from '@/components/CatchParticles';
import { gameBalance } from '@/config/gameBalance';

/**
 * Mascot context states for dialogue selection
 */
type MascotContext = 'entrance' | 'hyping' | 'dancing' | 'disappointed' | 'ultimate' | 'exit';

/**
 * Movement mode for mascot behavior
 */
type MovementMode = 'manual' | 'auto';

export class Mascot extends BaseActorSprite {
  // Existing ability system properties
  private cooldown: number;
  private isActive: boolean;
  private personality: MascotPersonality | null;
  private dialogueManager: DialogueManager | null;
  private mascotId: string;
  private activeAbility: MascotAbility | null;
  private abilityTimer: number;
  private currentContext: MascotContext;

  // Movement system properties
  private perimeterPath: MascotPerimeterPath | null = null;
  private activeDuration: number = 0; // time remaining in current activation
  private maxDuration: number = 0; // total duration for current activation
  private movementSpeed: number = 0;
  private assignedSection: StadiumSection | null = null;
  private movementMode: MovementMode = 'manual';
  private movementCooldown: number = 0; // cooldown before can be activated again
  private autoRotationCooldown: number = 0; // cooldown before switching sections in auto mode

  // T-Shirt Cannon system properties
  private targetingAI!: MascotTargetingAI;
  private rippleEngine!: RipplePropagationEngine;
  private shotsRemaining: number = 0;
  private shotCooldown: number = 0;
  private isCharging: boolean = false;
  private chargingStartTime: number = 0;

  // Analytics tracking
  private analytics: MascotAnalytics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number,
        personality?: MascotPersonality,
    dialogueManager?: DialogueManager
  ) {
    super(scene, x, y, 'mascot', 'mascot'); // texture key and actor type
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cooldown = 0;
    this.isActive = false;
    this.personality = personality || null;
    this.dialogueManager = dialogueManager || null;
    this.mascotId = personality?.id || `mascot-${Math.random().toString(36).substr(2, 9)}`;
    this.activeAbility = null;
    this.abilityTimer = 0;
    this.currentContext = 'entrance';

    // Apply visual customization if personality is provided
    if (this.personality) {
      this.applyVisualCustomization();
    }

    // Initialize cannon systems
    this.targetingAI = new MascotTargetingAI();
    this.rippleEngine = new RipplePropagationEngine();

    // TODO: Add animation setup
  }

  /**
   * Apply visual customization based on personality
   */
  private applyVisualCustomization(): void {
    if (!this.personality) return;

    // Apply color tint from personality palette
    if (this.personality.appearance.colorPalette.length > 0) {
      const primaryColor = this.personality.appearance.colorPalette[0];
      this.setTint(parseInt(primaryColor.replace('#', '0x')));
    }

    // Apply scale from personality
    this.setScale(this.personality.appearance.scale);
  }

  /**
   * Trigger dialogue for a specific mascot context
   */
  public triggerDialogue(
    context: MascotContext,
    gameContext: {
      score: number;
      waveState: 'active' | 'inactive' | 'countdown';
      aggregateStats?: {
        happiness: number;
        thirst: number;
        attention: number;
      };
    }
  ): string | null {
    if (!this.personality || !this.dialogueManager) {
      return null;
    }

    this.currentContext = context;

    // Map mascot contexts to game events
    const eventMap: Record<MascotContext, 'mascotActivate' | 'waveComplete' | 'sectionSuccess' | 'sectionFail'> = {
      entrance: 'mascotActivate',
      hyping: 'mascotActivate',
      dancing: 'waveComplete',
      disappointed: 'sectionFail',
      ultimate: 'mascotActivate',
      exit: 'mascotActivate',
    };

    const dialogueLine = this.dialogueManager.selectDialogue(
      this.mascotId,
      this.personality.dialogue,
      {
        event: eventMap[context],
        ...gameContext,
      }
    );

    return dialogueLine?.text || null;
  }

  /**
   * Activate mascot ability by index
   */
  public activateAbility(abilityIndex: number = 0): boolean {
    if (!this.personality || this.cooldown > 0 || this.isActive) {
      return false;
    }

    const ability = this.personality.abilities[abilityIndex];
    if (!ability) {
      return false;
    }

    // Activate the ability
    this.isActive = true;
    this.activeAbility = ability;
    this.cooldown = ability.cooldown;
    this.abilityTimer = ability.duration;
    this.currentContext = 'ultimate';

    return true;
  }

  /**
   * Get active ability effects
   */
  public getActiveEffects(): AbilityEffect[] {
    if (!this.isActive || !this.activeAbility) {
      return [];
    }
    return this.activeAbility.effects;
  }

  /**
   * Get available abilities
   */
  public getAbilities(): MascotAbility[] {
    if (!this.personality) {
      return [];
    }
    return this.personality.abilities;
  }

  /**
   * Get mascot's personality
   */
  public getPersonality(): MascotPersonality | null {
    return this.personality;
  }

  /**
   * Get mascot's unique ID
   */
  public getMascotId(): string {
    return this.mascotId;
  }

  /**
   * Get current context
   */
  public getCurrentContext(): MascotContext {
    return this.currentContext;
  }

  /**
   * Set current context
   */
  public setContext(context: MascotContext): void {
    this.currentContext = context;
  }

  /**
   * Activate mascot in a specific section for perimeter patrol
   * @param section - Stadium section to patrol
   * @param mode - Movement mode ('manual' or 'auto')
   */
  public activateInSection(section: StadiumSection, mode: MovementMode = 'manual'): void {
    this.assignedSection = section;
    this.movementMode = mode;
    this.isActive = true;
    this.perimeterPath = new MascotPerimeterPath(section);

    // Random duration between min and max
    this.maxDuration = Phaser.Math.Between(
      gameBalance.mascot.minDuration,
      gameBalance.mascot.maxDuration
    );
    this.activeDuration = this.maxDuration;
    this.movementSpeed = gameBalance.mascot.movementSpeed;

    // Initialize cannon system
    this.shotsRemaining = Phaser.Math.Between(
      gameBalance.mascotCannon.minShotsPerActivation,
      gameBalance.mascotCannon.maxShotsPerActivation
    );
    this.shotCooldown = Phaser.Math.Between(
      gameBalance.mascotCannon.minShotInterval,
      gameBalance.mascotCannon.maxShotInterval
    );
    this.targetingAI.reset();

    // Initialize analytics
    this.analytics = new MascotAnalytics(section.getId() || 'unknown');
    this.analytics.recordBaseline(section);
    this.analytics.recordActivation();

    // Position at starting point
    const pos = this.perimeterPath.getCurrentPosition();
    this.setPosition(pos.x, pos.y);
    this.setFlipX(pos.facing === 'left');
    this.setVisible(true);

    console.log(`[Mascot ${this.mascotId}] Activated in section ${section.getId()}, duration: ${this.maxDuration}ms, shots: ${this.shotsRemaining}, mode: ${mode}`);
  }

  /**
   * Deactivate mascot and start cooldown
   */
  private deactivate(): void {
    // Record final participation metrics
    if (this.analytics && this.assignedSection) {
      this.analytics.recordPostMascotParticipation(this.assignedSection);

      // Log report if reporting is enabled
      if (gameBalance.mascotAnalytics?.reportingEnabled !== false) {
        console.log(this.analytics.generateReport());
      }

      // Emit analytics event for external systems
      this.emit('mascotAnalytics', this.analytics.getMetrics());
    }

    this.isActive = false;
    this.perimeterPath = null;

    // Random cooldown between min and max
    this.movementCooldown = Phaser.Math.Between(
      gameBalance.mascot.minCooldown,
      gameBalance.mascot.maxCooldown
    );

    // In auto mode, set section switch cooldown
    if (this.movementMode === 'auto') {
      this.autoRotationCooldown = gameBalance.mascot.autoRotationSectionCooldown;
    }

    // Reset cannon state
    this.targetingAI.reset();
    this.shotsRemaining = 0;
    this.isCharging = false;

    this.analytics = null;
    this.setVisible(false);
    console.log(`[Mascot ${this.mascotId}] Deactivated, cooldown: ${this.movementCooldown}ms`);
  }

  /**
   * Update perimeter movement
   */
  private updateMovement(delta: number): void {
    if (!this.perimeterPath || !this.assignedSection) return;

    // Pause movement if charging cannon
    if (!this.isCharging) {
      // Update position along perimeter
      this.perimeterPath.advance(delta, this.movementSpeed);
      const pos = this.perimeterPath.getCurrentPosition();
      this.setPosition(pos.x, pos.y);
      this.setFlipX(pos.facing === 'left');
    }

    // Update duration timer
    this.activeDuration -= delta;
    if (this.activeDuration <= 0) {
      this.deactivate();
    }
  }

  /**
   * Check if mascot can be activated (not in cooldown and not active)
   */
  public canActivate(): boolean {
    return !this.isActive && this.movementCooldown <= 0;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  public getCooldown(): number {
    return this.movementCooldown;
  }

  /**
   * Get remaining auto-rotation cooldown time in milliseconds
   */
  public getAutoRotationCooldown(): number {
    return this.autoRotationCooldown;
  }

  /**
   * Get current depth factor for targeting
   * Higher = further from fans = prefer distant targets
   */
  public getDepthFactor(): number {
    return this.perimeterPath?.getDepthFactor() || gameBalance.mascot.depthFactorFrontSides;
  }

  /**
   * Get assigned section
   */
  public getAssignedSection(): StadiumSection | null {
    return this.assignedSection;
  }

  /**
   * Set movement mode
   */
  public setMovementMode(mode: MovementMode): void {
    this.movementMode = mode;
  }

  /**
   * Get movement mode
   */
  public getMovementMode(): MovementMode {
    return this.movementMode;
  }

  /**
   * Manually assign to a section (without activating)
   * Used for preparing mascot before activation
   */
  public assignToSection(section: StadiumSection): void {
    this.assignedSection = section;
  }

  /**
   * Clear section assignment
   */
  public clearSection(): void {
    this.assignedSection = null;
  }

  /**
   * Check if mascot is actively patrolling
   */
  public isPatrolling(): boolean {
    return this.isActive && this.perimeterPath !== null;
  }

  /**
   * Fire a single t-shirt cannon shot
   * Pauses mascot movement during charge, selects targets, applies effects
   */
  private fireCannonShot(): void {
    if (!this.assignedSection) {
      console.warn(`[Mascot ${this.mascotId}] Cannot fire - no assigned section`);
      return;
    }

    // Pause movement during charge
    this.isCharging = true;
    this.chargingStartTime = this.scene.time.now;

    console.log(`[Mascot ${this.mascotId}] Charging cannon (${this.shotsRemaining} shots remaining)`);

    // Select target fans
    const catchers = this.targetingAI.selectCatchingFans(
      this.assignedSection,
      this
    );

    if (catchers.length === 0) {
      // No valid targets - wasted shot
      console.warn(`[Mascot ${this.mascotId}] No valid targets, shot wasted`);
      this.isCharging = false;
      this.emit('cannonMissed', { reason: 'no_targets', timestamp: this.scene.time.now });
      return;
    }

    // Show targeting indicator (1 second before fire)
    const targetingIndicator = (this.scene as any).targetingIndicator;
    if (targetingIndicator) {
      targetingIndicator.showTargetArea(
        catchers,
        gameBalance.mascotCannon.targetingPreviewDuration
      );
    }

    this.emit('cannonCharging', {
      catchers,
      chargeStartTime: this.chargingStartTime,
      mascotId: this.mascotId
    });

    // Wait for charge duration, then fire
    this.scene.time.delayedCall(
      gameBalance.mascotCannon.chargeDuration,
      () => {
        this.executeShot(catchers);
        this.isCharging = false;
      }
    );
  }

  /**
   * Execute the cannon shot after charge completes
   * Launches projectile and schedules effect application
   */
  private executeShot(catchers: Fan[]): void {
    console.log(`[Mascot ${this.mascotId}] Firing cannon at ${catchers.length} targets`);

    this.emit('cannonFired', {
      catchers,
      timestamp: this.scene.time.now,
      mascotId: this.mascotId
    });

    // Wait for projectile flight time, then apply effects
    this.scene.time.delayedCall(
      gameBalance.mascotCannon.projectileFlightTime,
      () => {
        this.applyCannonEffects(catchers);
      }
    );
  }

  /**
   * Apply all cannon effects: global boost, ripples, visual feedback
   * Only called on successful hits (catchers.length > 0)
   */
  private applyCannonEffects(catchers: Fan[]): void {
    if (!this.assignedSection) return;

    // Global boost to ALL fans in section (only on successful hit)
    const allFans = this.assignedSection.getFans();
    allFans.forEach(fan => {
      const stats = fan.getStats();
      fan.modifyStats({
        attention: stats.attention + gameBalance.mascotCannon.globalAttentionBoost,
        happiness: stats.happiness + gameBalance.mascotCannon.globalHappinessBoost
      });
    });

    // Calculate ripples from each catcher
    const ripples = catchers.map(catcher =>
      this.rippleEngine.calculateRipple(catcher, this.assignedSection!)
    );

    // Combine overlapping ripples
    const combinedEffects = this.rippleEngine.combineRipples(ripples);

    // Apply combined ripple effects
    this.rippleEngine.applyCombinedRipples(combinedEffects);

    // Record shot impact for analytics
    if (this.analytics) {
      const shotNumber = gameBalance.mascotCannon.maxShotsPerActivation - this.shotsRemaining + 1;
      this.analytics.recordCannonShot(shotNumber, ripples);
    }

    // Show catch particles
    // Re-engagement animations will trigger automatically when stats improve
    catchers.forEach(catcher => {
      CatchParticles.create(this.scene, catcher.x, catcher.y);
    });

    console.log(
      `[Mascot ${this.mascotId}] Shot complete! ` +
      `${catchers.length} catchers, ${combinedEffects.size} fans affected by ripple`
    );

    this.emit('cannonShot', {
      catchers,
      ripples,
      combinedEffects,
      shotNumber: (gameBalance.mascotCannon.maxShotsPerActivation - this.shotsRemaining),
      timestamp: this.scene.time.now,
      mascotId: this.mascotId
    });
  }

  public activate(): void {
    // Legacy method - trigger special ability
    if (this.cooldown <= 0) {
      this.activateAbility(0); // Activate first ability by default
    }
  }

  public update(delta: number): void {
    // Update ability cooldown timer (existing system)
    if (this.cooldown > 0) {
      this.cooldown -= delta;
    }

    // Update ability timer (existing system)
    if (this.activeAbility && this.abilityTimer > 0) {
      this.abilityTimer -= delta;

      if (this.abilityTimer <= 0) {
        // Ability expired
        this.activeAbility = null;
      }
    }

    // Update movement cooldown
    if (this.movementCooldown > 0) {
      this.movementCooldown -= delta;
    }

    // Update auto-rotation cooldown
    if (this.autoRotationCooldown > 0) {
      this.autoRotationCooldown -= delta;
    }

    // Update perimeter movement
    if (this.isActive && this.perimeterPath) {
      this.updateMovement(delta);

      // Update cannon shot cooldown
      if (!this.isCharging) {
        this.shotCooldown -= delta;
      }

      // Fire cannon if ready
      if (this.shotCooldown <= 0 && this.shotsRemaining > 0 && !this.isCharging) {
        this.fireCannonShot();
        this.shotsRemaining--;

        // Set next shot cooldown
        this.shotCooldown = Phaser.Math.Between(
          gameBalance.mascotCannon.minShotInterval,
          gameBalance.mascotCannon.maxShotInterval
        );
      }
    }
  }

  public getBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /**
   * @internal Test helper - force immediate deactivation
   * Only use in tests to simulate duration expiration
   */
  public __TEST_forceDeactivation(): void {
    this.activeDuration = 0;
  }

  /**
   * @internal Test helper - set cooldown for testing
   * Only use in tests to control cooldown state
   */
  public __TEST_setCooldown(ms: number): void {
    this.movementCooldown = ms;
  }

  /**
   * Get current analytics (useful for dev tools)
   */
  public getAnalytics(): MascotAnalytics | null {
    return this.analytics;
  }
}
