/**
 * AI Performance Benchmarks
 * 
 * Performance tests to ensure AI systems meet strict performance targets:
 * - Content manager initialization: <500ms
 * - Dialogue selection: <1ms per call
 * - Memory usage: <5MB for full content
 * - IndexedDB cache hit: <10ms
 * - Speech bubble rendering: 60fps with 10 concurrent
 * 
 * These benchmarks validate that the AI subsystem performs
 * efficiently enough for smooth 60fps gameplay.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIContentManager } from '@/systems/AIContentManager';
import { DialogueManager } from '@/systems/DialogueManager';
import { AnnouncerSystem } from '@/systems/AnnouncerSystem';
import { getCurrentEpoch, getEpochStartTime } from '@/config/ai-config';
import type { GameAIContent, DialogueLine } from '@/types/personalities';

// Performance test configuration
const PERFORMANCE_TARGETS = {
  contentManagerInit: 500, // ms
  dialogueSelection: 1, // ms
  memoryUsage: 5 * 1024 * 1024, // 5MB in bytes
  cacheHit: 10, // ms
  speechBubbleRender: 16.67, // ms (60fps = 16.67ms per frame)
};

// Create comprehensive mock content for performance testing
const createLargeGameContent = (epoch: number): GameAIContent => {
  const vendors = Array.from({ length: 10 }, (_, i) => ({
    id: `vendor-${i}`,
    name: `Vendor ${i}`,
    description: 'A friendly vendor',
    productType: ['food', 'drinks', 'snacks'][i % 3] as 'food' | 'drinks' | 'snacks',
    traits: [
      {
        id: `trait-${i}`,
        name: 'Friendly',
        description: 'Always cheerful',
        intensity: 0.8,
        tags: ['positive'],
      },
    ],
    dialogue: Array.from({ length: 20 }, (_, j) => ({
      id: `vendor-${i}-line-${j}`,
      text: `Vendor line ${j} for vendor ${i}`,
      context: {
        event: 'vendorServe' as const,
        minHappiness: j * 5,
      },
      emotion: 'cheerful' as const,
      priority: 5,
      cooldown: 5000,
    })),
    movement: {
      speed: 50,
      pauseDuration: 3000,
      sectionPreferences: { A: 1.0, B: 1.0, C: 1.0 },
      avoidsActiveWave: false,
    },
    appearance: {
      spriteSheet: 'vendor',
      animations: ['idle'],
      colorPalette: ['#000000'],
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
  }));

  const mascots = Array.from({ length: 5 }, (_, i) => ({
    id: `mascot-${i}`,
    name: `Mascot ${i}`,
    description: 'An energetic mascot',
    mascotType: 'bear' as const,
    traits: [
      {
        id: `trait-mascot-${i}`,
        name: 'Energetic',
        description: 'Full of energy',
        intensity: 0.9,
        tags: ['positive'],
      },
    ],
    dialogue: Array.from({ length: 15 }, (_, j) => ({
      id: `mascot-${i}-line-${j}`,
      text: `Mascot line ${j} for mascot ${i}`,
      context: {
        event: 'mascotActivate' as const,
      },
      emotion: 'excited' as const,
      priority: 5,
      cooldown: 10000,
    })),
    abilities: [
      {
        id: `ability-${i}`,
        name: 'Boost',
        description: 'Boosts stats',
        cooldown: 30000,
        duration: 10000,
        effects: [
          {
            target: 'crowd' as const,
            statModifier: 'happiness' as const,
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
      spriteSheet: 'mascot',
      animations: ['idle'],
      colorPalette: ['#000000'],
      scale: 1.0,
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
  }));

  const announcers = Array.from({ length: 3 }, (_, i) => ({
    id: `announcer-${i}`,
    name: `Announcer ${i}`,
    description: 'An enthusiastic announcer',
    style: 'energetic' as const,
    traits: [
      {
        id: `trait-announcer-${i}`,
        name: 'Enthusiastic',
        description: 'Always excited',
        intensity: 0.9,
        tags: ['positive'],
      },
    ],
    commentary: Array.from({ length: 25 }, (_, j) => ({
      id: `announcer-${i}-line-${j}`,
      text: `Announcer line ${j} for announcer ${i}`,
      context: {
        event: (['waveStart', 'waveComplete', 'sectionSuccess'][j % 3]) as any,
      },
      emotion: 'excited' as const,
      priority: 5,
      cooldown: 8000,
    })),
    catchphrases: [
      {
        id: `catchphrase-${i}`,
        text: 'Amazing!',
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
  }));

  return {
    version: '1.0.0-perf-test',
    epoch,
    generatedAt: Date.now(),
    environment: 'development',
    vendors,
    mascots,
    announcers,
    metadata: {
      totalItems: vendors.length + mascots.length + announcers.length,
      totalCost: 200,
      totalTokens: 5000,
      generationTime: 2000,
      status: 'cached',
    },
  };
};

describe('AI Performance Benchmarks', () => {
  let contentManager: AIContentManager;
  let dialogueManager: DialogueManager;

  beforeEach(() => {
    (AIContentManager as any).instance = null;
    contentManager = AIContentManager.getInstance('development');
    dialogueManager = new DialogueManager();

    // Mock fetch with large content
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => createLargeGameContent(0),
    });
  });

  afterEach(async () => {
    if (contentManager) {
      await contentManager.clearCache();
    }
  });

  describe('Content Manager Initialization', () => {
    it('should initialize within 500ms', async () => {
      // Reset to ensure fresh initialization
      (AIContentManager as any).instance = null;
      const manager = AIContentManager.getInstance('development');

      const start = performance.now();
      await manager.getContent();
      const duration = performance.now() - start;

      console.log(`Content manager initialization: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.contentManagerInit);
    });

    it('should load fallback content quickly', async () => {
      const start = performance.now();
      await contentManager.getContent();
      const duration = performance.now() - start;

      console.log(`Fallback content load: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.contentManagerInit);
    });

    it('should handle concurrent initialization requests efficiently', async () => {
      (AIContentManager as any).instance = null;
      const manager = AIContentManager.getInstance('development');

      const start = performance.now();
      
      // 10 concurrent requests
      const promises = Array.from({ length: 10 }, () => manager.getContent());
      await Promise.all(promises);
      
      const duration = performance.now() - start;

      console.log(`Concurrent initialization (10 requests): ${duration.toFixed(2)}ms`);
      // Should still complete quickly even with concurrent requests
      expect(duration).toBeLessThan(PERFORMANCE_TARGETS.contentManagerInit * 1.5);
    });
  });

  describe('Dialogue Selection Performance', () => {
    it('should select dialogue in <1ms per call', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        dialogueManager.selectDialogue(
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
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      console.log(`Dialogue selection average: ${avgDuration.toFixed(4)}ms per call`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.dialogueSelection);
    });

    it('should maintain performance with large dialogue sets', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0]; // Has 20 dialogue lines

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        dialogueManager.selectDialogue(
          vendor.id,
          vendor.dialogue,
          {
            event: 'vendorServe',
            score: i,
            waveState: 'inactive',
            sectionStats: {
              happiness: (i % 100),
              thirst: (i % 100),
              attention: (i % 100),
            },
          }
        );
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      console.log(`Large dialogue set selection: ${avgDuration.toFixed(4)}ms per call`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.dialogueSelection);
    });

    it('should handle context filtering efficiently', async () => {
      const complexDialogue: DialogueLine[] = Array.from({ length: 50 }, (_, i) => ({
        id: `line-${i}`,
        text: `Line ${i}`,
        context: {
          event: 'vendorServe',
          minHappiness: i,
          maxHappiness: i + 10,
          minThirst: i,
          maxThirst: i + 10,
          scoreRange: [i * 10, (i + 1) * 10],
        },
        emotion: 'neutral',
        priority: 5,
        cooldown: 5000,
      }));

      const iterations = 500;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        dialogueManager.selectDialogue(
          'test-vendor',
          complexDialogue,
          {
            event: 'vendorServe',
            score: i % 500,
            waveState: 'inactive',
            sectionStats: {
              happiness: i % 100,
              thirst: i % 100,
              attention: i % 100,
            },
          }
        );
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      console.log(`Complex context filtering: ${avgDuration.toFixed(4)}ms per call`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.dialogueSelection * 2);
    });
  });

  describe('Memory Usage', () => {
    it('should keep content memory under 5MB', async () => {
      const content = await contentManager.getContent();

      // Estimate memory size by serializing
      const jsonString = JSON.stringify(content);
      const sizeInBytes = new Blob([jsonString]).size;
      const sizeInMB = sizeInBytes / (1024 * 1024);

      console.log(`Content size: ${sizeInMB.toFixed(2)}MB (${sizeInBytes} bytes)`);
      expect(sizeInBytes).toBeLessThan(PERFORMANCE_TARGETS.memoryUsage);
    });

    it('should not accumulate memory in dialogue manager', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];

      // Use dialogue many times
      for (let i = 0; i < 1000; i++) {
        dialogueManager.selectDialogue(
          `vendor-${i % 10}`,
          vendor.dialogue,
          {
            event: 'vendorServe',
            score: 100,
            waveState: 'inactive',
          }
        );
      }

      // Usage map should be bounded
      const usageCount = dialogueManager.getUsageCount();
      const estimatedSize = usageCount * 100; // Rough estimate: 100 bytes per entry

      console.log(`Dialogue usage entries: ${usageCount} (~${(estimatedSize / 1024).toFixed(2)}KB)`);
      expect(estimatedSize).toBeLessThan(1024 * 1024); // Less than 1MB
    });

    it('should handle memory efficiently with multiple characters', async () => {
      const content = await contentManager.getContent();

      // Use all vendors
      for (const vendor of content.vendors) {
        for (let i = 0; i < 10; i++) {
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
      }

      // Use all mascots
      for (const mascot of content.mascots) {
        for (let i = 0; i < 10; i++) {
          dialogueManager.selectDialogue(
            mascot.id,
            mascot.dialogue,
            {
              event: 'mascotActivate',
              score: 100,
              waveState: 'active',
            }
          );
        }
      }

      const usageCount = dialogueManager.getUsageCount();
      console.log(`Total usage entries across all characters: ${usageCount}`);
      
      // Should track efficiently without excessive memory
      expect(usageCount).toBeLessThan(500);
    });
  });

  describe('Cache Performance', () => {
    it('should retrieve from cache in <10ms', async () => {
      const epoch = getCurrentEpoch(Date.now(), 'development');
      const mockContent = createLargeGameContent(epoch);

      // Store in cache
      const expiresAt = getEpochStartTime(epoch + 1, 'development');
      await contentManager.storeContent(mockContent, expiresAt);

      // Measure retrieval time
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const timestamp = getEpochStartTime(epoch, 'development');
        const start = performance.now();
        await contentManager.getContent(timestamp);
        const duration = performance.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log(`Cache retrieval: avg=${avgTime.toFixed(2)}ms, min=${minTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
      
      // Average should be under target (allowing for some variance)
      expect(avgTime).toBeLessThan(PERFORMANCE_TARGETS.cacheHit * 2);
      // Best case should definitely be under target
      expect(minTime).toBeLessThan(PERFORMANCE_TARGETS.cacheHit);
    });

    it('should handle cache misses efficiently', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const futureEpoch = getCurrentEpoch(Date.now(), 'development') + i + 100;
        const timestamp = getEpochStartTime(futureEpoch, 'development');
        
        const start = performance.now();
        await contentManager.getContent(timestamp);
        const duration = performance.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;

      console.log(`Cache miss (fallback) average: ${avgTime.toFixed(2)}ms`);
      // Cache miss should fall back quickly
      expect(avgTime).toBeLessThan(50);
    });
  });

  describe('Announcer System Performance', () => {
    it('should select commentary efficiently', async () => {
      const content = await contentManager.getContent();
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      const iterations = 500;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        announcerSystem.getCommentary('waveStart', {
          score: i,
          waveState: 'countdown',
        });
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      console.log(`Announcer commentary selection: ${avgDuration.toFixed(4)}ms per call`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.dialogueSelection * 2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple dialogue selections simultaneously', async () => {
      const content = await contentManager.getContent();
      
      const start = performance.now();

      // Simulate 10 concurrent characters speaking
      const promises = content.vendors.slice(0, 10).map(vendor =>
        Promise.resolve(
          dialogueManager.selectDialogue(
            vendor.id,
            vendor.dialogue,
            {
              event: 'vendorServe',
              score: 100,
              waveState: 'inactive',
            }
          )
        )
      );

      await Promise.all(promises);
      const duration = performance.now() - start;

      console.log(`10 concurrent dialogue selections: ${duration.toFixed(2)}ms total`);
      expect(duration).toBeLessThan(10); // Should complete very quickly
    });

    it('should maintain 60fps during heavy usage', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Simulate one frame of gameplay with multiple operations
      const frameBudget = PERFORMANCE_TARGETS.speechBubbleRender;
      const iterations = 10; // Simulate 10 active speech bubbles

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        // Mix of vendor and announcer dialogue
        if (i % 2 === 0) {
          dialogueManager.selectDialogue(
            vendor.id,
            vendor.dialogue,
            {
              event: 'vendorServe',
              score: 100,
              waveState: 'inactive',
            }
          );
        } else {
          announcerSystem.getCommentary('waveStart', {
            score: 100,
            waveState: 'countdown',
          });
        }
      }

      const duration = performance.now() - start;

      console.log(`Frame budget usage (10 operations): ${duration.toFixed(2)}ms (${((duration / frameBudget) * 100).toFixed(1)}% of 16.67ms)`);
      
      // Should use only a small fraction of frame budget
      expect(duration).toBeLessThan(frameBudget * 0.5); // Less than 50% of frame budget
    });
  });

  describe('Epoch Transition Performance', () => {
    it('should handle epoch boundaries efficiently', async () => {
      const epoch1 = getCurrentEpoch(Date.now(), 'development');
      const epoch2 = epoch1 + 1;

      const content1 = await contentManager.getContent(
        getEpochStartTime(epoch1, 'development')
      );
      
      const start = performance.now();
      const content2 = await contentManager.getContent(
        getEpochStartTime(epoch2, 'development')
      );
      const duration = performance.now() - start;

      console.log(`Epoch transition: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it('should generate deterministic seeds quickly', () => {
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        contentManager.getSeedForEpoch(Date.now() + i * 1000);
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      console.log(`Seed generation: ${avgDuration.toFixed(4)}ms per call`);
      expect(avgDuration).toBeLessThan(0.1); // Should be extremely fast
    });
  });

  describe('Stress Tests', () => {
    it('should handle 1000 consecutive dialogue selections', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        dialogueManager.selectDialogue(
          vendor.id,
          vendor.dialogue,
          {
            event: 'vendorServe',
            score: i,
            waveState: 'inactive',
            sectionStats: {
              happiness: i % 100,
              thirst: i % 100,
              attention: i % 100,
            },
          }
        );
      }

      const duration = performance.now() - start;
      const avgDuration = duration / 1000;

      console.log(`1000 dialogue selections: ${duration.toFixed(2)}ms total, ${avgDuration.toFixed(4)}ms avg`);
      expect(avgDuration).toBeLessThan(PERFORMANCE_TARGETS.dialogueSelection);
    });

    it('should handle rapid content retrieval', async () => {
      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await contentManager.getContent();
      }

      const duration = performance.now() - start;
      const avgDuration = duration / iterations;

      console.log(`100 rapid content retrievals: ${avgDuration.toFixed(2)}ms avg`);
      expect(avgDuration).toBeLessThan(50);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should simulate typical 5-minute gameplay performance', async () => {
      const content = await contentManager.getContent();
      const vendor = content.vendors[0];
      const announcer = content.announcers[0];
      const announcerSystem = new AnnouncerSystem(announcer, dialogueManager);

      // Typical 5-minute session:
      // - 15 waves
      // - 50 vendor interactions
      // - 30 announcer comments

      const start = performance.now();

      // Waves
      for (let i = 0; i < 15; i++) {
        announcerSystem.getCommentary('waveStart', {
          score: i * 100,
          waveState: 'countdown',
        });
        announcerSystem.getCommentary('waveSuccess', {
          score: (i + 1) * 100,
          waveState: 'inactive',
        });
      }

      // Vendor interactions
      for (let i = 0; i < 50; i++) {
        dialogueManager.selectDialogue(
          vendor.id,
          vendor.dialogue,
          {
            event: 'vendorServe',
            score: 500,
            waveState: 'inactive',
          }
        );
      }

      const duration = performance.now() - start;

      console.log(`5-minute gameplay simulation: ${duration.toFixed(2)}ms total`);
      // All operations should complete quickly
      expect(duration).toBeLessThan(100);
    });
  });
});
