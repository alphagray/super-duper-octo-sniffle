import type { Section } from '@/managers/interfaces/Section';
import type { SectionConfig } from '@/managers/interfaces/Section';
import { gameBalance } from '@/config/gameBalance';
import { LoggerService } from '@/services/LoggerService';

export type SessionState = 'idle' | 'countdown' | 'active' | 'complete';

interface AggregateStats {
  happiness: number;
  thirst: number;
  attention: number;
}

interface SessionScore {
  grade: string;
  completedWaves: number;
  maxPossibleWaves: number;
  netHappiness: number;
  netAttention: number;
  netThirst: number;
  finalScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
}

interface WaveBoost {
  happiness: number;
  attention: number;
  expiresAt: number;
}

/**
 * Manages the game state including sections, wave mechanics, and scoring
 */
export class GameStateManager {
  private sections: Section[];
  private sessionState: SessionState = 'idle';
  private sessionTimeRemaining: number = 0;
  private sessionStartTime: number = 0;
  private completedWaves: number = 0;
  private waveAttempts: number = 0;
  private totalSectionSuccesses: number = 0;
  private vendorScore: number = 0; // Track vendor service points
  private waveScore: number = 0;   // Track wave points
  private lostVendorPoints: number = 0; // Points lost due to vendor splats
  private lostWavePoints: number = 0;   // Points lost due to failed waves
  private initialAggregateStats: AggregateStats | null = null;
  private eventListeners: Map<string, Array<Function>>;
  private waveBoosts: Map<string, WaveBoost> = new Map(); // Track temporary boosts per section
  private logger = LoggerService.instance();
  
  // Cluster decay state (global coordination)
  private clusterDecayTimer: number = 0;

  constructor() {
    // Initialize empty sections array - will be populated by initializeSections()
    this.sections = [];
    this.eventListeners = new Map();
  }

  /**
   * Initialize sections from level data
   * @param sectionData Array of section configurations from LevelService
   */
  public initializeSections(sectionData: Array<{ id: string }>): void {
    this.sections = sectionData.map(data => ({
      id: data.id,
      happiness: 70,
      thirst: 0,
      attention: 50,
      environmentalModifier: 1.0 // Normal conditions by default
    }));
    this.logger.push({ 
      level: 'info', 
      category: 'system:gamestate', 
      message: `Initialized ${this.sections.length} sections from level data`, 
      ts: Date.now() 
    });
  }

  /**
   * Returns all sections
   */
  public getSections(): Section[] {
    return [...this.sections];
  }

  /**
   * Returns a specific section by id
   * @param id - The section identifier (A, B, or C)
   * @throws Error if section not found
   */
  public getSection(id: string): Section {
    const section = this.sections.find((s) => s.id === id);
    if (!section) {
      throw new Error(`Section ${id} not found`);
    }
    return section;
  }

  /**
   * Set environmental modifier for a section
   * @param sectionId - The section identifier (A, B, or C)
   * @param modifier - Environmental modifier (< 1.0 = shade, 1.0 = normal, > 1.0 = hot/sunny)
   */
  public setEnvironmentalModifier(sectionId: string, modifier: number): void {
    const section = this.getSection(sectionId);
    section.environmentalModifier = modifier;
    this.logger.push({
      level: 'info',
      category: 'system:gamestate',
      message: `Section ${sectionId} environmental modifier set to ${modifier.toFixed(2)}`,
      ts: Date.now()
    });
  }

  /**
   * Get environmental modifier for a section
   * @param sectionId - The section identifier (A, B, or C)
   * @returns The environmental modifier
   */
  public getEnvironmentalModifier(sectionId: string): number {
    const section = this.getSection(sectionId);
    return section.environmentalModifier;
  }

  /**
   * Calculates the wave success chance for a section
   * Formula: 80 + (happiness * 0.2) - (thirst * 0.3)
   * @param sectionId - The section identifier
   * @returns The success chance as a number (not percentage)
   */
  public calculateWaveSuccess(sectionId: string): number {
    const section = this.getSection(sectionId);
    return 80 + (section.happiness * 0.2) - (section.thirst * 0.3);
  }

