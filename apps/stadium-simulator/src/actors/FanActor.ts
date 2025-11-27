import { AnimatedActor } from '@/actors/base/Actor';
import { Fan } from '@/sprites/Fan';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import { gameBalance } from '@/config/gameBalance';

/**
 * Fan states (derived from stats, not manually set)
 */
export type FanState = 'happy' | 'engaged' | 'disengaged' | 'waving' | 'thirsty' | 'unhappy' | 'drinking';

/**
 * FanActor: Actor managing fan game state and delegating rendering to Fan sprite.
 * Handles all game logic: stats, wave participation, vendor interactions.
 * Fan sprite handles only visual animations and rendering.
 * 
 * State Machine Pattern:
 * - updateStats(delta) modifies raw stats (thirst, happiness, attention)
 * - update(delta) derives state from current stats and triggers transitions
 * - State transitions trigger visual updates (not direct stat changes)
 */
export class FanActor extends AnimatedActor {
  private fan: Fan;
  private gridManager?: import('@/managers/GridManager').GridManager;

  // Fan-level stats (game logic)
  private happiness: number;
  private thirst: number;
  private attention: number;

  // Grump/difficult terrain stats (foundation for future grump type)
  private disgruntlement: number = 0; // only grows for future grump type
  private disappointment: number = 0; // dynamic accumulator for unhappiness condition

  // State machine
  private state: FanState = 'happy';
  private previousState: FanState = 'happy';

  // Wave participation properties
  private waveStrengthModifier: number = 0;
  private attentionFreezeUntil: number = 0;
  private thirstFreezeUntil: number = 0;
  public reducedEffort: boolean = false;
  public lastWaveParticipated: boolean = false;

  constructor(
    id: string,
    fan: Fan,
    initialStats?: { happiness: number; thirst: number; attention: number },
    category: ActorCategory = 'fan',
    enableLogging = false,
    gridManager?: import('@/managers/GridManager').GridManager
  ) {
    super(id, 'fan', category, 0, 0, enableLogging);
    this.fan = fan;
    this.gridManager = gridManager;

    // Initialize stats
    if (initialStats) {
      this.happiness = initialStats.happiness;
      this.thirst = initialStats.thirst;
      this.attention = initialStats.attention;
    } else {
      this.happiness = gameBalance.fanStats.initialHappiness;
      this.thirst =
        Math.random() * (gameBalance.fanStats.initialThirstMax - gameBalance.fanStats.initialThirstMin) +
        gameBalance.fanStats.initialThirstMin;
      this.attention = gameBalance.fanStats.initialAttention;
    }

    this.logger.debug('FanActor created with game state');

    // Initialize depth based on current position if gridManager provided
    if (this.gridManager) {
      const coords = this.gridManager.worldToGrid(this.fan.x, this.fan.y);
      if (coords) {
        const depth = this.gridManager.getDepthForPosition(coords.row, coords.col);
        this.fan.setDepth(depth);
        // Log first fan only
        if (id.includes('fan-0-0')) {
          console.log(`[FanActor] Init depth for fan at grid (${coords.row},${coords.col}): ${depth}`);
        }
      } else {
        const depth = this.gridManager.getDepthForWorld(this.fan.x, this.fan.y);
        if (typeof depth === 'number') {
          this.fan.setDepth(depth);
        }
      }
    }
    
    // Initialize visual intensity based on initial thirst
    this.fan.setIntensity(this.thirst / 100);
  }

  // === Stat Accessors ===

  public getStats(): { happiness: number; thirst: number; attention: number } {
    return {
      happiness: this.happiness,
      thirst: this.thirst,
      attention: this.attention,
    };
  }

  public getHappiness(): number {
    return this.happiness;
  }

  public getThirst(): number {
    return this.thirst;
  }

  public getAttention(): number {
    return this.attention;
  }

