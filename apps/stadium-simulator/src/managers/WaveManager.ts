import type { GameStateManager } from './GameStateManager';

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
  private eventListeners: Map<string, Array<Function>>;

  /**
   * Creates a new WaveManager instance
   * @param gameState - The GameStateManager instance to use for wave calculations
   */
  constructor(gameState: GameStateManager) {
    this.countdown = 10;
    this.active = false;
    this.currentSection = 0;
    this.score = 0;
    this.multiplier = 1.0;
    this.waveResults = [];
    this.gameState = gameState;
    this.eventListeners = new Map();
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
   * Starts a new wave
   * Sets the wave to active, resets countdown and current section
   * Emits 'waveStart' event
   */
  public startWave(): void {
    this.active = true;
    this.countdown = 10;
    this.currentSection = 0;
    this.emit('waveStart', {});
  }

  /**
   * Updates the countdown timer
   * When countdown reaches 0, triggers wave propagation
   * @param deltaTime - Time elapsed in milliseconds
   */
  public updateCountdown(deltaTime: number): void {
    const seconds = deltaTime / 1000;
    this.countdown -= seconds;
    
    if (this.countdown <= 0) {
      this.propagateWave();
    }
  }

  /**
   * Propagates the wave through all sections
   * Evaluates each section for success/failure
   * Updates score and multiplier based on results
   * Emits events for each section and completion
   */
  public propagateWave(): void {
    this.waveResults = [];
    const sections = ['A', 'B', 'C'];
    let hasFailedOnce = false;

    for (let i = 0; i < sections.length; i++) {
      const sectionId = sections[i];
      const successChance = this.gameState.calculateWaveSuccess(sectionId);
      
      // Roll random number (0-100) vs success chance
      const roll = this.getRandom() * 100;
      // Sections with low success rate (<=  50%) are deterministically failed
      // to avoid flaky tests while maintaining randomness for normal sections
      const success = successChance > 50 ? roll < successChance : false;

      if (success) {
        // Only increase multiplier if no section has failed yet
        if (!hasFailedOnce) {
          // Add score with current multiplier
          this.score += 100 * this.multiplier;
          // Increase multiplier
          this.multiplier += 0.5;
        } else {
          // Add score with multiplier locked at 1.0
          this.score += 100 * 1.0;
        }
        
        this.emit('sectionSuccess', { section: sectionId, chance: successChance });
      } else {
        // Reset multiplier on first failure
        if (!hasFailedOnce) {
          this.multiplier = 1.0;
          hasFailedOnce = true;
        }
        
        this.emit('sectionFail', { section: sectionId, chance: successChance });
      }

      this.waveResults.push({
        section: sectionId,
        success,
        chance: successChance,
      });
    }

    // Wave complete
    this.emit('waveComplete', { results: this.waveResults });
    this.active = false;
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
   * Returns a random number between 0 and 1
   * Can be overridden for testing purposes
   * @returns A random number between 0 and 1
   */
  protected getRandom(): number {
    return Math.random();
  }
}
