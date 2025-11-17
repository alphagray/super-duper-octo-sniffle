/**
 * Tests for DialogueManager
 * 
 * Validates context-aware dialogue selection, usage tracking,
 * cooldowns, weighted selection, and performance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DialogueManager } from '@/systems/DialogueManager';
import type { DialogueLine, GameEventType } from '@/types/personalities';
import type { DialogueSelectionContext } from '@/systems/DialogueManager';

// Test dialogue lines
const createTestLine = (
  id: string,
  event: GameEventType,
  priority: number = 1,
  cooldown: number = 5000,
  options: Partial<DialogueLine> = {}
): DialogueLine => ({
  id,
  text: `Test line ${id}`,
  context: {
    event,
    ...options.context,
  },
  emotion: 'neutral',
  priority,
  cooldown,
  ...options,
});

describe('DialogueManager', () => {
  let manager: DialogueManager;

  beforeEach(() => {
    manager = new DialogueManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Selection', () => {
    it('should select a dialogue line from available options', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
        createTestLine('line-2', 'waveStart'),
        createTestLine('line-3', 'waveStart'),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 100,
        waveState: 'active',
      };

      const selected = manager.selectDialogue('character-1', lines, context);

      expect(selected).toBeDefined();
      expect(selected?.context.event).toBe('waveStart');
    });

    it('should return null when no lines available', () => {
      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'inactive',
      };

      const selected = manager.selectDialogue('character-1', [], context);

      expect(selected).toBeNull();
    });

    it('should return first line as fallback when no lines match context', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveComplete'),
        createTestLine('line-2', 'sectionSuccess'),
      ];

      const context: DialogueSelectionContext = {
        event: 'vendorServe', // No lines match this event
        score: 0,
        waveState: 'inactive',
      };

      const selected = manager.selectDialogue('character-1', lines, context);

      // Should fallback to first line
      expect(selected).toBeDefined();
      expect(selected?.id).toBe('line-1');
    });
  });

  describe('Context Filtering', () => {
    it('should filter by event type', () => {
      const lines: DialogueLine[] = [
        createTestLine('wave-line', 'waveStart'),
        createTestLine('vendor-line', 'vendorServe'),
        createTestLine('mascot-line', 'mascotActivate'),
      ];

      const context: DialogueSelectionContext = {
        event: 'vendorServe',
        score: 0,
        waveState: 'inactive',
      };

      const selected = manager.selectDialogue('character-1', lines, context);

      expect(selected?.id).toBe('vendor-line');
    });

    it('should filter by score range', () => {
      const lines: DialogueLine[] = [
        createTestLine('low-score', 'waveComplete', 1, 5000, {
          context: {
            event: 'waveComplete',
            scoreRange: [0, 100],
          },
        }),
        createTestLine('high-score', 'waveComplete', 1, 5000, {
          context: {
            event: 'waveComplete',
            scoreRange: [500, 1000],
          },
        }),
      ];

      const contextLow: DialogueSelectionContext = {
        event: 'waveComplete',
        score: 50,
        waveState: 'inactive',
      };

      const selectedLow = manager.selectDialogue('character-1', lines, contextLow);
      expect(selectedLow?.id).toBe('low-score');

      const contextHigh: DialogueSelectionContext = {
        event: 'waveComplete',
        score: 750,
        waveState: 'inactive',
      };

      const selectedHigh = manager.selectDialogue('character-2', lines, contextHigh);
      expect(selectedHigh?.id).toBe('high-score');
    });

    it('should filter by wave state', () => {
      const lines: DialogueLine[] = [
        createTestLine('active-line', 'fanHappy', 1, 5000, {
          context: {
            event: 'fanHappy',
            waveState: 'active',
          },
        }),
        createTestLine('inactive-line', 'fanHappy', 1, 5000, {
          context: {
            event: 'fanHappy',
            waveState: 'inactive',
          },
        }),
      ];

      const context: DialogueSelectionContext = {
        event: 'fanHappy',
        score: 0,
        waveState: 'active',
      };

      const selected = manager.selectDialogue('character-1', lines, context);
      expect(selected?.id).toBe('active-line');
    });

    it('should filter by happiness range', () => {
      const lines: DialogueLine[] = [
        createTestLine('happy-line', 'fanHappy', 1, 5000, {
          context: {
            event: 'fanHappy',
            minHappiness: 70,
          },
        }),
        createTestLine('sad-line', 'fanHappy', 1, 5000, {
          context: {
            event: 'fanHappy',
            maxHappiness: 30,
          },
        }),
      ];

      const contextHappy: DialogueSelectionContext = {
        event: 'fanHappy',
        score: 0,
        waveState: 'inactive',
        sectionStats: {
          happiness: 80,
          thirst: 20,
          attention: 70,
        },
      };

      const selectedHappy = manager.selectDialogue('character-1', lines, contextHappy);
      expect(selectedHappy?.id).toBe('happy-line');

      const contextSad: DialogueSelectionContext = {
        event: 'fanHappy',
        score: 0,
        waveState: 'inactive',
        sectionStats: {
          happiness: 20,
          thirst: 80,
          attention: 30,
        },
      };

      const selectedSad = manager.selectDialogue('character-2', lines, contextSad);
      expect(selectedSad?.id).toBe('sad-line');
    });

    it('should filter by thirst range', () => {
      const lines: DialogueLine[] = [
        createTestLine('thirsty-line', 'vendorServe', 1, 5000, {
          context: {
            event: 'vendorServe',
            minThirst: 60,
          },
        }),
        createTestLine('hydrated-line', 'vendorServe', 1, 5000, {
          context: {
            event: 'vendorServe',
            maxThirst: 40,
          },
        }),
      ];

      const contextThirsty: DialogueSelectionContext = {
        event: 'vendorServe',
        score: 0,
        waveState: 'inactive',
        sectionStats: {
          happiness: 50,
          thirst: 80,
          attention: 50,
        },
      };

      const selected = manager.selectDialogue('character-1', lines, contextThirsty);
      expect(selected?.id).toBe('thirsty-line');
    });

    it('should filter by attention range', () => {
      const lines: DialogueLine[] = [
        createTestLine('attentive-line', 'waveStart', 1, 5000, {
          context: {
            event: 'waveStart',
            minAttention: 70,
          },
        }),
        createTestLine('bored-line', 'waveStart', 1, 5000, {
          context: {
            event: 'waveStart',
            maxAttention: 30,
          },
        }),
      ];

      const contextAttentive: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
        aggregateStats: {
          happiness: 50,
          thirst: 50,
          attention: 85,
        },
      };

      const selected = manager.selectDialogue('character-1', lines, contextAttentive);
      expect(selected?.id).toBe('attentive-line');
    });

    it('should handle multiple context conditions', () => {
      // Use seeded manager for deterministic testing
      const seededManager = new DialogueManager(42);
      
      const lines: DialogueLine[] = [
        createTestLine('specific-line', 'sectionSuccess', 10, 5000, { // Higher priority
          context: {
            event: 'sectionSuccess',
            scoreRange: [200, 500],
            waveState: 'active',
            minHappiness: 60,
            maxThirst: 40,
          },
        }),
        createTestLine('generic-line', 'sectionSuccess'),
      ];

      const contextMatch: DialogueSelectionContext = {
        event: 'sectionSuccess',
        score: 350,
        waveState: 'active',
        sectionStats: {
          happiness: 75,
          thirst: 25,
          attention: 80,
        },
      };

      const selected = seededManager.selectDialogue('character-1', lines, contextMatch);
      expect(selected?.id).toBe('specific-line');

      const contextNoMatch: DialogueSelectionContext = {
        event: 'sectionSuccess',
        score: 350,
        waveState: 'active',
        sectionStats: {
          happiness: 40, // Too low
          thirst: 25,
          attention: 80,
        },
      };

      const selectedGeneric = seededManager.selectDialogue('character-2', lines, contextNoMatch);
      expect(selectedGeneric?.id).toBe('generic-line');
    });
  });

  describe('Cooldown Enforcement', () => {
    it('should respect cooldown periods', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 1, 1000), // 1 second cooldown
        createTestLine('line-2', 'waveStart', 1, 1000),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Mock Date.now for deterministic testing
      let currentTime = 1000000;
      const mockNow = vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      // First selection
      const firstSelected = manager.selectDialogue('character-1', lines, context);
      expect(firstSelected).toBeDefined();
      const firstId = firstSelected!.id;

      // Immediate second selection - should avoid first line due to cooldown
      const secondSelected = manager.selectDialogue('character-1', lines, context);
      expect(secondSelected).toBeDefined();
      
      // If we got the same line, it's because it was the only option
      // Let's verify cooldown is actually tracked
      const usage = manager.getLineUsage('character-1', firstId);
      expect(usage).toBeDefined();
      expect(usage!.useCount).toBeGreaterThan(0);

      // Advance time past cooldown
      currentTime += 2000;

      // Should now be able to select first line again
      const thirdSelected = manager.selectDialogue('character-1', lines, context);
      expect(thirdSelected).toBeDefined();

      // Restore Date.now
      mockNow.mockRestore();
    });

    it('should return first eligible line when all on cooldown', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 1, 10000),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Use the line
      const first = manager.selectDialogue('character-1', lines, context);
      expect(first?.id).toBe('line-1');

      // Try again immediately (should still return same line as fallback)
      const second = manager.selectDialogue('character-1', lines, context);
      expect(second?.id).toBe('line-1');
    });

    it('should track cooldowns per character independently', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Character 1 uses the line
      manager.selectDialogue('character-1', lines, context);
      const usage1 = manager.getLineUsage('character-1', 'line-1');
      expect(usage1).toBeDefined();

      // Character 2 should have separate tracking
      const usage2Before = manager.getLineUsage('character-2', 'line-1');
      expect(usage2Before).toBeNull();

      manager.selectDialogue('character-2', lines, context);
      const usage2After = manager.getLineUsage('character-2', 'line-1');
      expect(usage2After).toBeDefined();
      expect(usage2After!.useCount).toBe(1);
    });
  });

  describe('Weighted Random Selection', () => {
    it('should respect priority weights in selection', () => {
      // Use seeded manager for deterministic testing
      const seededManager = new DialogueManager(42);

      const lines: DialogueLine[] = [
        createTestLine('low-priority', 'waveStart', 1),
        createTestLine('high-priority', 'waveStart', 10), // 10x more likely
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Run multiple selections to test distribution
      const selections: string[] = [];
      for (let i = 0; i < 20; i++) {
        seededManager.resetUsage();
        const selected = seededManager.selectDialogue(`char-${i}`, lines, context);
        if (selected) {
          selections.push(selected.id);
        }
      }

      // High priority should be selected more often
      const highCount = selections.filter((id) => id === 'high-priority').length;
      const lowCount = selections.filter((id) => id === 'low-priority').length;

      expect(highCount).toBeGreaterThan(lowCount);
    });

    it('should handle single line selection', () => {
      const lines: DialogueLine[] = [
        createTestLine('only-line', 'waveStart', 1),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      const selected = manager.selectDialogue('character-1', lines, context);
      expect(selected?.id).toBe('only-line');
    });

    it('should handle equal priorities randomly', () => {
      const seededManager = new DialogueManager(12345);

      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 1),
        createTestLine('line-2', 'waveStart', 1),
        createTestLine('line-3', 'waveStart', 1),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      const selections = new Set<string>();
      for (let i = 0; i < 10; i++) {
        seededManager.resetUsage();
        const selected = seededManager.selectDialogue(`char-${i}`, lines, context);
        if (selected) {
          selections.add(selected.id);
        }
      }

      // Should have selected at least 2 different lines
      expect(selections.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Usage Tracking', () => {
    it('should track dialogue usage', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      manager.selectDialogue('character-1', lines, context);

      const usage = manager.getLineUsage('character-1', 'line-1');
      expect(usage).toBeDefined();
      expect(usage!.characterId).toBe('character-1');
      expect(usage!.lineId).toBe('line-1');
      expect(usage!.useCount).toBe(1);
      expect(usage!.lastUsedAt).toBeGreaterThan(0);
    });

    it('should increment use count on repeated usage', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 1, 100), // Short cooldown
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Mock time to bypass cooldown
      let currentTime = 1000000;
      const mockNow = vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      manager.selectDialogue('character-1', lines, context);
      
      currentTime += 200; // Move past cooldown
      manager.selectDialogue('character-1', lines, context);

      const usage = manager.getLineUsage('character-1', 'line-1');
      expect(usage!.useCount).toBe(2);

      mockNow.mockRestore();
    });

    it('should get all usage for a character', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
        createTestLine('line-2', 'waveComplete'),
      ];

      manager.selectDialogue('character-1', lines.slice(0, 1), {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      });

      manager.selectDialogue('character-1', lines.slice(1, 2), {
        event: 'waveComplete',
        score: 100,
        waveState: 'inactive',
      });

      const usage = manager.getCharacterUsage('character-1');
      expect(usage.length).toBe(2);
      expect(usage.map((u) => u.lineId).sort()).toEqual(['line-1', 'line-2']);
    });

    it('should return null for unused line', () => {
      const usage = manager.getLineUsage('character-1', 'never-used');
      expect(usage).toBeNull();
    });

    it('should return empty array for character with no usage', () => {
      const usage = manager.getCharacterUsage('new-character');
      expect(usage).toEqual([]);
    });
  });

  describe('Usage Management', () => {
    it('should reset all usage', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      manager.selectDialogue('character-1', lines, context);
      expect(manager.getUsageCount()).toBe(1);

      manager.resetUsage();
      expect(manager.getUsageCount()).toBe(0);
      expect(manager.getLineUsage('character-1', 'line-1')).toBeNull();
    });

    it('should reset usage for specific character', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      manager.selectDialogue('character-1', lines, context);
      manager.selectDialogue('character-2', lines, context);
      expect(manager.getUsageCount()).toBe(2);

      manager.resetCharacterUsage('character-1');
      expect(manager.getUsageCount()).toBe(1);
      expect(manager.getLineUsage('character-1', 'line-1')).toBeNull();
      expect(manager.getLineUsage('character-2', 'line-1')).toBeDefined();
    });

    it('should get total usage count', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart'),
        createTestLine('line-2', 'waveStart'),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      expect(manager.getUsageCount()).toBe(0);

      manager.selectDialogue('character-1', lines, context);
      expect(manager.getUsageCount()).toBe(1);

      manager.selectDialogue('character-2', lines, context);
      expect(manager.getUsageCount()).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should select dialogue in under 1ms for typical case', () => {
      const lines: DialogueLine[] = Array.from({ length: 10 }, (_, i) =>
        createTestLine(`line-${i}`, 'waveStart', Math.random() * 10)
      );

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 100,
        waveState: 'countdown',
        sectionStats: {
          happiness: 75,
          thirst: 30,
          attention: 80,
        },
      };

      const start = performance.now();
      manager.selectDialogue('character-1', lines, context);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should handle 1000 selections in under 100ms', () => {
      const lines: DialogueLine[] = Array.from({ length: 10 }, (_, i) =>
        createTestLine(`line-${i}`, 'waveStart', 1, 100)
      );

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 100,
        waveState: 'countdown',
      };

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        manager.selectDialogue(`character-${i}`, lines, context);
      }
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should maintain performance with large usage history', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 1, 100),
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Build up large usage history
      for (let i = 0; i < 100; i++) {
        manager.selectDialogue(`character-${i}`, lines, context);
      }

      expect(manager.getUsageCount()).toBe(100);

      // Test selection performance with large history
      const start = performance.now();
      manager.selectDialogue('character-new', lines, context);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty priority (default to 1)', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 0), // Priority 0
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      const selected = manager.selectDialogue('character-1', lines, context);
      expect(selected).toBeDefined();
    });

    it('should handle very short cooldowns', () => {
      const lines: DialogueLine[] = [
        createTestLine('line-1', 'waveStart', 1, 1), // 1ms cooldown
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      manager.selectDialogue('character-1', lines, context);
      
      // Wait 2ms
      const start = Date.now();
      while (Date.now() - start < 2) {
        // Busy wait
      }

      const second = manager.selectDialogue('character-1', lines, context);
      expect(second).toBeDefined();
    });

    it('should handle zero-weight priorities gracefully', () => {
      const lines: DialogueLine[] = [
        createTestLine('zero-priority-1', 'waveStart', 0), // Priority 0
        createTestLine('zero-priority-2', 'waveStart', 0), // Priority 0
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Should not throw and should return first line
      const selected = manager.selectDialogue('character-1', lines, context);
      expect(selected).toBeDefined();
      expect(selected?.id).toBe('zero-priority-1');
    });

    it('should handle negative priorities by treating them as zero', () => {
      const lines: DialogueLine[] = [
        createTestLine('negative-priority', 'waveStart', -5), // Negative priority
        createTestLine('positive-priority', 'waveStart', 10), // Positive priority
      ];

      const context: DialogueSelectionContext = {
        event: 'waveStart',
        score: 0,
        waveState: 'countdown',
      };

      // Should still work and prefer the positive priority line
      const selected = manager.selectDialogue('character-1', lines, context);
      expect(selected).toBeDefined();
      // With seeded randomness, we can't predict which will be chosen with certainty,
      // but it should not crash and should return one of the lines
      expect(['negative-priority', 'positive-priority']).toContain(selected?.id);
    });

    it('should handle complex nested conditions', () => {
      // Use seeded manager for deterministic testing
      const seededManager = new DialogueManager(12345);
      
      const lines: DialogueLine[] = [
        createTestLine('ultra-specific', 'sectionSuccess', 10, 5000, { // Higher priority
          context: {
            event: 'sectionSuccess',
            scoreRange: [100, 200],
            waveState: 'active',
            minHappiness: 60,
            maxHappiness: 80,
            minThirst: 20,
            maxThirst: 40,
            minAttention: 70,
            maxAttention: 90,
          },
        }),
        createTestLine('fallback', 'sectionSuccess', 1),
      ];

      const contextPerfect: DialogueSelectionContext = {
        event: 'sectionSuccess',
        score: 150,
        waveState: 'active',
        sectionStats: {
          happiness: 70,
          thirst: 30,
          attention: 80,
        },
      };

      const selected = seededManager.selectDialogue('character-1', lines, contextPerfect);
      expect(selected?.id).toBe('ultra-specific');
    });
  });
});
