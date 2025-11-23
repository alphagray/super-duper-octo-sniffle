import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';
import { gameBalance } from '@/config/gameBalance';

/**
 * Configuration for ripple propagation behavior
 */
export interface RippleConfig {
  baseEffect: number; // Attention boost at epicenter (default: 40)
  maxRadius: number; // Maximum Manhattan distance (default: 4)
  disinterestedBonus: number; // Extra boost for disinterested fans (default: 5)
  decayType: 'linear' | 'exponential'; // Decay function type
}

/**
 * Result of a single ripple calculation
 */
export interface RippleEffect {
  epicenterFan: Fan;
  epicenterRow: number;
  epicenterSeat: number;
  affectedFans: Map<Fan, number>; // fan -> attention boost amount
}

/**
 * Engine for calculating cascading fan engagement effects
 * Uses grid-based Manhattan distance with configurable decay
 *
 * @example
 * const engine = new RipplePropagationEngine();
 * const ripple = engine.calculateRipple(catcherFan, section);
 * engine.applyRipple(ripple);
 */
export class RipplePropagationEngine {
  private config: RippleConfig;

  constructor(config?: Partial<RippleConfig>) {
    this.config = {
      baseEffect: config?.baseEffect ?? gameBalance.ripplePropagation.baseEffect,
      maxRadius: config?.maxRadius ?? gameBalance.ripplePropagation.maxRadius,
      disinterestedBonus: config?.disinterestedBonus ?? gameBalance.ripplePropagation.disinterestedBonus,
      decayType: config?.decayType ?? gameBalance.ripplePropagation.decayType,
    };
  }

  /**
   * Calculate ripple effects from an epicenter fan
   *
   * @param epicenter - Fan who caught the t-shirt (ripple origin)
   * @param section - Section containing the fan
   * @returns RippleEffect with all affected fans and their boosts
   *
   * @example
   * const ripple = engine.calculateRipple(catcherFan, section);
   * ripple.affectedFans.forEach((boost, fan) => {
   *   fan.modifyStats({ attention: fan.getAttention() + boost });
   * });
   */
  public calculateRipple(
    epicenter: Fan,
    section: StadiumSection
  ): RippleEffect {
    const epicenterPos = this.findFanPosition(epicenter, section);

    if (!epicenterPos) {
      console.warn('[RippleEngine] Epicenter fan not found in section');
      return {
        epicenterFan: epicenter,
        epicenterRow: -1,
        epicenterSeat: -1,
        affectedFans: new Map(),
      };
    }

    const affectedFans = new Map<Fan, number>();
    const rows = section.getRows();

    // Iterate through all fans in section grid
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const seats = row.getSeats();

      for (let seatIdx = 0; seatIdx < seats.length; seatIdx++) {
        const seat = seats[seatIdx];
        const fan = seat.getFan();
        if (!fan) continue;

        // Calculate Manhattan distance from epicenter
        const distance = this.calculateManhattanDistance(
          epicenterPos.row,
          epicenterPos.seat,
          rowIdx,
          seatIdx
        );

        // Apply decay function to get effect strength
        const effect = this.calculateEffect(distance, fan);

        if (effect > 0) {
          affectedFans.set(fan, effect);
        }
      }
    }

