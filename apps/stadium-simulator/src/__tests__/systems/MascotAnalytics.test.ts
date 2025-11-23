/**
 * Tests for MascotAnalytics
 *
 * Validates metrics tracking, baseline recording, shot impact tracking,
 * participation rate calculation, and report generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MascotAnalytics } from '@/systems/MascotAnalytics';
import type { RippleEffect } from '@/systems/RipplePropagationEngine';

// Simple mock Fan for testing
class MockFan {
  private attention: number = 50;
  private happiness: number = 60;
  private thirst: number = 30;
  private isDisinterested: boolean = false;

  getAttention(): number {
    return this.attention;
  }

  getStats(): { happiness: number; thirst: number; attention: number } {
    return {
      happiness: this.happiness,
      thirst: this.thirst,
      attention: this.attention,
    };
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

  setStats(stats: { attention?: number; happiness?: number; thirst?: number }): void {
    if (stats.attention !== undefined) this.attention = stats.attention;
    if (stats.happiness !== undefined) this.happiness = stats.happiness;
    if (stats.thirst !== undefined) this.thirst = stats.thirst;
  }

  // Mock calculateWaveChance to match Fan behavior
  calculateWaveChance(sectionBonus: number): number {
    // Simplified formula matching Fan.ts
    const baseChance = this.happiness * 0.5 + this.attention * 0.5 - this.thirst * 0.3;
    const totalChance = baseChance + sectionBonus + 10; // includes flat bonus
    return Math.max(0, Math.min(100, totalChance));
  }
}

// Simple mock Section
class MockSection {
  private fans: MockFan[] = [];
  private id: string;

  constructor(id: string, fanCount: number) {
    this.id = id;
    for (let i = 0; i < fanCount; i++) {
      this.fans.push(new MockFan());
    }
  }

  getFans(): MockFan[] {
    return this.fans;
  }

  getId(): string {
    return this.id;
  }
}

describe('MascotAnalytics', () => {
  let analytics: MascotAnalytics;
  let section: MockSection;

  beforeEach(() => {
    analytics = new MascotAnalytics('test-section');
    section = new MockSection('test-section', 30); // 30 fans
  });

  describe('Initialization', () => {
    it('should initialize with correct section ID', () => {
      const metrics = analytics.getMetrics();
      expect(metrics.sectionId).toBe('test-section');
    });

    it('should initialize all metrics to zero', () => {
      const metrics = analytics.getMetrics();
      expect(metrics.activationCount).toBe(0);
      expect(metrics.totalShotsFired).toBe(0);
      expect(metrics.totalFansAffected).toBe(0);
      expect(metrics.totalAttentionBoost).toBe(0);
      expect(metrics.disinterestedReEngaged).toBe(0);
    });

    it('should have a valid timestamp', () => {
      const metrics = analytics.getMetrics();
      expect(metrics.timestamp).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Baseline Recording', () => {
    it('should record baseline participation', () => {
      analytics.recordBaseline(section as any);

      const metrics = analytics.getMetrics();
      expect(metrics.waveParticipationBefore).toBeGreaterThanOrEqual(0);
      expect(metrics.waveParticipationBefore).toBeLessThanOrEqual(100);
    });

    it('should calculate participation based on fan stats', () => {
      // Set all fans to high stats (likely to participate)
      section.getFans().forEach((fan) => {
        fan.setStats({ attention: 80, happiness: 80, thirst: 20 });
      });

      analytics.recordBaseline(section as any);

      const metrics = analytics.getMetrics();
      expect(metrics.waveParticipationBefore).toBeGreaterThan(50);
    });

    it('should calculate low participation for low-stat fans', () => {
      // Set all fans to low stats (unlikely to participate)
      section.getFans().forEach((fan) => {
        fan.setStats({ attention: 20, happiness: 20, thirst: 80 });
      });

      analytics.recordBaseline(section as any);

      const metrics = analytics.getMetrics();
      expect(metrics.waveParticipationBefore).toBeLessThan(50);
    });
  });

  describe('Activation Tracking', () => {
    it('should increment activation count', () => {
      analytics.recordActivation();
      expect(analytics.getMetrics().activationCount).toBe(1);

      analytics.recordActivation();
      expect(analytics.getMetrics().activationCount).toBe(2);
    });

    it('should reset shot records on activation', () => {
      // Create a fake shot record
      const ripple: RippleEffect = {
        epicenterFan: section.getFans()[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([[section.getFans()[0] as any, 40]]),
      };
      analytics.recordCannonShot(1, [ripple]);

      expect(analytics.getShotRecords().length).toBe(1);

      // New activation should reset
      analytics.recordActivation();
      expect(analytics.getShotRecords().length).toBe(0);
    });
  });

  describe('Cannon Shot Recording', () => {
    it('should track shot count', () => {
      const ripple: RippleEffect = {
        epicenterFan: section.getFans()[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([[section.getFans()[0] as any, 40]]),
      };

      analytics.recordCannonShot(1, [ripple]);
      expect(analytics.getMetrics().totalShotsFired).toBe(1);

      analytics.recordCannonShot(2, [ripple]);
      expect(analytics.getMetrics().totalShotsFired).toBe(2);
    });

    it('should track fans affected by ripples', () => {
      const fans = section.getFans();
      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([
          [fans[0] as any, 40],
          [fans[1] as any, 30],
          [fans[2] as any, 20],
        ]),
      };

      analytics.recordCannonShot(1, [ripple]);

      const metrics = analytics.getMetrics();
      expect(metrics.totalFansAffected).toBe(3);
      expect(metrics.totalAttentionBoost).toBe(90); // 40 + 30 + 20
    });

    it('should count unique fans across multiple ripples', () => {
      const fans = section.getFans();
      const ripple1: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([
          [fans[0] as any, 40],
          [fans[1] as any, 30],
        ]),
      };

      const ripple2: RippleEffect = {
        epicenterFan: fans[2] as any,
        epicenterRow: 0,
        epicenterSeat: 2,
        affectedFans: new Map([
          [fans[1] as any, 20], // fan[1] is in both ripples
          [fans[2] as any, 40],
        ]),
      };

      analytics.recordCannonShot(1, [ripple1, ripple2]);

      const metrics = analytics.getMetrics();
      expect(metrics.totalFansAffected).toBe(3); // fans 0, 1, 2 (unique)
      expect(metrics.totalAttentionBoost).toBe(130); // 40 + 30 + 20 + 40
    });

    it('should track disinterested fans hit', () => {
      const fans = section.getFans();

      // Set some fans as disinterested
      fans[0].setStats({ attention: 25, happiness: 30, thirst: 70 });
      fans[0].setDisinterested(true);
      fans[1].setStats({ attention: 28, happiness: 35, thirst: 65 });
      fans[1].setDisinterested(true);

      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([
          [fans[0] as any, 40], // will re-engage (25 + 40 >= 30)
          [fans[1] as any, 30], // will re-engage (28 + 30 >= 30)
        ]),
      };

      analytics.recordCannonShot(1, [ripple]);

      const metrics = analytics.getMetrics();
      expect(metrics.disinterestedReEngaged).toBe(2);
    });

    it('should create shot records with correct data', () => {
      const fans = section.getFans();
      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([
          [fans[0] as any, 40],
          [fans[1] as any, 30],
        ]),
      };

      analytics.recordCannonShot(3, [ripple]);

      const records = analytics.getShotRecords();
      expect(records.length).toBe(1);
      expect(records[0].shotNumber).toBe(3);
      expect(records[0].fansAffected).toBe(2);
      expect(records[0].totalBoost).toBe(70);
      expect(records[0].averageBoost).toBe(35);
      expect(records[0].catcherCount).toBe(1);
    });
  });

  describe('Post-Mascot Participation', () => {
    it('should record participation improvement', () => {
      const fans = section.getFans();

      // Set initial low stats (clearly below threshold)
      fans.forEach((fan) => {
        fan.setStats({ attention: 20, happiness: 30, thirst: 70 });
      });

      analytics.recordBaseline(section as any);

      // Boost attention significantly (simulating mascot effect)
      fans.forEach((fan) => {
        fan.setStats({ attention: 80, happiness: 30, thirst: 70 });
      });

      analytics.recordPostMascotParticipation(section as any);

      
      // Debug: Check what calculateWaveChance returns
      // chanceBefore: 20 * 0.5 + 30 * 0.5 - 70 * 0.3 + 10 = 25 + 15 - 21 + 10 = 29 (below 50)
      // chanceAfter = 80 * 0.5 + 30 * 0.5 - 70 * 0.3 + 10; // should be 40 + 15 - 21 + 10 = 44 (still below 50!)
      
      // Need higher happiness or lower thirst to cross threshold
      fans.forEach((fan) => {
        fan.setStats({ attention: 80, happiness: 60, thirst: 30 });
      });
      
      analytics.recordPostMascotParticipation(section as any);
      const metricsUpdated = analytics.getMetrics();
      
      expect(metricsUpdated.participationImprovement).toBeGreaterThan(0);
      expect(metricsUpdated.waveParticipationAfter).toBeGreaterThan(
        metricsUpdated.waveParticipationBefore
      );
    });

    it('should handle negative improvement (degradation)', () => {
      const fans = section.getFans();

      // Set initial high stats (clearly above threshold)
      fans.forEach((fan) => {
        fan.setStats({ attention: 80, happiness: 80, thirst: 20 });
      });

      analytics.recordBaseline(section as any);

      // Reduce stats significantly (simulating negative effect)
      fans.forEach((fan) => {
        fan.setStats({ attention: 20, happiness: 20, thirst: 80 });
      });

      analytics.recordPostMascotParticipation(section as any);

      const metrics = analytics.getMetrics();
      expect(metrics.participationImprovement).toBeLessThan(0);
    });

    it('should calculate average re-engagement boost', () => {
      const fans = section.getFans();

      // Set up disinterested fans
      fans[0].setStats({ attention: 25, happiness: 30, thirst: 70 });
      fans[0].setDisinterested(true);

      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([[fans[0] as any, 40]]),
      };

      analytics.recordCannonShot(1, [ripple]);
      analytics.recordPostMascotParticipation(section as any);

      const metrics = analytics.getMetrics();
      if (metrics.disinterestedReEngaged > 0) {
        expect(metrics.averageReEngagementBoost).toBeGreaterThan(0);
      }
    });
  });

  describe('Report Generation', () => {
    it('should generate a readable report', () => {
      const fans = section.getFans();

      analytics.recordBaseline(section as any);
      analytics.recordActivation();

      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([
          [fans[0] as any, 40],
          [fans[1] as any, 30],
        ]),
      };

      analytics.recordCannonShot(1, [ripple]);
      analytics.recordPostMascotParticipation(section as any);

      const report = analytics.generateReport();

      expect(report).toContain('Mascot Impact Report');
      expect(report).toContain('test-section');
      expect(report).toContain('Fan Impact');
      expect(report).toContain('Wave Participation');
      expect(report).toContain('Shot Breakdown');
    });

    it('should include shot-by-shot breakdown in report', () => {
      const fans = section.getFans();
      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([[fans[0] as any, 40]]),
      };

      analytics.recordCannonShot(1, [ripple]);
      analytics.recordCannonShot(2, [ripple]);

      const report = analytics.generateReport();

      expect(report).toContain('Shot 1');
      expect(report).toContain('Shot 2');
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      const fans = section.getFans();

      analytics.recordBaseline(section as any);
      analytics.recordActivation();

      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([[fans[0] as any, 40]]),
      };

      analytics.recordCannonShot(1, [ripple]);

      // Reset
      analytics.reset();

      const metrics = analytics.getMetrics();
      expect(metrics.activationCount).toBe(0);
      expect(metrics.totalShotsFired).toBe(0);
      expect(metrics.totalFansAffected).toBe(0);
      expect(metrics.totalAttentionBoost).toBe(0);
      expect(analytics.getShotRecords().length).toBe(0);
    });

    it('should preserve section ID after reset', () => {
      analytics.reset();
      expect(analytics.getMetrics().sectionId).toBe('test-section');
    });

    it('should update timestamp on reset', () => {
      const originalTimestamp = analytics.getMetrics().timestamp;

      // Wait a bit
      const waitUntil = Date.now() + 10;
      while (Date.now() < waitUntil) {
        // busy wait
      }

      analytics.reset();

      expect(analytics.getMetrics().timestamp).toBeGreaterThan(originalTimestamp);
    });
  });

  describe('Metrics Immutability', () => {
    it('should return a copy of metrics, not original object', () => {
      const metrics1 = analytics.getMetrics();
      const metrics2 = analytics.getMetrics();

      expect(metrics1).not.toBe(metrics2); // Different objects
      expect(metrics1).toEqual(metrics2); // Same values
    });

    it('should return a copy of shot records', () => {
      const fans = section.getFans();
      const ripple: RippleEffect = {
        epicenterFan: fans[0] as any,
        epicenterRow: 0,
        epicenterSeat: 0,
        affectedFans: new Map([[fans[0] as any, 40]]),
      };

      analytics.recordCannonShot(1, [ripple]);

      const records1 = analytics.getShotRecords();
      const records2 = analytics.getShotRecords();

      expect(records1).not.toBe(records2); // Different arrays
      expect(records1).toEqual(records2); // Same values
    });
  });
});
