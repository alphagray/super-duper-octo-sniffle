import { WaveManager } from '@/managers/WaveManager';
import { GameStateManager } from '@/managers/GameStateManager';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WaveManager', () => {
  let waveManager: WaveManager;
  let mockGameState: GameStateManager;

  beforeEach(() => {
    mockGameState = new GameStateManager();
    waveManager = new WaveManager(mockGameState);
  });

  describe('Wave Initialization', () => {
    it('should start in inactive state', () => {
      expect(waveManager.isActive()).toBe(false);
    });

    it('should have countdown at 10 seconds initially', () => {
      expect(waveManager.getCountdown()).toBe(10);
    });
  });

  describe('startWave', () => {
    it('should activate wave and reset countdown', () => {
      waveManager.startWave();
      expect(waveManager.isActive()).toBe(true);
      expect(waveManager.getCountdown()).toBe(10);
    });

    it('should start at section 0 (Section A)', () => {
      waveManager.startWave();
      expect(waveManager.getCurrentSection()).toBe(0);
    });
  });

  describe('updateCountdown', () => {
    it('should decrease countdown over time', () => {
      waveManager.startWave();
      waveManager.updateCountdown(1000); // 1 second
      expect(waveManager.getCountdown()).toBe(9);
    });

    it('should trigger wave propagation when countdown reaches 0', () => {
      waveManager.startWave();
      const propagateSpy = vi.spyOn(waveManager, 'propagateWave');
      waveManager.updateCountdown(10000); // 10 seconds
      expect(propagateSpy).toHaveBeenCalled();
    });
  });

  describe('propagateWave', () => {
    it('should evaluate each section sequentially', () => {
      waveManager.startWave();
      waveManager.updateCountdown(10000); // Start propagation
      
      // After propagation, should have results for all 3 sections
      const results = waveManager.getWaveResults();
      expect(results).toHaveLength(3);
    });

    it('should use GameStateManager to calculate success', () => {
      const calcSpy = vi.spyOn(mockGameState, 'calculateWaveSuccess');
      waveManager.startWave();
      waveManager.updateCountdown(10000);
      
      expect(calcSpy).toHaveBeenCalledTimes(3); // Once per section
    });

    it('should track score and multiplier on success', () => {
      waveManager.startWave();
      waveManager.updateCountdown(10000);
      
      const score = waveManager.getScore();
      expect(score).toBeGreaterThan(0);
    });

    it('should reset multiplier on first failure', () => {
      // Sabotage section B
      mockGameState.updateSectionStat('B', 'happiness', 0);
      mockGameState.updateSectionStat('B', 'thirst', 100);
      
      waveManager.startWave();
      waveManager.updateCountdown(10000);
      
      // After wave with failure, multiplier should reset
      const multiplier = waveManager.getMultiplier();
      expect(multiplier).toBe(1.0);
    });
  });

  describe('Event Emissions', () => {
    it('should emit waveStart event', () => {
      const callback = vi.fn();
      waveManager.on('waveStart', callback);
      waveManager.startWave();
      expect(callback).toHaveBeenCalled();
    });

    it('should emit sectionSuccess event for successful sections', () => {
      const callback = vi.fn();
      waveManager.on('sectionSuccess', callback);
      waveManager.startWave();
      waveManager.updateCountdown(10000);
      expect(callback).toHaveBeenCalled();
    });

    it('should emit waveComplete event after all sections', () => {
      const callback = vi.fn();
      waveManager.on('waveComplete', callback);
      waveManager.startWave();
      waveManager.updateCountdown(10000);
      expect(callback).toHaveBeenCalled();
    });
  });
});
