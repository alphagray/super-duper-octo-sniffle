import { Fan } from './Fan';

/**
 * Represents a seat in a stadium section row
 */
export class Seat {
  public readonly seatIndex: number;
  public readonly x: number;
  public readonly y: number;
  private fan: Fan | null;

  constructor(seatIndex: number, x: number, y: number) {
    this.seatIndex = seatIndex;
    this.x = x;
    this.y = y;
    this.fan = null;
  }

  /** Assign a fan to this seat */
  assignFan(fan: Fan): void {
    this.fan = fan;
  }

  /** Remove the fan from this seat */
  removeFan(): Fan | null {
    const removed = this.fan;
    this.fan = null;
    return removed;
  }

  /** Is this seat empty? */
  isEmpty(): boolean {
    return this.fan === null;
  }

  /** Get the fan assigned to this seat */
  getFan(): Fan | null {
    return this.fan;
  }

  /** Get the position of this seat */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }
}