  /**
   * Vendor serves a section, decreasing thirst and increasing happiness
   * @param sectionId - The section identifier
   */
  public vendorServe(sectionId: string): void {
    const section = this.getSection(sectionId);
    // Decrease thirst by 30, increase happiness by 10
    section.thirst = this.clamp(section.thirst - 30, 0, 100);
    section.happiness = this.clamp(section.happiness + 10, 0, 100);
  }

  /**
   * Updates all section stats based on time elapsed
   * - Thirst always increases (2 pts/sec)
   * - Happiness only decays when thirst > threshold (conditional decay)
   * - Peer pressure: section avg happiness ≥ threshold boosts all fans' attention in that section
   * - Wave completion boosts: temporary happiness/attention boosts with expiry
   * @param deltaTime - Time elapsed in milliseconds
   */
  public updateStats(deltaTime: number): void {
    const seconds = deltaTime / 1000;
    const now = Date.now();

    this.sections.forEach((section) => {
      // Always increase thirst
      section.thirst = this.clamp(section.thirst + (2 * seconds), 0, 100);

      // Conditional happiness decay (only when thirsty)
      if (section.thirst > gameBalance.waveAutonomous.thirstHappinessDecayThreshold) {
        const decayRate = gameBalance.waveAutonomous.thirstHappinessDecayRate;
        section.happiness = this.clamp(section.happiness - (decayRate * seconds), 0, 100);
      }

      // Apply wave completion boosts if active
      const boost = this.waveBoosts.get(section.id);
      if (boost) {
        if (now < boost.expiresAt) {
          // Boost is active - no additional stat change needed (boost applied at creation)
          // Just let it expire naturally
        } else {
          // Boost expired - remove from tracking
          this.waveBoosts.delete(section.id);
        }
      }
    });

    // Apply peer pressure mechanics (per section)
    this.updatePeerPressure(seconds);
  }

  /**
   * Apply peer pressure mechanics
   * When section avg happiness ≥ threshold, all fans in that section get attention boost
   * @param seconds - Time delta in seconds
   */
  private updatePeerPressure(seconds: number): void {
    const threshold = gameBalance.waveAutonomous.peerPressureHappinessThreshold;
    const attentionBoost = gameBalance.waveAutonomous.peerPressureAttentionBoost;

    this.sections.forEach((section) => {
      // Check if section avg happiness meets threshold
      // For now, section.happiness IS the section average (when we add individual fans, this will aggregate)
      if (section.happiness >= threshold) {
        section.attention = this.clamp(section.attention + (attentionBoost * seconds), 0, 100);
      }
    });
  }

  /**
   * Apply wave completion boost to a section
   * @param sectionId - The section to boost
   */
  public applyWaveCompletionBoost(sectionId: string): void {
    const section = this.getSection(sectionId);
    const happinessBoost = gameBalance.waveAutonomous.waveCompletionHappinessBoost;
    const attentionBoost = gameBalance.waveAutonomous.waveCompletionAttentionBoost;
    const duration = gameBalance.waveAutonomous.waveBoostDuration;

    // Apply instant boost
    section.happiness = this.clamp(section.happiness + happinessBoost, 0, 100);
    section.attention = this.clamp(section.attention + attentionBoost, 0, 100);

    // Track boost expiry
    this.waveBoosts.set(sectionId, {
      happiness: happinessBoost,
      attention: attentionBoost,
      expiresAt: Date.now() + duration,
    });
  }

  /**
   * Get section average happiness (for wave triggering probability)
   * @param sectionId - The section to check
   * @returns Average happiness (0-100)
   */
  public getSectionAverageHappiness(sectionId: string): number {
    const section = this.getSection(sectionId);
    // For now, section.happiness IS the average
    // When we add individual fans, this will aggregate fan happiness
    return section.happiness;
  }