    return {
      epicenterFan: epicenter,
      epicenterRow: epicenterPos.row,
      epicenterSeat: epicenterPos.seat,
      affectedFans,
    };
  }

  /**
   * Calculate Manhattan distance between two grid positions
   * Manhattan distance = |row1 - row2| + |seat1 - seat2|
   *
   * @example
   * // Adjacent horizontally: distance = 1
   * calculateManhattanDistance(2, 3, 2, 4) // => 1
   *
   * // Adjacent vertically: distance = 1
   * calculateManhattanDistance(2, 3, 3, 3) // => 1
   *
   * // Diagonal: distance = 2
   * calculateManhattanDistance(2, 3, 3, 4) // => 2
   */
  private calculateManhattanDistance(
    row1: number,
    seat1: number,
    row2: number,
    seat2: number
  ): number {
    return Math.abs(row1 - row2) + Math.abs(seat1 - seat2);
  }

  /**
   * Calculate effect strength for a fan at given distance
   * Applies decay formula and bonuses
   *
   * @param distance - Manhattan distance from epicenter
   * @param fan - Target fan (for checking disinterested status)
   * @returns Attention boost amount (0 if outside radius)
   */
  private calculateEffect(distance: number, fan: Fan): number {
    // Outside max radius = no effect
    if (distance >= this.config.maxRadius) {
      return 0;
    }

    // Calculate base effect with decay
    let effect = this.config.baseEffect;

    if (this.config.decayType === 'linear') {
      // Linear decay: effect = baseEffect * (1 - distance/maxRadius)
      // Distance 0: 100% effect
      // Distance maxRadius: 0% effect
      if (this.config.maxRadius === 0) {
        return 0;
      }
      const decayFactor = Math.max(0, 1 - (distance / this.config.maxRadius));
      effect *= decayFactor;
    } else if (this.config.decayType === 'exponential') {
      // Exponential decay not yet implemented
      throw new Error('Exponential decay type is not yet implemented. Use "linear" instead.');
    }

    // Add bonus for disinterested fans (re-engagement incentive)
    if (fan.getIsDisinterested()) {
      effect += this.config.disinterestedBonus;
    }

    return Math.round(effect);
  }

  /**
   * Find a fan's grid position within a section
   *
   * @param fan - Fan to locate
   * @param section - Section to search
   * @returns Grid position {row, seat} or null if not found
   */
  private findFanPosition(
    fan: Fan,
    section: StadiumSection
  ): { row: number; seat: number } | null {
    const rows = section.getRows();

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const seats = row.getSeats();

      for (let seatIdx = 0; seatIdx < seats.length; seatIdx++) {
        const seat = seats[seatIdx];
        if (seat.getFan() === fan) {
          return { row: rowIdx, seat: seatIdx };
        }
      }
    }

    return null;
  }

  /**
   * Apply ripple effects to all affected fans
   * Respects 100 attention cap
   *
   * @param ripple - Calculated ripple effect
   */
  public applyRipple(ripple: RippleEffect): void {
    ripple.affectedFans.forEach((boost, fan) => {
      const currentAttention = fan.getAttention();
      const newAttention = Math.min(100, currentAttention + boost);

      fan.modifyStats({
        attention: newAttention
      });
    });
  }

  /**
   * Combine multiple ripples from same event
   * Effects are additive but capped at 100 when applied
   *
   * @param ripples - Array of ripple effects to combine
   * @returns Map of fans to total combined boost
   *
   * @example
   * // Two fans catch t-shirts near each other
   * const ripple1 = engine.calculateRipple(catcher1, section);
   * const ripple2 = engine.calculateRipple(catcher2, section);
   * const combined = engine.combineRipples([ripple1, ripple2]);
   * engine.applyCombinedRipples(combined);
   * // Fans in overlap area get both boosts added together
   */
  public combineRipples(ripples: RippleEffect[]): Map<Fan, number> {
    const combined = new Map<Fan, number>();

    for (const ripple of ripples) {
      ripple.affectedFans.forEach((boost, fan) => {
        const currentBoost = combined.get(fan) || 0;
        combined.set(fan, currentBoost + boost);
      });
    }

    return combined;
  }

  /**
   * Apply combined ripples to fans with attention cap
   *
   * @param combinedEffects - Result from combineRipples()
   */
  public applyCombinedRipples(combinedEffects: Map<Fan, number>): void {
    combinedEffects.forEach((boost, fan) => {
      const currentAttention = fan.getAttention();
      const newAttention = Math.min(100, currentAttention + boost);

      fan.modifyStats({
        attention: newAttention
      });
    });
  }

  /**
   * Get current configuration
   */
  public getConfig(): RippleConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (useful for testing different parameters)
   */
  public updateConfig(config: Partial<RippleConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
