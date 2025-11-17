import Phaser from 'phaser';
import { Seat } from './Seat';
import type { VendorAbilities } from '@/managers/interfaces/VendorTypes';
import { gameBalance } from '@/config/gameBalance';

/**
 * Represents a row in a stadium section
 */
export class SectionRow {
  public readonly rowIndex: number;
  public readonly y: number;
  public readonly width: number;
  public readonly height: number;
  public readonly targetLightness: number;
  public readonly nextRowLightness: number;
  public readonly seatCount: number;
  private seats: Seat[] = [];

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    rowIndex: number,
    y: number,
    width: number,
    height: number,
    targetLightness: number,
    nextRowLightness: number,
    seatCount: number
  ) {
    this.rowIndex = rowIndex;
    this.y = y;
    this.width = width;
    this.height = height;
    this.targetLightness = targetLightness;
    this.nextRowLightness = nextRowLightness;
    this.seatCount = seatCount;

    // Render row background
    const bgColor = this.hslToHex(0, 0, targetLightness);
    const bgRect = scene.add.rectangle(0, y + height * 0.425, width, height * 0.85, bgColor);
    bgRect.setName(`row-${rowIndex}-bg`);
    container.add(bgRect);

    // Render gradient divider at bottom
    const dividerHeight = height * 0.15;
    const divSubRowCount = 4;
    const divSubRowHeight = dividerHeight / divSubRowCount;
    const dividerTopLightness = Math.max(30, targetLightness - 5);
    const dividerBottomLightness = Math.max(30, nextRowLightness - 5);
    for (let divSubIdx = 0; divSubIdx < divSubRowCount; divSubIdx++) {
      const t = divSubIdx / (divSubRowCount - 1);
      const divLightness = dividerTopLightness + (dividerBottomLightness - dividerTopLightness) * t;
      const divColor = this.hslToHex(0, 0, Math.min(90, divLightness));
      const divSubRowY = y + height * 0.85 + divSubRowHeight * (divSubIdx + 0.5);
      const divRect = scene.add.rectangle(0, divSubRowY, width, divSubRowHeight, divColor);
      divRect.setName(`row-${rowIndex}-divider-${divSubIdx}`);
      container.add(divRect);
    }

    // Initialize seats
    this.initializeSeats();
  }

  /**
   * Create evenly spaced seats for this row
   */
  private initializeSeats(): void {
    // Place seats so each is centered in its grid cell, row fills full width
    // Each cell: width/seatCount, seat at center of cell
    const cellWidth = this.width / this.seatCount;
    for (let i = 0; i < this.seatCount; i++) {
      // Center of cell: left edge + (i + 0.5) * cellWidth
      const x = -this.width / 2 + (i + 0.5) * cellWidth;
      const y = this.y + this.height * 0.85; // Position at divider top
      this.seats.push(new Seat(i, x, y));
    }
  }

  /** Assign a fan to a seat */
  assignFanToSeat(fan: any, seatIndex: number): void {
    if (this.seats[seatIndex]) {
      this.seats[seatIndex].assignFan(fan);
    }
  }

  /** Get all seats in this row */
  getSeats(): Seat[] {
    return this.seats;
  }

  /** Get all fans in this row */
  getFans(): any[] {
    return this.seats.map(seat => seat.getFan()).filter(fan => fan !== null);
  }

  /** Get the Y coordinate of the row floor */
  getFloorY(): number {
    return this.y + this.height * 0.85;
  }

  /** Update intensity for all fans in this row */
  updateFanIntensity(value: number): void {
    this.getFans().forEach(fan => fan.setIntensity(value));
  }

  /** Play wave animation for all fans in this row */
  playWave(
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

  /** Get occupancy rate (0-1) */
  getOccupancyRate(): number {
    const occupied = this.seats.filter(seat => !seat.isEmpty()).length;
    return occupied / this.seatCount;
  }

  /**
   * Calculate row traversal cost for vendor pathfinding
   * Aggregates seat penalties across the row and adds base row penalty
   * 
   * @param vendorAbilities Vendor abilities to check for penalty overrides
   * @returns Total movement cost penalty for traversing this row
   */
  public getRowTraversalCost(vendorAbilities: VendorAbilities): number {
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
    return Math.min(totalPenalty, gameBalance.vendorMovement.maxTerrainPenalty);
  }

  /** Converts HSL color values to Phaser hex format */
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
}
