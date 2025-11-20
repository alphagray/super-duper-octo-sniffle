import type { GameStateManager } from './GameStateManager';
import type { AIManager } from './AIManager';
import type { GridManager } from './GridManager';
import { gameBalance } from '@/config/gameBalance';
import { Wave } from './Wave';
import type { WaveType } from './Wave';
import { WaveSprite } from '@/sprites/WaveSprite';
import { ActorRegistry } from '@/actors/base/ActorRegistry';

interface WaveCalculationResult {
  sectionId: string;
  columnIndex: number;
  participationRate: number;
  strength: number;
  columnState: 'full' | 'sputter' | 'death';
}

/**
 * Manages wave mechanics including countdown, section propagation, scoring and events
 */
export class WaveManager {
  private countdown: number;
  private active: boolean;
  private currentSection: number;
  private score: number;
  private multiplier: number;
  private waveResults: Array<{ section: string; success: boolean; chance: number }>;
  private gameState: GameStateManager;
  private aiManager?: AIManager;
  private gridManager?: GridManager;
  private scene?: Phaser.Scene; // Scene reference for sprite spawning
  private actorRegistry?: ActorRegistry; // ActorRegistry reference
  private eventListeners: Map<string, Array<Function>>;
  private propagating: boolean;
  // private seatManager?: SeatManager; // DELETED - logic moved to SectionActor
  private waveSprite?: WaveSprite; // WaveSprite instance
  private waveSpriteCreated: boolean = false;
  private pathSectionActors: any[] = []; // Track current path for jump logic (SectionActor[])
  private gridColumnSequence: Array<{ sectionActor: any; col: number; worldX: number }> = []; // Grid columns to traverse
  private currentGridColumnIndex: number = 0; // Current position in sequence
  private waveSputter: {
    active: boolean;
    columnsRemaining: number;
  };
  private currentWaveStrength: number;
  private waveCalculationResults: WaveCalculationResult[];
  private consecutiveFailedColumns: number;
  private lastSectionWaveState: 'success' | 'sputter' | 'death' | null;
  private lastColumnParticipationRate: number;
  private lastBoosterType: 'momentum' | 'recovery' | 'participation' | 'none';
  // New debug / forced event & booster flags
  private forceSputterNextSection: boolean;
  private forceDeathNextSection: boolean;
  private waveBoosterMultiplier: number; // overall participation multiplier for this wave (temporary)
  private lastTwoColumnParticipation: number[]; // rolling store of last 2 column participation rates
  private columnStateRecords: Array<{ sectionId: string; columnIndex: number; participation: number; state: 'success' | 'sputter' | 'death' }>; // debug/analytics

  // Autonomous wave system properties
  private lastWaveEndTime: number = 0; // timestamp when last wave completed
  private lastWaveCooldownDuration: number = 0; // cooldown duration for last wave
  private lastSectionStartTimes: Map<string, number> = new Map(); // per-section cooldown tracking
  private activeWave: Wave | null = null; // current wave instance
  private waveHistory: Wave[] = []; // completed wave instances
  private maxPossibleScore: number = 0; // cumulative max possible score
  private nextWaveId: number = 1; // auto-increment wave ID
  private lastProbabilityCheckLog: number = 0; // throttle logging
  private sessionStartTime: number = 0; // when session became active (for startup delay)

  /**
   * Creates a new WaveManager instance
   * @param gameState - The GameStateManager instance to use for wave calculations
   * @param aiManager - Optional AIManager instance to check for vendor interference
   * @param gridManager - Optional GridManager instance for grid-based wave sprites
   */
  constructor(gameState: GameStateManager, aiManager?: AIManager, gridManager?: GridManager, actorRegistry?: ActorRegistry) {
    this.countdown = gameBalance.waveTiming.triggerCountdown / 1000; // Convert ms to seconds
    this.active = false;
    this.currentSection = 0;
    this.score = 0;
    this.multiplier = 1.0;
    this.waveResults = [];
    this.gameState = gameState;
    this.aiManager = aiManager;
    this.gridManager = gridManager;
    // this.seatManager removed - logic in SectionActor
    this.eventListeners = new Map();
    this.propagating = false;
    this.actorRegistry = actorRegistry;
    this.waveSputter = {
      active: false,
      columnsRemaining: 0
    };
    this.currentWaveStrength = gameBalance.waveStrength.starting;
    this.waveCalculationResults = [];
    this.consecutiveFailedColumns = 0;
    this.lastSectionWaveState = null;
    this.lastColumnParticipationRate = 0;
    this.lastBoosterType = 'none';
    this.forceSputterNextSection = false;
    this.forceDeathNextSection = false;
    this.waveBoosterMultiplier = 1.0;
    this.lastTwoColumnParticipation = [];
    this.columnStateRecords = [];
  }

