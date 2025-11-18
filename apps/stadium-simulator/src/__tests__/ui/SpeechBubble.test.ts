import { describe, it, expect } from 'vitest';
import type { SpeechBubbleConfig } from '@/ui/SpeechBubble';

describe('SpeechBubble', () => {
  // Note: Full integration tests require Phaser game initialization
  // These tests verify the configuration structure and interface

  describe('Configuration', () => {
    it('should accept valid minimal config', () => {
      const config: SpeechBubbleConfig = {
        text: 'Hello World!',
      };

      expect(config.text).toBe('Hello World!');
    });

    it('should accept valid full config', () => {
      const config: SpeechBubbleConfig = {
        text: 'Custom text',
        duration: 5000,
        fadeInDuration: 300,
        fadeOutDuration: 300,
        maxWidth: 250,
        fontSize: 14,
        padding: 10,
        tailPosition: 'bottom-left',
      };

      expect(config.text).toBe('Custom text');
      expect(config.duration).toBe(5000);
      expect(config.fadeInDuration).toBe(300);
      expect(config.fadeOutDuration).toBe(300);
      expect(config.maxWidth).toBe(250);
      expect(config.fontSize).toBe(14);
      expect(config.padding).toBe(10);
      expect(config.tailPosition).toBe('bottom-left');
    });

    it('should accept all tail positions', () => {
      const positions: Array<'bottom-left' | 'bottom-center' | 'bottom-right'> = [
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ];

      positions.forEach((position) => {
        const config: SpeechBubbleConfig = {
          text: 'Test',
          tailPosition: position,
        };
        expect(config.tailPosition).toBe(position);
      });
    });
  });
});
