import { AnimatedActor } from '@/actors/base/Actor';
import { Fan } from '@/sprites/Fan';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import { gameBalance } from '@/config/gameBalance';

/**
 * Fan states (derived from stats, not manually set)
 */
export type FanState = 'happy' | 'engaged' | 'disengaged' | 'waving' | 'thirsty' | 'unhappy' | 'drinking' | 'excited';

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
  private actorRegistry?: any; // For vendor collision checks

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
  private excitedUntil: number = 0; // Temporary excited state from t-shirt cannon
  public reducedEffort: boolean = false;
  public lastWaveParticipated: boolean = false;
  
  // Auto-wave triggering (Phase 5.3)
  private waveReady: boolean = false;
  
  // Attention-driven thirst mechanism (Issue #3)
  private lastAttentionLevel: number = 0;
  private attentionStagnationTimer: number = 0;

  constructor(
    id: string,
    fan: Fan,
    initialStats?: { happiness: number; thirst: number; attention: number },
    category: ActorCategory = 'fan',
    enableLogging = false,
    gridManager?: import('@/managers/GridManager').GridManager,
    actorRegistry?: any
  ) {
    super(id, 'fan', category, 0, 0, enableLogging);
    this.fan = fan;
    this.gridManager = gridManager;
    this.actorRegistry = actorRegistry;

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
      console.log(`[FanActor ${this.id}] Init attention: ${this.attention}`);
    }

    this.logger.debug('FanActor created with game state');

    // Initialize depth based on current position if gridManager provided
    if (this.gridManager) {
      const coords = this.gridManager.worldToGrid(this.fan.x, this.fan.y);
      if (coords) {
        const depth = this.gridManager.getDepthForPosition(coords.row, coords.col);
        this.fan.setDepth(depth);
        // Log first fan only
        // if (id.includes('fan-0-0')) {
        //   console.log(`[FanActor] Init depth for fan at grid (${coords.row},${coords.col}): ${depth}`);
        // }
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
   * Get the fan sprite (for visual effects like cluster decay feedback)
   */
  public getSprite(): Fan {
    return this.fan;
  }

  /**
   * Check if fan is ready to trigger a wave (happiness >= threshold)
   * Used by SectionActor for auto-wave triggering (Phase 5.3)
   */
  public isWaveReady(): boolean {
    return this.waveReady;
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
    // Update wave readiness immediately (Phase 5.6: happiness is sole gate for wave initiation)
    this.waveReady = this.happiness >= gameBalance.fanStats.waveStartThreshold;
    // Visual update deferred to update() state machine
  }

  public setThirst(value: number): void {
    this.thirst = Math.max(0, Math.min(100, value));
    // Visual update deferred to update() state machine
  }

  public setAttention(value: number): void {
    const newVal = Math.max(0, Math.min(100, value));
    if (newVal !== this.attention) {
      // console.log(`[FanActor ${this.id}] setAttention: ${this.attention} → ${newVal}`);
    }
    this.attention = newVal;
    // Visual update deferred to update() state machine
  }

  /**
   * Apply t-shirt cannon effect (actor-to-actor interaction from mascot)
   * Follows actor pattern: mascot → fanActor → fan sprite
   * @param happinessBoost Amount of happiness to add
   * @param attentionDrain Amount of attention to drain
   * @param intensity Reaction intensity (1.0 = epicenter, lower = farther away)
   */
  public applyTShirtCannonEffect(happinessBoost: number, attentionDrain: number, intensity: number = 1.0): void {
    console.log(`[FanActor] applyTShirtCannonEffect called with intensity=${intensity.toFixed(2)}, sprite=`, !!this.sprite);
    
    // Apply stat changes
    this.modifyStats({ happiness: happinessBoost, attention: -attentionDrain });
    
    // Trigger visual reaction with intensity
    this.triggerExcitedReaction(intensity);
  }

  /**
   * Trigger excited reaction (t-shirt cannon hit)
   * Follows actor pattern: actor changes state → actor triggers sprite animation
   * @param intensity Reaction intensity (1.0 = full bounce, 0.33 = subtle)
   */
  public triggerExcitedReaction(intensity: number = 1.0): void {
    console.log(`[FanActor] triggerExcitedReaction called, fan=`, !!this.fan, 'hasMethod=', typeof this.fan?.playExcitedJump);
    
    // Trigger visual jump through fan sprite (actor controls sprite, not external events)
    if (this.fan && typeof this.fan.playExcitedJump === 'function') {
      this.fan.playExcitedJump(intensity);
    } else {
      console.warn('[FanActor] Cannot trigger jump - fan sprite or method missing');
    }
  }

  /** Generic stat modification helper (delta-based) */
  public modifyStats(delta: { happiness?: number; thirst?: number; attention?: number }): void {
    let penaltyApplied = false;
    let beforeClamp : number = 0;
    let afterClamp : number = 0;
    if (delta.happiness !== undefined) {
      beforeClamp = this.happiness + delta.happiness
      afterClamp = Phaser.Math.Clamp(this.happiness + delta.happiness, 0, 100);
      this.setHappiness(afterClamp);
      if (delta.happiness < 0) penaltyApplied = true;
    }
    if (delta.thirst !== undefined) {
      this.thirst = Phaser.Math.Clamp(this.thirst + delta.thirst, 0, 100);
    }
    if (delta.attention !== undefined) {
      beforeClamp = this.attention + delta.attention;
      afterClamp = Phaser.Math.Clamp(beforeClamp, 0, 100);
      if (afterClamp !== this.attention) {
        // console.log(`[FanActor ${this.id}] modifyStats attention: ${this.attention} + ${delta.attention} = ${beforeClamp} (clamped: ${afterClamp})`);
      }
      this.setAttention(afterClamp);
      if (delta.attention < 0) penaltyApplied = true;
    }
    // If a penalty was applied, blink the fan's border red
    // if (penaltyApplied && this.fan?.blinkBorderRed) {
    //   this.fan.blinkBorderRed();
    // }
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
    // NOTE: Per-frame attention decay REMOVED (Phase 5.1 - now handled by cluster decay in SectionActor)
    // Attention should only decay in burst events, not continuously
    if (this.attentionFreezeUntil && scene.time.now < this.attentionFreezeUntil) {
      // Do not decrease attention while frozen
    } else {
      // ATTENTION DECAY REMOVED - cluster decay handles this now
      // const decayAmount = frameSeconds * gameBalance.fanStats.attentionDecayRate;
      // const newAttention = Math.max(
      //   gameBalance.fanStats.attentionMinimum,
      //   this.attention - decayAmount
      // );
      // this.attention = newAttention;
    }

    // Attention-driven thirst mechanism (Issue #3)
    // Track if attention is stagnating at low levels, which triggers fast thirst
    if (this.attention < gameBalance.fanStats.attentionStagnationThreshold) {
      this.attentionStagnationTimer += deltaTime;
    } else {
      this.attentionStagnationTimer = 0;
    }
    const attentionStagnant = this.attentionStagnationTimer >= gameBalance.fanStats.attentionMinimumDuration;

    // Thirst freeze logic
    if (this.thirstFreezeUntil && scene.time.now < this.thirstFreezeUntil) {
      // Do not increase thirst while frozen
    } else {
      // Thirst two-phase linear system (Phase 5.2 refactor) with attention-driven acceleration:
      // Phase 1 (0-60): Slow linear growth (unless attention is stagnant)
      // Phase 2 (60-100): Fast linear growth
      // If attention is stagnant for too long, accelerate to Phase 2 rate regardless of thirst level
      if (this.thirst < gameBalance.fanStats.thirstPhase2Threshold && !attentionStagnant) {
        // Phase 1: Slow growth (0-60)
        this.thirst = Math.min(100, this.thirst + gameBalance.fanStats.thirstPhase1Rate * environmentalModifier * frameSeconds);
      } else {
        // Phase 2: Fast growth (60-100) OR fast growth due to attention stagnation
        this.thirst = Math.min(100, this.thirst + gameBalance.fanStats.thirstPhase2Rate * environmentalModifier * frameSeconds);
      }
    }

    // Individual happiness decay REMOVED (Phase 5.1 - now handled by cluster decay in SectionActor)
    // Legacy code: if (this.thirst > 50) { this.happiness -= ... }

    // Disappointment accumulation (future grump-only feature)
    if (this.thirst > 50 && this.happiness < gameBalance.grumpConfig.unhappyThreshold) {
      this.disappointment = Math.min(
        100,
        this.disappointment + frameSeconds * gameBalance.grumpConfig.disappointmentGrowthRate
      );
    } else {
      this.disappointment = Math.max(0, this.disappointment - frameSeconds * 0.5);
    }

    // Auto-wave readiness tracking (Phase 5.3)
    // Phase 5.6: Only happiness gates wave initiation (attention affects success, not start)
    this.waveReady = this.happiness >= gameBalance.fanStats.waveStartThreshold;

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
    // Reduce thirst using config value
    this.thirst = Math.max(0, this.thirst - gameBalance.fanStats.thirstReductionOnServe);
    
    // NEW: Recover happiness on vendor serve
    this.happiness = Math.min(
      gameBalance.fanStats.happinessMaximum || 100,
      this.happiness + gameBalance.fanStats.happinessRecoveryOnServe
    );
    
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
      // Modest attention boost on wave success (not a full freeze)
      const attnBoost = gameBalance.waveAutonomous.waveCompletionAttentionBoost || 0;
      const happyBoost = gameBalance.waveAutonomous.waveCompletionHappinessBoost || 0;
      const newAttention = Math.min(100, this.attention + attnBoost);
      const newHappiness = Math.min(100, this.happiness + happyBoost);
      if(Math.random() < 0.15){
        // 35% of the time, log fan happiness and attention after wave participation
        console.log(`[FanActor ${this.id}] onWaveParticipation: attention ${this.attention} + ${attnBoost} = ${newAttention}`);
        console.log(`[FanActor ${this.id}] onWaveParticipation: happiness ${this.happiness} + ${happyBoost} = ${newHappiness}`);
      }
      
      // this.attention = newAttention;
      // this.setAttention(newAttention);
      this.setHappiness(newHappiness);
      // Short freeze to prevent immediate re-decay, but allow attention to drop quickly after
      this.attentionFreezeUntil = scene.time.now + 1000; // 1 second freeze (was 5000)
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
   * Checks for vendor collision at fan's position during participation check
   * NOTE: Collision is checked and emitted REGARDLESS of participation outcome
   */
  public rollForWaveParticipation(sectionBonus: number): boolean {
    // ALWAYS check for vendor collision (even if fan doesn't participate)
    const vendorAtPosition = this.checkVendorCollision();
    
    // Emit collision event immediately if vendor present (before participation roll)
    // This ensures collision is detected even if fan doesn't participate
    if (vendorAtPosition) {
      this.emitVendorCollision(vendorAtPosition);
    }
    
    // Calculate base chance
    let chance = this.calculateWaveChance(sectionBonus);
    
    // Vendor presence reduces participation chance (distraction/obstacle)
    if (vendorAtPosition) {
      const vendorPenalty = gameBalance.vendorMovement.waveCollisionPenalty;
      chance += vendorPenalty;
      chance = Math.max(0, Math.min(100, chance));
    }
    
    const result = Math.random() * 100 < chance;
    this.lastWaveParticipated = result;
    
    return result;
  }

  // === Vendor Collision Detection ===

  /**
   * Check if a vendor is currently at this fan's grid position
   * Uses horizontal bounding box overlap to detect vendors that span multiple columns
   * Ignores vertical overlap - only checks if vendor is in the same row and overlaps horizontally
   * @returns The vendor actor if present, null otherwise
   */
  private checkVendorCollision(): any | null {
    if (!this.actorRegistry || !this.gridManager) return null;
    
    const fanPos = this.getGridPosition();
    
    // Get fan's world position and cell bounds
    const fanWorldPos = this.gridManager.gridToWorld(fanPos.row, fanPos.col);
    const cellWidth = this.gridManager.cellWidth ?? 40;
    
    // Fan cell horizontal bounds (centered)
    const fanLeft = fanWorldPos.x - cellWidth / 2;
    const fanRight = fanWorldPos.x + cellWidth / 2;
    
    // Get all vendors from registry
    const vendors = this.actorRegistry.getByCategory('vendor');
    
    for (const vendor of vendors) {
      const vendorAny = vendor as any;
      const vendorWorldPos = vendorAny.getPosition?.();
      
      if (!vendorWorldPos) continue;
      
      // Check if vendor is in same row (using grid position for row check)
      const vendorGridPos = this.gridManager.worldToGrid(vendorWorldPos.x, vendorWorldPos.y);
      if (!vendorGridPos || vendorGridPos.row !== fanPos.row) continue;
      
      // Vendor sprite dimensions (approximate - vendors are ~32x48 pixels)
      const vendorWidth = 32;
      
      // Vendor horizontal bounding box
      const vendorLeft = vendorWorldPos.x - vendorWidth / 2;
      const vendorRight = vendorWorldPos.x + vendorWidth / 2;
      
      // Check for horizontal overlap only
      const overlapsHorizontally = 
        vendorLeft < fanRight &&
        vendorRight > fanLeft;
      
      if (overlapsHorizontally) {
        return vendor;
      }
    }
    
    return null;
  }

  /**
   * Emit vendor collision event when fan participates in wave with vendor present
   * @param vendor The vendor actor at collision
   */
  private emitVendorCollision(vendor: any): void {
    const vendorAny = vendor as any;
    const behavior = vendorAny.getBehavior?.();
    const pointsAtRisk = behavior?.getPointsEarned?.() ?? 0;
    const fanPos = this.getGridPosition();
    
    // Find seat actor at this position for complete event data
    const seats = this.actorRegistry?.getByCategory('seat') ?? [];
    const seatAtPosition = seats.find((seat: any) => {
      const seatPos = seat.getGridPosition();
      return seatPos.row === fanPos.row && seatPos.col === fanPos.col;
    });
    
    // Emit DOM event for scene-level listener to handle penalties (keeps actors decoupled)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vendorCollision', {
        detail: {
          vendorId: vendor.id,
          fanId: this.id,
          gridRow: fanPos.row,
          gridCol: fanPos.col,
          pointsAtRisk,
          seatId: seatAtPosition?.id ?? null
        }
      }));
    }
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
   * @param roundTime - Time relative to round start (negative = remaining, positive = elapsed)
   * @param scene - Phaser scene (for time.now access)
   * @param environmentalModifier - Environmental thirst multiplier (optional, defaults to 1.0)
   */
  public update(delta: number, roundTime: number, scene?: Phaser.Scene, environmentalModifier: number = 1.0): void {
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
        // if (Math.random() < 0.50) {
        //   console.log(`[FanActor] Update depth at grid (${coords.row},${coords.col}): ${depth}, actual depth: ${this.fan.depth}`);
        // }
      }
    }
  }

  /**
   * Derive state from current stats (pure logic, no side effects)
   */
  private deriveStateFromStats(): FanState {
    // Priority order: specific states override general states
    
    // 1. Temporary states (highest priority)
    if (this.excitedUntil > Date.now()) {
      return 'excited';
    }
    
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
    if (this.attention > 100 
      ) {
      // || this.lastWaveParticipated) {
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