  /**
   * Per-frame update hook to advance sprite-driven wave movement.
   * Should be called by the scene each frame.
   */
  public update(delta: number): void {
    if (!this.waveSprite || typeof this.waveSprite.update !== 'function') {
      return; // Guard against undefined sprite
    }

    this.waveSprite.update(delta);
    // Sprite may have completed and been destroyed during update()
    if (!this.waveSprite) return;

    // Snap sprite to grid columns for discrete column-by-column movement
    if (this.gridColumnSequence.length > 0 && this.currentGridColumnIndex < this.gridColumnSequence.length) {
      let triggered = false;
      while (this.currentGridColumnIndex < this.gridColumnSequence.length) {
        const targetCol = this.gridColumnSequence[this.currentGridColumnIndex];
        const direction = this.activeWave ? this.activeWave.direction : 'right';
        // Check if sprite has passed or reached the current target column
        const spriteX = this.waveSprite.getPosition().x;
        const hasReachedColumn = direction === 'right'
          ? spriteX >= targetCol.worldX
          : spriteX <= targetCol.worldX;
        if (hasReachedColumn) {
          // Snap to exact grid column position
          this.waveSprite.setPosition(targetCol.worldX, this.waveSprite.getPosition().y);
          // Trigger wave participation for seats in this grid column
          this.triggerColumnWaveParticipation(targetCol);
          this.currentGridColumnIndex++;
          triggered = true;
        } else {
          break;
        }
      }
      // If we just finished the last column, and the sprite is at the end, ensure last column triggers
      if (this.currentGridColumnIndex === this.gridColumnSequence.length && triggered) {
        // Already triggered in loop above, nothing more needed
      }
    }
  }

  /**
   * Trigger wave participation checks for all seats in a specific grid column.
   * Uses GridManager to find seat occupants at this column position.
   */
  private triggerColumnWaveParticipation(colData: { sectionActor: any; col: number; worldX: number }): void {
    if (!this.gridManager) return;
    const sectionActor = colData.sectionActor;
    if (!sectionActor) {
      console.warn(`[WaveManager.triggerColumn] No sectionActor for colData`);
      return;
    }
    
    // Access seats directly through SectionActor's rowActors
    const sectionData = sectionActor.getSectionData();
    if (!sectionData) {
      console.warn(`[WaveManager.triggerColumn] No sectionData for ${sectionActor.id}`);
      return;
    }
    
    const colIndex = colData.col - sectionData.gridLeft;
    const rowActors = sectionActor.getRowActors();
    console.log(`[WaveManager.triggerColumn] Section ${sectionActor.getSectionId()} col ${colData.col} (localCol=${colIndex}), rowActors: ${rowActors.length}`);
    
    const seatsInColumn = rowActors
      .map((rowActor: any) => rowActor.getSeatAt(colIndex))
      .filter(Boolean);
    
    console.log(`[WaveManager.triggerColumn] Found ${seatsInColumn.length} seats in column ${colIndex}, emitting columnWaveReached`);
    
    this.emit('columnWaveReached', {
      sectionId: sectionActor.getSectionId(),
      gridCol: colData.col,
      worldX: colData.worldX,
      seatIds: seatsInColumn.map((s: any) => s.id),
      seatCount: seatsInColumn.length,
      waveStrength: this.getCurrentWaveStrength(),
      visualState: this.getColumnVisualState(this.waveSputter.active)
    });
  }

  /**
   * Returns whether the wave is currently active
   * @returns true if wave is active, false otherwise
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Returns the current countdown value
   * @returns The countdown in seconds
   */
  public getCountdown(): number {
    return this.countdown;
  }

  /**
   * Returns the current section index
   * @returns The section index (0, 1, or 2)
   */
  public getCurrentSection(): number {
    return this.currentSection;
  }

  /**
   * Returns the total score
   * @returns The current score
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * Returns the current multiplier
   * @returns The multiplier value
   */
  public getMultiplier(): number {
    return this.multiplier;
  }

  /**
   * Returns the wave results from the last propagation
   * @returns Array of section results
   */
  public getWaveResults(): Array<{ section: string; success: boolean; chance: number }> {
    return this.waveResults;
  }

  /**
   * Get the last section wave state
   */
  public getLastSectionWaveState(): 'success' | 'sputter' | 'death' | null {
    return this.lastSectionWaveState;
  }

  /**
   * Set the last section wave state
   */
  public setLastSectionWaveState(state: 'success' | 'sputter' | 'death' | null): void {
    this.lastSectionWaveState = state;
  }

  /**
   * Get the last column participation rate
   */
  public getLastColumnParticipationRate(): number {
    return this.lastColumnParticipationRate;
  }

  /**
   * Set the last column participation rate
   */
  public setLastColumnParticipationRate(rate: number): void {
    this.lastColumnParticipationRate = rate;
  }

  /** Force next section to start as sputter (debug) */
  public setForceSputter(flag: boolean): void {
    this.forceSputterNextSection = flag;
  }

