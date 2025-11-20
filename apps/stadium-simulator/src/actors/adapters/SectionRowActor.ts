import { SceneryActor } from '@/actors/Actor';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { VendorAbilities } from '@/managers/interfaces/VendorTypes';
import { gameBalance } from '@/config/gameBalance';
import { SeatActor } from '@/sprites/Seat';
import type { Fan } from '@/sprites/Fan';
import Phaser from 'phaser';

/**
 * Options for constructing a SectionRowActor
 */
export interface SectionRowActorOptions {
  id: string;
  sectionId: string;
  rowIndex: number;
  gridTop: number;
  gridLeft: number;
  gridRight: number;
  rowHeightPx: number;
  rowWidthPx: number;
  lightnessStops: { current: number; next: number };
  container: Phaser.GameObjects.Container;
  scene: Phaser.Scene;
  gridManager: any;
}

/**
 * SectionRowActor: Represents a single row within a stadium section.
 * Composes seats, handles rendering, and provides traversal cost metadata for vendor pathfinding.
 */
export class SectionRowActor extends SceneryActor {
  public readonly rowIndex: number;
  public readonly sectionId: string;
  private gridTop: number;
  private gridLeft: number;
  private gridRight: number;
  private rowHeightPx: number;
  private rowWidthPx: number;
  private lightnessStops: { current: number; next: number };
  private container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private gridManager: any;
  private seats: SeatActor[] = [];
  private rowVisuals: Phaser.GameObjects.Container;
  private blocked: boolean = false;
  private blockReason?: string;
  private traversalCostCache: number | null = null;
  private eventListeners: Map<string, Array<Function>> = new Map();

  constructor(opts: SectionRowActorOptions, category: ActorCategory = 'row', enableLogging = false) {
    super(opts.id, 'section-row', category, opts.gridTop, opts.gridLeft, enableLogging);
    this.rowIndex = opts.rowIndex;
    this.sectionId = opts.sectionId;
    this.gridTop = opts.gridTop;
    this.gridLeft = opts.gridLeft;
    this.gridRight = opts.gridRight;
    this.rowHeightPx = opts.rowHeightPx;
    this.rowWidthPx = opts.rowWidthPx;
    this.lightnessStops = opts.lightnessStops;
    this.container = opts.container;
    this.scene = opts.scene;
    this.gridManager = opts.gridManager;

    // Create visual container for this row
    this.rowVisuals = this.scene.add.container(0, 0);
    this.container.add(this.rowVisuals);

    // Render row background and divider
    this.renderRow();

    this.logger.debug(`SectionRowActor created for ${opts.sectionId} row ${opts.rowIndex}`);
  }

  /**
   * Render the row background and gradient divider
   */
  private renderRow(): void {
    const sectionWidth = this.rowWidthPx;
    const rowHeight = this.rowHeightPx;
    const y = this.calculateRowY();

    // Background rectangle (85% of row height)
    const bgColor = this.hslToHex(0, 0, this.lightnessStops.current);
    const bgRect = this.scene.add.rectangle(0, y + rowHeight * 0.425, sectionWidth, rowHeight * 0.85, bgColor);
    bgRect.setName(`row-${this.rowIndex}-bg`);
    this.rowVisuals.add(bgRect);

    // Gradient divider at bottom (15% of row height)
    const dividerHeight = rowHeight * gameBalance.sectionRows.dividerHeightRatio;
    const divSubRowCount = 4;
    const divSubRowHeight = dividerHeight / divSubRowCount;
    const dividerTopLightness = Math.max(30, this.lightnessStops.current - 5);
    const dividerBottomLightness = Math.max(30, this.lightnessStops.next - 5);

    for (let divSubIdx = 0; divSubIdx < divSubRowCount; divSubIdx++) {
      const t = divSubIdx / (divSubRowCount - 1);
      const divLightness = dividerTopLightness + (dividerBottomLightness - dividerTopLightness) * t;
      const divColor = this.hslToHex(0, 0, Math.min(90, divLightness));
      const divSubRowY = y + rowHeight * 0.85 + divSubRowHeight * (divSubIdx + 0.5);
      const divRect = this.scene.add.rectangle(0, divSubRowY, sectionWidth, divSubRowHeight, divColor);
      divRect.setName(`row-${this.rowIndex}-divider-${divSubIdx}`);
      this.rowVisuals.add(divRect);
    }
  }

  /**
   * Calculate the Y position of this row relative to section container origin
   */
  private calculateRowY(): number {
    // For now, calculate based on row index and height
    // This will be replaced when we get proper section height from config
    const totalRows = 4; // TODO: Get from sectionData
    const sectionHeight = this.rowHeightPx * totalRows;
    return -sectionHeight / 2 + this.rowIndex * this.rowHeightPx;
  }

  /**
   * Build seats for this row from level data
   * @param seatCount Number of seats in this row
   */
  public buildSeats(seatCount: number): void {
    for (let col = 0; col < seatCount; col++) {
      const gridCol = this.gridLeft + col;
      const seatId = `${this.sectionId}-${this.rowIndex}-${col}`;
      const seat = new SeatActor(col, this.gridTop, gridCol, seatId);
      this.seats.push(seat);

      // Register seat with grid manager
      if (this.gridManager) {
        this.gridManager.addOccupant(this.gridTop, gridCol, {
          id: seatId,
          type: 'seat',
          metadata: { sectionId: this.sectionId, rowIndex: this.rowIndex, seatIndex: col }
        });
      }
    }
    this.invalidateTraversalCostCache();
    this.logger.debug(`Built ${seatCount} seats for row ${this.rowIndex}`);
  }

