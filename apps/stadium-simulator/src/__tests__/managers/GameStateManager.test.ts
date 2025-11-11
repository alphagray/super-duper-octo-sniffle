import { GameStateManager } from '@/managers/GameStateManager';
import type { Section } from '@/types/GameTypes';

describe('GameStateManager', () => {
  let gameState: GameStateManager;

  beforeEach(() => {
    gameState = new GameStateManager();
  });

  describe('Initialization', () => {
    it('should initialize with 3 sections (A, B, C)', () => {
      expect(gameState.getSections()).toHaveLength(3);
    });

    it('should initialize sections with correct starting values', () => {
      const sectionA = gameState.getSection('A');
      expect(sectionA.happiness).toBe(70);
      expect(sectionA.thirst).toBe(20);
      expect(sectionA.attention).toBe(50);
    });
  });

  describe('calculateWaveSuccess', () => {
    it('should calculate base success rate correctly', () => {
      const chance = gameState.calculateWaveSuccess('A');
      // 80 + (70 * 0.2) - (20 * 0.3) = 80 + 14 - 6 = 88%
      expect(chance).toBe(88);
    });

    it('should increase success with higher happiness', () => {
      gameState.updateSectionStat('A', 'happiness', 90);
      const chance = gameState.calculateWaveSuccess('A');
      // 80 + (90 * 0.2) - (20 * 0.3) = 80 + 18 - 6 = 92%
      expect(chance).toBe(92);
    });

    it('should decrease success with higher thirst', () => {
      gameState.updateSectionStat('A', 'thirst', 50);
      const chance = gameState.calculateWaveSuccess('A');
      // 80 + (70 * 0.2) - (50 * 0.3) = 80 + 14 - 15 = 79%
      expect(chance).toBe(79);
    });
  });

  describe('vendorServe', () => {
    it('should decrease thirst by 30', () => {
      gameState.vendorServe('A');
      expect(gameState.getSection('A').thirst).toBe(0); // 20 - 30 = 0 (clamped)
    });

    it('should increase happiness by 10', () => {
      gameState.vendorServe('A');
      expect(gameState.getSection('A').happiness).toBe(80); // 70 + 10
    });

    it('should clamp values between 0-100', () => {
      gameState.updateSectionStat('A', 'happiness', 95);
      gameState.vendorServe('A');
      expect(gameState.getSection('A').happiness).toBe(100); // 95 + 10 = 105 → 100
    });
  });

  describe('updateStats', () => {
    it('should decay happiness over time', () => {
      gameState.updateStats(1000); // 1 second
      expect(gameState.getSection('A').happiness).toBe(69); // 70 - 1
    });

    it('should increase thirst over time', () => {
      gameState.updateStats(1000); // 1 second
      expect(gameState.getSection('A').thirst).toBe(22); // 20 + 2
    });

    it('should handle fractional time correctly', () => {
      gameState.updateStats(500); // 0.5 seconds
      expect(gameState.getSection('A').happiness).toBeCloseTo(69.5);
      expect(gameState.getSection('A').thirst).toBeCloseTo(21);
    });
  });
});
