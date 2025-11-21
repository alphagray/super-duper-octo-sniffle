import { AnimatedActor } from '@/actors/base/Actor';
import { Fan } from '@/sprites/Fan';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import { gameBalance } from '@/config/gameBalance';

/**
 * FanActor: Actor managing fan game state and delegating rendering to Fan sprite.
 * Handles all game logic: stats, wave participation, vendor interactions.
 * Fan sprite handles only visual animations and rendering.
 */
export class FanActor extends AnimatedActor {
  private fan: Fan;

  // Fan-level stats (game logic)
  private happiness: number;
  private thirst: number;
  private attention: number;

  // Randomized thirst growth rate (environmental sensitivity)
  private thirstMultiplier: number;

  // Grump/difficult terrain stats (foundation for future grump type)
  private disgruntlement: number = 0; // only grows for future grump type
  private disappointment: number = 0; // dynamic accumulator for unhappiness condition

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
    enableLogging = false
  ) {
    super(id, 'fan', category, 0, 0, enableLogging);
    this.fan = fan;

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

    // Randomize thirst growth rate: 0.5x to 1.5x (bell curve centered at 1.0)
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const bellCurve = (r1 + r2 + r3) / 3;
    this.thirstMultiplier = 0.5 + bellCurve;

    this.logger.debug('FanActor created with game state');
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

  public getThirstMultiplier(): number {
    return this.thirstMultiplier;
  }

  public setHappiness(value: number): void {
    this.happiness = Math.max(0, Math.min(100, value));
    this.updateVisualIntensity();
  }

  public setThirst(value: number): void {
    this.thirst = Math.max(0, Math.min(100, value));
    this.updateVisualIntensity();
  }

  public setAttention(value: number): void {
    this.attention = Math.max(0, Math.min(100, value));
  }

  // === Game Logic Methods ===

  /**
   * Update fan stats over time
   */
  public updateStats(deltaTime: number, scene: Phaser.Scene, environmentalModifier: number = 1.0): void {
    const deltaSeconds = deltaTime / 1000;

    // Attention freeze logic
    if (this.attentionFreezeUntil && scene.time.now < this.attentionFreezeUntil) {
      // Do not decrease attention while frozen
    } else {
      this.attention = Math.max(
        gameBalance.fanStats.attentionMinimum,
        this.attention - deltaSeconds * gameBalance.fanStats.attentionDecayRate
      );
    }

    // Thirst freeze logic
    if (this.thirstFreezeUntil && scene.time.now < this.thirstFreezeUntil) {
      // Do not increase thirst while frozen
    } else {
      const totalMultiplier = this.thirstMultiplier * environmentalModifier;
      this.thirst = Math.min(
        100,
        this.thirst + deltaSeconds * gameBalance.fanStats.thirstGrowthRate * totalMultiplier
      );
    }

    // Thirsty fans get less happy
    if (this.thirst > 50) {
      this.happiness = Math.max(0, this.happiness - deltaSeconds * gameBalance.fanStats.happinessDecayRate);
    }

    // Disappointment accumulation (future grump-only feature)
    if (this.thirst > 50 && this.happiness < gameBalance.grumpConfig.unhappyThreshold) {
      this.disappointment = Math.min(
        100,
        this.disappointment + deltaSeconds * gameBalance.grumpConfig.disappointmentGrowthRate
      );
    } else {
      this.disappointment = Math.max(0, this.disappointment - deltaSeconds * 0.5);
    }

    // Update visual representation
    this.updateVisualIntensity();
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
    this.updateVisualIntensity();
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

  // === Visual Delegation ===

  /**
   * Update visual intensity based on current thirst level
   */
  private updateVisualIntensity(): void {
    this.fan.setIntensity(this.thirst / 100);
  }

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
   */
  public update(delta: number): void {
    // Stats are updated explicitly by SectionActor.updateFanStats()
    // No per-frame updates needed here currently
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
