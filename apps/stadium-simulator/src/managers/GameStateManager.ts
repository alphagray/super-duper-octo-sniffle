import type { GameState, Section } from '@/types/GameTypes';
import { gameBalance } from '@/config/gameBalance';

export type GameMode = 'eternal' | 'run';
export type SessionState = 'idle' | 'countdown' | 'active' | 'complete';

interface AggregateStats {
  happiness: number;
  thirst: number;
  attention: number;
}

interface SessionScore {
  grade: string;
  completedWaves: number;
  netHappiness: number;
  netAttention: number;
  netThirst: number;
  finalScore: number;
  maxPossibleScore: number;
  scorePercentage: number;
}

/**
 * Manages the game state including sections, wave mechanics, and scoring
 */
export class GameStateManager {
  private sections: Section[];
  private gameMode: GameMode = 'eternal';
  private sessionState: SessionState = 'idle';
  private sessionTimeRemaining: number = 0;
  private sessionStartTime: number = 0;
  private completedWaves: number = 0;
  private waveAttempts: number = 0;
  private totalSectionSuccesses: number = 0;
  private initialAggregateStats: AggregateStats | null = null;
  private eventListeners: Map<string, Array<Function>>;

  constructor() {
    // Initialize 3 sections (A, B, C) with default values
    this.sections = [
      { id: 'A', happiness: 70, thirst: 0, attention: 50 },
      { id: 'B', happiness: 70, thirst: 0, attention: 50 },
      { id: 'C', happiness: 70, thirst: 0, attention: 50 },
    ];
    this.eventListeners = new Map();
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
   * Happiness decreases 1 per second, thirst increases 2 per second
   * @param deltaTime - Time elapsed in milliseconds
   */
  public updateStats(deltaTime: number): void {
    const seconds = deltaTime / 1000;
    this.sections.forEach((section) => {
      section.happiness = this.clamp(section.happiness - (1 * seconds), 0, 100);
      section.thirst = this.clamp(section.thirst + (2 * seconds), 0, 100);
    });
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
   * Get current game mode
   */
  public getGameMode(): GameMode {
    return this.gameMode;
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
   * Get number of completed waves
   */
  public getCompletedWaves(): number {
    return this.completedWaves;
  }

  /**
   * Increment completed waves counter
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
   * Start a new session
   * @param mode - Game mode: 'eternal' or 'run'
   */
  public startSession(mode: GameMode): void {
    this.gameMode = mode;
    this.sessionState = 'countdown';
    this.completedWaves = 0;
    this.waveAttempts = 0;
    this.totalSectionSuccesses = 0;

    // Snapshot initial aggregate stats
    this.initialAggregateStats = this.getAggregateStats();

    // Set timer based on mode
    const duration =
      mode === 'run'
        ? gameBalance.sessionConfig.runModeDuration
        : gameBalance.sessionConfig.eternalModeDuration;

    this.sessionTimeRemaining = duration;
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

    if (this.gameMode === 'run') {
      this.sessionTimeRemaining -= deltaTime;

      if (this.sessionTimeRemaining <= 0) {
        this.sessionTimeRemaining = 0;
        this.completeSession();
      }

      this.emit('sessionTick', { timeRemaining: this.sessionTimeRemaining });
    }
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
      // Fall back to percentage-based grading
      // Estimate max possible waves: with 100s session and ~10s per wave cycle
      const maxPossibleWaves = Math.max(15, Math.ceil(this.gameMode === 'run' ? 100 / 10 : 15));
      const percentage = this.completedWaves / maxPossibleWaves;

      const percentThresholds = gameBalance.scoring.percentageThresholds;
      for (const [gradeKey, threshold] of Object.entries(percentThresholds)) {
        if (percentage >= threshold) {
          grade = gradeKey;
          break;
        }
      }
    }

    // Calculate final score
    const maxPossibleScore = gameBalance.scoring.basePointsPerWave * 10; // assume 10 waves max
    const finalScore = Math.round(this.completedWaves * gameBalance.scoring.basePointsPerWave);
    const scorePercentage = finalScore / maxPossibleScore;

    return {
      grade,
      completedWaves: this.completedWaves,
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
}