  /** Force next section to start effectively dead (debug) */
  public setForceDeath(flag: boolean): void {
    this.forceDeathNextSection = flag;
  }

  /** Returns and clears forced flags for consumption at section start */
  public consumeForcedFlags(): { sputter: boolean; death: boolean } {
    const payload = { sputter: this.forceSputterNextSection, death: this.forceDeathNextSection };
    this.forceSputterNextSection = false;
    this.forceDeathNextSection = false;
    return payload;
  }

  /** Override current wave strength (debug panel) */
  public setWaveStrength(value: number): void {
    this.currentWaveStrength = Math.max(0, Math.min(100, value));
    this.emit('waveStrengthChanged', { strength: this.currentWaveStrength });
  }

  /** Apply a wave-only booster (non-stacking). Types map to config boosterPercents. */
  public applyWaveBooster(type: keyof typeof gameBalance.waveClassification.boosterPercents): void {
    const percent = gameBalance.waveClassification.boosterPercents[type] ?? 0;
    // Booster affects participation probability & recovery bonuses implicitly via multiplier
    this.waveBoosterMultiplier = 1 + percent;
    this.lastBoosterType = type as any;
    this.emit('waveBoosterApplied', { type, multiplier: this.waveBoosterMultiplier });
  }

  /** Clear booster after wave completes */
  public clearWaveBooster(): void {
    this.waveBoosterMultiplier = 1.0;
    this.lastBoosterType = 'none';
  }

  /** Get current booster multiplier */
  public getWaveBoosterMultiplier(): number {
    return this.waveBoosterMultiplier;
  }

  public getLastBoosterType(): 'momentum' | 'recovery' | 'participation' | 'none' {
    return this.lastBoosterType;
  }

  /**
   * Set session start time (for autonomous wave startup delay)
   */
  public setSessionStartTime(time: number): void {
    this.sessionStartTime = time;
    // legacy console logging removed
  }

  /** Classify a column participation rate */
  public classifyColumn(participation: number): 'success' | 'sputter' | 'death' {
    const cfg = gameBalance.waveClassification;
    if (participation >= cfg.columnSuccessThreshold) return 'success';
    if (participation >= cfg.columnSputterThreshold) return 'sputter';
    return 'death';
  }

  /** Record column state (for debug panel grid) */
  public recordColumnState(sectionId: string, columnIndex: number, participation: number, state: 'success' | 'sputter' | 'death'): void {
    this.columnStateRecords.push({ sectionId, columnIndex, participation, state });
    // Keep size bounded (24 max for 3 sections * 8 columns)
    if (this.columnStateRecords.length > 32) {
      this.columnStateRecords.splice(0, this.columnStateRecords.length - 32);
    }
    this.emit('columnStateRecorded', { sectionId, columnIndex, participation, state });
  }

  /** Retrieve column states for current wave */
  public getColumnStateRecords(): Array<{ sectionId: string; columnIndex: number; participation: number; state: 'success' | 'sputter' | 'death' }> {
    return this.columnStateRecords.slice();
  }

  /** Update rolling last-two participation average */
  public pushColumnParticipation(participation: number): void {
    this.lastTwoColumnParticipation.push(participation);
    if (this.lastTwoColumnParticipation.length > 2) {
      this.lastTwoColumnParticipation.shift();
    }
  }

  public getLastTwoAvgParticipation(): number {
    if (this.lastTwoColumnParticipation.length === 0) return 0;
    return this.lastTwoColumnParticipation.reduce((a, b) => a + b, 0) / this.lastTwoColumnParticipation.length;
  }

  /**
   * Check if the system is in global cooldown
   * Global cooldown = incoming cue duration + wave travel time + success/failure cooldown
   * @returns true if in cooldown, false otherwise
   */
  public isInGlobalCooldown(): boolean {
    if (!gameBalance.waveAutonomous.enabled) return true;
    if (this.lastWaveEndTime === 0) return false;

    const now = Date.now();
    const elapsed = now - this.lastWaveEndTime;
    const inCooldown = elapsed < this.lastWaveCooldownDuration;
    
    // legacy cooldown console logging removed
    
    return inCooldown;
  }

  /**
   * Check if a specific section can start a wave (per-section cooldown)
   * @param sectionId - The section to check
   * @returns true if section can start wave, false if in cooldown
   */
  public canSectionStartWave(sectionId: string): boolean {
    if (!gameBalance.waveAutonomous.enabled) {
      return false;
    }
    
    const lastStart = this.lastSectionStartTimes.get(sectionId);
    if (!lastStart) {
      return true;
    }

    const now = Date.now();
    const cooldown = gameBalance.waveAutonomous.sectionStartCooldown;
    const elapsed = now - lastStart;
    const canStart = elapsed >= cooldown;
    return canStart;
  }

