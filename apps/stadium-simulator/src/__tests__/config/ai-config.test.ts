/**
 * Tests for AI Configuration and Epoch System
 * 
 * Validates deterministic epoch calculation, configuration integrity,
 * and edge case handling for the AI content rotation system.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  aiConfig,
  getCurrentEpoch,
  getEpochStartTime,
  getEpochEndTime,
  getTimeUntilNextEpoch,
  isInEpoch,
  type Environment,
} from '@/config/ai-config';

describe('AI Configuration', () => {
  describe('Configuration Structure', () => {
    it('should have valid epoch configuration', () => {
      expect(aiConfig.epoch).toBeDefined();
      expect(aiConfig.epoch.developmentDuration).toBeGreaterThan(0);
      expect(aiConfig.epoch.productionDuration).toBeGreaterThan(0);
      expect(aiConfig.epoch.epochZero).toBeGreaterThan(0);
    });

    it('should have development duration shorter than production', () => {
      expect(aiConfig.epoch.developmentDuration).toBeLessThan(
        aiConfig.epoch.productionDuration
      );
    });

    it('should have valid cost configuration', () => {
      expect(aiConfig.cost).toBeDefined();
      expect(aiConfig.cost.enabled).toBeDefined();
      expect(aiConfig.cost.maxCostPerSession).toBeGreaterThan(0);
      expect(aiConfig.cost.maxCostPerUserPerDay).toBeGreaterThan(0);
      expect(aiConfig.cost.estimatedCostPerCall).toBeGreaterThan(0);
      expect(aiConfig.cost.warningThreshold).toBeGreaterThan(0);
      expect(aiConfig.cost.warningThreshold).toBeLessThanOrEqual(1);
    });

    it('should have valid content variation configuration', () => {
      expect(aiConfig.contentVariation).toBeDefined();
      expect(aiConfig.contentVariation.enabled).toBeDefined();
      expect(aiConfig.contentVariation.variantsPerType).toBeGreaterThan(0);
      expect(aiConfig.contentVariation.minRefreshInterval).toBeGreaterThan(0);
    });

    it('should have daily cost limit greater than session limit', () => {
      expect(aiConfig.cost.maxCostPerUserPerDay).toBeGreaterThanOrEqual(
        aiConfig.cost.maxCostPerSession
      );
    });
  });

  describe('getCurrentEpoch - Deterministic Behavior', () => {
    it('should return the same epoch for the same timestamp', () => {
      const timestamp = Date.UTC(2025, 0, 15, 12, 0, 0); // Jan 15, 2025, noon UTC
      const epoch1 = getCurrentEpoch(timestamp, 'production');
      const epoch2 = getCurrentEpoch(timestamp, 'production');
      
      expect(epoch1).toBe(epoch2);
      expect(epoch1).toBeGreaterThanOrEqual(0);
    });

    it('should return different epochs for timestamps in different periods', () => {
      const day1 = Date.UTC(2025, 0, 2, 0, 0, 0); // Jan 2, 2025
      const day2 = Date.UTC(2025, 0, 3, 0, 0, 0); // Jan 3, 2025
      
      const epoch1 = getCurrentEpoch(day1, 'production');
      const epoch2 = getCurrentEpoch(day2, 'production');
      
      expect(epoch2).toBeGreaterThan(epoch1);
    });

    it('should return epoch 0 for timestamp at epoch zero', () => {
      const epochZero = aiConfig.epoch.epochZero;
      const epoch = getCurrentEpoch(epochZero, 'production');
      
      expect(epoch).toBe(0);
    });

    it('should handle timestamps before epoch zero', () => {
      const beforeEpochZero = aiConfig.epoch.epochZero - 1000;
      const epoch = getCurrentEpoch(beforeEpochZero, 'production');
      
      expect(epoch).toBe(0);
    });

    it('should return epoch 0 for very early timestamps', () => {
      const veryEarly = Date.UTC(2020, 0, 1, 0, 0, 0); // Jan 1, 2020
      const epoch = getCurrentEpoch(veryEarly, 'production');
      
      expect(epoch).toBe(0);
    });
  });

  describe('getCurrentEpoch - Environment Differences', () => {
    it('should return different epochs for different environments with same timestamp', () => {
      const timestamp = Date.UTC(2025, 0, 2, 0, 0, 0);
      
      const devEpoch = getCurrentEpoch(timestamp, 'development');
      const prodEpoch = getCurrentEpoch(timestamp, 'production');
      
      // Development epochs change more frequently, so dev epoch should be higher
      expect(devEpoch).toBeGreaterThanOrEqual(prodEpoch);
    });

    it('should use production by default', () => {
      const timestamp = Date.UTC(2025, 0, 2, 0, 0, 0);
      
      const defaultEpoch = getCurrentEpoch(timestamp);
      const prodEpoch = getCurrentEpoch(timestamp, 'production');
      
      expect(defaultEpoch).toBe(prodEpoch);
    });

    it('should progress faster in development than production', () => {
      const start = Date.UTC(2025, 0, 2, 0, 0, 0);
      const end = Date.UTC(2025, 0, 3, 0, 0, 0); // 24 hours later
      
      const devEpochStart = getCurrentEpoch(start, 'development');
      const devEpochEnd = getCurrentEpoch(end, 'development');
      const devEpochDiff = devEpochEnd - devEpochStart;
      
      const prodEpochStart = getCurrentEpoch(start, 'production');
      const prodEpochEnd = getCurrentEpoch(end, 'production');
      const prodEpochDiff = prodEpochEnd - prodEpochStart;
      
      // After 24 hours, development should have progressed through more epochs
      expect(devEpochDiff).toBeGreaterThan(prodEpochDiff);
    });
  });

  describe('getCurrentEpoch - Edge Cases', () => {
    it('should handle boundary between epochs correctly', () => {
      const epochZero = aiConfig.epoch.epochZero;
      const prodDuration = aiConfig.epoch.productionDuration;
      
      // Just before epoch 1
      const justBeforeEpoch1 = epochZero + prodDuration - 1;
      const epochBefore = getCurrentEpoch(justBeforeEpoch1, 'production');
      
      // Exactly at epoch 1
      const exactlyEpoch1 = epochZero + prodDuration;
      const epochAt = getCurrentEpoch(exactlyEpoch1, 'production');
      
      expect(epochBefore).toBe(0);
      expect(epochAt).toBe(1);
    });

    it('should handle millisecond precision boundaries', () => {
      const epochZero = aiConfig.epoch.epochZero;
      const devDuration = aiConfig.epoch.developmentDuration;
      
      const timestamps = [
        epochZero + devDuration - 1,     // Last ms of epoch 0
        epochZero + devDuration,         // First ms of epoch 1
        epochZero + devDuration + 1,     // Second ms of epoch 1
      ];
      
      const epochs = timestamps.map(t => getCurrentEpoch(t, 'development'));
      
      expect(epochs[0]).toBe(0);
      expect(epochs[1]).toBe(1);
      expect(epochs[2]).toBe(1);
    });

    it('should handle very large timestamps', () => {
      const farFuture = Date.UTC(2100, 0, 1, 0, 0, 0); // Year 2100
      const epoch = getCurrentEpoch(farFuture, 'production');
      
      expect(epoch).toBeGreaterThan(0);
      expect(Number.isFinite(epoch)).toBe(true);
      expect(Number.isInteger(epoch)).toBe(true);
    });

    it('should handle current time without errors', () => {
      const now = Date.now();
      const epoch = getCurrentEpoch(now, 'production');
      
      expect(epoch).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(epoch)).toBe(true);
    });
  });

  describe('getEpochStartTime', () => {
    it('should return epoch zero for epoch 0', () => {
      const startTime = getEpochStartTime(0, 'production');
      expect(startTime).toBe(aiConfig.epoch.epochZero);
    });

    it('should return correct start time for epoch 1', () => {
      const startTime = getEpochStartTime(1, 'production');
      const expected = aiConfig.epoch.epochZero + aiConfig.epoch.productionDuration;
      
      expect(startTime).toBe(expected);
    });

    it('should calculate correct start times for arbitrary epochs', () => {
      const epochNumber = 10;
      const startTime = getEpochStartTime(epochNumber, 'production');
      const expected = aiConfig.epoch.epochZero + (epochNumber * aiConfig.epoch.productionDuration);
      
      expect(startTime).toBe(expected);
    });

    it('should differ between environments', () => {
      const epochNumber = 5;
      const devStart = getEpochStartTime(epochNumber, 'development');
      const prodStart = getEpochStartTime(epochNumber, 'production');
      
      // Same epoch number but different durations means different start times
      expect(devStart).not.toBe(prodStart);
    });
  });

  describe('getEpochEndTime', () => {
    it('should return start of next epoch', () => {
      const epochNumber = 5;
      const endTime = getEpochEndTime(epochNumber, 'production');
      const nextEpochStart = getEpochStartTime(epochNumber + 1, 'production');
      
      expect(endTime).toBe(nextEpochStart);
    });

    it('should be exactly one duration after start time', () => {
      const epochNumber = 3;
      const startTime = getEpochStartTime(epochNumber, 'production');
      const endTime = getEpochEndTime(epochNumber, 'production');
      const duration = endTime - startTime;
      
      expect(duration).toBe(aiConfig.epoch.productionDuration);
    });
  });

  describe('getTimeUntilNextEpoch', () => {
    it('should return positive time remaining', () => {
      const timestamp = Date.UTC(2025, 0, 2, 12, 0, 0);
      const timeRemaining = getTimeUntilNextEpoch(timestamp, 'production');
      
      expect(timeRemaining).toBeGreaterThan(0);
    });

    it('should be less than epoch duration', () => {
      const timestamp = Date.UTC(2025, 0, 2, 12, 0, 0);
      const timeRemaining = getTimeUntilNextEpoch(timestamp, 'production');
      
      expect(timeRemaining).toBeLessThanOrEqual(aiConfig.epoch.productionDuration);
    });

    it('should return full duration at epoch boundary', () => {
      const epochZero = aiConfig.epoch.epochZero;
      const timeRemaining = getTimeUntilNextEpoch(epochZero, 'production');
      
      expect(timeRemaining).toBe(aiConfig.epoch.productionDuration);
    });

    it('should return near-zero time just before epoch transition', () => {
      const epochZero = aiConfig.epoch.epochZero;
      const prodDuration = aiConfig.epoch.productionDuration;
      const almostNextEpoch = epochZero + prodDuration - 1;
      
      const timeRemaining = getTimeUntilNextEpoch(almostNextEpoch, 'production');
      
      expect(timeRemaining).toBe(1); // 1 millisecond remaining
    });

    it('should use current time by default', () => {
      const timeRemaining = getTimeUntilNextEpoch();
      
      expect(timeRemaining).toBeGreaterThan(0);
      expect(timeRemaining).toBeLessThanOrEqual(aiConfig.epoch.productionDuration);
    });
  });

  describe('isInEpoch', () => {
    it('should return true for timestamp within specified epoch', () => {
      const epochNumber = 5;
      const startTime = getEpochStartTime(epochNumber, 'production');
      const midTime = startTime + (aiConfig.epoch.productionDuration / 2);
      
      expect(isInEpoch(midTime, epochNumber, 'production')).toBe(true);
    });

    it('should return false for timestamp outside specified epoch', () => {
      const epochNumber = 5;
      const nextEpochStart = getEpochStartTime(epochNumber + 1, 'production');
      
      expect(isInEpoch(nextEpochStart, epochNumber, 'production')).toBe(false);
    });

    it('should return true for start boundary', () => {
      const epochNumber = 3;
      const startTime = getEpochStartTime(epochNumber, 'production');
      
      expect(isInEpoch(startTime, epochNumber, 'production')).toBe(true);
    });

    it('should return false for end boundary', () => {
      const epochNumber = 3;
      const endTime = getEpochEndTime(epochNumber, 'production');
      
      expect(isInEpoch(endTime, epochNumber, 'production')).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should maintain consistency across multiple calls', () => {
      const timestamp = Date.now();
      const epochs = Array.from({ length: 100 }, () => 
        getCurrentEpoch(timestamp, 'production')
      );
      
      // All calls with same timestamp should return same epoch
      const uniqueEpochs = new Set(epochs);
      expect(uniqueEpochs.size).toBe(1);
    });

    it('should handle rapid successive calls', () => {
      const epochs: number[] = [];
      const startTime = Date.now();
      
      // Make 1000 rapid calls
      for (let i = 0; i < 1000; i++) {
        epochs.push(getCurrentEpoch(startTime + i, 'production'));
      }
      
      // All should be valid integers
      expect(epochs.every(e => Number.isInteger(e) && e >= 0)).toBe(true);
    });

    it('should calculate epoch correctly for realistic test dates', () => {
      // Test specific known dates
      const jan1_2025 = Date.UTC(2025, 0, 1, 0, 0, 0);
      const jan2_2025 = Date.UTC(2025, 0, 2, 0, 0, 0);
      
      const epoch1 = getCurrentEpoch(jan1_2025, 'production');
      const epoch2 = getCurrentEpoch(jan2_2025, 'production');
      
      // Should be in different epochs (24 hours = 1 production epoch)
      expect(epoch2).toBe(epoch1 + 1);
    });

    it('should support content caching strategy', () => {
      const now = Date.now();
      const currentEpoch = getCurrentEpoch(now, 'production');
      const epochStart = getEpochStartTime(currentEpoch, 'production');
      const epochEnd = getEpochEndTime(currentEpoch, 'production');
      
      // Verify cache key would be stable within epoch
      expect(now).toBeGreaterThanOrEqual(epochStart);
      expect(now).toBeLessThan(epochEnd);
      
      // Any timestamp in this range should yield same epoch
      const midEpoch = epochStart + ((epochEnd - epochStart) / 2);
      expect(getCurrentEpoch(midEpoch, 'production')).toBe(currentEpoch);
    });
  });

  describe('Production vs Development Timing', () => {
    it('should have correct duration ratios', () => {
      const devDuration = aiConfig.epoch.developmentDuration;
      const prodDuration = aiConfig.epoch.productionDuration;
      
      // Production should be exactly 24x development (24 hours vs 1 hour)
      expect(prodDuration / devDuration).toBe(24);
    });

    it('should advance 24 dev epochs per production epoch', () => {
      const start = aiConfig.epoch.epochZero;
      const end = start + aiConfig.epoch.productionDuration;
      
      const devEpochsDiff = getCurrentEpoch(end, 'development') - getCurrentEpoch(start, 'development');
      const prodEpochsDiff = getCurrentEpoch(end, 'production') - getCurrentEpoch(start, 'production');
      
      expect(devEpochsDiff).toBe(24);
      expect(prodEpochsDiff).toBe(1);
    });
  });
});
