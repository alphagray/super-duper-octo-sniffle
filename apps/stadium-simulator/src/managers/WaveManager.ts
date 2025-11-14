import type { GameStateManager } from './GameStateManager';
import type { VendorManager } from './VendorManager';
import type { SeatManager } from './SeatManager';

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

  /**
   * Creates a new WaveManager instance
   * @param gameState - The GameStateManager instance to use for wave calculations
   * @param vendorManager - Optional VendorManager instance to check for vendor interference
   * @param seatManager - Optional SeatManager instance for seat logic
   */
  constructor(gameState: GameStateManager, vendorManager?: VendorManager, seatManager?: SeatManager) {
    this.countdown = 10;
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
   * Sets the wave to active, resets countdown and current section
   * Emits 'waveStart' event
   */
  public startWave(): void {
    this.active = true;
    this.countdown = 10;
    this.currentSection = 0;
    this.waveSputter = { active: false, columnsRemaining: 0 };
    this.emit('waveStart', {});
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
   * Each section is processed with a 1-second delay
   * Stops propagation if any section fails
   * Emits events for each section and completion
   */
  public async propagateWave(): Promise<void> {
    // Prevent re-entrant propagation (avoid duplicate scoring/events)
    if (this.propagating) return;
    this.propagating = true;

    this.waveResults = [];
    const sections = ['A', 'B', 'C'];
    let hasFailedOnce = false;

    for (let i = 0; i < sections.length; i++) {
      if (hasFailedOnce) break;
      const sectionId = sections[i];
      let successChance = this.gameState.calculateWaveSuccess(sectionId);

      // Check for vendor interference
      if (this.vendorManager?.isVendorInSection(sectionId)) {
        successChance -= 25; // 25% penalty
      }

      // Roll random number (0-100) vs success chance
      const roll = this.getRandom() * 100;
      const success = successChance > 50 ? roll < successChance : false;

      if (success) {
        if (!hasFailedOnce) {
          this.score += 100;
        }
        await this.emitAsync('sectionSuccess', { section: sectionId, chance: successChance });
      } else {
        if (!hasFailedOnce) {
          this.multiplier = 1.0;
          hasFailedOnce = true;
        }
        await this.emitAsync('sectionFail', { section: sectionId, chance: successChance });
      }

      this.waveResults.push({ section: sectionId, success, chance: successChance });
    }

    // Wave complete
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