  /**
   * Record wave end and start global cooldown
   * @param success - Whether wave completed successfully
   */
  public recordWaveEnd(success: boolean): void {
    const cooldown = success 
      ? gameBalance.waveAutonomous.successCooldown
      : gameBalance.waveAutonomous.failureCooldown;
    
    this.lastWaveEndTime = Date.now();
    this.lastWaveCooldownDuration = cooldown;
    
    // legacy wave end console logging removed
    
    // Emit event with cooldown info
    this.emit('waveCooldownStarted', { success, cooldown, endsAt: this.lastWaveEndTime + cooldown });
  }

  /**
   * Record section start time for per-section cooldown
   * @param sectionId - The section that initiated the wave
   */
  public recordSectionStart(sectionId: string): void {
    this.lastSectionStartTimes.set(sectionId, Date.now());
  }

  /**
   * Check wave probability for all sections and potentially trigger a wave
   * Sections are checked in random order, weighted by position preference
   * @returns The section that triggered a wave, or null if no wave triggered
   */
  public checkWaveProbability(): string | null {
    if (!gameBalance.waveAutonomous.enabled) {
      console.log('[WaveManager.checkWaveProbability] Autonomous waves disabled');
      return null;
    }
    if (this.active || this.propagating) {
      console.log('[WaveManager.checkWaveProbability] Wave already active or propagating');
      return null;
    }
    if (this.isInGlobalCooldown()) {
      console.log('[WaveManager.checkWaveProbability] In global cooldown');
      return null;
    }

    // 5-second startup delay after session begins
    if (this.sessionStartTime > 0) {
      const elapsed = Date.now() - this.sessionStartTime;
      const startupDelay = 5000; // 5 seconds
      if (elapsed < startupDelay) {
        // console.log(`[WaveManager.checkWaveProbability] Startup delay: ${elapsed}ms/${startupDelay}ms`);
        return null; // Too early, don't even check
      }
    }

    const sections = this.gameState.getSections();
    const now = Date.now();
    const shouldLog = (now - this.lastProbabilityCheckLog) > 1000; // Log max once per second

    if (shouldLog) {
      this.lastProbabilityCheckLog = now;
      console.log(`[WaveManager.checkWaveProbability] Checking ${sections.length} sections`);
    }

    // Create weighted section order
    // Build array of sections with their position weights
    const weightedSections = sections.map((section, i) => ({
      section,
      index: i,
      weight: Wave.getSectionPositionWeight(
        i,
        sections.length,
        gameBalance.waveAutonomous.sectionPositionWeights
      )
    }));

    // Sort by weight (descending) with random tiebreaker
    // This makes edges (higher weight) more likely to be checked first
    weightedSections.sort((a, b) => {
      if (Math.abs(a.weight - b.weight) < 0.01) {
        // Equal weights - randomize order
        return Math.random() - 0.5;
      }
      return b.weight - a.weight; // Higher weight first
    });

    // suppressed probability order logging

    // Check each section in weighted random order
    for (const { section, index } of weightedSections) {
      // Check per-section cooldown - skip if on cooldown
      const canStart = this.canSectionStartWave(section.id);
      if (!canStart) {
        // suppressed cooldown skip logging
        continue;
      }

      // Get section average happiness
      const avgHappiness = this.gameState.getSectionAverageHappiness(section.id);
      
      // Three probability bands based on happiness:
      // Low (<20%): 40% chance
      // Medium (20-60%): 60% chance
      // High (>60%): 90% chance
      let baseProbability: number;
      if (avgHappiness < 20) {
        baseProbability = 0.40;
      } else if (avgHappiness < 60) {
        baseProbability = 0.60;
      } else {
        baseProbability = 0.90;
      }

      // Roll for wave trigger
      const roll = Math.random();

      if (shouldLog) {
        // suppressed per-section probability detail logging
      }

      // Check if this section triggers a wave
      if (roll < baseProbability) {
        console.log(`[WaveManager.checkWaveProbability] Wave triggered by section ${section.id} (happiness: ${avgHappiness.toFixed(1)}%, roll: ${(roll*100).toFixed(1)}% < ${(baseProbability*100).toFixed(0)}%)`);
        return section.id;
      }
    }

    if (shouldLog) {
      console.log('[WaveManager.checkWaveProbability] No wave triggered this check');
    }
    return null;
  }

  /**
   * Create a new Wave instance and start wave propagation
   * @param originSectionId - The section where wave starts
   * @param type - Wave type (normal, super, double_down)
   * @returns The created Wave instance
   */
  public createWave(originSectionId: string, type: WaveType = 'NORMAL'): Wave {
    const sections = this.gameState.getSections();
    const allSectionIds = sections.map(s => s.id);
    
    // Calculate the wave path from origin section
    const wavePath = Wave.calculatePath(allSectionIds, originSectionId);
    
    const wave = new Wave(
      this.nextWaveId.toString(),
      type,
      originSectionId,
      wavePath,
      Date.now()
    );

    this.nextWaveId++; // Increment for next wave
    this.activeWave = wave;
    this.recordSectionStart(originSectionId);

    // Emit event for visuals (incoming cue)
    this.emit('waveCreated', { wave: wave.toJSON() });

    // Actually start the wave propagation!
    this.startWave();
    // suppressed wave creation logging

    return wave;
  }

