import Phaser from 'phaser';
import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { Mascot } from '@/sprites/Mascot';
import { gameBalance } from '@/config/gameBalance';

/**
 * Mascot Targeting AI System
 *
 * Intelligently selects fans to target with t-shirt cannon based on:
 * - Disinterested status (3x weight multiplier)
 * - Distance from mascot (farther fans prioritized)
 * - Prevents duplicate targeting within same activation session
 *
 * Usage:
 * ```typescript
 * const ai = new MascotTargetingAI();
 * const targets = ai.selectCatchingFans(section, mascot);
 * // ... fire cannon at targets
 * ai.reset(); // when mascot deactivates
 * ```
 */
export class MascotTargetingAI {
  /** Set of fans already targeted during current activation session */
  private targetedFans: Set<Fan> = new Set();

  /**
   * Select 1-3 fans who will catch t-shirts from this cannon shot
   *
   * Selection algorithm:
   * 1. Filter out fans already targeted this activation
   * 2. Calculate weighted scores for each available fan
   * 3. Sort by weight (highest first)
   * 4. Perform weighted random selection of 1-3 fans
   * 5. Mark selected fans to prevent duplicate targeting
   *
   * @param section - Stadium section to target fans within
   * @param mascot - Mascot firing the cannon (for position/distance calculation)
   * @returns Array of 1-3 fans who will catch, or empty array if no valid targets
   */
  public selectCatchingFans(
    section: StadiumSection,
    mascot: Mascot
  ): Fan[] {
    // Get all fans not yet targeted this activation
    const availableFans = section.getFans().filter(f =>
      !this.targetedFans.has(f)
    );

    if (availableFans.length === 0) {
      console.warn('[TargetingAI] No available fans to target');
      return [];
    }

    // Build weighted candidate list
    const weightedFans = availableFans.map(fan => ({
      fan,
      weight: this.calculateCatchWeight(fan, mascot)
    }));

    // Sort by weight descending (highest weight first)
    weightedFans.sort((a, b) => b.weight - a.weight);

    // Select 1-3 fans using weighted random selection
    const catchCount = Phaser.Math.Between(
      gameBalance.mascotCannon.minCatchersPerShot,
      gameBalance.mascotCannon.maxCatchersPerShot
    );

    const catchers: Fan[] = [];
    const pool = [...weightedFans]; // Create mutable copy

    for (let i = 0; i < catchCount && pool.length > 0; i++) {
      const selected = this.weightedRandomSelect(pool);
      if (selected) {
        catchers.push(selected.fan);
        this.targetedFans.add(selected.fan);

        // Remove from pool to prevent duplicate selection
        const idx = pool.indexOf(selected);
        pool.splice(idx, 1);
      }
    }

    return catchers;
  }

  /**
   * Calculate selection weight for a fan
   *
   * Higher weight = more likely to be selected as catcher
   *
   * Factors:
   * - Disinterested status (3x multiplier)
   * - Distance from mascot (farther = higher weight)
   *
   * @param fan - Fan to calculate weight for
   * @param mascot - Mascot position for distance calculation
   * @returns Weight value (higher = more likely to catch)
   */
  private calculateCatchWeight(
    fan: Fan,
    mascot: Mascot
  ): number {
    let weight = 1.0;

    // Apply disinterested multiplier (3x more likely)
    if (fan.getIsDisinterested?.()) {
      weight *= gameBalance.mascotCannon.disinterestedTargetingWeight;
    }

    // Apply distance weighting (farther from mascot = higher priority)
    const distance = Phaser.Math.Distance.Between(
      mascot.x,
      mascot.y,
      fan.x,
      fan.y
    );

    // Normalize distance to 0-1 range (assuming max section width ~300px)
    const normalizedDistance = Math.min(distance / 300, 1.0);

    // Apply distance bonus (farther = higher weight)
    const distanceBonus = 1.0 + (normalizedDistance * gameBalance.mascotCannon.distanceWeight);
    weight *= distanceBonus;

    return weight;
  }

  /**
   * Perform weighted random selection from candidate list
   *
   * Uses cumulative weight distribution for fair random selection
   * that respects weight values.
   *
   * @param weightedFans - Array of fans with calculated weights
   * @returns Randomly selected fan based on weights, or null if empty
   */
  private weightedRandomSelect(
    weightedFans: Array<{ fan: Fan; weight: number }>
  ): { fan: Fan; weight: number } | null {
    if (weightedFans.length === 0) return null;

    const totalWeight = weightedFans.reduce((sum, wf) => sum + wf.weight, 0);
    if (totalWeight === 0) return null;

    let random = Math.random() * totalWeight;

    for (const wf of weightedFans) {
      random -= wf.weight;
      if (random <= 0) {
        return wf;
      }
    }

    // Fallback to last item (floating point edge case)
    return weightedFans[weightedFans.length - 1];
  }

  /**
   * Reset targeting state for new mascot activation
   *
   * Call this when mascot is deactivated to allow all fans
   * to be targeted again in the next activation session.
   */
  public reset(): void {
    this.targetedFans.clear();
  }

  /**
   * Get count of fans already targeted this activation
   *
   * Useful for debugging and analytics.
   *
   * @returns Number of fans targeted so far
   */
  public getTargetedCount(): number {
    return this.targetedFans.size;
  }

  /**
   * Check if a specific fan has already been targeted
   *
   * @param fan - Fan to check
   * @returns True if fan has already caught a t-shirt this activation
   */
  public hasBeenTargeted(fan: Fan): boolean {
    return this.targetedFans.has(fan);
  }
}
