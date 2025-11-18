import { describe, it, expect, beforeEach } from 'vitest';
import { AnnouncerSystem } from '@/systems/AnnouncerSystem';
import type { AnnouncerContent } from '@/types/personalities';
import { DialogueManager } from '@/systems/DialogueManager';

// Mock announcer content
const createMockAnnouncerContent = (): AnnouncerContent => ({
  id: 'announcer-test-1',
  name: 'Test Announcer',
  description: 'A test announcer for unit tests',
  style: 'energetic',
  traits: [],
  commentary: [
    {
      id: 'test-commentary-waveStart',
      text: 'Here comes the wave!',
      context: {
        event: 'waveStart',
      },
      emotion: 'excited',
      priority: 5,
      cooldown: 30000,
    },
    {
      id: 'test-commentary-waveSuccess',
      text: 'Amazing wave!',
      context: {
        event: 'waveComplete',
      },
      emotion: 'celebratory',
      priority: 5,
      cooldown: 30000,
    },
    {
      id: 'test-commentary-waveFail',
      text: 'Oh no, the wave fizzled out!',
      context: {
        event: 'sectionFail',
      },
      emotion: 'disappointed',
      priority: 4,
      cooldown: 30000,
    },
    {
      id: 'test-commentary-highScore',
      text: 'New high score!',
      context: {
        event: 'highScore',
      },
      emotion: 'celebratory',
      priority: 5,
      cooldown: 60000,
    },
  ],
  catchphrases: [
    {
      id: 'test-catchphrase-1',
      text: 'BOOM SHAKALAKA!',
      trigger: {
        event: 'waveComplete',
        conditions: {
          perfectWave: true,
        },
      },
      rarity: 1.0, // Always trigger when conditions met
    },
    {
      id: 'test-catchphrase-2',
      text: "He's on fire!",
      trigger: {
        event: 'waveComplete',
        conditions: {
          consecutiveSuccesses: 3,
        },
      },
      rarity: 1.0,
    },
  ],
  metadata: {
    model: 'test-model',
    temperature: 0.7,
    promptTokens: 100,
    completionTokens: 200,
    cost: 0.05,
    generatedAt: Date.now(),
    epoch: 0,
    usageCount: 0,
  },
});