  /**
   * Finalize current wave and move to history
   * @param success - Whether wave completed successfully
   */
  public finalizeWave(success: boolean): void {
    if (!this.activeWave) return;

    this.activeWave.complete(Date.now());
    this.waveHistory.push(this.activeWave);

    // Update max possible score
    this.maxPossibleScore += this.activeWave.getMaxPossibleScore();

    // Record cooldown
    this.recordWaveEnd(success);

    // Emit event
    this.emit('waveFinalized', { wave: this.activeWave.toJSON(), success });

    this.activeWave = null;
  }

  /**
   * Get current active wave
   */
  public getActiveWave(): Wave | null {
    return this.activeWave;
  }

  /**
   * Get wave history
   */
  public getWaveHistory(): Wave[] {
    return [...this.waveHistory];
  }

  /**
   * Get max possible score (for normalized scoring)
   */
  public getMaxPossibleScore(): number {
    return this.maxPossibleScore;
  }

  /**
   * Export all waves as JSON for debugging
   */
  public exportWavesJSON(): string {
    const data = {
      activeWave: this.activeWave?.toJSON() || null,
      history: this.waveHistory.map(w => w.toJSON()),
      maxPossibleScore: this.maxPossibleScore,
    };
    return JSON.stringify(data, null, 2);
  }

  /** Enhanced recovery check: sputter -> clean success triggers amplified bonus before next column */
  public calculateEnhancedRecovery(previousColumnState: 'success' | 'sputter' | 'death', currentColumnState: 'success' | 'sputter' | 'death'): number {
    if (previousColumnState === 'sputter' && currentColumnState === 'success') {
      return gameBalance.waveClassification.recoveryPowerMultiplier;
    }
    return 0;
  }

  /**
   * Check if wave participation rate triggers sputter mechanic
   * @param participationRate - Percentage of fans participating (0-1)
   * @returns true if sputter should activate
   */
  public checkWaveSputter(participationRate: number): boolean {
    // Sputter activates if participation drops below 40%
    if (participationRate < 0.40 && !this.waveSputter.active) {
      this.waveSputter.active = true;
      this.waveSputter.columnsRemaining = 3 + Math.floor(Math.random() * 3); // 3-5 columns
      return true;
    }
    return false;
  }

  /**
   * Get the current wave sputter state
   */
  public getWaveSputter(): { active: boolean; columnsRemaining: number } {
    return { ...this.waveSputter };
  }

  /**
   * Get the current wave strength
   */
  public getCurrentWaveStrength(): number {
    return this.currentWaveStrength;
  }

  /**
   * Get the current wave calculation results
   */
  public getWaveCalculationResults(): WaveCalculationResult[] {
    return [...this.waveCalculationResults];
  }

  /**
   * Adjust wave strength based on section result and participation
   * 
   * Logic:
   * - if lastState was 'success' (clean roll):
   *   - if success: increase strength slightly
   *   - if sputter: reduce strength
   * 
   * - if lastState was 'sputter':
   *   - if participation 40-60% (still sputtering): reduce strength
   *   - if participation < 40% (death range): greatly reduce strength
   *   - if participation > 60% (recovery): increase strength
   * 
   * - if lastState was 'death': keep strength very low
   */
  public adjustWaveStrength(currentState: 'success' | 'sputter' | 'death', participationRate: number): void {
    const lastState = this.lastSectionWaveState;
    const momentumBoost = this.waveBoosterMultiplier && this.waveBoosterMultiplier > 1 ? this.waveBoosterMultiplier : 1;
    
    if (lastState === 'success') {
      // Coming from a clean success
      if (currentState === 'success') {
        // Continue success: slight increase
        this.currentWaveStrength = Math.min(100, this.currentWaveStrength + 5 * momentumBoost);
      } else if (currentState === 'sputter') {
        // Dropped to sputter: reduce significantly
        this.currentWaveStrength = Math.max(0, this.currentWaveStrength - 15);
      } else if (currentState === 'death') {
        // Dropped to death: massive reduction
        this.currentWaveStrength = Math.max(0, this.currentWaveStrength - 30);
      }
    } else if (lastState === 'sputter') {
      // Coming from a sputter state - check participation
      if (participationRate >= 0.6) {
        // Recovered above sputter range: increase strength
        this.currentWaveStrength = Math.min(100, this.currentWaveStrength + 10 * momentumBoost);
      } else if (participationRate >= 0.4 && participationRate < 0.6) {
        // Still in sputter range: reduce slightly
        this.currentWaveStrength = Math.max(0, this.currentWaveStrength - 8);
      } else if (participationRate < 0.4) {
        // Dropped to death range: greatly reduce
        this.currentWaveStrength = Math.max(0, this.currentWaveStrength - 25);
      }
    } else if (lastState === 'death') {
      // Coming from death: if somehow above 60%, treat as sputter recovery
      if (participationRate >= 0.6) {
        this.currentWaveStrength = Math.min(100, this.currentWaveStrength + 15 * momentumBoost);
      } else if (participationRate >= 0.4) {
        // Treat as sputter if 40-60%
        this.currentWaveStrength = Math.max(0, this.currentWaveStrength - 10);
      } else {
        // Still in death: keep it low
        this.currentWaveStrength = Math.max(0, this.currentWaveStrength - 5);
      }
    }
    
    // Clamp strength to 0-100 range
    this.currentWaveStrength = Math.max(0, Math.min(100, this.currentWaveStrength));
  }