  /**
   * Get all seats in this row
   */
  public getSeats(): SeatActor[] {
    return this.seats;
  }

  /**
   * Get seat at specific column index
   */
  public getSeatAt(columnIdx: number): SeatActor | undefined {
    return this.seats[columnIdx];
  }

  /**
   * Get all fans in this row
   */
  public getFans(): Fan[] {
    return this.seats.map(seat => seat.getFan()).filter((fan): fan is Fan => fan !== null);
  }

  /**
   * Assign a fan to a seat in this row
   */
  public assignFan(seatColumn: number, fan: Fan): void {
    const seat = this.seats[seatColumn];
    if (seat) {
      seat.setFan(fan);
      this.invalidateTraversalCostCache();
      this.emit('rowOccupancyChanged', {
        sectionId: this.sectionId,
        rowIndex: this.rowIndex,
        occupiedCount: this.getOccupiedCount(),
        seatCount: this.seats.length
      });
    }
  }

  /**
   * Release fan from a seat in this row
   */
  public releaseFan(seatColumn: number): Fan | null {
    const seat = this.seats[seatColumn];
    if (seat) {
      const fan = seat.removeFan();
      this.invalidateTraversalCostCache();
      this.emit('rowOccupancyChanged', {
        sectionId: this.sectionId,
        rowIndex: this.rowIndex,
        occupiedCount: this.getOccupiedCount(),
        seatCount: this.seats.length
      });
      return fan;
    }
    return null;
  }

  /**
   * Get occupancy rate (0-1)
   */
  public getOccupancyRate(): number {
    const occupied = this.getOccupiedCount();
    return this.seats.length > 0 ? occupied / this.seats.length : 0;
  }

  /**
   * Get count of occupied seats
   */
  private getOccupiedCount(): number {
    return this.seats.filter(seat => !seat.isEmpty()).length;
  }

  /**
   * Get the Y coordinate of the row floor (world space)
   */
  public getFloorY(): number {
    const y = this.calculateRowY();
    return y + this.rowHeightPx * 0.85;
  }

  /**
   * Calculate row traversal cost for vendor pathfinding
   * Aggregates seat penalties across the row and adds base row penalty
   * Results are cached until invalidated by seat/fan changes
   */
  public getTraversalCost(vendorAbilities: VendorAbilities): number {
    if (this.blocked) {
      return gameBalance.vendorMovement.maxTerrainPenalty * 10; // Heavily penalize blocked rows
    }

    if (this.traversalCostCache !== null) {
      return this.traversalCostCache;
    }

    let totalPenalty = 0;

    // Add base row penalty unless vendor ignores it
    if (!vendorAbilities.ignoreRowPenalty) {
      totalPenalty += gameBalance.vendorMovement.rowBasePenalty;
    }

    // Aggregate seat penalties
    for (const seat of this.seats) {
      totalPenalty += seat.getTraversalPenalty(vendorAbilities);
    }

    // Cap at maximum terrain penalty
    const cost = Math.min(totalPenalty, gameBalance.vendorMovement.maxTerrainPenalty);
    this.traversalCostCache = cost;
    return cost;
  }

  /**
   * Invalidate traversal cost cache (called when seat/fan assignments change)
   */
  private invalidateTraversalCostCache(): void {
    this.traversalCostCache = null;
  }

  /**
   * Set row blocked state (e.g., mascot event, maintenance)
   */
  public setBlocked(blocked: boolean, reason?: string): void {
    this.blocked = blocked;
    this.blockReason = reason;
    this.invalidateTraversalCostCache();
    this.logger.debug(`Row ${this.rowIndex} blocked=${blocked} reason=${reason || 'none'}`);
  }

  /**
   * Check if row is blocked
   */
  public isBlocked(): boolean {
    return this.blocked;
  }

  /**
   * Get row index
   */
  public getRowIndex(): number {
    return this.rowIndex;
  }

  /**
   * Play wave animation for all fans in this row
   */
  public async playWave(
    columnDelay: number,
    rowDelay: number,
    intensity: number = 1.0,
    visualState: 'full' | 'sputter' | 'death' = 'full',
    waveStrength: number = 70
  ): Promise<void> {
    const promises: Promise<void>[] = [];
    this.seats.forEach((seat, colIdx) => {
      const fan = seat.getFan();
      if (fan) {
        const delay = colIdx * columnDelay + this.rowIndex * rowDelay;
        promises.push(fan.playWave(delay, intensity, visualState, waveStrength));
      }
    });
    return Promise.all(promises).then(() => undefined);
  }

  /**
   * Update intensity for all fans in this row
   */
  public updateFanIntensity(value: number): void {
    this.getFans().forEach(fan => fan.setIntensity(value));
  }

  /**
   * Event listener registration
   */
  public on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * Event emitter
   */
  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  /**
   * Update method (no-op for scenery actor)
   */
  public update(delta: number): void {
    // No per-frame updates needed for row visuals
  }

  /**
   * Draw method (no-op, rendering done in constructor)
   */
  public draw(): void {
    // Rendering already handled in renderRow()
  }

  /**
   * Convert HSL to hex color for Phaser
   */
  private hslToHex(h: number, s: number, l: number): number {
    h = h / 360;
    s = s / 100;
    l = l / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return parseInt('0x' + toHex(r) + toHex(g) + toHex(b), 16);
  }

  /**
   * Cleanup method (destroy visuals)
   */
  public destroy(): void {
    this.rowVisuals.destroy();
    this.seats = [];
    this.eventListeners.clear();
  }
}
