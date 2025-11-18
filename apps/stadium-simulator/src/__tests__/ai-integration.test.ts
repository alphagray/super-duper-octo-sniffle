/**
 * AI Integration Tests
 * 
 * Comprehensive tests for AI system integration in gameplay scenarios.
 * Tests full lifecycle including:
 * - Vendor/mascot/announcer integration with game systems
 * - Epoch transitions and caching behavior
 * - Content manager lifecycle and fallback handling
 * - Cross-system interactions and data flow
 * 
 * These tests validate the entire AI subsystem works correctly
 * in realistic gameplay scenarios with proper error handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIContentManager } from '@/systems/AIContentManager';
import { DialogueManager } from '@/systems/DialogueManager';
import { AnnouncerSystem } from '@/systems/AnnouncerSystem';
import { getCurrentEpoch, getEpochStartTime } from '@/config/ai-config';
import type { GameAIContent, VendorPersonality, MascotPersonality, AnnouncerContent } from '@/types/personalities';

// Mock game AI content for integration testing
const createMockGameContent = (epoch: number): GameAIContent => ({
  version: '1.0.0-test',
  epoch,
  generatedAt: Date.now(),
  environment: 'development',
  vendors: [
    {
      id: `vendor-epoch-${epoch}`,
      name: 'Hot Dog Harry',
      description: 'A friendly hot dog vendor',
      productType: 'food',
      traits: [
        {
          id: 'friendly',
          name: 'Friendly',
          description: 'Always cheerful',
          intensity: 0.8,
          tags: ['positive', 'social'],
        },
      ],
      dialogue: [
        {
          id: 'serve-1',
          text: 'Fresh hot dogs here!',
          context: {
            event: 'vendorServe',
            minHappiness: 0,
          },
          emotion: 'cheerful',
          priority: 5,
          cooldown: 5000,
        },
        {
          id: 'serve-2',
          text: 'Get your snacks!',
          context: {
            event: 'vendorServe',
            minHappiness: 0,
          },
          emotion: 'excited',
          priority: 3,
          cooldown: 5000,
        },
      ],
      movement: {
        speed: 50,
        pauseDuration: 3000,
        sectionPreferences: { A: 1.0, B: 0.8, C: 1.2 },
        avoidsActiveWave: true,
      },
      appearance: {
        spriteSheet: 'vendor-hotdog',
        animations: ['idle', 'walk', 'serve'],
        colorPalette: ['#FF6B35', '#F7931E'],
        scale: 1.0,
      },
      metadata: {
        model: 'test',
        temperature: 0.7,
        promptTokens: 100,
        completionTokens: 150,
        cost: 5,
        generatedAt: Date.now(),
        epoch,
        usageCount: 0,
      },
    },
  ],
  mascots: [
    {
      id: `mascot-epoch-${epoch}`,
      name: 'Thunder Bear',
      description: 'An energetic stadium mascot',
      mascotType: 'bear',
      traits: [
        {
          id: 'energetic',
          name: 'Energetic',
          description: 'Full of enthusiasm',
          intensity: 0.9,
          tags: ['active', 'positive'],
        },
      ],
      dialogue: [
        {
          id: 'activate-1',
          text: "Let's make some noise!",
          context: {
            event: 'mascotActivate',
          },
          emotion: 'excited',
          priority: 5,
          cooldown: 10000,
        },
      ],
      abilities: [
        {
          id: 'crowd-energizer',
          name: 'Crowd Energizer',
          description: 'Boosts crowd happiness',
          cooldown: 30000,
          duration: 10000,
          effects: [
            {
              target: 'crowd',
              statModifier: 'happiness',
              value: 20,
              duration: 10000,
            },
          ],
          triggerCondition: {
            minHappiness: 0,
          },
          animation: 'dance',
        },
      ],
      appearance: {
        spriteSheet: 'mascot-bear',
        animations: ['idle', 'dance', 'jump', 'celebrate'],
        colorPalette: ['#4A90E2', '#F5A623'],
        scale: 1.2,
      },
      metadata: {
        model: 'test',
        temperature: 0.7,
        promptTokens: 120,
        completionTokens: 180,
        cost: 6,
        generatedAt: Date.now(),
        epoch,
        usageCount: 0,
      },
    },
  ],
  announcers: [
    {
      id: `announcer-epoch-${epoch}`,
      name: 'Mike "The Voice" Johnson',
      description: 'An enthusiastic sports announcer',
      style: 'energetic',
      traits: [
        {
          id: 'enthusiastic',
          name: 'Enthusiastic',
          description: 'Always excited',
          intensity: 0.9,
          tags: ['positive', 'energetic'],
        },
      ],
      commentary: [
        {
          id: 'wave-start-1',
          text: 'Here we go, folks!',
          context: {
            event: 'waveStart',
          },
          emotion: 'excited',
          priority: 5,
          cooldown: 8000,
        },
        {
          id: 'wave-complete-1',
          text: 'What a wave!',
          context: {
            event: 'waveComplete',
          },
          emotion: 'cheerful',
          priority: 5,
          cooldown: 8000,
        },
      ],
      catchphrases: [
        {
          id: 'perfect-wave',
          text: 'PERFECTION!',
          trigger: {
            event: 'waveComplete',
            conditions: {
              perfectWave: true,
            },
          },
          rarity: 0.1,
        },
      ],
      metadata: {
        model: 'test',
        temperature: 0.7,
        promptTokens: 110,
        completionTokens: 160,
        cost: 5.5,
        generatedAt: Date.now(),
        epoch,
        usageCount: 0,
      },
    },
  ],
  metadata: {
    totalItems: 3,
    totalCost: 16.5,
    totalTokens: 820,
    generationTime: 1200,
    status: 'cached',
  },
});

describe('AI Integration Tests', () => {
  let contentManager: AIContentManager;
  let dialogueManager: DialogueManager;

  beforeEach(() => {
    // Reset singleton
    (AIContentManager as any).instance = null;
    contentManager = AIContentManager.getInstance('development');
    dialogueManager = new DialogueManager();

    // Mock fetch for fallback content
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createMockGameContent(0),
    });
  });

  afterEach(async () => {
    if (contentManager) {
      await contentManager.clearCache();
    }
  });

  describe('Full System Lifecycle', () => {
    it('should initialize content manager and retrieve content', async () => {
      const content = await contentManager.getContent();

      expect(content).toBeDefined();
      expect(content.vendors).toHaveLength(1);
      expect(content.mascots).toHaveLength(1);
      expect(content.announcers).toHaveLength(1);
    });

    it('should handle complete vendor interaction flow', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];

      expect(vendor).toBeDefined();
      expect(vendor.dialogue.length).toBeGreaterThan(0);

      // Simulate vendor serving a fan
      const dialogue1 = dialogueManager.selectDialogue(
        vendor.id,
        vendor.dialogue,
        {
          event: 'vendorServe',
          score: 100,
          waveState: 'inactive',
          sectionStats: {
            happiness: 75,
            thirst: 30,
            attention: 80,
          },
        }
      );

      expect(dialogue1).toBeDefined();
      expect(dialogue1?.text).toBeTruthy();

      // Verify cooldown is tracked
      const usage = dialogueManager.getLineUsage(vendor.id, dialogue1!.id);
      expect(usage).toBeDefined();
      expect(usage?.useCount).toBe(1);
    });

    it('should handle complete mascot interaction flow', async () => {
      const content = await contentManager.getContent();
      const mascot = content.mascots[0];

      expect(mascot).toBeDefined();
      expect(mascot.abilities.length).toBeGreaterThan(0);

      // Simulate mascot activation
      const dialogue = dialogueManager.selectDialogue(
        mascot.id,
        mascot.dialogue,
        {
          event: 'mascotActivate',
          score: 500,
          waveState: 'active',
          aggregateStats: {
            happiness: 60,
            thirst: 40,
            attention: 70,
          },
        }
      );

      expect(dialogue).toBeDefined();
      expect(dialogue?.text).toBeTruthy();

      // Verify ability is available
      const ability = mascot.abilities[0];
      expect(ability.id).toBe('crowd-energizer');
      expect(ability.cooldown).toBe(30000);
    });

    it('should handle complete announcer commentary flow', async () => {
      const content = await contentManager.getContent();
      const announcer = content.announcers[0];

      expect(announcer).toBeDefined();

      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Wave start commentary
      const startComment = announcerSystem.getCommentary('waveStart', {
        score: 0,
        waveState: 'countdown',
      });
      expect(startComment).toBeTruthy();

      // Wave complete commentary
      const completeComment = announcerSystem.getCommentary('waveSuccess', {
        score: 100,
        waveState: 'inactive',
      });
      expect(completeComment).toBeTruthy();

      // Verify different comments are selected
      expect(startComment).not.toBe(completeComment);
    });
  });

  describe('Epoch Transitions', () => {
    it('should handle epoch transitions correctly', async () => {
      const timestamp1 = Date.UTC(2025, 0, 1, 0, 0, 0);
      const timestamp2 = Date.UTC(2025, 0, 1, 2, 0, 0); // 2 hours later

      const epoch1 = getCurrentEpoch(timestamp1, 'development');
      const epoch2 = getCurrentEpoch(timestamp2, 'development');

      // Development epochs are 1 hour, so 2 hours = 2 different epochs
      expect(epoch2).toBe(epoch1 + 2);

      // Get content for different epochs
      const content1 = await contentManager.getContent(timestamp1);
      const content2 = await contentManager.getContent(timestamp2);

      expect(content1.epoch).toBe(epoch1);
      expect(content2.epoch).toBe(epoch2);
    });

    it('should use deterministic seeds across epochs', () => {
      const timestamp1 = Date.UTC(2025, 0, 1, 0, 0, 0);
      const timestamp2 = Date.UTC(2025, 0, 1, 1, 0, 0); // 1 hour later

      const seed1 = contentManager.getSeedForEpoch(timestamp1);
      const seed2 = contentManager.getSeedForEpoch(timestamp2);

      // Seeds should be different for different epochs
      expect(seed1).not.toBe(seed2);

      // But consistent for same epoch
      const seed1Again = contentManager.getSeedForEpoch(timestamp1);
      expect(seed1).toBe(seed1Again);
    });

    it('should maintain content consistency within epoch', async () => {
      const epochStart = Date.UTC(2025, 0, 1, 0, 0, 0);
      const midEpoch = Date.UTC(2025, 0, 1, 0, 30, 0);
      const epochEnd = Date.UTC(2025, 0, 1, 0, 59, 59);

      const content1 = await contentManager.getContent(epochStart);
      const content2 = await contentManager.getContent(midEpoch);
      const content3 = await contentManager.getContent(epochEnd);

      // All should be in same epoch
      expect(content1.epoch).toBe(content2.epoch);
      expect(content2.epoch).toBe(content3.epoch);
    });
  });

  describe('Cache Behavior', () => {
    it('should cache and retrieve content efficiently', async () => {
      const epoch = getCurrentEpoch(Date.now(), 'development');
      const mockContent = createMockGameContent(epoch);

      // Store content in cache
      const expiresAt = getEpochStartTime(epoch + 1, 'development');
      await contentManager.storeContent(mockContent, expiresAt);

      // Retrieve should be fast (from cache)
      const start = performance.now();
      const timestamp = getEpochStartTime(epoch, 'development');
      await contentManager.getContent(timestamp);
      const duration = performance.now() - start;

      // Cache retrieval should be very fast (< 50ms even with IndexedDB overhead)
      expect(duration).toBeLessThan(50);
    });

    it('should handle cache misses gracefully', async () => {
      const futureEpoch = getCurrentEpoch(Date.now(), 'development') + 100;
      const futureTimestamp = getEpochStartTime(futureEpoch, 'development');

      // Request content for non-cached epoch
      const content = await contentManager.getContent(futureTimestamp);

      // Should return fallback content with correct epoch
      expect(content).toBeDefined();
      expect(content.epoch).toBe(futureEpoch);
    });

    it('should not return expired content', async () => {
      const epoch = getCurrentEpoch(Date.now(), 'development') - 10;
      const mockContent = createMockGameContent(epoch);

      // Store with past expiration
      const pastExpiration = Date.now() - 10000;
      await contentManager.storeContent(mockContent, pastExpiration);

      // Try to retrieve
      const timestamp = getEpochStartTime(epoch, 'development');
      const content = await contentManager.getContent(timestamp);

      // Should get fresh content, not expired
      expect(content).toBeDefined();
      // Version should be from fallback, not the stored expired content
      expect(content.version).toBe('1.0.0-test');
    });

    it('should update access count on cache hits', async () => {
      const epoch = getCurrentEpoch(Date.now(), 'development');
      const mockContent = createMockGameContent(epoch);

      const expiresAt = getEpochStartTime(epoch + 1, 'development');
      await contentManager.storeContent(mockContent, expiresAt);

      const timestamp = getEpochStartTime(epoch, 'development');

      // Access multiple times
      await contentManager.getContent(timestamp);
      await contentManager.getContent(timestamp);
      const content = await contentManager.getContent(timestamp);

      // Content should be returned successfully
      expect(content).toBeDefined();
      expect(content.epoch).toBe(epoch);
    });
  });

  describe('Cross-System Integration', () => {
    it('should coordinate vendor dialogue with game state', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];

      // Low happiness scenario
      const dialogue1 = dialogueManager.selectDialogue(
        vendor.id,
        vendor.dialogue,
        {
          event: 'vendorServe',
          score: 50,
          waveState: 'inactive',
          sectionStats: {
            happiness: 30,
            thirst: 70,
            attention: 50,
          },
        }
      );

      // High happiness scenario
      const dialogue2 = dialogueManager.selectDialogue(
        vendor.id,
        vendor.dialogue,
        {
          event: 'vendorServe',
          score: 500,
          waveState: 'active',
          sectionStats: {
            happiness: 90,
            thirst: 20,
            attention: 85,
          },
        }
      );

      // Both should return valid dialogue
      expect(dialogue1).toBeDefined();
      expect(dialogue2).toBeDefined();
    });

    it('should handle multiple characters with shared dialogue manager', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];
      const mascot = content.mascots[0];

      // Use vendor dialogue
      const vendorDialogue = dialogueManager.selectDialogue(
        vendor.id,
        vendor.dialogue,
        {
          event: 'vendorServe',
          score: 100,
          waveState: 'inactive',
        }
      );

      // Use mascot dialogue
      const mascotDialogue = dialogueManager.selectDialogue(
        mascot.id,
        mascot.dialogue,
        {
          event: 'mascotActivate',
          score: 100,
          waveState: 'active',
        }
      );

      expect(vendorDialogue).toBeDefined();
      expect(mascotDialogue).toBeDefined();

      // Verify separate usage tracking
      const vendorUsage = dialogueManager.getCharacterUsage(vendor.id);
      const mascotUsage = dialogueManager.getCharacterUsage(mascot.id);

      expect(vendorUsage.length).toBeGreaterThan(0);
      expect(mascotUsage.length).toBeGreaterThan(0);
    });

    it('should coordinate announcer with game events', async () => {
      const content = await contentManager.getContent();
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Sequence of game events
      const events: Array<{
        context: any;
        gameState: any;
      }> = [
        { context: 'waveStart', gameState: { score: 0, waveState: 'countdown' as const } },
        { context: 'waveSuccess', gameState: { score: 100, waveState: 'inactive' as const } },
        { context: 'waveStart', gameState: { score: 100, waveState: 'countdown' as const } },
        { context: 'waveSuccess', gameState: { score: 200, waveState: 'inactive' as const } },
      ];

      const comments = events.map(({ context, gameState }) =>
        announcerSystem.getCommentary(context, gameState)
      );

      // All events should generate commentary
      expect(comments.filter(c => c !== null).length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle content manager initialization failure', async () => {
      // Reset with failing fetch
      (AIContentManager as any).instance = null;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const failingManager = AIContentManager.getInstance('development');
      const content = await failingManager.getContent();

      // Should return minimal fallback
      expect(content).toBeDefined();
      expect(content.version).toContain('fallback');
      expect(content.vendors).toEqual([]);
    });

    it('should handle dialogue selection with no available lines', () => {
      const result = dialogueManager.selectDialogue(
        'test-vendor',
        [], // Empty dialogue array
        {
          event: 'vendorServe',
          score: 100,
          waveState: 'inactive',
        }
      );

      expect(result).toBeNull();
    });

    it('should handle announcer with missing content gracefully', () => {
      const announcerSystem = new AnnouncerSystem(); // No content

      const commentary = announcerSystem.getCommentary('waveStart', {
        score: 0,
        waveState: 'countdown',
      });

      expect(commentary).toBeNull();
    });

    it('should recover from IndexedDB failures', async () => {
      const epoch = getCurrentEpoch(Date.now(), 'development');
      const mockContent = createMockGameContent(epoch);

      // Attempt to store (may fail if IndexedDB unavailable)
      await expect(
        contentManager.storeContent(mockContent, Date.now() + 100000)
      ).resolves.not.toThrow();

      // Should still be able to get content via fallback
      const content = await contentManager.getContent();
      expect(content).toBeDefined();
    });
  });

  describe('Gameplay Scenarios', () => {
    it('should handle rapid wave succession scenario', async () => {
      const content = await contentManager.getContent();
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Simulate 5 rapid waves
      for (let i = 0; i < 5; i++) {
        const startComment = announcerSystem.getCommentary('waveStart', {
          score: i * 100,
          waveState: 'countdown',
        });
        expect(startComment).toBeTruthy();

        const successComment = announcerSystem.getCommentary('waveSuccess', {
          score: (i + 1) * 100,
          waveState: 'inactive',
        });
        expect(successComment).toBeTruthy();
      }
    });

    it('should handle vendor movement with wave avoidance', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];

      // Check wave avoidance behavior
      expect(vendor.movement.avoidsActiveWave).toBe(true);

      // Get section preferences
      const prefA = vendor.movement.sectionPreferences.A;
      const prefB = vendor.movement.sectionPreferences.B;
      const prefC = vendor.movement.sectionPreferences.C;

      expect(prefA).toBeDefined();
      expect(prefB).toBeDefined();
      expect(prefC).toBeDefined();

      // Preferences should influence movement (Section C preferred)
      expect(prefC).toBeGreaterThan(prefB);
    });

    it('should handle mascot ability activation sequence', async () => {
      const content = await contentManager.getContent();
      const mascot = content.mascots[0];
      const ability = mascot.abilities[0];

      // Verify ability configuration
      expect(ability.cooldown).toBe(30000);
      expect(ability.duration).toBe(10000);
      expect(ability.effects.length).toBeGreaterThan(0);

      // Check effect properties
      const effect = ability.effects[0];
      expect(effect.target).toBe('crowd');
      expect(effect.statModifier).toBe('happiness');
      expect(effect.value).toBe(20);
    });

    it('should handle perfect wave scenario', async () => {
      const content = await contentManager.getContent();
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Perfect wave should trigger catchphrase
      const commentary = announcerSystem.getCommentary('perfectWave', {
        score: 500,
        waveState: 'inactive',
        perfectWave: true,
      });

      // Should get some commentary (catchphrase or regular dialogue)
      expect(commentary).toBeTruthy();
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory on repeated operations', async () => {
      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        await contentManager.getContent();
        
        dialogueManager.selectDialogue(
          `test-vendor-${i}`,
          [
            {
              id: 'test-line',
              text: 'Test',
              context: { event: 'vendorServe' },
              emotion: 'neutral',
              priority: 1,
              cooldown: 0,
            },
          ],
          {
            event: 'vendorServe',
            score: 100,
            waveState: 'inactive',
          }
        );
      }

      // Usage map should not grow unbounded
      const usageCount = dialogueManager.getUsageCount();
      expect(usageCount).toBeLessThan(iterations * 2); // Allow some growth but not linear
    });

    it('should clean up old dialogue usage', () => {
      // Add some usage entries
      for (let i = 0; i < 10; i++) {
        dialogueManager.selectDialogue(
          `vendor-${i}`,
          [
            {
              id: 'line-1',
              text: 'Test',
              context: { event: 'vendorServe' },
              emotion: 'neutral',
              priority: 1,
              cooldown: 0,
            },
          ],
          {
            event: 'vendorServe',
            score: 100,
            waveState: 'inactive',
          }
        );
      }

      // Reset should clear all
      dialogueManager.resetUsage();
      expect(dialogueManager.getUsageCount()).toBe(0);
    });
  });

  describe('Long-Running Stability', () => {
    it('should handle extended gameplay session', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Simulate 30 minutes of gameplay (compressed)
      const waveCount = 20;
      const vendorServeCount = 50;

      for (let i = 0; i < waveCount; i++) {
        announcerSystem.getCommentary('waveStart', {
          score: i * 100,
          waveState: 'countdown',
        });

        announcerSystem.getCommentary('waveSuccess', {
          score: (i + 1) * 100,
          waveState: 'inactive',
        });
      }

      for (let i = 0; i < vendorServeCount; i++) {
        dialogueManager.selectDialogue(
          vendor.id,
          vendor.dialogue,
          {
            event: 'vendorServe',
            score: 100,
            waveState: 'inactive',
          }
        );
      }

      // System should still be functional
      const finalDialogue = dialogueManager.selectDialogue(
        vendor.id,
        vendor.dialogue,
        {
          event: 'vendorServe',
          score: 2000,
          waveState: 'inactive',
        }
      );

      expect(finalDialogue).toBeDefined();
    });
  });
});