  /**
   * Update wave strength based on column participation rate
   * @param participationRate - Participation rate for the column (0-1)
   * @param wasFailureRecovery - Whether this column succeeded after previous failures
   * TODO: Integrate into wave propagation to track momentum during visual animation
   */
  private updateWaveStrength(participationRate: number, wasFailureRecovery: boolean = false): void {
    const config = gameBalance.waveStrength;
    const previousFailures = this.consecutiveFailedColumns;

    if (participationRate >= config.columnSuccessThreshold) {
      // Column succeeded
      this.currentWaveStrength += config.successBonus;
      this.consecutiveFailedColumns = 0;

      // Recovery bonus if succeeding after failures
      if (wasFailureRecovery && previousFailures > 0 && previousFailures <= config.recoveryMaximumFailures) {
        this.currentWaveStrength += config.recoveryBonus;
      }
    } else {
      // Column failed
      this.currentWaveStrength += config.failurePenalty;
      this.consecutiveFailedColumns++;
    }

    // Clamp strength to reasonable bounds
    this.currentWaveStrength = Math.max(0, Math.min(100, this.currentWaveStrength));
  }

  /**
   * Check if wave is dead (strength too low or too many consecutive failures)
   * TODO: Use this during wave propagation to determine visual animation state
   */
  private isWaveDead(): boolean {
    const config = gameBalance.waveStrength;
    return (
      this.currentWaveStrength < config.deathThreshold ||
      this.consecutiveFailedColumns >= config.consecutiveFailureThreshold
    );
  }

  /**
   * Determine visual state of column animation based on wave state
   * TODO: Implement visual states ('full' vs 'sputter' vs 'death') during column animation playback
   */
  private getColumnVisualState(isSputtering: boolean = false): 'full' | 'sputter' | 'death' {
    if (this.isWaveDead()) {
      return 'death';
    }
    if (isSputtering) {
      return 'sputter';
    }
    return 'full';
  }

  /**
   * Decrement sputter columns and check if sputter is still active
   */
  public decrementSputter(): void {
    if (this.waveSputter.active) {
      this.waveSputter.columnsRemaining--;
      if (this.waveSputter.columnsRemaining <= 0) {
        this.waveSputter.active = false;
      }
    }
  }

  /**
   * Starts a new wave
   * Sets the wave to active, resets countdown
   * For autonomous waves, uses the Wave instance's path
   * Emits 'waveStart' event
   */
  public startWave(): void {
    this.active = true;
    this.countdown = gameBalance.waveTiming.triggerCountdown / 1000; // Convert ms to seconds
    
    // If we have an active Wave instance, start from its origin section index
    // Otherwise default to section 0 (for manual/debug waves)
    if (this.activeWave) {
      const sections = this.gameState.getSections();
      const originIndex = sections.findIndex(s => s.id === this.activeWave!.originSection);
      this.currentSection = originIndex >= 0 ? originIndex : 0;
      // suppressed wave start logging
    } else {
      this.currentSection = 0;
    }
    
    this.currentWaveStrength = gameBalance.waveStrength.starting;
    this.waveCalculationResults = [];
    this.consecutiveFailedColumns = 0;
    this.waveSputter = { active: false, columnsRemaining: 0 };
    this.emit('waveStart', {});
    this.emit('waveStrengthChanged', { strength: this.currentWaveStrength });
  }

  /**
   * Set the scene reference for sprite spawning
   * @param scene - The Phaser scene instance
   */
  public setScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * Get the current wave sprite instance (for debug access)
   */
  public getWaveSprite(): any {
    return this.waveSprite;
  }

