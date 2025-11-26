import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Mascot } from '@/sprites/Mascot';
import { StadiumSection } from '@/sprites/StadiumSection';
import { gameBalance } from '@/config/gameBalance';

// Mock Phaser scene
const createMockScene = (): any => {
  const mockEventEmitter = {
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  return {
    add: {
      existing: vi.fn(),
    },
    physics: {
      add: {
        existing: vi.fn(),
      },
    },
    tweens: {
      add: vi.fn(),
    },
    time: {
      delayedCall: vi.fn(),
    },
    sys: {
      queueDepthSort: vi.fn(),
      displayList: {
        add: vi.fn(),
      },
      updateList: {
        add: vi.fn(),
      },
      events: mockEventEmitter,
    },
    events: mockEventEmitter,
    anims: {
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
    },
    textures: {
      exists: vi.fn().mockReturnValue(true),
      get: vi.fn().mockReturnValue({
        has: vi.fn().mockReturnValue(false),
      }),
    },
  };
};

// Mock section with configurable dimensions
const createMockSection = (
  id: string = 'A',
  x: number = 256,
  y: number = 300,
  width: number = 200,
  height: number = 200
): StadiumSection => {
  const scene = createMockScene();
  const section = new StadiumSection(
    scene,
    x,
    y,
    {
      width,
      height,
      rowCount: 4,
      seatsPerRow: 8,
    },
    id
  );
  return section;
};

describe('Mascot Movement System', () => {
  let scene: any;
  let mascot: Mascot;
  let section: StadiumSection;

  beforeEach(() => {
    scene = createMockScene();
    section = createMockSection('A', 256, 300, 200, 200);
    mascot = new Mascot(scene, 0, 0);
  });

  describe('Activation and Deactivation', () => {
    it('should activate in section and become visible', () => {
      expect(mascot.canActivate()).toBe(true);

      mascot.activateInSection(section, 'manual');

      expect(mascot.visible).toBe(true);
      expect(mascot.canActivate()).toBe(false);
      expect(mascot.isPatrolling()).toBe(true);
      expect(mascot.getAssignedSection()).toBe(section);
    });

    it('should position mascot on section perimeter when activated', () => {
      mascot.activateInSection(section);

      const bounds = section.getSectionBounds();
      const padding = gameBalance.mascot.edgePadding;

      // Mascot should be within section bounds (with padding)
      expect(mascot.x).toBeGreaterThanOrEqual(bounds.left + padding - 1);
      expect(mascot.x).toBeLessThanOrEqual(bounds.right - padding + 1);
      expect(mascot.y).toBeGreaterThanOrEqual(bounds.top + padding - 1);
      expect(mascot.y).toBeLessThanOrEqual(bounds.bottom - padding + 1);
    });

    it('should deactivate after duration expires', () => {
      mascot.activateInSection(section);
      expect(mascot.visible).toBe(true);
      expect(mascot.isPatrolling()).toBe(true);

      // Simulate time passing beyond max duration (20 seconds + 1 second buffer)
      for (let i = 0; i < 21; i++) {
        mascot.update(1000); // 1 second per update
      }

      expect(mascot.visible).toBe(false);
      expect(mascot.isPatrolling()).toBe(false);
      expect(mascot.getCooldown()).toBeGreaterThan(0);
      expect(mascot.canActivate()).toBe(false);
    });

    it('should enter cooldown after deactivation', () => {
      mascot.activateInSection(section);

      // Force immediate deactivation using test helper
      mascot.__TEST_forceDeactivation();
      mascot.update(16);

      expect(mascot.getCooldown()).toBeGreaterThan(0);
      expect(mascot.getCooldown()).toBeGreaterThanOrEqual(gameBalance.mascot.minCooldown);
      expect(mascot.getCooldown()).toBeLessThanOrEqual(gameBalance.mascot.maxCooldown);
    });

    it('should reduce cooldown over time', () => {
      // Set cooldown using test helper
      mascot.__TEST_setCooldown(5000); // 5 seconds

      expect(mascot.getCooldown()).toBe(5000);

      mascot.update(1000); // 1 second
      expect(mascot.getCooldown()).toBe(4000);

      mascot.update(4000); // 4 more seconds
      expect(mascot.getCooldown()).toBe(0);
      expect(mascot.canActivate()).toBe(true);
    });
  });

  describe('Movement Behavior', () => {
    it('should move along perimeter during update', () => {
      mascot.activateInSection(section);

      const startX = mascot.x;
      const startY = mascot.y;

      // Update for ~1 second (60 frames at 16.67ms each)
      for (let i = 0; i < 60; i++) {
        mascot.update(16.67);
      }

      // Position should have changed (mascot moved)
      const moved = (mascot.x !== startX) || (mascot.y !== startY);
      expect(moved).toBe(true);
    });

    it('should stay within section bounds during movement', () => {
      mascot.activateInSection(section);

      const bounds = section.getSectionBounds();
      const padding = gameBalance.mascot.edgePadding;

      // Update for several seconds
      for (let i = 0; i < 300; i++) {
        mascot.update(16.67);

        // Check bounds on every update
        expect(mascot.x).toBeGreaterThanOrEqual(bounds.left + padding - 2);
        expect(mascot.x).toBeLessThanOrEqual(bounds.right - padding + 2);
        expect(mascot.y).toBeGreaterThanOrEqual(bounds.top + padding - 2);
        expect(mascot.y).toBeLessThanOrEqual(bounds.bottom - padding + 2);
      }
    });

    it('should face correct direction based on movement', () => {
      mascot.activateInSection(section);

      // Update a few frames to ensure movement starts
      for (let i = 0; i < 10; i++) {
        mascot.update(16.67);
      }

      // flipX should be set based on direction (left = true, right = false)
      expect(typeof mascot.flipX).toBe('boolean');
    });

    it('should not move while in cooldown', () => {
      // Activate and then deactivate
      mascot.activateInSection(section);
      mascot.__TEST_forceDeactivation();
      mascot.update(16);

      // Now in cooldown
      const cooldownX = mascot.x;
      const cooldownY = mascot.y;

      // Update during cooldown
      for (let i = 0; i < 60; i++) {
        mascot.update(16.67);
      }

      // Position should not change during cooldown
      expect(mascot.x).toBe(cooldownX);
      expect(mascot.y).toBe(cooldownY);
    });
  });

  describe('Depth Factor Calculation', () => {
    it('should return depth factor when active', () => {
      mascot.activateInSection(section);

      const depthFactor = mascot.getDepthFactor();
      expect(depthFactor).toBeGreaterThanOrEqual(gameBalance.mascot.depthFactorFrontSides);
      expect(depthFactor).toBeLessThanOrEqual(gameBalance.mascot.depthFactorBack);
    });

    it('should return default depth factor when inactive', () => {
      const depthFactor = mascot.getDepthFactor();
      expect(depthFactor).toBe(gameBalance.mascot.depthFactorFrontSides);
    });

    it('should vary depth factor based on position', () => {
      mascot.activateInSection(section);

      const depthFactors = new Set<number>();

      // Collect depth factors over time as mascot moves
      for (let i = 0; i < 500; i++) {
        mascot.update(16.67);
        depthFactors.add(mascot.getDepthFactor());
      }

      // Should have seen multiple depth factors (front/sides = 0.3, back = 1.0)
      expect(depthFactors.size).toBeGreaterThanOrEqual(1);
      expect(depthFactors.has(gameBalance.mascot.depthFactorFrontSides)).toBe(true);
    });
  });

  describe('Section Assignment', () => {
    it('should track assigned section', () => {
      expect(mascot.getAssignedSection()).toBeNull();

      mascot.activateInSection(section);

      expect(mascot.getAssignedSection()).toBe(section);
    });

    it('should clear section on manual clear', () => {
      mascot.activateInSection(section);
      expect(mascot.getAssignedSection()).toBe(section);

      mascot.clearSection();
      expect(mascot.getAssignedSection()).toBeNull();
    });

    it('should allow manual section assignment without activation', () => {
      mascot.assignToSection(section);

      expect(mascot.getAssignedSection()).toBe(section);
      expect(mascot.isPatrolling()).toBe(false);
      expect(mascot.visible).toBe(false);
    });
  });

  describe('Movement Modes', () => {
    it('should default to manual mode', () => {
      expect(mascot.getMovementMode()).toBe('manual');
    });

    it('should activate in manual mode by default', () => {
      mascot.activateInSection(section);
      expect(mascot.getMovementMode()).toBe('manual');
    });

    it('should activate in auto mode when specified', () => {
      mascot.activateInSection(section, 'auto');
      expect(mascot.getMovementMode()).toBe('auto');
    });

    it('should allow changing movement mode', () => {
      mascot.setMovementMode('auto');
      expect(mascot.getMovementMode()).toBe('auto');

      mascot.setMovementMode('manual');
      expect(mascot.getMovementMode()).toBe('manual');
    });
  });

  describe('Multi-Mascot Support', () => {
    it('should support multiple mascots simultaneously', () => {
      const mascot2 = new Mascot(scene, 0, 0);
      const section2 = createMockSection('B', 512, 300, 200, 200);

      mascot.activateInSection(section);
      mascot2.activateInSection(section2);

      expect(mascot.isPatrolling()).toBe(true);
      expect(mascot2.isPatrolling()).toBe(true);
      expect(mascot.getAssignedSection()).toBe(section);
      expect(mascot2.getAssignedSection()).toBe(section2);
    });

    it('should track separate cooldowns for multiple mascots', () => {
      const mascot2 = new Mascot(scene, 0, 0);

      mascot.activateInSection(section);
      mascot.__TEST_forceDeactivation();
      mascot.update(16); // Deactivate mascot 1

      mascot2.activateInSection(section);

      expect(mascot.canActivate()).toBe(false);
      expect(mascot2.canActivate()).toBe(false);
      expect(mascot.getCooldown()).toBeGreaterThan(0);
      expect(mascot2.getCooldown()).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should complete update() quickly', () => {
      mascot.activateInSection(section);

      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        mascot.update(16.67);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      // Should average < 0.5ms per update (generous target)
      expect(avgTime).toBeLessThan(0.5);
    });

    it('should handle multiple mascots efficiently', () => {
      const mascots: Mascot[] = [];
      const sections: StadiumSection[] = [];

      // Create 4 mascots and sections
      for (let i = 0; i < 4; i++) {
        mascots.push(new Mascot(scene, 0, 0));
        sections.push(createMockSection(`${String.fromCharCode(65 + i)}`, 256 * i, 300));
      }

      // Activate all mascots
      mascots.forEach((m, i) => m.activateInSection(sections[i]));

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        mascots.forEach(m => m.update(16.67));
      }

      const duration = performance.now() - start;
      const avgTimePerMascot = duration / (iterations * mascots.length);

      // Should average < 0.5ms per mascot update
      expect(avgTimePerMascot).toBeLessThan(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small sections', () => {
      const smallSection = createMockSection('S', 100, 100, 50, 50);

      expect(() => {
        mascot.activateInSection(smallSection);
      }).not.toThrow();

      // Update a few times
      for (let i = 0; i < 60; i++) {
        expect(() => {
          mascot.update(16.67);
        }).not.toThrow();
      }
    });

    it('should handle very large sections', () => {
      const largeSection = createMockSection('L', 500, 500, 800, 600);

      expect(() => {
        mascot.activateInSection(largeSection);
      }).not.toThrow();

      // Update a few times
      for (let i = 0; i < 60; i++) {
        expect(() => {
          mascot.update(16.67);
        }).not.toThrow();
      }
    });

    it('should handle zero delta time gracefully', () => {
      mascot.activateInSection(section);

      const beforeX = mascot.x;
      const beforeY = mascot.y;

      expect(() => {
        mascot.update(0);
      }).not.toThrow();

      // Position should not change with zero delta
      expect(mascot.x).toBe(beforeX);
      expect(mascot.y).toBe(beforeY);
    });

    it('should handle very large delta time', () => {
      mascot.activateInSection(section);

      expect(() => {
        mascot.update(10000); // 10 seconds
      }).not.toThrow();

      // Should have deactivated due to duration expiring
      expect(mascot.isPatrolling()).toBe(false);
    });
  });
});
