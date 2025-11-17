import Phaser from 'phaser';
import { SectionConfig } from '@/managers/interfaces/Section';
import { gameBalance } from '@/config/gameBalance';
import type { Fan } from './Fan';
import type { SeatActor } from './Seat';

/**
 * StadiumSection is a container sprite that manages:
 * - Rendering graduated stripe backgrounds with gradient dividers
 * - Population and management of 32 fan sprites (4 rows × 8 columns)
 * - Visual effects (wave animations, flash effects, particle bursts)
 * - Vendor placement indicators
 */
export class StadiumSection extends Phaser.GameObjects.Container {
  private sectionId: string;
  private sectionWidth: number;
  private sectionHeight: number;
  private config: SectionConfig;
  private rows: Array<{
    rowIndex: number;
    seats: SeatActor[];
    getSeats(): SeatActor[];
    getFans(): Fan[];
    updateFanIntensity(value: number): void;
  }> = [];
  private waveColumnStates: Map<number, 'success' | 'sputter' | 'death'> = new Map();
  private expectedColumnCount: number = 0;
  private currentWaveActive: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: SectionConfig,
    sectionId: string
  ) {
    super(scene, x, y);
    this.sectionId = sectionId;
    this.sectionWidth = config.width;
    this.sectionHeight = config.height;
    this.config = {
      rowCount: config.rowCount ?? 4,
      seatsPerRow: config.seatsPerRow ?? 8,
      width: config.width,
      height: config.height,
      rowBaseHeightPercent: config.rowBaseHeightPercent ?? 0.15,
      startLightness: Math.max(30, Math.min(90, config.startLightness ?? 62)),
      autoPopulate: config.autoPopulate ?? true,
    };
    this.expectedColumnCount = config.seatsPerRow ?? 8;

    this.initializeRows(scene);
    scene.add.existing(this);
  }

  /**
   * Get the section ID
   */
  public getId(): string {
    return this.sectionId;
  }

  /**
   * Initializes SectionRow objects and adds them to the container
   * TODO: This will be replaced by SectionRowActor initialization in SectionActor
   */
  private initializeRows(scene: Phaser.Scene): void {
    const rowCount = this.config.rowCount ?? 4;
    const seatsPerRow = this.config.seatsPerRow ?? 8;
    
    // Stub: Create empty row structures
    // Real row/seat creation happens in SectionActor.populateFromData()
    for (let i = 0; i < rowCount; i++) {
      this.rows.push({
        rowIndex: i,
        seats: [],
        getSeats: () => this.rows[i]?.seats || [],
        getFans: () => this.rows[i]?.seats.map(s => s.getFan()).filter((f): f is Fan => f !== null) || [],
        updateFanIntensity: (value: number) => {
          this.rows[i]?.seats.forEach(seat => {
            const fan = seat.getFan();
            if (fan) fan.setIntensity(value);
          });
        }
      });
    }
  }

  /**
   * Get all SectionRow objects
   */
  public getRows(): Array<{
    rowIndex: number;
    seats: SeatActor[];
    getSeats(): SeatActor[];
    getFans(): Fan[];
    updateFanIntensity(value: number): void;
  }> {
    return this.rows;
  }

  /**
   * Gets all fans in this section
   */
  public getFans(): any[] {
    return this.rows.flatMap(row => row.getFans());
  }

  /**
   * Gets fans in a specific row
   */
  public getFanRow(rowIndex: number): any[] {
    if (this.rows[rowIndex]) {
      return this.rows[rowIndex].getFans();
    }
    return [];
  }

  /**
   * Calculate aggregate stats from all fans in this section
   */
  public getAggregateStats(): { happiness: number; thirst: number; attention: number } {
    const allFans = this.getFans();
    if (allFans.length === 0) {
      return { happiness: 50, thirst: 50, attention: 50 };
    }

    let totalHappiness = 0;
    let totalThirst = 0;
    let totalAttention = 0;

    for (const fan of allFans) {
      const stats = fan.getStats();
      totalHappiness += stats.happiness;
      totalThirst += stats.thirst;
      totalAttention += stats.attention;
    }

    return {
      happiness: totalHappiness / allFans.length,
      thirst: totalThirst / allFans.length,
      attention: totalAttention / allFans.length
    };
  }

  /**
   * Calculate section bonus for individual fan wave participation
   * Higher happiness and attention, lower thirst = higher bonus
   */
  public getSectionWaveBonus(): number {
    const aggregate = this.getAggregateStats();
    // Section bonus is 20% of aggregate happiness + attention, minus 15% of thirst
    return (aggregate.happiness * 0.2 + aggregate.attention * 0.2) - (aggregate.thirst * 0.15);
  }

  /**
   * Update all fan stats (thirst, happiness, attention decay)
   */
  public updateFanStats(deltaTime: number): void {
    const allFans = this.getFans();
    for (const fan of allFans) {
      fan.updateStats(deltaTime);
    }
  }

  /**
   * Updates intensity for all fans in this section
   * Now uses personal thirst if no intensity provided
   */
  public updateFanIntensity(intensity?: number): void {
    if (intensity !== undefined) {
      this.rows.forEach(row => row.updateFanIntensity(intensity));
    } else {
      // Update each fan based on their personal thirst
      const allFans = this.getFans();
      for (const fan of allFans) {
        fan.setIntensity();
      }
    }
  }

  /**
   * Resets wave-related state on all fans before new wave calculations
   * Clears reducedEffort flag and wave strength modifier for clean state
   */
  public resetFanWaveState(): void {
    const allFans = this.getFans();
    for (const fan of allFans) {
      fan.reducedEffort = false;
      fan.setWaveStrengthModifier(0);
    }
  }

  /**
   * Calculate participation for a specific column with peer pressure logic
   * @param columnIndex - The column index (0-7)
   * @param waveStrength - Current wave strength for strength modifier
   * @returns Array of fan objects with their participation state and intensity
   */
  public calculateColumnParticipation(
    columnIndex: number,
    waveStrength: number
  ): Array<{ fan: Fan; willParticipate: boolean; intensity: number }> {
    const sectionBonus = this.getSectionWaveBonus();
    const strengthModifier = (waveStrength - 50) * gameBalance.waveStrength.strengthModifier;
    const rows = this.getRows();
    const result: Array<{ fan: Fan; willParticipate: boolean; intensity: number }> = [];

    // First pass: roll participation for all fans in column
    let participatingCount = 0;
    const fanStates: Array<{ fan: Fan; willParticipate: boolean }> = [];

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const seats = row.getSeats();
      if (columnIndex < seats.length) {
        const seat = seats[columnIndex];
        if (!seat.isEmpty()) {
          const fan = seat.getFan();
          if (fan) {
            // Apply wave strength modifier
            fan.setWaveStrengthModifier(strengthModifier);
            // Roll for participation
            const willParticipate = fan.rollForWaveParticipation(sectionBonus);
            fanStates.push({ fan, willParticipate });
            if (willParticipate) {
              participatingCount++;
            }
            // Debug: log each fan's participation roll
            if (typeof window !== 'undefined') {
              console.log(`[DEBUG] Fan at row ${rowIdx} col ${columnIndex} (section ${this.sectionId}) willParticipate=${willParticipate}`);
            }
          }
        }
      }
    }

    // Second pass: apply peer pressure if threshold met
    const columnSize = fanStates.length;
    const peerPressureThreshold = gameBalance.waveStrength.peerPressureThreshold;
    const participationRate = columnSize > 0 ? participatingCount / columnSize : 0;

    if (participationRate >= peerPressureThreshold) {
      // This column succeeded, non-participating fans join at reduced effort
      for (const state of fanStates) {
        if (!state.willParticipate) {
          state.willParticipate = true;
          state.fan.reducedEffort = true;
        }
      }
    }

    // Build result with intensity
    for (const state of fanStates) {
      result.push({
        fan: state.fan,
        willParticipate: state.willParticipate,
        intensity: state.fan.reducedEffort ? 0.5 : 1.0,
      });
    }

    // Debug: log summary for this column
    if (typeof window !== 'undefined') {
      console.log(`[DEBUG] Section ${this.sectionId} col ${columnIndex}: ${participatingCount}/${fanStates.length} fans participating`);
    }
    return result;
  }

  /**
   * Plays wave animation for a specific column with fan participation states
   * @param columnIndex - The column index
   * @param fanStates - Array of fans with participation info
   * @param visualState - Visual state for animation ('full', 'sputter', 'death')
   * @param waveStrength - Current wave strength (0-100) for height scaling
   */
  public async playColumnAnimation(
    columnIndex: number,
    fanStates: Array<{ fan: Fan; willParticipate: boolean; intensity: number }>,
    visualState: 'full' | 'sputter' | 'death' = 'full',
    waveStrength: number = 70
  ): Promise<void> {
    const baseRowDelay = gameBalance.waveTiming.rowDelay;
    const columnPromises: Promise<void>[] = [];

    // Determine animation completion time based on visual state
    let animationDuration: number;
    switch (visualState) {
      case 'sputter':
        animationDuration = 378; // 108ms up + 270ms down
        break;
      case 'death':
        animationDuration = 252; // 72ms up + 180ms down
        break;
      case 'full':
      default:
        animationDuration = 420; // 120ms up + 300ms down
        break;
    }

    // Get row count for proper staggering
    const rows = this.getRows();

    let animCount = 0;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const state = fanStates[rowIdx];
      if (state && state.willParticipate && state.fan) {
        const delayMs = rowIdx * baseRowDelay;
        columnPromises.push(state.fan.playWave(delayMs, state.intensity, visualState, waveStrength));
        animCount++;
        // Call onWaveParticipation after animation completes
        this.scene.time.delayedCall(delayMs + animationDuration, () => {
          state.fan.onWaveParticipation(state.willParticipate);
        });
      }
    }
    if (typeof window !== 'undefined') {
      console.log(`[DEBUG] playColumnAnimation: section ${this.sectionId} col ${columnIndex} animating ${animCount} fans`);
    }

    // Start all fans in this column (don't await - allows smooth overlapping animations)
    Promise.all(columnPromises).catch(err => {
      console.error('Error during column animation:', err);
    });
  }

  /**
   * Plays wave animation for all fans with column-based stagger
   * Now tracks individual fan participation (kept for backwards compatibility)
   */
  public async playWave(): Promise<{ participatingFans: number; totalFans: number; participationRate: number }> {
    // Reset fan wave state for clean participation calculations
    this.resetFanWaveState();

    const baseColumnDelay = gameBalance.waveTiming.columnDelay;
    const baseRowDelay = gameBalance.waveTiming.rowDelay;
    const columnDelay = baseColumnDelay;
    const rowDelay = baseRowDelay;

    const sectionBonus = this.getSectionWaveBonus();
    let participatingFans = 0;
    let totalFans = 0;

    // PRE-CALCULATE participation for all fans before any animation
    const rows = this.getRows();
    const maxSeats = rows[0]?.getSeats().length ?? 0;
    
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const seats = row.getSeats();
      for (let col = 0; col < seats.length; col++) {
        const seat = seats[col];
        if (!seat.isEmpty()) {
          const fan = seat.getFan();
          if (fan) {
            totalFans++;
            // Pre-roll participation
            if (fan.rollForWaveParticipation(sectionBonus)) {
              participatingFans++;
            }
          }
        }
      }
    }

    // Now animate the wave smoothly, column by column
    for (let col = 0; col < maxSeats; col++) {
      const columnPromises: Promise<void>[] = [];

      // For each row, animate the seat at this column if they're participating
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const seats = row.getSeats();
        if (col < seats.length) {
          const seat = seats[col];
          if (!seat.isEmpty()) {
            const fan = seat.getFan();
            if (fan && fan._lastWaveParticipated) {
              const delayMs = rowIdx * rowDelay;
              columnPromises.push(fan.playWave(delayMs));
            }
          }
        }
      }

      // Start all fans in this column (don't await - allows smooth overlapping animations)
      Promise.all(columnPromises).catch(err => {
        console.error('Error during wave animation:', err);
      });
      
      // Delay before next column
      if (col < maxSeats - 1) {
        await new Promise(resolve => {
          this.scene.time.delayedCall(columnDelay, resolve);
        });
      }
    }

    // Wait a short buffer for the final column to start before reporting completion
    await new Promise(resolve => {
      this.scene.time.delayedCall(40, resolve);
    });

    const participationRate = totalFans > 0 ? participatingFans / totalFans : 0;
    return { participatingFans, totalFans, participationRate };
  }

  /**
   * Play a named animation on this section
   * @param animationName - The name of the animation ('flash-success', 'flash-fail', etc.)
   * @param options - Optional parameters for the animation
   */
  public playAnimation(animationName: string, options?: Record<string, any>): Promise<void> | void {
    switch (animationName) {
      case 'flash-success':
        return this.flashSuccess();
      
      case 'flash-fail':
        return this.flashFail();
      
      default:
        console.warn(`Unknown animation '${animationName}' for StadiumSection`);
        return Promise.resolve();
    }
  }

  /**
   * Flash the border of the section green after all fans have played their animation
   */
  public async flashSuccess(): Promise<void> {
    return new Promise(resolve => {
      // Create particle burst at section center
      this.createParticleBurst(0x00ff00);

      // Delay flash until all fans have played their animation
      // (Assume playWave is called before this and awaited)
      const border = this.scene.add.rectangle(this.x, this.y, this.sectionWidth + 8, this.sectionHeight + 8);
      border.setStrokeStyle(6, 0x00ff00, 0.95);
      border.setDepth(9999);
      this.scene.tweens.add({
        targets: border,
        alpha: { from: 0.95, to: 0 },
        duration: 350,
        onComplete: () => {
          border.destroy();
          resolve();
        }
      });
    });
  }

  /**
   * Flash the border of the section red after all fans have played their animation
   */
  public async flashFail(): Promise<void> {
    return new Promise(resolve => {
      // Create particle burst at section center
      this.createParticleBurst(0xff0000);

      // Delay flash until all fans have played their animation
      // (Assume playWave is called before this and awaited)
      const border = this.scene.add.rectangle(this.x, this.y, this.sectionWidth + 8, this.sectionHeight + 8);
      border.setStrokeStyle(6, 0xff0000, 0.95);
      border.setDepth(9999);
      this.scene.tweens.add({
        targets: border,
        alpha: { from: 0.95, to: 0 },
        duration: 350,
        onComplete: () => {
          border.destroy();
          resolve();
        }
      });
    });
  }

  /**
   * Show vendor placed indicator (if needed)
   */
  public placedVendor(vendorId: number): void {
    // Placeholder for vendor indicator
    // Could add a text or icon to show vendor is here
  }

  /**
   * Creates a particle burst effect at the section center
   */
  private createParticleBurst(color: number): void {
    const particleCount = 20;
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = 100 + Math.random() * 50;

      const particle = this.scene.add.circle(this.x, this.y, 4, color);

      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => {
          particle.destroy();
        }
      });
    }
  }
}