  /**
   * Determine if fan is currently disinterested (low attention + low happiness).
   * Used by engagement, targeting, ripple stubs, and mascot ability heuristics.
   */
  public getIsDisinterested(): boolean {
    return (
      this.attention < gameBalance.fanDisengagement.attentionThreshold &&
      this.happiness < gameBalance.fanDisengagement.happinessThreshold
    );
  }

  public setHappiness(value: number): void {
    this.happiness = Math.max(0, Math.min(100, value));
    // Visual update deferred to update() state machine
  }

  public setThirst(value: number): void {
    this.thirst = Math.max(0, Math.min(100, value));
    // Visual update deferred to update() state machine
  }

  public setAttention(value: number): void {
    this.attention = Math.max(0, Math.min(100, value));
    // Visual update deferred to update() state machine
  }

  /** Generic stat modification helper (delta-based) */
  public modifyStats(delta: { happiness?: number; thirst?: number; attention?: number }): void {
    if (delta.happiness !== undefined) {
      this.happiness = Phaser.Math.Clamp(this.happiness + delta.happiness, 0, 100);
    }
    if (delta.thirst !== undefined) {
      this.thirst = Phaser.Math.Clamp(this.thirst + delta.thirst, 0, 100);
    }
    if (delta.attention !== undefined) {
      this.attention = Phaser.Math.Clamp(this.attention + delta.attention, 0, 100);
    }
    // Visual update deferred to update() state machine
  }

  // === Game Logic Methods ===

  /**
   * Update fan stats over time
   */
  public updateStats(deltaTime: number, scene: Phaser.Scene, environmentalModifier: number = 1.0): void {
    // Use deltaTime (ms) for decay
    const frameSeconds = deltaTime / 1000;

    // Attention freeze logic
    if (this.attentionFreezeUntil && scene.time.now < this.attentionFreezeUntil) {
      // Do not decrease attention while frozen
    } else {
      this.attention = Math.max(
        gameBalance.fanStats.attentionMinimum,
        this.attention - frameSeconds * gameBalance.fanStats.attentionDecayRate
      );
    }

    // Thirst freeze logic
    if (this.thirstFreezeUntil && scene.time.now < this.thirstFreezeUntil) {
      // Do not increase thirst while frozen
    } else {
      // Thirst two-phase system:
      // Phase 1 (below threshold): Roll to START getting thirsty
      // Phase 2 (above threshold): Linear decay after getting thirsty
      if (this.thirst < gameBalance.fanStats.thirstThreshold) {
        // Phase 1: Roll to start getting thirsty
        const rollChance = gameBalance.fanStats.thirstRollChance * environmentalModifier * frameSeconds;
        if (Math.random() < rollChance) {
          // Activation amount pushes fan over threshold
          const thirstAmount = gameBalance.fanStats.thirstActivationAmount * environmentalModifier;
          this.thirst = Math.min(100, this.thirst + thirstAmount);
        }
      } else {
        // Phase 2: Linear decay after threshold
        const decayRate = gameBalance.fanStats.thirstDecayRate * environmentalModifier * frameSeconds;
        this.thirst = Math.min(100, this.thirst + decayRate);
      }
    }

    // Thirsty fans get less happy
    if (this.thirst > 50) {
      this.happiness = Math.max(0, this.happiness - frameSeconds * gameBalance.fanStats.happinessDecayRate);
    }

    // Disappointment accumulation (future grump-only feature)
    if (this.thirst > 50 && this.happiness < gameBalance.grumpConfig.unhappyThreshold) {
      this.disappointment = Math.min(
        100,
        this.disappointment + frameSeconds * gameBalance.grumpConfig.disappointmentGrowthRate
      );
    } else {
      this.disappointment = Math.max(0, this.disappointment - frameSeconds * 0.5);
    }

    // Visual updates deferred to update() state machine
  }

