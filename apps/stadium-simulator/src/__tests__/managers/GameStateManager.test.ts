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
      expect(sectionA.thirst).toBe(0); // Fans start with low thirst
      expect(sectionA.attention).toBe(50);
    });
  });

  describe('calculateWaveSuccess', () => {
    it('should calculate base success rate correctly', () => {
      const chance = gameState.calculateWaveSuccess('A');
      // 80 + (70 * 0.2) - (0 * 0.3) = 80 + 14 - 0 = 94%
      expect(chance).toBe(94);
    });

    it('should increase success with higher happiness', () => {
      gameState.updateSectionStat('A', 'happiness', 90);
      const chance = gameState.calculateWaveSuccess('A');
      // 80 + (90 * 0.2) - (0 * 0.3) = 80 + 18 - 0 = 98%
      expect(chance).toBe(98);
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
    it('should NOT decay happiness if thirst below threshold', () => {
      gameState.updateStats(1000); // 1 second (thirst becomes 2)
      expect(gameState.getSection('A').happiness).toBe(70); // unchanged because thirst < decay threshold
    });

    it('should increase thirst over time', () => {
      gameState.updateStats(1000); // 1 second
      expect(gameState.getSection('A').thirst).toBe(2); // 0 + 2
    });

    it('should accumulate thirst fractionally without early happiness decay', () => {
      gameState.updateStats(500); // 0.5 seconds
      expect(gameState.getSection('A').happiness).toBe(70); // still unchanged
      expect(gameState.getSection('A').thirst).toBeCloseTo(1); // 0 + (2 * 0.5)
    });
  });
});