  /**
   * Updates a specific stat on a specific section
   * @param id - The section identifier
   * @param stat - The stat to update (must be a key of Section excluding 'id')
   * @param value - The new value
   */
  public updateSectionStat(id: string, stat: keyof Section, value: number): void {
    const section = this.getSection(id);
    if (stat !== 'id') {
      (section[stat] as number) = value;
    }
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
   * Get current session state
   */
  public getSessionState(): SessionState {
    return this.sessionState;
  }

  /**
   * Get time remaining in session (in milliseconds)
   */
  public getSessionTimeRemaining(): number {
    return this.sessionTimeRemaining;
  }

  /**
   * Get elapsed time since session start in seconds
   * @returns Elapsed time in seconds
   */
  public getSessionElapsedTime(): number {
    if (this.sessionState === 'idle' || this.sessionState === 'complete') {
      return 0;
    }
    return (Date.now() - this.sessionStartTime) / 1000;
  }

  /**
   * Get round time for passing to update calls
   * @returns Negative value (time remaining) in timed mode, positive (elapsed) in eternal mode
   */
  public getRoundTime(): number {
    // For now, always return negative (time remaining) since we're in timed mode
    // TODO: Add eternal mode support
    return -this.sessionTimeRemaining / 1000; // Convert ms to seconds
  }

  /**
   * Get number of completed waves
   */
  public getCompletedWaves(): number {
    return this.completedWaves;
  }

  /**
   * Get vendor service score
   */
  public getVendorScore(): number {
    return this.vendorScore;
  }

  /** Get wave score */
  public getWaveScore(): number {
    return this.waveScore;
  }

  /** Get total combined score */
  public getTotalScore(): number {
    return this.vendorScore + this.waveScore - this.lostVendorPoints - this.lostWavePoints;
  }

  /**
   * Add points from vendor service
   */
  public addVendorScore(points: number): void {
    this.vendorScore += points;
    this.logger.push({
      level: 'info',
      category: 'system:score',
      message: `Vendor score: +${points} (total: ${this.vendorScore})`,
      ts: Date.now()
    });
  }

  /** Add points from successful waves */
  public addWaveScore(points: number): void {
    this.waveScore += points;
    this.logger.push({
      level: 'info',
      category: 'system:score',
      message: `Wave score: +${points} (total: ${this.waveScore})`,
      ts: Date.now()
    });
  }

  /** Track points lost due to vendor splats */
  public addLostVendorPoints(points: number): void {
    this.lostVendorPoints += points;
    this.logger.push({
      level: 'warn',
      category: 'system:score',
      message: `Lost vendor points: +${points} (total: ${this.lostVendorPoints})`,
      ts: Date.now()
    });
  }

  /** Track points lost due to wave crashes/failures */
  public addLostWavePoints(points: number): void {
    this.lostWavePoints += points;
    this.logger.push({
      level: 'warn',
      category: 'system:score',
      message: `Lost wave points: +${points} (total: ${this.lostWavePoints})`,
      ts: Date.now()
    });
  }

  /**
   * Increment wave count
   */
  public incrementCompletedWaves(): void {
    this.completedWaves++;
  }

  /**
   * Increment wave attempts counter
   */
  public incrementWaveAttempts(): void {
    this.waveAttempts++;
  }

  /**
   * Increment total section successes counter
   */
  public incrementSectionSuccesses(): void {
    this.totalSectionSuccesses++;
  }

  /**
   * Start a new session (run mode only)
   */
  public startSession(): void {
    this.sessionState = 'countdown';
    this.completedWaves = 0;
    this.waveAttempts = 0;
    this.totalSectionSuccesses = 0;

    // Snapshot initial aggregate stats
    this.initialAggregateStats = this.getAggregateStats();

    // Set timer for run mode (100 seconds)
    this.sessionTimeRemaining = gameBalance.sessionConfig.runModeDuration;
    this.sessionStartTime = Date.now();

    this.emit('sessionStateChanged', { state: 'countdown' });
  }

  /**
   * Activate the session (after countdown)
   */
  public activateSession(): void {
    this.sessionState = 'active';
    this.emit('sessionStateChanged', { state: 'active' });
  }

  /**
   * Update session timer
   * @param deltaTime - Time elapsed in milliseconds
   */
  public updateSession(deltaTime: number): void {
    if (this.sessionState !== 'active') {
      return;
    }

    this.sessionTimeRemaining -= deltaTime;

    if (this.sessionTimeRemaining <= 0) {
      this.sessionTimeRemaining = 0;
      this.completeSession();
    }

    this.emit('sessionTick', { timeRemaining: this.sessionTimeRemaining });
  }

  /**
   * Complete the current session
   */
  public completeSession(): void {
    this.sessionState = 'complete';
    this.emit('sessionStateChanged', { state: 'complete' });
  }

  /**
   * Calculate session score
   * @returns Session score details including grade and metrics
   */
  public calculateSessionScore(): SessionScore {
    const finalAggregateStats = this.getAggregateStats();

    if (!this.initialAggregateStats) {
      throw new Error('Cannot calculate score without initial stats snapshot');
    }

    // Calculate net changes
    const netHappiness = finalAggregateStats.happiness - this.initialAggregateStats.happiness;
    const netAttention = finalAggregateStats.attention - this.initialAggregateStats.attention;
    const netThirst = this.initialAggregateStats.thirst - finalAggregateStats.thirst; // inverted: lower is better

    // Calculate dynamic max waves based on session duration
    const sessionDuration = gameBalance.sessionConfig.runModeDuration;
    const maxPossibleWaves = gameBalance.scoring.calculateMaxWavesEstimate(sessionDuration);

    // Determine grade based on completed waves
    let grade = 'F';
    const waveThresholds = gameBalance.scoring.gradeThresholds;

    if (this.completedWaves >= waveThresholds['S+']) {
      grade = 'S+';
    } else if (this.completedWaves >= waveThresholds['S']) {
      grade = 'S';
    } else if (this.completedWaves >= waveThresholds['S-']) {
      grade = 'S-';
    } else {
      // Fall back to percentage-based grading using dynamic max waves estimate
      const percentage = this.completedWaves / maxPossibleWaves;

      // Sort thresholds in descending order to ensure deterministic grade assignment
      const percentThresholds = gameBalance.scoring.percentageThresholds;
      const sortedThresholds = Object.entries(percentThresholds).sort((a, b) => b[1] - a[1]);
      for (const [gradeKey, threshold] of sortedThresholds) {
        if (percentage >= threshold) {
          grade = gradeKey;
          break;
        }
      }
    }

    // Calculate final score using dynamic max waves estimate
    const maxPossibleScore = gameBalance.scoring.basePointsPerWave * maxPossibleWaves;
    const finalScore = Math.round(this.completedWaves * gameBalance.scoring.basePointsPerWave);
    const scorePercentage = finalScore / maxPossibleScore;

    return {
      grade,
      completedWaves: this.completedWaves,
      maxPossibleWaves,
      netHappiness,
      netAttention,
      netThirst,
      finalScore,
      maxPossibleScore,
      scorePercentage,
    };
  }

  /**
   * Get aggregate stats across all sections
   * @returns Average stats across sections
   */
  private getAggregateStats(): AggregateStats {
    const happiness = this.sections.reduce((sum, s) => sum + s.happiness, 0) / this.sections.length;
    const thirst = this.sections.reduce((sum, s) => sum + s.thirst, 0) / this.sections.length;
    const attention = this.sections.reduce((sum, s) => sum + s.attention, 0) / this.sections.length;

    return { happiness, thirst, attention };
  }

  /**
   * Clamps a value between min and max
   * @param value - The value to clamp
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns The clamped value
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Trigger cluster decay for sections in randomized order with diminishing returns
   * Called from AIManager.update() to coordinate decay across all sections
   */
  public updateClusterDecay(delta: number, sessionTime: number, actorRegistry: any): void {
    this.clusterDecayTimer += delta;
    
    // Get interval based on session progress
    const progress = sessionTime / gameBalance.sessionConfig.runModeDuration;
    const interval = progress >= gameBalance.clusterDecay.lateGameThreshold
      ? gameBalance.clusterDecay.lateInterval
      : gameBalance.clusterDecay.earlyInterval;
    
    if (this.clusterDecayTimer < interval) {
      return; // Not time yet
    }
    
    this.clusterDecayTimer = 0;
    
    // Get all section actors and randomize order
    const sectionActors = actorRegistry?.getByCategory('section') || [];
    if (sectionActors.length === 0) return;
    
    const shuffled = [...sectionActors].sort(() => Math.random() - 0.5);
    
    // Roll for decay with diminishing chance for each section
    let diminishingMultiplier = 1.0;
    for (const sectionActor of shuffled) {
      // Roll for decay with diminishing returns
      const roll = Math.random();
      const threshold = 0.6 * diminishingMultiplier; // 60% base chance, reduced per section
      
      if (roll < threshold) {
        // This section triggers decay
        sectionActor.flagForDecay?.();
        // Apply diminishing returns: next section has 60% of the chance
        diminishingMultiplier *= 0.6;
      }
    }
  }
}