  /**
   * Vendor serves this fan a drink
   */
  /**
   * Serve a drink to the fan
   * @param sceneOrTimestamp Scene reference or current timestamp in milliseconds
   */
  public drinkServed(sceneOrTimestamp: Phaser.Scene | number): void {
    this.thirst = 0;
    this.happiness = Math.min(100, this.happiness + 15);
    
    const timestamp = typeof sceneOrTimestamp === 'number' 
      ? sceneOrTimestamp 
      : sceneOrTimestamp.time.now;
    
    this.thirstFreezeUntil = timestamp + gameBalance.fanStats.thirstFreezeDuration;
    // Explicitly transition to drinking state
    this.transitionToState('drinking');
  }

  /**
   * Fan successfully participates in a wave
   */
  public onWaveParticipation(scene: Phaser.Scene, success: boolean): void {
    if (success) {
      this.attention = 100;
      this.attentionFreezeUntil = scene.time.now + gameBalance.fanStats.attentionFreezeDuration;
      this.reducedEffort = false;
    }
  }

  /**
   * Calculate this fan's chance to participate in the wave
   */
  public calculateWaveChance(sectionBonus: number): number {
    const baseChance =
      this.happiness * gameBalance.fanStats.waveChanceHappinessWeight +
      this.attention * gameBalance.fanStats.waveChanceAttentionWeight -
      this.thirst * gameBalance.fanStats.waveChanceThirstPenalty;

    let totalChance = baseChance + sectionBonus + this.waveStrengthModifier;
    totalChance += gameBalance.fanStats.waveChanceFlatBonus;

    return Math.max(0, Math.min(100, totalChance));
  }

  /**
   * Set the wave strength modifier
   */
  public setWaveStrengthModifier(modifier: number): void {
    this.waveStrengthModifier = modifier;
  }

  /**
   * Roll to see if this fan participates in the wave
   */
  public rollForWaveParticipation(sectionBonus: number): boolean {
    const chance = this.calculateWaveChance(sectionBonus);
    const result = Math.random() * 100 < chance;
    this.lastWaveParticipated = result;
    return result;
  }

  // === Grump/Difficult Terrain Methods ===

  public isDifficultTerrain(): boolean {
    return (
      this.happiness < gameBalance.grumpConfig.unhappyThreshold ||
      this.disappointment > gameBalance.grumpConfig.disappointmentThreshold
    );
  }

  public getTerrainPenaltyMultiplier(): number {
    if (this.isDifficultTerrain()) {
      return gameBalance.vendorMovement.grumpPenaltyMultiplier;
    }
    return 1.0;
  }

  public getDisgruntlement(): number {
    return this.disgruntlement;
  }

  public getDisappointment(): number {
    return this.disappointment;
  }

  /**
   * Get current state
   */
  public getState(): FanState {
    return this.state;
  }

  /**
   * Transition to a new state (triggers visual updates)
   */
  private transitionToState(newState: FanState): void {
    if (this.state === newState) return;
    
    this.previousState = this.state;
    this.state = newState;
    
    // Trigger visual updates on state change
    this.updateVisualsForState(newState);
  }

  // === Visual Updates ===

  /**
   * Update visuals for the current state (called on state transitions)
   * Handles state-specific visual properties like alpha, tint, scale
   */
  private updateVisualsForState(state: FanState): void {
    const cfg = gameBalance.fanDisengagement;
    
    // Update thirst-based intensity (color + jiggle) - always needs to be updated
    this.fan.setIntensity(this.thirst / 100);
    
    switch (state) {
      case 'disengaged':
        this.fan.setAlpha(cfg.visualOpacity);
        (this.fan as any).setTint?.(cfg.visualTint);
        break;

      case 'thirsty':
        // Thirsty: slightly faded, yellowish tint
        this.fan.setAlpha(0.85);
        (this.fan as any).setTint?.(0xFFDD88);
        break;

      case 'unhappy':
        // Unhappy: very faded, dark tint
        this.fan.setAlpha(0.6);
        (this.fan as any).setTint?.(0x666666);
        break;
        
      case 'engaged':
      case 'happy':
        this.fan.setAlpha(1);
        (this.fan as any).clearTint?.();
        break;
        
      case 'waving':
        // Wave animation handles its own visuals
        this.fan.setAlpha(1);
        (this.fan as any).clearTint?.();
        break;
        
      case 'drinking':
        // Drinking state - full visibility, no tint
        this.fan.setAlpha(1);
        (this.fan as any).clearTint?.();
        break;
    }
  }