describe('AnnouncerSystem', () => {
  let mockContent: AnnouncerContent;
  let dialogueManager: DialogueManager;

  beforeEach(() => {
    mockContent = createMockAnnouncerContent();
    dialogueManager = new DialogueManager();
  });

  describe('Initialization', () => {
    it('should create announcer system with content', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      expect(system.getAnnouncerContent()).toBe(mockContent);
      expect(system.getAnnouncerId()).toBe('announcer-test-1');
    });

    it('should create announcer system without content', () => {
      const system = new AnnouncerSystem();
      expect(system.getAnnouncerContent()).toBeNull();
      expect(system.getAnnouncerId()).toMatch(/^announcer-/);
    });

    it('should initialize with zero consecutive successes', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      expect(system.getConsecutiveSuccesses()).toBe(0);
    });
  });

  describe('Commentary Selection', () => {
    it('should get commentary for waveStart', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      const commentary = system.getCommentary('waveStart', {
        score: 100,
        waveState: 'countdown',
      });
      expect(commentary).toBe('Here comes the wave!');
    });

    it('should get commentary for waveSuccess', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      const commentary = system.getCommentary('waveSuccess', {
        score: 200,
        waveState: 'inactive',
      });
      expect(commentary).toBe('Amazing wave!');
    });

    it('should get commentary for waveFail', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      const commentary = system.getCommentary('waveFail', {
        score: 150,
        waveState: 'inactive',
      });
      expect(commentary).toBe('Oh no, the wave fizzled out!');
    });

    it('should get commentary for newHighScore', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      const commentary = system.getCommentary('newHighScore', {
        score: 1000,
        waveState: 'inactive',
      });
      expect(commentary).toBe('New high score!');
    });

    it('should return null when no content', () => {
      const system = new AnnouncerSystem();
      const commentary = system.getCommentary('waveStart', {
        score: 100,
        waveState: 'countdown',
      });
      expect(commentary).toBeNull();
    });

    it('should return null when no dialogue manager', () => {
      const system = new AnnouncerSystem(mockContent);
      const commentary = system.getCommentary('waveStart', {
        score: 100,
        waveState: 'countdown',
      });
      expect(commentary).toBeNull();
    });
  });

  describe('Consecutive Successes Tracking', () => {
    it('should increment consecutive successes on waveSuccess', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      
      system.getCommentary('waveSuccess', { score: 100, waveState: 'inactive' });
      expect(system.getConsecutiveSuccesses()).toBe(1);
      
      system.getCommentary('waveSuccess', { score: 200, waveState: 'inactive' });
      expect(system.getConsecutiveSuccesses()).toBe(2);
      
      system.getCommentary('waveSuccess', { score: 300, waveState: 'inactive' });
      expect(system.getConsecutiveSuccesses()).toBe(3);
    });

    it('should reset consecutive successes on waveFail', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      
      system.getCommentary('waveSuccess', { score: 100, waveState: 'inactive' });
      system.getCommentary('waveSuccess', { score: 200, waveState: 'inactive' });
      expect(system.getConsecutiveSuccesses()).toBe(2);
      
      system.getCommentary('waveFail', { score: 150, waveState: 'inactive' });
      expect(system.getConsecutiveSuccesses()).toBe(0);
    });

    it('should manually reset consecutive successes', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      
      system.getCommentary('waveSuccess', { score: 100, waveState: 'inactive' });
      system.getCommentary('waveSuccess', { score: 200, waveState: 'inactive' });
      expect(system.getConsecutiveSuccesses()).toBe(2);
      
      system.resetConsecutiveSuccesses();
      expect(system.getConsecutiveSuccesses()).toBe(0);
    });
  });

  describe('Catchphrases', () => {
    it('should trigger catchphrase for perfect wave', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      const commentary = system.getCommentary('waveSuccess', {
        score: 500,
        waveState: 'inactive',
        perfectWave: true,
      });
      expect(commentary).toBe('BOOM SHAKALAKA!');
    });

    it('should trigger catchphrase after consecutive successes', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      
      // Get to 2 consecutive successes
      system.getCommentary('waveSuccess', { score: 100, waveState: 'inactive' });
      system.getCommentary('waveSuccess', { score: 200, waveState: 'inactive' });
      
      // Third success should trigger catchphrase
      const commentary = system.getCommentary('waveSuccess', {
        score: 300,
        waveState: 'inactive',
      });
      expect(commentary).toBe("He's on fire!");
    });

    it('should not trigger catchphrase without meeting conditions', () => {
      const system = new AnnouncerSystem(mockContent, dialogueManager);
      
      // Only 1 consecutive success, needs 3 for catchphrase
      const commentary = system.getCommentary('waveSuccess', {
        score: 100,
        waveState: 'inactive',
      });
      expect(commentary).toBe('Amazing wave!'); // Regular commentary
    });
  });

  describe('Setters', () => {
    it('should set announcer content', () => {
      const system = new AnnouncerSystem();
      expect(system.getAnnouncerContent()).toBeNull();
      
      system.setAnnouncerContent(mockContent);
      expect(system.getAnnouncerContent()).toBe(mockContent);
      expect(system.getAnnouncerId()).toBe('announcer-test-1');
    });

    it('should set dialogue manager', () => {
      const system = new AnnouncerSystem(mockContent);
      
      // Should not work without dialogue manager
      let commentary = system.getCommentary('waveStart', {
        score: 100,
        waveState: 'countdown',
      });
      expect(commentary).toBeNull();
      
      // Should work after setting dialogue manager
      system.setDialogueManager(dialogueManager);
      commentary = system.getCommentary('waveStart', {
        score: 100,
        waveState: 'countdown',
      });
      expect(commentary).toBe('Here comes the wave!');
    });
  });
});
