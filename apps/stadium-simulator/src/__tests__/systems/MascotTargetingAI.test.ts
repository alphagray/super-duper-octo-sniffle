/**
 * Tests for MascotTargetingAI
 *
 * Validates targeting weight calculation, selection logic, disinterested fan
 * prioritization, distance weighting, and duplicate prevention.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MascotTargetingAI } from '@/systems/MascotTargetingAI';
import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { Mascot } from '@/sprites/Mascot';

// Simple mock Fan for testing
class MockFan {
  public x: number;
  public y: number;
  private isDisinterested: boolean = false;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }

  getIsDisinterested(): boolean {
    return this.isDisinterested;
  }

  setDisinterested(value: boolean): void {
    this.isDisinterested = value;
  }
}

// Simple mock Mascot for testing
class MockMascot {
  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    this.x = x;
    this.y = y;
  }
}

// Simple mock Section
class MockSection {
  private fans: MockFan[] = [];

  constructor(fanCount: number = 10) {
    for (let i = 0; i < fanCount; i++) {
      // Spread fans out in a grid pattern
      const x = (i % 5) * 50; // 5 fans per row, 50px apart
      const y = Math.floor(i / 5) * 50;
      this.fans.push(new MockFan(x, y));
    }
  }

  getFans(): MockFan[] {
    return this.fans;
  }

  addFan(fan: MockFan): void {
    this.fans.push(fan);
  }

  setFans(fans: MockFan[]): void {
    this.fans = fans;
  }
}

describe('MascotTargetingAI', () => {
  let ai: MascotTargetingAI;
  let section: MockSection;
  let mascot: MockMascot;

  beforeEach(() => {
    ai = new MascotTargetingAI();
    section = new MockSection(10);
    mascot = new MockMascot(100, 100);
  });

  describe('Weight Calculation', () => {
    it('should calculate higher weight for disinterested fans', () => {
      const normalFan = new MockFan(50, 50);
      const disinterestedFan = new MockFan(50, 50); // Same position as normal
      disinterestedFan.setDisinterested(true);

      section.setFans([normalFan, disinterestedFan]);

      // Run selection multiple times and count which fan gets selected more
      let normalCount = 0;
      let disinterestedCount = 0;

      for (let i = 0; i < 100; i++) {
        ai.reset();
        const selected = ai.selectCatchingFans(
          section as unknown as StadiumSection,
          mascot as unknown as Mascot
        );

        if (selected.length > 0) {
          if (selected[0] === (normalFan as unknown as Fan)) {
            normalCount++;
          } else {
            disinterestedCount++;
          }
        }
      }

      // Disinterested should be selected ~75% of time (3x weight = 75% vs 25%)
      expect(disinterestedCount).toBeGreaterThan(normalCount);
      expect(disinterestedCount).toBeGreaterThan(60); // Allow some variance
    });

    it('should calculate higher weight for fans farther from mascot', () => {
      const closeFan = new MockFan(110, 110); // 14px from mascot
      const farFan = new MockFan(300, 300); // 283px from mascot

      section.setFans([closeFan, farFan]);

      // Run selection multiple times
      let closeCount = 0;
      let farCount = 0;

      for (let i = 0; i < 100; i++) {
        ai.reset();
        const selected = ai.selectCatchingFans(
          section as unknown as StadiumSection,
          mascot as unknown as Mascot
        );

        if (selected.length > 0) {
          if (selected[0] === (closeFan as unknown as Fan)) {
            closeCount++;
          } else {
            farCount++;
          }
        }
      }

      // Far fan should be selected more often
      expect(farCount).toBeGreaterThan(closeCount);
    });

    it('should combine disinterested and distance weights', () => {
      // Close disinterested fan vs far normal fan
      const closeDisinterested = new MockFan(110, 110);
      closeDisinterested.setDisinterested(true);

      const farNormal = new MockFan(300, 300);

      section.setFans([closeDisinterested, farNormal]);

      // Run selection multiple times
      let closeDisinterestedCount = 0;
      let farNormalCount = 0;

      for (let i = 0; i < 100; i++) {
        ai.reset();
        const selected = ai.selectCatchingFans(
          section as unknown as StadiumSection,
          mascot as unknown as Mascot
        );

        if (selected.length > 0) {
          if (selected[0] === (closeDisinterested as unknown as Fan)) {
            closeDisinterestedCount++;
          } else {
            farNormalCount++;
          }
        }
      }

      // Close disinterested should still win due to 3x multiplier
      expect(closeDisinterestedCount).toBeGreaterThan(farNormalCount);
    });
  });

  describe('Selection Logic', () => {
    it('should select 1-3 fans per shot', () => {
      const catchers = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBeGreaterThanOrEqual(1);
      expect(catchers.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array if no fans available', () => {
      const emptySection = new MockSection(0);

      const catchers = ai.selectCatchingFans(
        emptySection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBe(0);
    });

    it('should handle section with fewer than 3 fans', () => {
      const smallSection = new MockSection(2);

      const catchers = ai.selectCatchingFans(
        smallSection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBeGreaterThanOrEqual(1);
      expect(catchers.length).toBeLessThanOrEqual(2); // Can't select more than exist
    });

    it('should select unique fans (no duplicates in single shot)', () => {
      const catchers = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      const uniqueCatchers = new Set(catchers);
      expect(catchers.length).toBe(uniqueCatchers.size);
    });
  });

  describe('Disinterested Fan Prioritization', () => {
    it('should heavily favor disinterested fans statistically', () => {
      // Create section with 5 disinterested and 5 normal fans
      const fans: MockFan[] = [];

      for (let i = 0; i < 5; i++) {
        const disinterestedFan = new MockFan(i * 50, 0);
        disinterestedFan.setDisinterested(true);
        fans.push(disinterestedFan);
      }

      for (let i = 0; i < 5; i++) {
        fans.push(new MockFan(i * 50, 50));
      }

      section.setFans(fans);

      // Run 100 trials
      const allCatchers: MockFan[] = [];
      for (let i = 0; i < 100; i++) {
        ai.reset();
        const catchers = ai.selectCatchingFans(
          section as unknown as StadiumSection,
          mascot as unknown as Mascot
        );
        allCatchers.push(...(catchers as unknown as MockFan[]));
      }

      // Count disinterested catches
      const disinterestedCatches = allCatchers.filter(f => f.getIsDisinterested()).length;
      const percentDisinterested = (disinterestedCatches / allCatchers.length) * 100;

      // Should be around 75% (3x weight with 50/50 population)
      expect(percentDisinterested).toBeGreaterThan(60);
      expect(percentDisinterested).toBeLessThan(90);
    });

    it('should handle section with all disinterested fans', () => {
      const fans: MockFan[] = [];
      for (let i = 0; i < 10; i++) {
        const fan = new MockFan(i * 50, 0);
        fan.setDisinterested(true);
        fans.push(fan);
      }
      section.setFans(fans);

      const catchers = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBeGreaterThan(0);
      expect(catchers.every(f => (f as unknown as MockFan).getIsDisinterested())).toBe(true);
    });

    it('should handle section with no disinterested fans', () => {
      // Default section has no disinterested fans
      const catchers = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBeGreaterThan(0);
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent same fan from catching twice in one activation', () => {
      const shot1 = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );
      const shot2 = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );
      const shot3 = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      const allCatchers = [...shot1, ...shot2, ...shot3];
      const uniqueCatchers = new Set(allCatchers);

      expect(allCatchers.length).toBe(uniqueCatchers.size);
    });

    it('should return empty array when all fans already targeted', () => {
      const smallSection = new MockSection(3);

      // First shot: select 1-3 fans
      const shot1 = ai.selectCatchingFans(
        smallSection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      // Second shot: select remaining
      const shot2 = ai.selectCatchingFans(
        smallSection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      // Third shot: all targeted, should return empty
      const shot3 = ai.selectCatchingFans(
        smallSection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(shot1.length).toBeGreaterThan(0);
      expect(shot1.length + shot2.length).toBeLessThanOrEqual(3);
      expect(shot3.length).toBe(0);
    });

    it('should track targeted count correctly', () => {
      expect(ai.getTargetedCount()).toBe(0);

      ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      const countAfterFirstShot = ai.getTargetedCount();
      expect(countAfterFirstShot).toBeGreaterThan(0);
      expect(countAfterFirstShot).toBeLessThanOrEqual(3);

      ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      const countAfterSecondShot = ai.getTargetedCount();
      expect(countAfterSecondShot).toBeGreaterThanOrEqual(countAfterFirstShot);
    });

    it('should check if specific fan has been targeted', () => {
      const fan = section.getFans()[0];

      expect(ai.hasBeenTargeted(fan as unknown as Fan)).toBe(false);

      // Keep selecting until we get this specific fan
      let targeted = false;
      for (let i = 0; i < 10 && !targeted; i++) {
        const catchers = ai.selectCatchingFans(
          section as unknown as StadiumSection,
          mascot as unknown as Mascot
        );

        if (catchers.includes(fan as unknown as Fan)) {
          targeted = true;
        }
      }

      if (targeted) {
        expect(ai.hasBeenTargeted(fan as unknown as Fan)).toBe(true);
      }
    });
  });

  describe('Reset Functionality', () => {
    it('should clear targeted fans on reset', () => {
      ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(ai.getTargetedCount()).toBeGreaterThan(0);

      ai.reset();

      expect(ai.getTargetedCount()).toBe(0);
    });

    it('should allow re-targeting fans after reset', () => {
      const firstShot = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(firstShot.length).toBeGreaterThan(0);

      const firstFan = firstShot[0];
      expect(ai.hasBeenTargeted(firstFan)).toBe(true);

      ai.reset();

      expect(ai.hasBeenTargeted(firstFan)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle section with single fan', () => {
      const singleFanSection = new MockSection(1);

      const shot1 = ai.selectCatchingFans(
        singleFanSection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(shot1.length).toBe(1);

      const shot2 = ai.selectCatchingFans(
        singleFanSection as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(shot2.length).toBe(0); // Fan already targeted
    });

    it('should handle mascot at same position as fans', () => {
      const fan1 = new MockFan(100, 100); // Same as mascot
      const fan2 = new MockFan(200, 200);

      section.setFans([fan1, fan2]);

      const catchers = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBeGreaterThan(0); // Should still select
    });

    it('should handle fans at exact same position', () => {
      const fan1 = new MockFan(100, 100);
      const fan2 = new MockFan(100, 100); // Exact same position
      const fan3 = new MockFan(100, 100);

      section.setFans([fan1, fan2, fan3]);

      const catchers = ai.selectCatchingFans(
        section as unknown as StadiumSection,
        mascot as unknown as Mascot
      );

      expect(catchers.length).toBeGreaterThan(0);
      expect(catchers.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Statistical Distribution', () => {
    it('should distribute selections reasonably across multiple trials', () => {
      const selectionCounts = new Map<MockFan, number>();
      const fans = section.getFans();

      fans.forEach(fan => selectionCounts.set(fan, 0));

      // Run 100 trials
      for (let i = 0; i < 100; i++) {
        ai.reset();
        const catchers = ai.selectCatchingFans(
          section as unknown as StadiumSection,
          mascot as unknown as Mascot
        ) as unknown as MockFan[];

        catchers.forEach(fan => {
          selectionCounts.set(fan, (selectionCounts.get(fan) || 0) + 1);
        });
      }

      // Every fan should be selected at least once over 100 trials
      const neverSelected = Array.from(selectionCounts.values()).filter(count => count === 0);
      expect(neverSelected.length).toBeLessThan(3); // Allow a few fans to be unlucky

      // No single fan should dominate (unless it's the only disinterested one)
      const maxSelections = Math.max(...Array.from(selectionCounts.values()));
      expect(maxSelections).toBeLessThan(80); // Allow some variance
    });
  });
});
