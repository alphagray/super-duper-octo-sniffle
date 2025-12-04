import { describe, it, expect } from 'vitest';
import { gameBalance } from '@/config/gameBalance';

describe('gameBalance.scoring.calculateMaxWavesEstimate', () => {
  it('should calculate correct max waves for 100s session', () => {
    // 100,000ms / (5,000 + 15,000 + 2,000) = 100,000 / 22,000 = 4.545...
    // Math.ceil(4.545) = 5
    const maxWaves = gameBalance.scoring.calculateMaxWavesEstimate(100000);
    expect(maxWaves).toBe(5);
  });

  it('should calculate correct max waves for 20s session', () => {
    // 20,000ms / 22,000ms = 0.909...
    // Math.ceil(0.909) = 1
    const maxWaves = gameBalance.scoring.calculateMaxWavesEstimate(20000);
    expect(maxWaves).toBe(1);
  });

  it('should calculate correct max waves for 300s session', () => {
    // 300,000ms / 22,000ms = 13.636...
    // Math.ceil(13.636) = 14
    const maxWaves = gameBalance.scoring.calculateMaxWavesEstimate(300000);
    expect(maxWaves).toBe(14);
  });

  it('should handle edge case of 0ms session', () => {
    // 0 / 22,000 = 0
    // Math.ceil(0) = 0
    const maxWaves = gameBalance.scoring.calculateMaxWavesEstimate(0);
    expect(maxWaves).toBe(0);
  });

  it('should handle very short session (1s)', () => {
    // 1,000ms / 22,000ms = 0.045...
    // Math.ceil(0.045) = 1
    const maxWaves = gameBalance.scoring.calculateMaxWavesEstimate(1000);
    expect(maxWaves).toBe(1);
  });

  it('should round up partial waves', () => {
    // Test that even a partial wave cycle counts
    // 22,001ms / 22,000ms = 1.000045...
    // Math.ceil(1.000045) = 2
    const maxWaves = gameBalance.scoring.calculateMaxWavesEstimate(22001);
    expect(maxWaves).toBe(2);
  });

  it('should use correct wave timing values', () => {
    // Verify the calculation uses the actual config values
    const triggerCountdown = gameBalance.waveTiming.triggerCountdown;
    const baseCooldown = gameBalance.waveTiming.baseCooldown;
    const avgWaveLength = 2000; // As documented in the function
    
    const totalCycleTime = triggerCountdown + baseCooldown + avgWaveLength;
    expect(totalCycleTime).toBe(22000); // 5000 + 15000 + 2000
    
    // Verify calculation matches expected formula
    const sessionDuration = 100000;
    const expectedMaxWaves = Math.ceil(sessionDuration / totalCycleTime);
    const actualMaxWaves = gameBalance.scoring.calculateMaxWavesEstimate(sessionDuration);
    
    expect(actualMaxWaves).toBe(expectedMaxWaves);
  });
});
