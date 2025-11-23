/**
 * Tests for RipplePropagationEngine
 *
 * Validates ripple calculation, Manhattan distance, linear decay,
 * section boundary enforcement, and multiple ripple combination.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RipplePropagationEngine } from '@/systems/RipplePropagationEngine';
import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';

// Simple mock Fan for testing
class MockFan {
  private attention: number = 50;
  private happiness: number = 60;
  private thirst: number = 30;
  private isDisinterested: boolean = false;

  getAttention(): number {
    return this.attention;
  }

  getHappiness(): number {
    return this.happiness;
  }

  getThirst(): number {
    return this.thirst;
  }

  getIsDisinterested(): boolean {
    return this.isDisinterested;
  }

  modifyStats(stats: { attention?: number; happiness?: number; thirst?: number }): void {
    if (stats.attention !== undefined) {
      this.attention = Math.max(0, Math.min(100, stats.attention));
    }
    if (stats.happiness !== undefined) {
      this.happiness = Math.max(0, Math.min(100, stats.happiness));
    }
    if (stats.thirst !== undefined) {
      this.thirst = Math.max(0, Math.min(100, stats.thirst));
    }
  }

  setDisinterested(value: boolean): void {
    this.isDisinterested = value;
  }

  setAttention(value: number): void {
    this.attention = value;
  }
}

// Simple mock Section with grid structure
class MockSection {
  private rows: Array<{
    rowIndex: number;
    seats: Array<{ fan: MockFan | null }>;
    getSeats(): Array<{ getFan(): MockFan | null }>;
    getFans(): MockFan[];
  }> = [];

  constructor(rowCount: number, seatsPerRow: number) {
    for (let r = 0; r < rowCount; r++) {
      const seats: Array<{ fan: MockFan | null }> = [];
      for (let s = 0; s < seatsPerRow; s++) {
        seats.push({ fan: new MockFan() });
      }

      this.rows.push({
        rowIndex: r,
        seats,
        getSeats() {
          return this.seats.map(seat => ({
            getFan: () => seat.fan
          }));
        },
        getFans() {
          return this.seats.map(s => s.fan).filter((f): f is MockFan => f !== null);
        }
      });
    }
  }

  getRows() {
    return this.rows;
  }

  getFanAt(row: number, seat: number): MockFan | null {
    return this.rows[row]?.seats[seat]?.fan ?? null;
  }

  setFanAt(row: number, seat: number, fan: MockFan | null): void {
    if (this.rows[row]?.seats[seat]) {
      this.rows[row].seats[seat].fan = fan;
    }
  }

  getAllFans(): MockFan[] {
    return this.rows.flatMap(row => row.getFans());
  }
}

describe('RipplePropagationEngine', () => {
  let engine: RipplePropagationEngine;

  beforeEach(() => {
    engine = new RipplePropagationEngine({
      baseEffect: 40,
      maxRadius: 4,
      disinterestedBonus: 5,
      decayType: 'linear'
    });
  });

  describe('Manhattan Distance Calculation', () => {
    it('should calculate distance 0 for same position', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const epicenterBoost = ripple.affectedFans.get(epicenter as unknown as Fan);
      expect(epicenterBoost).toBe(40); // Full effect at distance 0
    });

    it('should calculate distance 1 for adjacent horizontal', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      const adjacent = section.getFanAt(1, 2)!; // Same row, next seat

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(adjacent as unknown as Fan);
      expect(boost).toBe(30); // 40 * (1 - 1/4) = 30
    });

    it('should calculate distance 1 for adjacent vertical', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      const adjacent = section.getFanAt(2, 1)!; // Next row, same seat

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(adjacent as unknown as Fan);
      expect(boost).toBe(30); // 40 * (1 - 1/4) = 30
    });

    it('should calculate distance 2 for diagonal', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      const diagonal = section.getFanAt(2, 2)!; // |1-2| + |1-2| = 2

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(diagonal as unknown as Fan);
      expect(boost).toBe(20); // 40 * (1 - 2/4) = 20
    });

    it('should calculate correct distance for far positions', () => {
      const section = new MockSection(6, 6);
      const epicenter = section.getFanAt(2, 2)!;
      const far = section.getFanAt(5, 5)!; // |2-5| + |2-5| = 6

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      // Distance 6 > maxRadius 4, should have no effect
      const boost = ripple.affectedFans.get(far as unknown as Fan);
      expect(boost).toBeUndefined();
    });
  });

  describe('Linear Decay Formula', () => {
    it('should apply full effect at epicenter (distance 0)', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(epicenter as unknown as Fan);
      expect(boost).toBe(40); // 100% of base
    });

    it('should apply 75% effect at distance 1', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      const fan = section.getFanAt(1, 2)!;

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(fan as unknown as Fan);
      expect(boost).toBe(30); // 40 * (1 - 1/4) = 30
    });

    it('should apply 50% effect at distance 2', () => {
      const section = new MockSection(5, 5);
      const epicenter = section.getFanAt(2, 2)!;
      const fan = section.getFanAt(2, 4)!; // Distance 2

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(fan as unknown as Fan);
      expect(boost).toBe(20); // 40 * (1 - 2/4) = 20
    });

    it('should apply 25% effect at distance 3', () => {
      const section = new MockSection(5, 5);
      const epicenter = section.getFanAt(1, 1)!;
      const fan = section.getFanAt(1, 4)!; // Distance 3

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(fan as unknown as Fan);
      expect(boost).toBe(10); // 40 * (1 - 3/4) = 10
    });

    it('should apply 0 effect at max radius (distance 4)', () => {
      const section = new MockSection(6, 6);
      const epicenter = section.getFanAt(1, 1)!;
      const fan = section.getFanAt(1, 5)!; // Distance 4

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(fan as unknown as Fan);
      // At max radius, effect is 0, so fan is not included in the map
      expect(boost).toBeUndefined(); // Not in map (0 effect)
    });

    it('should apply 0 effect beyond max radius', () => {
      const section = new MockSection(8, 8);
      const epicenter = section.getFanAt(2, 2)!;
      const fan = section.getFanAt(2, 7)!; // Distance 5

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const boost = ripple.affectedFans.get(fan as unknown as Fan);
      expect(boost).toBeUndefined(); // Not in map (beyond radius)
    });
  });

  describe('Disinterested Fan Bonus', () => {
    it('should add bonus for disinterested fans', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      const normalFan = section.getFanAt(1, 2)!;
      const disinterestedFan = section.getFanAt(2, 1)!;

      disinterestedFan.setDisinterested(true);

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      const normalBoost = ripple.affectedFans.get(normalFan as unknown as Fan);
      const disinterestedBoost = ripple.affectedFans.get(disinterestedFan as unknown as Fan);

      expect(disinterestedBoost).toBe((normalBoost ?? 0) + 5);
    });

    it('should apply disinterested bonus at all distances', () => {
      const section = new MockSection(5, 5);
      const epicenter = section.getFanAt(2, 2)!;

      // Distance 0 (epicenter)
      epicenter.setDisinterested(true);
      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);
      expect(ripple.affectedFans.get(epicenter as unknown as Fan)).toBe(45); // 40 + 5

      // Distance 2
      const fan2 = section.getFanAt(2, 4)!;
      fan2.setDisinterested(true);
      const ripple2 = engine.calculateRipple(fan2 as unknown as Fan, section as unknown as StadiumSection);
      expect(ripple2.affectedFans.get(epicenter as unknown as Fan)).toBe(25); // 20 + 5
    });
  });

  describe('Section Boundary Enforcement', () => {
    it('should only affect fans within the provided section', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      // All affected fans should be in the section
      const allFans = section.getAllFans();
      ripple.affectedFans.forEach((boost, fan) => {
        expect(allFans).toContain(fan as unknown as MockFan);
      });
    });

    it('should handle epicenter fan not in section', () => {
      const section = new MockSection(3, 3);
      const orphanFan = new MockFan();

      const ripple = engine.calculateRipple(orphanFan as unknown as Fan, section as unknown as StadiumSection);

      expect(ripple.affectedFans.size).toBe(0);
      expect(ripple.epicenterRow).toBe(-1);
      expect(ripple.epicenterSeat).toBe(-1);
    });
  });

  describe('Ripple Application', () => {
    it('should increase fan attention when applying ripple', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      epicenter.setAttention(50);

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);
      engine.applyRipple(ripple);

      expect(epicenter.getAttention()).toBe(90); // 50 + 40
    });

    it('should respect 100 attention cap', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;
      epicenter.setAttention(80);

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);
      engine.applyRipple(ripple);

      expect(epicenter.getAttention()).toBe(100); // Capped, not 120
    });

    it('should apply effects to all affected fans', () => {
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;

      const allFans = section.getAllFans();
      const initialAttention = allFans.map(f => f.getAttention());

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);
      engine.applyRipple(ripple);

      // All affected fans should have increased attention
      ripple.affectedFans.forEach((boost, fan) => {
        const mockFan = fan as unknown as MockFan;
        const index = allFans.indexOf(mockFan);
        expect(mockFan.getAttention()).toBeGreaterThan(initialAttention[index]);
      });
    });
  });

  describe('Multiple Ripple Combination', () => {
    it('should combine non-overlapping ripples', () => {
      const section = new MockSection(6, 6);
      const epicenter1 = section.getFanAt(0, 0)!; // Top-left
      const epicenter2 = section.getFanAt(5, 5)!; // Bottom-right

      const ripple1 = engine.calculateRipple(epicenter1 as unknown as Fan, section as unknown as StadiumSection);
      const ripple2 = engine.calculateRipple(epicenter2 as unknown as Fan, section as unknown as StadiumSection);

      const combined = engine.combineRipples([ripple1, ripple2]);

      // Should have fans from both ripples
      expect(combined.size).toBeGreaterThan(ripple1.affectedFans.size);
      expect(combined.size).toBeGreaterThan(ripple2.affectedFans.size);
    });

    it('should add effects for overlapping ripples', () => {
      const section = new MockSection(5, 5);
      const epicenter1 = section.getFanAt(2, 2)!; // Center
      const epicenter2 = section.getFanAt(2, 3)!; // Adjacent

      const ripple1 = engine.calculateRipple(epicenter1 as unknown as Fan, section as unknown as StadiumSection);
      const ripple2 = engine.calculateRipple(epicenter2 as unknown as Fan, section as unknown as StadiumSection);

      const combined = engine.combineRipples([ripple1, ripple2]);

      // Find overlapping fan
      const overlappingFan = section.getFanAt(2, 2)!; // Affected by both
      const boost1 = ripple1.affectedFans.get(overlappingFan as unknown as Fan) ?? 0;
      const boost2 = ripple2.affectedFans.get(overlappingFan as unknown as Fan) ?? 0;
      const combinedBoost = combined.get(overlappingFan as unknown as Fan);

      expect(combinedBoost).toBe(boost1 + boost2);
    });

    it('should handle three simultaneous ripples', () => {
      const section = new MockSection(6, 6);
      const epicenter1 = section.getFanAt(1, 1)!;
      const epicenter2 = section.getFanAt(3, 3)!;
      const epicenter3 = section.getFanAt(4, 4)!;

      const ripples = [
        engine.calculateRipple(epicenter1 as unknown as Fan, section as unknown as StadiumSection),
        engine.calculateRipple(epicenter2 as unknown as Fan, section as unknown as StadiumSection),
        engine.calculateRipple(epicenter3 as unknown as Fan, section as unknown as StadiumSection)
      ];

      const combined = engine.combineRipples(ripples);

      expect(combined.size).toBeGreaterThan(0);

      // All boosts should be positive
      combined.forEach(boost => {
        expect(boost).toBeGreaterThan(0);
      });
    });

    it('should apply combined ripples with 100 cap', () => {
      const section = new MockSection(3, 3);
      const epicenter1 = section.getFanAt(1, 1)!;
      const epicenter2 = section.getFanAt(1, 2)!;

      epicenter1.setAttention(70);

      const ripple1 = engine.calculateRipple(epicenter1 as unknown as Fan, section as unknown as StadiumSection);
      const ripple2 = engine.calculateRipple(epicenter2 as unknown as Fan, section as unknown as StadiumSection);

      const combined = engine.combineRipples([ripple1, ripple2]);
      engine.applyCombinedRipples(combined);

      // Should be capped at 100
      expect(epicenter1.getAttention()).toBe(100);
    });

    it('should handle empty ripple array', () => {
      const combined = engine.combineRipples([]);
      expect(combined.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-fan section', () => {
      const section = new MockSection(1, 1);
      const onlyFan = section.getFanAt(0, 0)!;

      const ripple = engine.calculateRipple(onlyFan as unknown as Fan, section as unknown as StadiumSection);

      expect(ripple.affectedFans.size).toBe(1);
      expect(ripple.affectedFans.get(onlyFan as unknown as Fan)).toBe(40);
    });

    it('should handle section with null fans (sparse seating)', () => {
      const section = new MockSection(3, 3);
      section.setFanAt(1, 1, null); // Remove center fan
      section.setFanAt(2, 2, null); // Remove corner fan

      const epicenter = section.getFanAt(0, 0)!;
      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      // Should not crash, should skip null fans
      expect(ripple.affectedFans.size).toBeGreaterThan(0);

      // Null fans should not be in affected map
      ripple.affectedFans.forEach((boost, fan) => {
        expect(fan).not.toBeNull();
      });
    });

    it('should handle zero radius configuration', () => {
      const zeroEngine = new RipplePropagationEngine({ maxRadius: 0 });
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;

      const ripple = zeroEngine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      // With radius 0, even epicenter gets 0 effect (1 - 0/0 = NaN -> 0)
      // So no fans are affected
      expect(ripple.affectedFans.size).toBe(0);
    });

    it('should handle very large radius', () => {
      const largeEngine = new RipplePropagationEngine({ maxRadius: 100 });
      const section = new MockSection(5, 5);
      const epicenter = section.getFanAt(2, 2)!;

      const ripple = largeEngine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      // Should affect all fans in section
      expect(ripple.affectedFans.size).toBe(25);
    });
  });

  describe('Configuration Management', () => {
    it('should return current configuration', () => {
      const config = engine.getConfig();

      expect(config.baseEffect).toBe(40);
      expect(config.maxRadius).toBe(4);
      expect(config.disinterestedBonus).toBe(5);
      expect(config.decayType).toBe('linear');
    });

    it('should update configuration', () => {
      engine.updateConfig({ baseEffect: 50, maxRadius: 3 });

      const config = engine.getConfig();
      expect(config.baseEffect).toBe(50);
      expect(config.maxRadius).toBe(3);
      expect(config.disinterestedBonus).toBe(5); // Unchanged
    });

    it('should throw error for exponential decay type', () => {
      const expEngine = new RipplePropagationEngine({ decayType: 'exponential' });
      const section = new MockSection(3, 3);
      const epicenter = section.getFanAt(1, 1)!;

      expect(() => {
        expEngine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);
      }).toThrow('Exponential decay type is not yet implemented');
    });
  });

  describe('Ripple Effect Result Structure', () => {
    it('should return correct epicenter position', () => {
      const section = new MockSection(4, 8);
      const epicenter = section.getFanAt(2, 5)!;

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      expect(ripple.epicenterFan).toBe(epicenter as unknown as Fan);
      expect(ripple.epicenterRow).toBe(2);
      expect(ripple.epicenterSeat).toBe(5);
    });

    it('should include all fans within radius in affected map', () => {
      const section = new MockSection(5, 5);
      const epicenter = section.getFanAt(2, 2)!;

      const ripple = engine.calculateRipple(epicenter as unknown as Fan, section as unknown as StadiumSection);

      // Count expected fans within Manhattan distance 4 from (2,2)
      // Note: distance 4 gets 0 effect, so only count distance < 4
      let expectedCount = 0;
      for (let r = 0; r < 5; r++) {
        for (let s = 0; s < 5; s++) {
          const distance = Math.abs(r - 2) + Math.abs(s - 2);
          if (distance < 4) { // Exclude distance 4 (0 effect)
            expectedCount++;
          }
        }
      }

      expect(ripple.affectedFans.size).toBe(expectedCount);
    });
  });
});