  // === Visual Delegation ===

  /**
   * Play wave animation on sprite
   */
  public playWave(
    delayMs: number = 0,
    intensity: number = 1.0,
    visualState: 'full' | 'sputter' | 'death' = 'full',
    waveStrength: number = 70
  ): Promise<void> {
    return this.fan.playWave(delayMs, intensity, visualState, waveStrength);
  }

  /**
   * Play animation on sprite
   */
  public playAnimation(animationName: string, options?: Record<string, any>): Promise<void> | void {
    return this.fan.playAnimation(animationName, options);
  }

  /**
   * Poke jiggle on sprite
   */
  public pokeJiggle(intensityBoost: number = 0.6, durationMs: number = 900): void {
    this.fan.pokeJiggle(intensityBoost, durationMs);
  }

  /**
   * Reset sprite position and tweens
   */
  public resetPositionAndTweens(): void {
    this.fan.resetPositionAndTweens();
  }

  /**
   * Update fan actor (called each frame)
   * Handles stat decay, derives state from stats, and triggers transitions
   * @param delta - Time elapsed in milliseconds
   * @param scene - Phaser scene (for time.now access)
   * @param environmentalModifier - Environmental thirst multiplier (optional, defaults to 1.0)
   */
  public update(delta: number, scene?: Phaser.Scene, environmentalModifier: number = 1.0): void {
    // Update stats (thirst/happiness/attention decay)
    if (scene) {
      this.updateStats(delta, scene, environmentalModifier);
    }
    
    // Check for state transitions
    const newState = this.deriveStateFromStats();
    if (newState !== this.state) {
      this.transitionToState(newState);
    }

    // Continuous depth update based on current grid position (discrete row-based)
    if (this.gridManager) {
      const coords = this.gridManager.worldToGrid(this.fan.x, this.fan.y);
      if (coords) {
        const depth = this.gridManager.getDepthForPosition(coords.row, coords.col);
        this.fan.setDepth(depth);
        // Debug log occasionally
        if (Math.random() < 0.50) {
          console.log(`[FanActor] Update depth at grid (${coords.row},${coords.col}): ${depth}, actual depth: ${this.fan.depth}`);
        }
      }
    }
  }

  /**
   * Derive state from current stats (pure logic, no side effects)
   */
  private deriveStateFromStats(): FanState {
    // Priority order: specific states override general states
    
    // 1. Temporary states (highest priority)
    if (this.thirst < 10 && this.thirstFreezeUntil > 0) {
      return 'drinking';
    }
    
    // 2. Unhappy state (low happiness from prolonged thirst)
    if (this.happiness < gameBalance.fanStats.unhappyHappinessThreshold) {
      return 'unhappy';
    }
    
    // 3. Thirsty state (thirst crossed threshold, but happiness still okay)
    if (this.thirst > gameBalance.fanStats.thirstThreshold) {
      return 'thirsty';
    }
    
    // 4. Disengaged state (low attention + low happiness, not thirst-related)
    const isDisinterested = this.getIsDisinterested();
    if (isDisinterested) {
      return 'disengaged';
    }
    
    // 5. Engaged state (high attention or recent wave participation)
    if (this.attention > 70 || this.lastWaveParticipated) {
      return 'engaged';
    }
    
    // 6. Happy state (default when nothing is wrong)
    return 'happy';
  }

  /**
   * Refresh fan visual
   */
  public draw(): void {
    // Fan sprite handles its own rendering
  }

  /**
   * Get wrapped Fan sprite
   */
  public getFan(): Fan {
    return this.fan;
  }
}
