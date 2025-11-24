import { SceneryActor } from '@/actors/base/Actor';
import { StadiumSection } from '@/sprites/StadiumSection';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { FanData } from '@/services/LevelService';
import { Fan } from '@/sprites/Fan';
import { FanActor } from '@/actors/FanActor';
import { SeatActor } from '@/sprites/Seat';
import { SectionRowActor } from './SectionRowActor';

/**
 * SectionActor: Primary game logic for a stadium section.
 * Handles seat/fan population from data, provides queries for AI/wave systems.
 * Now owns its sprite (StadiumSection) via composition.
 */
export class SectionActor extends SceneryActor {
  private section: StadiumSection;
  private sectionId: string;
  private rowActors: SectionRowActor[] = [];
  // Sprite instances (visual only)
  private fans: Map<string, Fan> = new Map();
  // Actor instances (game logic)
  private fanActors: Map<string, FanActor> = new Map();
  private gridManager?: any;
  private sectionData: any;
  private labelText?: Phaser.GameObjects.Text;
  private happinessAgg: number = 0;
  private thirstAgg: number = 0;
  private attentionAgg: number = 0;

  constructor(
    id: string,
    scene: Phaser.Scene,
    sectionData: any, // Should be SectionData
    gridManager?: any,
    category: ActorCategory = 'section',
    enableLogging = false
  ) {
    super(id, 'section', category, sectionData.gridTop, sectionData.gridLeft, enableLogging);
    this.sectionId = sectionData.id;
    this.gridManager = gridManager;
    this.sectionData = sectionData;
    // Calculate world position from grid boundaries
    // Section container is centered, so calculate center point of grid rectangle
    const topLeft = gridManager ? gridManager.gridToWorld(sectionData.gridTop, sectionData.gridLeft) : { x: 0, y: 0 };
    const bottomRight = gridManager ? gridManager.gridToWorld(sectionData.gridBottom, sectionData.gridRight) : { x: 256, y: 200 };
    const worldPos = {
      x: (topLeft.x + bottomRight.x) / 2,
      y: (topLeft.y + bottomRight.y) / 2
    };
    const rowCount = sectionData.gridBottom - sectionData.gridTop + 1;
    const seatsPerRow = sectionData.gridRight - sectionData.gridLeft + 1;
    const cellSize = gridManager ? gridManager.getWorldSize().cellSize : 32;
    const sectionWidth = seatsPerRow * cellSize;
    const sectionHeight = rowCount * cellSize;
    this.section = new StadiumSection(scene, worldPos.x, worldPos.y, {
      width: sectionWidth,
      height: sectionHeight,
      rowCount,
      seatsPerRow,
      rowBaseHeightPercent: 0.15,
      startLightness: 62,
      autoPopulate: false,
    }, sectionData.id);
    this.sprite = this.section;
    // Create label using grid boundaries and label from data
    if (gridManager) {
      const topLeft = gridManager.gridToWorld(sectionData.gridTop, sectionData.gridLeft);
      const topRight = gridManager.gridToWorld(sectionData.gridTop, sectionData.gridRight);
      const labelX = (topLeft.x + topRight.x) / 2;
      const labelY = topLeft.y - 96;
      this.labelText = scene.add.text(labelX, labelY, sectionData.label, {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);
      // Register section with grid
      gridManager.addOccupant(sectionData.gridTop, sectionData.gridLeft, {
        id: this.id,
        type: 'section',
        metadata: { sectionId: sectionData.id }
      });
    }
    this.logger.debug(`SectionActor created for section ${sectionData.id}`);
  }

  /**
   * Populate seats and fans from level data (data-driven)
   */
  public populateFromData(fanData: FanData[]): void {
    const rowCount = this.sectionData.gridBottom - this.sectionData.gridTop + 1;
    const seatsPerRow = this.sectionData.gridRight - this.sectionData.gridLeft + 1;
    const cellSize = this.gridManager ? this.gridManager.getWorldSize().cellSize : 32;
    const sectionWidth = seatsPerRow * cellSize;
    const sectionHeight = rowCount * cellSize;
    const baseRowHeight = Math.floor(sectionHeight / rowCount);
    const remainder = sectionHeight - baseRowHeight * rowCount;
    const startLightness = 62;
    const maxLightness = 90;
    const minLightness = 30;
    const interval = (maxLightness - startLightness) / Math.max(1, rowCount - 1);

    for (let row = 0; row < rowCount; row++) {
      const gridRow = this.sectionData.gridTop + row;
      const rowHeight = baseRowHeight + (row === 0 ? remainder : 0);
      const targetLightness = Math.max(minLightness, Math.min(maxLightness, startLightness + interval * row));
      const nextRowLightness = Math.max(minLightness, Math.min(maxLightness, startLightness + interval * (row + 1)));

      const rowActor = new SectionRowActor({
        id: `${this.sectionId}-row-${row}`,
        sectionId: this.sectionId,
        rowIndex: row,
        gridTop: gridRow,
        gridLeft: this.sectionData.gridLeft,
        gridRight: this.sectionData.gridRight,
        rowHeightPx: rowHeight,
        rowWidthPx: sectionWidth,
        lightnessStops: { current: targetLightness, next: nextRowLightness },
        container: this.section,
        scene: this.section.scene,
        gridManager: this.gridManager
      });

      rowActor.buildSeats(seatsPerRow);
      this.rowActors.push(rowActor);

      // Inject seats into StadiumSection's row stub for backward compatibility
      if (this.section.getRows()[row]) {
        this.section.getRows()[row].seats = rowActor.getSeats();
      }
    }

    // Create fan sprites + actors from data
    fanData.forEach(fd => {
      const rowActor = this.rowActors[fd.row];
      if (rowActor) {
        const seat = rowActor.getSeatAt(fd.col);
        if (seat) {
          // Create fan sprite at seat position
          // gridToWorld already returns center of cell
          const worldPos = this.gridManager
            ? this.gridManager.gridToWorld(fd.gridRow, fd.gridCol)
            : { x: 0, y: 0 };
          const seatOffsetY = 5; // Offset to align with top of row floor divider (matches SectionRow seat positioning)
          const fanY = worldPos.y - seatOffsetY; // Adjust from cell center by seat offset
          const fan = new Fan(this.section.scene, worldPos.x, fanY);
          // Create FanActor for game logic
          const fanActor = new FanActor(
            `fan-${this.sectionId}-${fd.row}-${fd.col}`,
            fan,
            fd.initialStats ? {
              happiness: fd.initialStats.happiness,
              thirst: fd.initialStats.thirst,
              attention: fd.initialStats.attention
            } : undefined,
            'fan',
            false
          );
          // Set the FanActor's grid position to absolute grid coordinates
          fanActor.setGridPosition(fd.gridRow, fd.gridCol, this.gridManager);
          seat.setFan(fan);
          this.fans.set(`${fd.row}-${fd.col}`, fan);
          this.fanActors.set(`${fd.row}-${fd.col}`, fanActor);
        }
      }
    });

    this.logger.debug(`Section ${this.sectionId} populated with ${this.fans.size} fans across ${rowCount} rows`);
  }

  /**
   * Get all fans in this section
   */
  public getFans(): Fan[] { return Array.from(this.fans.values()); }

  /**
   * Get all FanActor logic instances in this section
   */
  public getFanActors(): FanActor[] { return Array.from(this.fanActors.values()); }

  /**
   * Get FanActor at a seat position
   */
  public getFanActorAt(row: number, col: number): FanActor | undefined {
    return this.fanActors.get(`${row}-${col}`);
  }

  /**
   * Query fans by criteria (e.g., thirstiest for AI targeting)
   * @deprecated Use queryFanActors for game logic
   */
  public queryFans(filter: (fan: Fan) => boolean): Fan[] {
    return this.getFans().filter(filter);
  }

private lastLoggedTargetFan: number = 0; 

  /**
   * Query thirstiest FanActors for vendor targeting
   * @param count Maximum number of fans to return
   * @returns Array of fan actors with grid positions, sorted by thirst descending
   */
  public queryThirstiestFans(count: number = 10): Array<{
    fanActor: FanActor;
    fan: Fan;
    row: number;
    col: number;
    thirst: number;
  }> {
    const results: Array<{
      fanActor: FanActor;
      fan: Fan;
      row: number;
      col: number;
      thirst: number;
    }> = [];

    // Scan all rows/columns to find fans
    for (let rowIdx = 0; rowIdx < this.rowActors.length; rowIdx++) {
      const rowActor = this.rowActors[rowIdx];
      const seats = rowActor.getSeats();
      
      for (let colIdx = 0; colIdx < seats.length; colIdx++) {
        const seat = seats[colIdx];
        if (!seat.isEmpty()) {
          const fanActor = this.getFanActorAt(rowIdx, colIdx);
          let fanPos = fanActor?.getGridPosition();
          let time = this.section.scene.game.getTime();
          if(time - this.lastLoggedTargetFan > 5000){
            this.lastLoggedTargetFan = time;
            this.logger.debug(`Checking fan at row ${fanPos?.row}, col ${fanPos?.col}`);
          }
          
          if (fanActor) {
            const fan = fanActor.getFan();
            results.push({
              fanActor,
              fan,
              row: fanPos.row,
              col: fanPos.col,
              thirst: fanActor.getThirst()
            });
          }
        }
      }
    }

    // Sort by thirst descending and take top N
    return results
      .sort((a, b) => b.thirst - a.thirst)
      .slice(0, count);
  }

  /**
   * Get fan at specific seat position
   */
  public getFanAt(row: number, col: number): Fan | undefined {
    return this.fans.get(`${row}-${col}`);
  }

  /**
   * Get wrapped StadiumSection sprite.
   */
  public getSection(): StadiumSection {
    return this.section;
  }

  /**
   * Get section identifier (A, B, C).
   */
  public getSectionId(): string {
    return this.sectionId;
  }

  /**
   * Get all row actors in this section.
   */
  public getRowActors(): SectionRowActor[] {
    return this.rowActors;
  }

  /**
   * Get section data (grid bounds, etc).
   */
  public getSectionData(): any {
    return this.sectionData;
  }

  /**
   * Get section stats for registry snapshot.
   */
  public getStats() {
    const worldPos = this.gridManager 
      ? this.gridManager.gridToWorld(this.gridRow, this.gridCol)
      : { x: 0, y: 0 };
    return {
      sectionId: this.sectionId,
      gridPosition: { row: this.gridRow, col: this.gridCol },
      worldPosition: worldPos,
      fanCount: this.fans.size
    };
  }

  /**
   * Update all fan stats (thirst, happiness, attention decay).
   * Called explicitly by StadiumScene during active session.
   * @param deltaTime - Time elapsed in milliseconds
   * @param environmentalModifier - Environmental thirst multiplier (< 1.0 = shade, 1.0 = normal, > 1.0 = hot/sunny)
   */
  public updateFanStats(deltaTime: number, environmentalModifier: number = 1.0): void {
    const allFanActors = this.getFanActors();
    for (const fanActor of allFanActors) {
      fanActor.updateStats(deltaTime, this.section.scene, environmentalModifier);
    }
    // Update cached aggregate values for performance
    this.updateAggregateCache();
  }

  /**
   * Get aggregate stats across all fans in this section.
   * Returns cached values updated by updateFanStats().
   */
  public getAggregateStats(): { happiness: number; thirst: number; attention: number } {
    const allFanActors = this.getFanActors();
    if (allFanActors.length === 0) {
      return { happiness: 50, thirst: 50, attention: 50 };
    }
    return {
      happiness: this.happinessAgg,
      thirst: this.thirstAgg,
      attention: this.attentionAgg
    };
  }

  /**
   * Calculate section bonus for individual fan wave participation.
   * Higher happiness and attention, lower thirst = higher bonus.
   */
  public getSectionWaveBonus(): number {
    const aggregate = this.getAggregateStats();
    return (aggregate.happiness * 0.2 + aggregate.attention * 0.2) - (aggregate.thirst * 0.15);
  }

  /**
   * Update cached aggregate stats from all fans.
   * Called internally after fan stats update.
   */
  private updateAggregateCache(): void {
    const allFanActors = this.getFanActors();
    if (allFanActors.length === 0) {
      this.happinessAgg = 50;
      this.thirstAgg = 50;
      this.attentionAgg = 50;
      return;
    }

    let totalHappiness = 0;
    let totalThirst = 0;
    let totalAttention = 0;

    for (const fanActor of allFanActors) {
      const stats = fanActor.getStats();
      totalHappiness += stats.happiness;
      totalThirst += stats.thirst;
      totalAttention += stats.attention;
    }

    this.happinessAgg = totalHappiness / allFanActors.length;
    this.thirstAgg = totalThirst / allFanActors.length;
    this.attentionAgg = totalAttention / allFanActors.length;
  }

  /**
   * Update fan visual intensity based on thirst.
   * Called each frame to update fan colors.
   */
  public updateFanIntensity(intensity?: number): void {
    const allFanActors = this.getFanActors();
    if (intensity !== undefined) {
      // Set all fans to same intensity
      for (const fanActor of allFanActors) {
        fanActor.getFan().setIntensity(intensity);
      }
    } else {
      // Use each fan's personal thirst as intensity
      for (const fanActor of allFanActors) {
        const thirst = fanActor.getThirst();
        fanActor.getFan().setIntensity(thirst / 100);
      }
    }
  }

  /**
   * Reset wave-related state on all fans before new wave calculations.
   * Clears reducedEffort flag and wave strength modifier for clean state.
   */
  public resetFanWaveState(): void {
    for (const fanActor of this.getFanActors()) {
      fanActor.reducedEffort = false;
      fanActor.setWaveStrengthModifier(0);
    }
  }

  /**
   * Calculate participation for a specific column with peer pressure logic.
   * @param columnIndex - The column index (0-7)
   * @param waveStrength - Current wave strength for strength modifier
   * @returns Array of fan objects with their participation state and intensity
   */
  public calculateColumnParticipation(
    columnIndex: number,
    waveStrength: number
  ): Array<{ fan: any; willParticipate: boolean; intensity: number }> {
    const sectionBonus = this.getSectionWaveBonus();
    const gameBalance = require('@/config/gameBalance').gameBalance;
    const strengthModifier = (waveStrength - 50) * gameBalance.waveStrength.strengthModifier;
    const result: Array<{ fan: any; willParticipate: boolean; intensity: number }> = [];

    // First pass: roll participation for all fans in column
    let participatingCount = 0;
    const fanStates: Array<{ fan: any; willParticipate: boolean }> = [];

    for (let rowIdx = 0; rowIdx < this.rowActors.length; rowIdx++) {
      const rowActor = this.rowActors[rowIdx];
      const seats = rowActor.getSeats();
      if (columnIndex < seats.length) {
        const seat = seats[columnIndex];
        if (!seat.isEmpty()) {
          const fan = seat.getFan();
          if (fan) {
            const fanActor = this.getFanActorAt(rowIdx, columnIndex);
            if (fanActor) {
              fanActor.setWaveStrengthModifier(strengthModifier);
              const willParticipate = fanActor.rollForWaveParticipation(sectionBonus);
              fanStates.push({ fan: fanActor, willParticipate });
              if (willParticipate) {
                participatingCount++;
              }
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
          (state.fan as FanActor).reducedEffort = true;
        }
      }
    }

    // Build result with intensity
    for (const state of fanStates) {
      const actor = state.fan as FanActor;
      result.push({
        fan: actor,
        willParticipate: state.willParticipate,
        intensity: actor.reducedEffort ? 0.5 : 1.0,
      });
    }

    return result;
  }

  /**
   * Play wave animation for a specific column with fan participation states.
   * @param columnIndex - The column index
   * @param fanStates - Array of fans with participation info
   * @param visualState - Visual state for animation ('full', 'sputter', 'death')
   * @param waveStrength - Current wave strength (0-100) for height scaling
   */
  public async playColumnAnimation(
    columnIndex: number,
    fanStates: Array<{ fan: any; willParticipate: boolean; intensity: number }>,
    visualState: 'full' | 'sputter' | 'death' = 'full',
    waveStrength: number = 70
  ): Promise<void> {
    const gameBalance = require('@/config/gameBalance').gameBalance;
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

    let animCount = 0;
    for (let rowIdx = 0; rowIdx < this.rowActors.length; rowIdx++) {
      const state = fanStates[rowIdx];
      if (state && state.willParticipate && state.fan) {
        const delayMs = rowIdx * baseRowDelay;
        const actor = state.fan as FanActor;
        columnPromises.push(actor.playWave(delayMs, state.intensity, visualState, waveStrength));
        animCount++;
        // Call onWaveParticipation after animation completes
        const scene = (this.section as any).scene;
        if (scene) {
          scene.time.delayedCall(delayMs + animationDuration, () => {
            (state.fan as FanActor).onWaveParticipation(scene, state.willParticipate);
          });
        }
      }
    }

    // Start all fans in this column (don't await - allows smooth overlapping animations)
    Promise.all(columnPromises).catch(err => {
      console.error('Error during column animation:', err);
    });
  }
}