  /**
   * Updates the countdown timer
   * When countdown reaches 0, triggers wave propagation
   * @param deltaTime - Time elapsed in milliseconds
   */
  public async updateCountdown(deltaTime: number): Promise<void> {
    const seconds = deltaTime / 1000;
    this.countdown -= seconds;
    
    if (this.countdown <= 0) {
      // Spawn/reuse WaveSprite when countdown completes
      if (!this.propagating && this.scene && this.activeWave && this.gridManager && this.actorRegistry) {
        console.log('[WaveManager] Countdown complete, spawning WaveSprite');
        // Query SectionActor objects for the wave path
        const sectionActors = this.activeWave.path.map(sectionId =>
          this.actorRegistry!.query({ category: 'section' as any })
            .find((a: any) => a.getSectionId && a.getSectionId() === sectionId)
        ).filter(Boolean);
        this.spawnWaveSprite(this.scene, sectionActors);
        this.propagating = true; // Mark propagation as active
      }
    }
  }

  /**
   * Spawns a WaveSprite for horizontal wave sweep movement
   * Creates sprite with section bounds for collision detection
   * Subscribes to sprite events for section enter/exit tracking
   * @param scene - The Phaser scene to add sprite to
   * @param sectionActors - Array of SectionActor objects for path generation
   */
  public spawnWaveSprite(scene: Phaser.Scene, sectionActors: any[]): void {
    if (!this.gridManager) {
      console.warn('WaveManager: Cannot spawn WaveSprite without GridManager');
      return;
    }

    // Track current path SectionActors for jump logic
    this.pathSectionActors = sectionActors;

    // Build grid column sequence across all sections in path order
    this.gridColumnSequence = [];
    const direction = this.activeWave?.direction || 'right';

    for (const sectionActor of this.pathSectionActors) {
      if (!sectionActor) continue;
      const sectionData = sectionActor.getSectionData();
      if (!sectionData) continue;
      // Generate column sequence from grid bounds
      const columns = [];
      for (let col = sectionData.gridLeft; col <= sectionData.gridRight; col++) {
        const worldPos = this.gridManager.gridToWorld(sectionData.gridTop, col);
        columns.push({ col, worldX: worldPos.x });
      }
      // If moving left, reverse the column order for this section
      const orderedColumns = direction === 'right' ? columns : columns.slice().reverse();
      for (const colData of orderedColumns) {
        this.gridColumnSequence.push({
          sectionActor,
          col: colData.col,
          worldX: colData.worldX
        });
      }
    }

    if (this.gridColumnSequence.length === 0) {
      console.warn('WaveManager: No grid columns found in path');
      return;
    }

    console.log(`[WaveManager] Built grid sequence: ${this.gridColumnSequence.length} columns across ${sectionActors.length} sections`);

    // Get precise seat-based bounds for vertical line rendering
    const sectionBounds: Array<{ id: string; left: number; right: number; top: number; bottom: number }> = [];
    for (const sectionActor of this.pathSectionActors) {
      if (!sectionActor) continue;

      const sectionData = sectionActor.getSectionData();
      if (!sectionData) continue;
      const sectionId = sectionActor.getSectionId();

      const topLeft = this.gridManager.gridToWorld(sectionData.gridTop, sectionData.gridLeft);
      const bottomRight = this.gridManager.gridToWorld(sectionData.gridBottom, sectionData.gridRight);
      sectionBounds.push({
        id: sectionId,
        left: topLeft.x,
        right: bottomRight.x,
        top: topLeft.y,
        bottom: bottomRight.y
      });
    }

    if (sectionBounds.length === 0) {
      console.warn('WaveManager: No valid section bounds');
      return;
    }

    const lineTop = Math.min(...sectionBounds.map(s => s.top));
    const lineBottom = Math.max(...sectionBounds.map(s => s.bottom));

    // Start at first grid column, target is last grid column
    const startX = this.gridColumnSequence[0].worldX;
    const targetX = this.gridColumnSequence[this.gridColumnSequence.length - 1].worldX;
    this.currentGridColumnIndex = 0;
    
    console.log('[WaveManager] Start X:', startX, 'Target X:', targetX, 'Direction:', direction);
    
    // Only create WaveSprite once, then re-use
    if (!this.waveSpriteCreated) {
      const spriteConfig = gameBalance.waveSprite;
      this.waveSprite = new WaveSprite(
        scene,
        `wave-shared`,
        this.gridManager!,
        startX,
        (lineTop + lineBottom) / 2,
        {
          baseSpeed: spriteConfig.speed * 3, // triple speed for runtime effect
          waveStrength: this.getCurrentWaveStrength(),
          debugVisible: spriteConfig.visible,
          debugColor: spriteConfig.debugColor,
          debugAlpha: spriteConfig.debugAlpha,
          lineWidth: 3,
        }
      );
      this.waveSpriteCreated = true;
      // Set up event listeners for sprite-driven wave propagation
      // No-op for waveSpriteEntersSection (not needed)
      this.waveSprite.on('waveSpriteExitsSection', (data: { sectionId: string; x: number }) => {
        this.handleSpriteExitsSection(data.sectionId);
      });
      this.waveSprite.on('pathComplete', () => {
        this.handleWaveComplete();
      });
      // Configure and start
      this.waveSprite.setSections(sectionBounds);
      this.waveSprite.setLineBounds(lineTop, lineBottom);
      this.waveSprite.setTarget(direction, targetX);
      this.waveSprite.setWaveStrength(this.getCurrentWaveStrength());
      this.waveSprite.setPosition(startX, (lineTop + lineBottom) / 2);
      this.waveSprite.startMovement();
    } else if (this.waveSprite) {
      // Re-use existing sprite: reset and reconfigure
      console.log('[WaveManager] Reusing existing WaveSprite');
      this.waveSprite.resetState();
      this.waveSprite.setSections(sectionBounds);
      this.waveSprite.setLineBounds(lineTop, lineBottom);
      this.waveSprite.setWaveStrength(this.getCurrentWaveStrength());
      this.waveSprite.configure(startX, direction, targetX);
      this.waveSprite.startMovement();
      console.log('[WaveManager] WaveSprite reuse complete, movement started');
    }
  }

