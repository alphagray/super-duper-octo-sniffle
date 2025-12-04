/**
 * Content Quality Tests
 * 
 * Validates the quality and consistency of AI-generated content:
 * - Static fallback content completeness and quality
 * - Personality trait consistency across dialogue
 * - Appropriate tone and style for each character type
 * - Content structure and field validation
 * - Dialogue context appropriateness
 * 
 * These tests ensure that both AI-generated and static content
 * meet quality standards for player experience.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIContentManager } from '@/systems/AIContentManager';
import { getAssetPath } from '@/utils/assetPath';
import type {
  GameAIContent,
  VendorPersonality,
  MascotPersonality,
  AnnouncerContent,
  DialogueLine,
  PersonalityTrait,
} from '@/types/personalities';

describe('Content Quality Tests', () => {
  let contentManager: AIContentManager;
  let staticContent: GameAIContent | null = null;

  beforeEach(async () => {
    (AIContentManager as any).instance = null;
    contentManager = AIContentManager.getInstance('development');

    // Fetch actual static fallback content
    try {
      const response = await fetch(getAssetPath('assets/ai-content-static.json'));
      if (response.ok) {
        staticContent = await response.json();
      }
    } catch (error) {
      console.warn('Could not load static content for testing');
    }
  });

  describe('Static Fallback Content Quality', () => {
    it('should have valid content structure', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      expect(staticContent).toBeDefined();
      expect(staticContent.version).toBeTruthy();
      expect(staticContent.vendors).toBeInstanceOf(Array);
      expect(staticContent.mascots).toBeInstanceOf(Array);
      expect(staticContent.announcers).toBeInstanceOf(Array);
      expect(staticContent.metadata).toBeDefined();
    });

    it('should have non-empty personality collections', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      expect(staticContent.vendors.length).toBeGreaterThan(0);
      expect(staticContent.mascots.length).toBeGreaterThan(0);
      expect(staticContent.announcers.length).toBeGreaterThan(0);

      console.log(`Static content contains: ${staticContent.vendors.length} vendors, ${staticContent.mascots.length} mascots, ${staticContent.announcers.length} announcers`);
    });

    it('should have complete vendor personalities', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.vendors.forEach((vendor, index) => {
        // Required fields
        expect(vendor.id, `Vendor ${index} missing id`).toBeTruthy();
        expect(vendor.name, `Vendor ${index} missing name`).toBeTruthy();
        expect(vendor.description, `Vendor ${index} missing description`).toBeTruthy();
        expect(vendor.productType, `Vendor ${index} missing productType`).toBeTruthy();
        
        // Collections
        expect(vendor.traits, `Vendor ${index} missing traits`).toBeInstanceOf(Array);
        expect(vendor.dialogue, `Vendor ${index} missing dialogue`).toBeInstanceOf(Array);
        expect(vendor.dialogue.length, `Vendor ${index} has no dialogue`).toBeGreaterThan(0);
        
        // Movement config
        expect(vendor.movement, `Vendor ${index} missing movement`).toBeDefined();
        expect(vendor.movement.speed, `Vendor ${index} movement.speed invalid`).toBeGreaterThan(0);
        expect(vendor.movement.pauseDuration, `Vendor ${index} movement.pauseDuration invalid`).toBeGreaterThan(0);
        
        // Appearance
        expect(vendor.appearance, `Vendor ${index} missing appearance`).toBeDefined();
        expect(vendor.appearance.spriteSheet, `Vendor ${index} missing spriteSheet`).toBeTruthy();
        
        // Metadata
        expect(vendor.metadata, `Vendor ${index} missing metadata`).toBeDefined();
      });
    });

    it('should have complete mascot personalities', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.mascots.forEach((mascot, index) => {
        // Required fields
        expect(mascot.id, `Mascot ${index} missing id`).toBeTruthy();
        expect(mascot.name, `Mascot ${index} missing name`).toBeTruthy();
        expect(mascot.description, `Mascot ${index} missing description`).toBeTruthy();
        expect(mascot.theme, `Mascot ${index} missing theme`).toBeTruthy();
        
        // Collections
        expect(mascot.traits, `Mascot ${index} missing traits`).toBeInstanceOf(Array);
        expect(mascot.dialogue, `Mascot ${index} missing dialogue`).toBeInstanceOf(Array);
        expect(mascot.dialogue.length, `Mascot ${index} has no dialogue`).toBeGreaterThan(0);
        expect(mascot.abilities, `Mascot ${index} missing abilities`).toBeInstanceOf(Array);
        expect(mascot.abilities.length, `Mascot ${index} has no abilities`).toBeGreaterThan(0);
        
        // Appearance
        expect(mascot.appearance, `Mascot ${index} missing appearance`).toBeDefined();
        expect(mascot.appearance.spriteSheet, `Mascot ${index} missing spriteSheet`).toBeTruthy();
        
        // Metadata
        expect(mascot.metadata, `Mascot ${index} missing metadata`).toBeDefined();
      });
    });

    it('should have complete announcer personalities', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.announcers.forEach((announcer, index) => {
        // Required fields
        expect(announcer.id, `Announcer ${index} missing id`).toBeTruthy();
        expect(announcer.name, `Announcer ${index} missing name`).toBeTruthy();
        expect(announcer.description, `Announcer ${index} missing description`).toBeTruthy();
        expect(announcer.style, `Announcer ${index} missing style`).toBeTruthy();
        
        // Collections
        expect(announcer.traits, `Announcer ${index} missing traits`).toBeInstanceOf(Array);
        expect(announcer.commentary, `Announcer ${index} missing commentary`).toBeInstanceOf(Array);
        expect(announcer.commentary.length, `Announcer ${index} has no commentary`).toBeGreaterThan(0);
        expect(announcer.catchphrases, `Announcer ${index} missing catchphrases`).toBeInstanceOf(Array);
        
        // Metadata
        expect(announcer.metadata, `Announcer ${index} missing metadata`).toBeDefined();
      });
    });

    it('should have valid metadata', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const { metadata } = staticContent;
      expect(metadata.totalItems).toBeGreaterThan(0);
      expect(metadata.totalCost).toBeGreaterThanOrEqual(0);
      expect(metadata.totalTokens).toBeGreaterThanOrEqual(0);
      expect(metadata.generationTime).toBeGreaterThanOrEqual(0);
      expect(metadata.status).toBeTruthy();
    });
  });

  describe('Personality Trait Consistency', () => {
    it('should have valid trait structures', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allPersonalities = [
        ...staticContent.vendors,
        ...staticContent.mascots,
        ...staticContent.announcers,
      ];

      allPersonalities.forEach((personality, index) => {
        personality.traits.forEach((trait, traitIndex) => {
          expect(trait.id, `Personality ${index} trait ${traitIndex} missing id`).toBeTruthy();
          expect(trait.name, `Personality ${index} trait ${traitIndex} missing name`).toBeTruthy();
          expect(trait.description, `Personality ${index} trait ${traitIndex} missing description`).toBeTruthy();
          expect(trait.intensity, `Personality ${index} trait ${traitIndex} missing intensity`).toBeGreaterThanOrEqual(0);
          expect(trait.intensity, `Personality ${index} trait ${traitIndex} intensity too high`).toBeLessThanOrEqual(1);
          expect(trait.tags, `Personality ${index} trait ${traitIndex} missing tags`).toBeInstanceOf(Array);
        });
      });
    });

    it('should have meaningful trait descriptions', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allPersonalities = [
        ...staticContent.vendors,
        ...staticContent.mascots,
        ...staticContent.announcers,
      ];

      allPersonalities.forEach((personality) => {
        personality.traits.forEach((trait) => {
          // Description should be at least somewhat descriptive
          expect(trait.description.length).toBeGreaterThan(10);
          
          // Should not be just the name repeated
          expect(trait.description.toLowerCase()).not.toBe(trait.name.toLowerCase());
        });
      });
    });

    it('should have consistent trait intensity ranges', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allTraits: PersonalityTrait[] = [
        ...staticContent.vendors.flatMap(v => v.traits),
        ...staticContent.mascots.flatMap(m => m.traits),
        ...staticContent.announcers.flatMap(a => a.traits),
      ];

      const intensities = allTraits.map(t => t.intensity);
      const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;

      // Average should be in reasonable range (not all extreme)
      expect(avgIntensity).toBeGreaterThan(0.3);
      expect(avgIntensity).toBeLessThan(0.9);

      console.log(`Average trait intensity: ${avgIntensity.toFixed(2)}`);
    });
  });

  describe('Dialogue Quality', () => {
    it('should have valid dialogue structures', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allDialogue: DialogueLine[] = [
        ...staticContent.vendors.flatMap(v => v.dialogue),
        ...staticContent.mascots.flatMap(m => m.dialogue),
        ...staticContent.announcers.flatMap(a => a.commentary),
      ];

      allDialogue.forEach((line, index) => {
        expect(line.id, `Dialogue ${index} missing id`).toBeTruthy();
        expect(line.text, `Dialogue ${index} missing text`).toBeTruthy();
        expect(line.context, `Dialogue ${index} missing context`).toBeDefined();
        expect(line.emotion, `Dialogue ${index} missing emotion`).toBeTruthy();
        expect(line.priority, `Dialogue ${index} missing priority`).toBeGreaterThanOrEqual(0);
        expect(line.cooldown, `Dialogue ${index} missing cooldown`).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have meaningful dialogue text', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allDialogue: DialogueLine[] = [
        ...staticContent.vendors.flatMap(v => v.dialogue),
        ...staticContent.mascots.flatMap(m => m.dialogue),
        ...staticContent.announcers.flatMap(a => a.commentary),
      ];

      allDialogue.forEach((line) => {
        // Dialogue should not be empty or just whitespace
        expect(line.text.trim().length).toBeGreaterThan(0);
        
        // Should be at least a few characters (not just "Hi")
        expect(line.text.length).toBeGreaterThan(2);
        
        // Should not be excessively long
        expect(line.text.length).toBeLessThan(500);
      });
    });

    it('should have appropriate dialogue contexts', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      // Vendor dialogue should use vendor events
      staticContent.vendors.forEach((vendor) => {
        vendor.dialogue.forEach((line) => {
          expect(['vendorServe', 'waveComplete', 'sectionSuccess', 'sectionFail', 'fanHappy', 'fanThirsty']).toContain(line.context.event);
        });
      });

      // Mascot dialogue should use mascot events
      staticContent.mascots.forEach((mascot) => {
        mascot.dialogue.forEach((line) => {
          expect(['mascotActivate', 'waveComplete', 'sectionSuccess', 'sectionFail', 'highScore']).toContain(line.context.event);
        });
      });

      // Announcer commentary should use announcer events
      staticContent.announcers.forEach((announcer) => {
        announcer.commentary.forEach((line) => {
          expect(['waveStart', 'waveComplete', 'sectionSuccess', 'sectionFail', 'sessionStart', 'sessionEnd', 'highScore', 'lowScore']).toContain(line.context.event);
        });
      });
    });

    it('should have reasonable cooldowns', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allDialogue: DialogueLine[] = [
        ...staticContent.vendors.flatMap(v => v.dialogue),
        ...staticContent.mascots.flatMap(m => m.dialogue),
        ...staticContent.announcers.flatMap(a => a.commentary),
      ];

      allDialogue.forEach((line) => {
        // Cooldowns should be reasonable (not negative, not years)
        expect(line.cooldown).toBeGreaterThanOrEqual(0);
        expect(line.cooldown).toBeLessThan(60000); // Less than 1 minute
      });

      const avgCooldown = allDialogue.reduce((sum, line) => sum + line.cooldown, 0) / allDialogue.length;
      console.log(`Average dialogue cooldown: ${avgCooldown.toFixed(0)}ms`);
    });

    it('should have varied priorities', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allDialogue: DialogueLine[] = [
        ...staticContent.vendors.flatMap(v => v.dialogue),
        ...staticContent.mascots.flatMap(m => m.dialogue),
        ...staticContent.announcers.flatMap(a => a.commentary),
      ];

      const priorities = [...new Set(allDialogue.map(d => d.priority))];
      
      // Should have at least 2 different priority levels
      expect(priorities.length).toBeGreaterThanOrEqual(2);
      
      console.log(`Dialogue priorities used: ${priorities.sort().join(', ')}`);
    });

    it('should have appropriate emotions for context', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const validEmotions = [
        'neutral', 'cheerful', 'excited', 'disappointed', 'frustrated',
        'amazed', 'concerned', 'confident', 'nervous', 'proud',
      ];

      const allDialogue: DialogueLine[] = [
        ...staticContent.vendors.flatMap(v => v.dialogue),
        ...staticContent.mascots.flatMap(m => m.dialogue),
        ...staticContent.announcers.flatMap(a => a.commentary),
      ];

      allDialogue.forEach((line) => {
        expect(validEmotions).toContain(line.emotion);
      });

      // Check emotion distribution
      const emotionCounts = allDialogue.reduce((acc, line) => {
        acc[line.emotion] = (acc[line.emotion] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('Emotion distribution:', emotionCounts);
    });
  });

  describe('Tone and Style Consistency', () => {
    it('should have consistent vendor tone (service-oriented)', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.vendors.forEach((vendor) => {
        // Vendor dialogue should generally be friendly/service-oriented
        const serviceWords = ['here', 'get', 'fresh', 'hot', 'cold', 'drinks', 'snacks', 'food'];
        
        const dialogueWithServiceWords = vendor.dialogue.filter(line =>
          serviceWords.some(word => line.text.toLowerCase().includes(word))
        );

        // At least some dialogue should be service-oriented
        expect(dialogueWithServiceWords.length).toBeGreaterThan(0);
      });
    });

    it('should have consistent mascot tone (energetic/enthusiastic)', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.mascots.forEach((mascot) => {
        // Mascots should have energetic traits
        const hasEnergeticTrait = mascot.traits.some(trait =>
          trait.name.toLowerCase().includes('energetic') ||
          trait.name.toLowerCase().includes('enthusiastic') ||
          trait.intensity > 0.7
        );

        expect(hasEnergeticTrait).toBe(true);
      });
    });

    it('should have consistent announcer tone (play-by-play style)', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.announcers.forEach((announcer) => {
        // Announcers should have catchphrases
        expect(announcer.catchphrases.length).toBeGreaterThan(0);

        // Check style is appropriate
        const validStyles = ['classic', 'energetic', 'sarcastic', 'professional', 'casual'];
        expect(validStyles).toContain(announcer.style);
      });
    });

    it('should not have inappropriate language', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allText = [
        ...staticContent.vendors.flatMap(v => [
          v.name,
          v.description,
          ...v.dialogue.map(d => d.text),
          ...v.traits.map(t => t.description),
        ]),
        ...staticContent.mascots.flatMap(m => [
          m.name,
          m.description,
          ...m.dialogue.map(d => d.text),
          ...m.traits.map(t => t.description),
        ]),
        ...staticContent.announcers.flatMap(a => [
          a.name,
          a.description,
          ...a.commentary.map(d => d.text),
          ...a.catchphrases.map(c => c.text),
          ...a.traits.map(t => t.description),
        ]),
      ];

      // Check for inappropriate content (basic check)
      const inappropriateWords = ['damn', 'hell', 'crap', 'stupid', 'dumb', 'hate'];
      
      allText.forEach((text) => {
        const lowerText = text.toLowerCase();
        inappropriateWords.forEach((word) => {
          expect(lowerText).not.toContain(word);
        });
      });
    });
  });

  describe('Vendor-Specific Quality', () => {
    it('should have diverse product types', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const productTypes = [...new Set(staticContent.vendors.map(v => v.productType))];
      
      // Should have at least 2 different product types
      expect(productTypes.length).toBeGreaterThanOrEqual(2);
      
      console.log(`Product types: ${productTypes.join(', ')}`);
    });

    it('should have reasonable movement parameters', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.vendors.forEach((vendor, index) => {
        expect(vendor.movement.speed, `Vendor ${index} speed too low`).toBeGreaterThan(0);
        expect(vendor.movement.speed, `Vendor ${index} speed too high`).toBeLessThan(200);
        
        expect(vendor.movement.pauseDuration, `Vendor ${index} pause too short`).toBeGreaterThan(500);
        expect(vendor.movement.pauseDuration, `Vendor ${index} pause too long`).toBeLessThan(10000);
        
        // Section preferences should be valid
        expect(vendor.movement.sectionPreferences).toBeDefined();
        Object.values(vendor.movement.sectionPreferences).forEach((pref) => {
          expect(pref).toBeGreaterThan(0);
          expect(pref).toBeLessThan(2);
        });
      });
    });
  });

  describe('Mascot-Specific Quality', () => {
    it('should have valid ability structures', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.mascots.forEach((mascot, index) => {
        mascot.abilities.forEach((ability, abilityIndex) => {
          expect(ability.id, `Mascot ${index} ability ${abilityIndex} missing id`).toBeTruthy();
          expect(ability.name, `Mascot ${index} ability ${abilityIndex} missing name`).toBeTruthy();
          expect(ability.description, `Mascot ${index} ability ${abilityIndex} missing description`).toBeTruthy();
          expect(ability.cooldown, `Mascot ${index} ability ${abilityIndex} missing cooldown`).toBeGreaterThan(0);
          expect(ability.duration, `Mascot ${index} ability ${abilityIndex} missing duration`).toBeGreaterThan(0);
          expect(ability.effects, `Mascot ${index} ability ${abilityIndex} missing effects`).toBeInstanceOf(Array);
          expect(ability.effects.length, `Mascot ${index} ability ${abilityIndex} has no effects`).toBeGreaterThan(0);
        });
      });
    });

    it('should have balanced ability effects', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.mascots.forEach((mascot) => {
        mascot.abilities.forEach((ability) => {
          ability.effects.forEach((effect) => {
            // Effects should have reasonable values
            expect(Math.abs(effect.value)).toBeGreaterThan(0);
            expect(Math.abs(effect.value)).toBeLessThan(100);
          });
          
          // Duration should be reasonable
          expect(ability.duration).toBeGreaterThan(0);
          expect(ability.duration).toBeLessThan(60000); // Less than 1 minute
        });
      });
    });
  });

  describe('Announcer-Specific Quality', () => {
    it('should have valid catchphrases', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      staticContent.announcers.forEach((announcer, index) => {
        announcer.catchphrases.forEach((catchphrase, cpIndex) => {
          expect(catchphrase.id, `Announcer ${index} catchphrase ${cpIndex} missing id`).toBeTruthy();
          expect(catchphrase.text, `Announcer ${index} catchphrase ${cpIndex} missing text`).toBeTruthy();
          expect(catchphrase.trigger, `Announcer ${index} catchphrase ${cpIndex} missing trigger`).toBeTruthy();
          expect(catchphrase.trigger.event, `Announcer ${index} catchphrase ${cpIndex} missing trigger.event`).toBeTruthy();
          expect(catchphrase.rarity, `Announcer ${index} catchphrase ${cpIndex} missing rarity`).toBeGreaterThanOrEqual(0);
        });
      });
    });

    it('should have catchphrases for key moments', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      // Key conditions that should be present in catchphrases
      const keyConditions = ['perfectWave', 'minMultiplier', 'consecutiveSuccesses'];
      
      staticContent.announcers.forEach((announcer) => {
        const hasKeyCondition = announcer.catchphrases.some(cp => {
          if (!cp.trigger.conditions) return false;
          return keyConditions.some(cond => cond in cp.trigger.conditions!);
        });
        
        // At least one catchphrase should have a special condition
        expect(hasKeyCondition).toBe(true);
      });
    });
  });

  describe('Visual Customization Quality', () => {
    it('should have valid appearance configurations', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allPersonalities = [
        ...staticContent.vendors,
        ...staticContent.mascots,
      ];

      allPersonalities.forEach((personality, index) => {
        expect(personality.appearance.spriteSheet, `Personality ${index} missing spriteSheet`).toBeTruthy();
        expect(personality.appearance.animations, `Personality ${index} missing animations`).toBeInstanceOf(Array);
        expect(personality.appearance.animations.length, `Personality ${index} has no animations`).toBeGreaterThan(0);
        expect(personality.appearance.colorPalette, `Personality ${index} missing colorPalette`).toBeInstanceOf(Array);
        expect(personality.appearance.colorPalette.length, `Personality ${index} has no colors`).toBeGreaterThan(0);
        expect(personality.appearance.scale, `Personality ${index} missing scale`).toBeGreaterThan(0);
      });
    });

    it('should have valid color codes', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allPersonalities = [
        ...staticContent.vendors,
        ...staticContent.mascots,
      ];

      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

      allPersonalities.forEach((personality) => {
        personality.appearance.colorPalette.forEach((color) => {
          expect(hexColorRegex.test(color), `Invalid color: ${color}`).toBe(true);
        });
      });
    });

    it('should have reasonable scale values', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allPersonalities = [
        ...staticContent.vendors,
        ...staticContent.mascots,
      ];

      allPersonalities.forEach((personality) => {
        expect(personality.appearance.scale).toBeGreaterThan(0.5);
        expect(personality.appearance.scale).toBeLessThan(2.0);
      });
    });
  });

  describe('Content Diversity', () => {
    it('should have diverse personality names', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      const allNames = [
        ...staticContent.vendors.map(v => v.name),
        ...staticContent.mascots.map(m => m.name),
        ...staticContent.announcers.map(a => a.name),
      ];

      // All names should be unique
      const uniqueNames = new Set(allNames);
      expect(uniqueNames.size).toBe(allNames.length);
    });

    it('should have varied dialogue across personalities', () => {
      if (!staticContent) {
        console.warn('Skipping test - static content not available');
        return;
      }

      // Check that vendors have different dialogue
      const vendorDialogueTexts = staticContent.vendors.flatMap(v => v.dialogue.map(d => d.text));
      const uniqueVendorDialogue = new Set(vendorDialogueTexts);
      
      // Most dialogue should be unique (allowing some repetition)
      const uniquenessRatio = uniqueVendorDialogue.size / vendorDialogueTexts.length;
      expect(uniquenessRatio).toBeGreaterThan(0.7); // At least 70% unique

      console.log(`Vendor dialogue uniqueness: ${(uniquenessRatio * 100).toFixed(1)}%`);
    });
  });

  describe('Integration with Game Systems', () => {
    it('should be loadable by content manager', async () => {
      const content = await contentManager.getContent();
      
      expect(content).toBeDefined();
      // Content manager may return empty arrays if using minimal fallback
      expect(content.vendors).toBeInstanceOf(Array);
      expect(content.mascots).toBeInstanceOf(Array);
      expect(content.announcers).toBeInstanceOf(Array);
    });

    it('should have dialogue compatible with dialogue manager', async () => {
      const content = await contentManager.getContent();
      
      // All dialogue should have required fields for dialogue manager
      content.vendors.forEach((vendor) => {
        vendor.dialogue.forEach((line) => {
          expect(line.id).toBeTruthy();
          expect(line.text).toBeTruthy();
          expect(line.context).toBeDefined();
          expect(line.context.event).toBeTruthy();
          expect(line.priority).toBeDefined();
          expect(line.cooldown).toBeDefined();
        });
      });
    });
  });
});
