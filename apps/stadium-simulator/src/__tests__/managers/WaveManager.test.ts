import { WaveManager } from '@/managers/WaveManager';
import { GameStateManager } from '@/managers/GameStateManager';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test subclass that allows us to control random rolls
class TestWaveManager extends WaveManager {
  // No random needed now – section success/fail determined externally (scene layer)
}

describe('WaveManager', () => {
  let waveManager: TestWaveManager;
  let mockGameState: GameStateManager;

  beforeEach(() => {
    mockGameState = new GameStateManager();
    waveManager = new TestWaveManager(mockGameState);
  });

  describe('Wave Initialization', () => {
    it('should start in inactive state', () => {
      expect(waveManager.isActive()).toBe(false);
    });

    it('should have countdown at triggerCountdown seconds initially', () => {
      expect(waveManager.getCountdown()).toBe(3); // 3000ms / 1000
    });
  });

  describe('startWave', () => {
    it('should activate wave and reset countdown to triggerCountdown', () => {
      waveManager.startWave();
      expect(waveManager.isActive()).toBe(true);
      expect(waveManager.getCountdown()).toBe(3);
    });

    it('should start at section 0 (Section A)', () => {
      waveManager.startWave();
      expect(waveManager.getCurrentSection()).toBe(0);
    });
  });

  describe('updateCountdown', () => {
    it('should decrease countdown over time by seconds', () => {
      waveManager.startWave();
      waveManager.updateCountdown(1000); // 1 second
      expect(waveManager.getCountdown()).toBe(2);
    });

    it('should trigger wave propagation when countdown reaches 0', () => {
      waveManager.startWave();
      const propagateSpy = vi.spyOn(waveManager, 'propagateWave');
      waveManager.updateCountdown(10000); // 10 seconds
      expect(propagateSpy).toHaveBeenCalled();
    });
  });

  describe('propagateWave (sectionWave based)', () => {
    it('emits sectionWave for each section', async () => {
      const calls: string[] = [];
      waveManager.on('sectionWave', (data: { section: string }) => {
        calls.push(data.section);
        // Simulate scene classification always success
        waveManager.setLastSectionWaveState('success');
      });
      waveManager.startWave();
      await waveManager.updateCountdown(10000);
      expect(calls).toEqual(['A', 'B', 'C']);
    });

    it('records waveResults using lastSectionWaveState', async () => {
      waveManager.on('sectionWave', () => {
        waveManager.setLastSectionWaveState('success');
      });
      waveManager.startWave();
      await waveManager.updateCountdown(10000);
      expect(waveManager.getWaveResults()).toHaveLength(3);
      expect(waveManager.getWaveResults().every(r => r.success)).toBe(true);
    });
  });

  describe('Event Emissions', () => {
    it('emits waveStart', () => {
      const cb = vi.fn();
      waveManager.on('waveStart', cb);
      waveManager.startWave();
      expect(cb).toHaveBeenCalled();
    });

    it('emits waveComplete after propagation', async () => {
      const cb = vi.fn();
      waveManager.on('sectionWave', () => waveManager.setLastSectionWaveState('success'));
      waveManager.on('waveComplete', cb);
      waveManager.startWave();
      await waveManager.updateCountdown(10000);
      expect(cb).toHaveBeenCalled();
    });
  });

  describe('Classification & Recovery Utilities', () => {
    it('classifies columns based on thresholds', () => {
      expect(waveManager.classifyColumn(0.7)).toBe('success');
      expect(waveManager.classifyColumn(0.45)).toBe('sputter');
      expect(waveManager.classifyColumn(0.2)).toBe('death');
    });

    it('applies momentum booster to strength increases', () => {
      waveManager.setLastSectionWaveState('success');
      waveManager.applyWaveBooster('momentum');
      const start = (waveManager as any).currentWaveStrength;
      waveManager.adjustWaveStrength('success', 0.9);
      const end = (waveManager as any).currentWaveStrength;
      // Base +5 scaled by (1 + momentumPercent)
      expect(end - start).toBeGreaterThanOrEqual(5); // At least base
    });

    it('calculates enhanced recovery sputter -> success', () => {
      const bonusFactor = waveManager.calculateEnhancedRecovery('sputter','success');
      expect(bonusFactor).toBeGreaterThan(0);
      expect(waveManager.calculateEnhancedRecovery('success','success')).toBe(0);
    });

    it('records column states and bounds array size', () => {
      for (let i=0;i<40;i++) {
        waveManager.recordColumnState('A', i, 0.5, 'sputter');
      }
      const recs = waveManager.getColumnStateRecords();
      expect(recs.length).toBeLessThanOrEqual(32); // bounded
    });

    it('consumes forced flags', () => {
      waveManager.setForceDeath(true);
      waveManager.setForceSputter(true);
      const first = waveManager.consumeForcedFlags();
      expect(first.death).toBe(true);
      expect(first.sputter).toBe(true);
      const second = waveManager.consumeForcedFlags();
      expect(second.death).toBe(false);
      expect(second.sputter).toBe(false);
    });
  });
});