  private handleSpriteExitsSection(sectionId: string): void {
    console.log(`[WaveManager] handleSpriteExitsSection: ${sectionId}`);
    // Calculate section state from recorded column states for this section
    const sectionColumns = this.columnStateRecords.filter(r => r.sectionId === sectionId);
    let successCount = 0;
    let sputterCount = 0;
    let deathCount = 0;
    let totalParticipation = 0;
    for (const col of sectionColumns) {
      totalParticipation += col.participation;
      if (col.state === 'success') successCount++;
      else if (col.state === 'sputter') sputterCount++;
      else deathCount++;
    }
    // Determine overall section state based on column majority
    let sectionState: 'success' | 'sputter' | 'death' = 'death';
    if (successCount >= sputterCount && successCount >= deathCount) sectionState = 'success';
    else if (sputterCount >= deathCount) sectionState = 'sputter';
    const avgParticipation = sectionColumns.length > 0 ? totalParticipation / sectionColumns.length : 0;
    console.log(`[WaveManager] Section ${sectionId} complete: ${sectionState} (S:${successCount} SP:${sputterCount} D:${deathCount}, avg ${Math.round(avgParticipation*100)}%)`);
    
    // Trigger section visual effects based on result
    this.emit('sectionComplete', {
      sectionId,
      state: sectionState,
      avgParticipation,
      successCount,
      sputterCount,
      deathCount
    });
    
    // Update wave strength based on section result
    this.adjustWaveStrength(sectionState, avgParticipation);
    this.setLastSectionWaveState(sectionState);
    // Track results
    this.waveResults.push({
      section: sectionId,
      success: sectionState === 'success',
      chance: 0
    });
    // Handle failure
    if (sectionState === 'death') {
      this.multiplier = 1.0;
      // TODO: Stop wave sprite movement on death?
    }
    // Award points for successful sections
    if (sectionState === 'success') {
      this.score += 100;
      this.gameState.incrementSectionSuccesses();
      if (typeof window !== 'undefined') {
        console.log(`[DEBUG] Score incremented! New score: ${this.score}`);
      }
    }
    // No manual jump needed - grid column sequence handles inter-section gaps automatically
  }

  /**
   * Handle WaveSprite completing its path
   * Finalizes wave and emits completion event
   */
  private handleWaveComplete(): void {
    console.log('[WaveManager] handleWaveComplete');
    
    // Determine if wave was successful (no deaths)
    const waveSuccess = !this.waveResults.some(r => !r.success);

    // Emit full success event for camera shake if all sections succeeded
    if (waveSuccess) {
      this.emit('waveFullSuccess', {});
    }

    // Finalize the Wave instance if we have one
    if (this.activeWave) {
      this.finalizeWave(waveSuccess);
    } else {
      this.recordWaveEnd(waveSuccess);
    }

    this.emit('waveComplete', { results: this.waveResults });
    this.active = false;
    this.propagating = false;

    // Reset sprite state for reuse
    if (this.waveSprite) {
      this.waveSprite.resetState();
    }
  }

  /**
   * Emits an event to all registered listeners
   * @param event - The event name
   * @param data - The event data to pass to listeners
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /**
   * Subscribe to an event
   * @param event - The event name
   * @param callback - The callback function to invoke when event is emitted
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param event - The event name
   * @param callback - The callback function to remove
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
   * Emits an event and waits for all async listeners to complete
   * @param event - The event name
   * @param data - The event data to pass to listeners
   */
  private async emitAsync(event: string, data: any): Promise<void> {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      await Promise.all(listeners.map((callback) => callback(data)));
    }
  }

  /**
   * Returns a random number between 0 and 1
   * Can be overridden for testing purposes
   * @returns A random number between 0 and 1
   */
  protected getRandom(): number {
    return Math.random();
  }
}
