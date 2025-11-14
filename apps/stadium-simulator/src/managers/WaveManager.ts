import type { GameStateManager } from './GameStateManager';
import type { VendorManager } from './VendorManager';
import type { SeatManager } from './SeatManager';
import { gameBalance } from '@/config/gameBalance';
import { Wave } from './Wave';
import type { WaveType } from './Wave';

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
  private vendorManager?: VendorManager;
  private eventListeners: Map<string, Array<Function>>;
  private propagating: boolean;
  private seatManager?: SeatManager;
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
   * @param vendorManager - Optional VendorManager instance to check for vendor interference
   * @param seatManager - Optional SeatManager instance for seat logic
   */
  constructor(gameState: GameStateManager, vendorManager?: VendorManager, seatManager?: SeatManager) {
    this.countdown = gameBalance.waveTiming.triggerCountdown / 1000; // Convert ms to seconds
    this.active = false;
    this.currentSection = 0;
    this.score = 0;
    this.multiplier = 1.0;
    this.waveResults = [];
    this.gameState = gameState;
    this.vendorManager = vendorManager;
    this.seatManager = seatManager;
    this.eventListeners = new Map();
    this.propagating = false;
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
    console.log('[WaveManager] Session started, 5s delay before autonomous waves');
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
    
    if (inCooldown) {
      const remaining = this.lastWaveCooldownDuration - elapsed;
      // Only log occasionally to avoid spam
      if (Math.floor(remaining / 1000) !== Math.floor((remaining + 16) / 1000)) {
        console.log(`[Global Cooldown] ${Math.ceil(remaining / 1000)}s remaining`);
      }
    }
    
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
    
    console.log(`[WaveManager] Wave ended (${success ? 'SUCCESS' : 'FAIL'}), cooldown: ${cooldown}ms`);
    
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
      return null;
    }
    if (this.active || this.propagating) {
      return null;
    }
    if (this.isInGlobalCooldown()) {
      return null;
    }

    // 5-second startup delay after session begins
    if (this.sessionStartTime > 0) {
      const elapsed = Date.now() - this.sessionStartTime;
      const startupDelay = 5000; // 5 seconds
      if (elapsed < startupDelay) {
        return null; // Too early, don't even check
      }
    }

    const sections = this.gameState.getSections();
    const now = Date.now();
    const shouldLog = (now - this.lastProbabilityCheckLog) > 1000; // Log max once per second

    if (shouldLog) {
      console.log('[Wave Probability] === CHECK START ===');
      this.lastProbabilityCheckLog = now;
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

    if (shouldLog) {
      console.log(`  Check order: ${weightedSections.map(ws => ws.section.id).join(' → ')}`);
    }

    // Check each section in weighted random order
    for (const { section, index } of weightedSections) {
      // Check per-section cooldown - skip if on cooldown
      const canStart = this.canSectionStartWave(section.id);
      if (!canStart) {
        if (shouldLog) console.log(`  ${section.id}: IN COOLDOWN (skipping)`);
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
        const band = baseProbability === 0.40 ? 'LOW' : baseProbability === 0.60 ? 'MED' : 'HIGH';
        console.log(`  ${section.id}: happiness=${avgHappiness.toFixed(1)}, band=${band} (${(baseProbability * 100).toFixed(0)}%), roll=${(roll * 100).toFixed(1)}%`);
      }

      // Check if this section triggers a wave
      if (roll < baseProbability) {
        console.log(`[Wave Probability] ${section.id}: WAVE TRIGGERED! 🌊`);
        return section.id;
      }
    }

    if (shouldLog) console.log('[Wave Probability] No trigger');
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
    console.log(`[WaveManager] Wave ${wave.id} created from ${originSectionId}, path: ${wavePath.join('→')}`);

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
      console.log(`[WaveManager] Starting wave from section ${this.activeWave.originSection} (index ${this.currentSection})`);
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
   * Updates the countdown timer
   * When countdown reaches 0, triggers wave propagation
   * @param deltaTime - Time elapsed in milliseconds
   */
  public async updateCountdown(deltaTime: number): Promise<void> {
    const seconds = deltaTime / 1000;
    this.countdown -= seconds;
    
    if (this.countdown <= 0) {
      await this.propagateWave();
    }
  }

  /**
   * Propagates the wave through sections sequentially
   * Uses the Wave instance's calculated path for direction
   * Each section is processed with a 1-second delay
   * Stops propagation if any section fails
   * Emits events for each section and completion
   */
  public async propagateWave(): Promise<void> {
    // Prevent re-entrant propagation (avoid duplicate scoring/events)
    if (this.propagating) return;
    this.propagating = true;

    this.waveResults = [];
    this.waveCalculationResults = [];
    
    // Use Wave instance path if available, otherwise default to A→B→C
    const sections = this.activeWave ? this.activeWave.path : ['A', 'B', 'C'];
    console.log(`[WaveManager] Propagating wave along path: ${sections.join('→')}`);
    
    let hasFailedOnce = false;

    for (let i = 0; i < sections.length; i++) {
      if (hasFailedOnce) break;
      const sectionId = sections[i];

      // Emit sectionWave event and wait for scene to determine actual participation
      // Scene will:
      // 1. Calculate per-fan participation using current wave strength
      // 2. Aggregate column participation to get section participation rate
      // 3. Determine state (success ≥60%, sputter 40-59%, death <40%)
      // 4. Call setLastSectionWaveState() and adjustWaveStrength() as needed
      // 5. Emit visual animations based on state
      await this.emitAsync('sectionWave', {
        section: sectionId,
        strength: this.getCurrentWaveStrength(),
        direction: this.activeWave ? this.activeWave.direction : 'right'
      });

      // Get the state that the scene determined and recorded
      const sectionState = this.getLastSectionWaveState();
      
      // Track results for wave completion
      this.waveResults.push({
        section: sectionId,
        success: sectionState === 'success',
        chance: 0 // Chance no longer pre-calculated
      });

      // Handle failure propagation (stop wave if failure occurs)
      if (sectionState === 'death') {
        if (!hasFailedOnce) {
          this.multiplier = 1.0;
          hasFailedOnce = true;
        }
      }

      // Award points for successful sections
      if (sectionState === 'success' && !hasFailedOnce) {
        this.score += 100;
        this.gameState.incrementSectionSuccesses();
      }
    }

    // Wave complete - determine success and record cooldown
    const waveSuccess = !hasFailedOnce;
    
    // Finalize the Wave instance if we have one
    if (this.activeWave) {
      this.finalizeWave(waveSuccess);
    } else {
      // Manual wave without Wave instance - just record cooldown
      this.recordWaveEnd(waveSuccess);
    }
    
    this.emit('waveComplete', { results: this.waveResults });
    this.active = false;
    this.propagating = false;
  }

  /**
   * Registers an event listener
   * @param event - The event name
   * @param callback - The callback function to invoke
   */
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
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
