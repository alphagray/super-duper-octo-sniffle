import { describe, it, expect, beforeEach } from 'vitest';
import { GameStateManager } from '@/managers/GameStateManager';
import { gameBalance } from '@/config/gameBalance';

describe('GameStateManager.calculateSessionScore', () => {
  let gameState: GameStateManager;

  beforeEach(() => {
    gameState = new GameStateManager();
    gameState.initializeSections([
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
    ]);
  });

  it('should include maxPossibleWaves in session score', () => {
    // Start and immediately complete a session
    gameState.startSession();
    gameState.activateSession();
    gameState.completeSession();

    const score = gameState.calculateSessionScore();
    
    // Verify maxPossibleWaves is calculated
    expect(score.maxPossibleWaves).toBeDefined();
    expect(score.maxPossibleWaves).toBe(5); // 100s session = 5 waves max
  });

  it('should calculate grade based on dynamic max waves', () => {
    gameState.startSession();
    gameState.activateSession();
    
    // Complete 3 waves (60% of 5)
    gameState.incrementCompletedWaves();
    gameState.incrementCompletedWaves();
    gameState.incrementCompletedWaves();
    
    gameState.completeSession();
    const score = gameState.calculateSessionScore();
    
    expect(score.completedWaves).toBe(3);
    expect(score.maxPossibleWaves).toBe(5);
    
    // 3/5 = 60% = B+ grade
    expect(score.grade).toBe('B+');
  });

  it('should calculate maxPossibleScore based on dynamic max waves', () => {
    gameState.startSession();
    gameState.activateSession();
    gameState.completeSession();

    const score = gameState.calculateSessionScore();
    
    const expectedMaxScore = gameBalance.scoring.basePointsPerWave * score.maxPossibleWaves;
    expect(score.maxPossibleScore).toBe(expectedMaxScore);
    expect(score.maxPossibleScore).toBe(500); // 100 * 5
  });

  it('should award S+ grade for 8+ waves regardless of percentage', () => {
    gameState.startSession();
    gameState.activateSession();
    
    // Complete 8 waves (160% of max 5, but still S+)
    for (let i = 0; i < 8; i++) {
      gameState.incrementCompletedWaves();
    }
    
    gameState.completeSession();
    const score = gameState.calculateSessionScore();
    
    expect(score.completedWaves).toBe(8);
    expect(score.grade).toBe('S+');
  });

  it('should award A+ grade for 75% completion (4/5 waves)', () => {
    gameState.startSession();
    gameState.activateSession();
    
    // Complete 4 waves (80% of 5)
    for (let i = 0; i < 4; i++) {
      gameState.incrementCompletedWaves();
    }
    
    gameState.completeSession();
    const score = gameState.calculateSessionScore();
    
    expect(score.completedWaves).toBe(4);
    expect(score.maxPossibleWaves).toBe(5);
    expect(score.grade).toBe('A+'); // 80% >= 75% threshold
  });

  it('should award F grade for 0 waves', () => {
    gameState.startSession();
    gameState.activateSession();
    gameState.completeSession();

    const score = gameState.calculateSessionScore();
    
    expect(score.completedWaves).toBe(0);
    expect(score.grade).toBe('F');
  });

  it('should calculate score percentage correctly', () => {
    gameState.startSession();
    gameState.activateSession();
    
    // Complete 2 waves
    gameState.incrementCompletedWaves();
    gameState.incrementCompletedWaves();
    
    gameState.completeSession();
    const score = gameState.calculateSessionScore();
    
    const expectedPercentage = (2 * gameBalance.scoring.basePointsPerWave) / (5 * gameBalance.scoring.basePointsPerWave);
    expect(score.scorePercentage).toBe(expectedPercentage);
    expect(score.scorePercentage).toBeCloseTo(0.4, 2); // 2/5 = 40%
  });
});
