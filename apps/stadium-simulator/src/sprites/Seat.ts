import { Fan } from './Fan';
import type { VendorAbilities } from '@/managers/interfaces/VendorTypes';
import { gameBalance } from '@/config/gameBalance';
import { Actor } from '@/actors/base/Actor';

/**
 * SeatActor: Represents a seat in a stadium section row as an Actor.
 * Handles grid position, collision, and fan polling.
 */
export class SeatActor extends Actor {
  public readonly seatIndex: number;
  private fan: Fan | null;
  public readonly id: string;

  constructor(seatIndex: number, gridRow: number, gridCol: number, id?: string) {
    super(id ?? `seat-${seatIndex}`, 'seat', 'seat', gridRow, gridCol, false);
    this.id = id ?? `seat-${seatIndex}`;
    this.seatIndex = seatIndex;
    this.fan = null;
  }

  setFan(fan: Fan): void {
    this.fan = fan;
  }

  assignFan(fan: Fan): void {
    this.fan = fan;
  }

  removeFan(): Fan | null {
    const removed = this.fan;
    this.fan = null;
    return removed;
  }

  isEmpty(): boolean {
    return this.fan === null;
  }

  getFan(): Fan | null {
    return this.fan;
  }

  /**
   * Called by WaveSprite to poll for fan participation
   */
  pollFanForWave(): boolean {
    // Return false - participation polling handled by WaveManager via SectionActor
    return false;
  }

  /**
   * Handle collision with WaveSprite (stub)
   */
  handleWaveCollision(): void {
    // Implement collision logic as needed
  }

  /**
   * Get the grid position of this seat
   */
  getGridPosition(): { row: number; col: number } {
    return { row: this.gridRow, col: this.gridCol };
  }

  /**
   * Get the position of this seat in world space (requires gridManager)
   * Returns the CENTER of the grid cell for proper alignment
   * Note: gridManager.gridToWorld() already returns cell center, no offset needed
   */
  getWorldPosition(gridManager: any): { x: number; y: number } {
    // gridToWorld() already returns the cell center
    return gridManager.gridToWorld(this.gridRow, this.gridCol);
  }

  /**
   * Get the position of this seat (legacy API for AIManager)
   * Returns relative position within row (x, y)
   */
  getPosition(): { x: number; y: number } {
    // Return zero for now - AIManager adds section offset
    // Real position comes from gridManager.gridToWorld
    return { x: 0, y: 0 };
  }

  public getTraversalPenalty(vendorAbilities: VendorAbilities): number {
    if (this.isEmpty()) {
      return gameBalance.vendorMovement.emptySeatPenalty;
    }
    let penalty = gameBalance.vendorMovement.occupiedSeatPenalty;
    if (this.fan && this.fan.isDifficultTerrain()) {
      if (!vendorAbilities.ignoreGrumpPenalty) {
        const grumpPenalty = gameBalance.vendorMovement.rowBasePenalty 
          * this.fan.getTerrainPenaltyMultiplier();
        penalty = Math.min(grumpPenalty, gameBalance.vendorMovement.maxTerrainPenalty);
      }
    }
    return penalty;
  }

  update(delta: number): void {
    // No-op for now
  }

  draw(): void {
    // No-op for now
  }
}

// Legacy export for backward compatibility with SectionRow
export { SeatActor as Seat };
