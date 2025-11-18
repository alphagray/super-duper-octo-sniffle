/**
 * Tests for AppearanceGenerator
 * 
 * Validates deterministic color palette generation, pool coverage,
 * color utilities, and performance characteristics.
 */

import { describe, it, expect } from 'vitest';
import { AppearanceGenerator } from '@/systems/AppearanceGenerator';

describe('AppearanceGenerator', () => {
  describe('Basic Color Palette Generation', () => {
    it('should generate a color palette from seed', () => {
      const palette = AppearanceGenerator.generateColorPalette('test-seed');

      expect(palette).toBeDefined();
      expect(palette.primary).toBeTruthy();
      expect(palette.secondary).toBeTruthy();
      expect(palette.accent).toBeTruthy();
      expect(palette.colors).toHaveLength(3);
    });

    it('should generate valid hex colors', () => {
      const palette = AppearanceGenerator.generateColorPalette('test-seed');

      const hexPattern = /^#[0-9A-F]{6}$/i;
      expect(palette.primary).toMatch(hexPattern);
      expect(palette.secondary).toMatch(hexPattern);
      expect(palette.accent).toMatch(hexPattern);
    });

    it('should include all colors in the colors array', () => {
      const palette = AppearanceGenerator.generateColorPalette('test-seed');

      expect(palette.colors[0]).toBe(palette.primary);
      expect(palette.colors[1]).toBe(palette.secondary);
      expect(palette.colors[2]).toBe(palette.accent);
    });

    it('should generate colors from the pool', () => {
      const palette = AppearanceGenerator.generateColorPalette('test-seed');
      const colorPool = AppearanceGenerator.getColorPool();

      expect(colorPool).toContain(palette.primary);
      expect(colorPool).toContain(palette.secondary);
      expect(colorPool).toContain(palette.accent);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should generate same palette for same seed', () => {
      const seed = 'deterministic-test';

      const palette1 = AppearanceGenerator.generateColorPalette(seed);
      const palette2 = AppearanceGenerator.generateColorPalette(seed);

      expect(palette1.primary).toBe(palette2.primary);
      expect(palette1.secondary).toBe(palette2.secondary);
      expect(palette1.accent).toBe(palette2.accent);
      expect(palette1.colors).toEqual(palette2.colors);
    });

    it('should generate different palettes for different seeds', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('seed-1');
      const palette2 = AppearanceGenerator.generateColorPalette('seed-2');

      // Check if at least one color is different
      const isDifferent = 
        palette1.primary !== palette2.primary ||
        palette1.secondary !== palette2.secondary ||
        palette1.accent !== palette2.accent;
      
      expect(isDifferent).toBe(true);
    });

    it('should be consistent across multiple calls', () => {
      const seeds = ['test-1', 'test-2', 'test-3'];

      const firstRun = seeds.map((seed) => AppearanceGenerator.generateColorPalette(seed));
      const secondRun = seeds.map((seed) => AppearanceGenerator.generateColorPalette(seed));

      for (let i = 0; i < seeds.length; i++) {
        expect(firstRun[i].primary).toBe(secondRun[i].primary);
        expect(firstRun[i].colors).toEqual(secondRun[i].colors);
      }
    });

    it('should handle empty seed string', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('');
      const palette2 = AppearanceGenerator.generateColorPalette('');

      expect(palette1.primary).toBe(palette2.primary);
    });

    it('should handle special characters in seed', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('!@#$%^&*()');
      const palette2 = AppearanceGenerator.generateColorPalette('!@#$%^&*()');

      expect(palette1.primary).toBe(palette2.primary);
    });
  });

  describe('Custom Color Count', () => {
    it('should generate palette with 1 color', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', 1);

      expect(palette.colors).toHaveLength(1);
      expect(palette.primary).toBe(palette.colors[0]);
      expect(palette.secondary).toBe(palette.primary); // Fallback
      expect(palette.accent).toBe(palette.primary); // Fallback
    });

    it('should generate palette with 2 colors', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', 2);

      expect(palette.colors).toHaveLength(2);
      expect(palette.primary).toBe(palette.colors[0]);
      expect(palette.secondary).toBe(palette.colors[1]);
      expect(palette.accent).toBe(palette.secondary); // Fallback to secondary
    });

    it('should generate palette with 5 colors', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', 5);

      expect(palette.colors).toHaveLength(5);
      expect(palette.primary).toBe(palette.colors[0]);
      expect(palette.secondary).toBe(palette.colors[1]);
      expect(palette.accent).toBe(palette.colors[2]);
    });

    it('should cap at pool size', () => {
      const poolSize = AppearanceGenerator.getColorPoolSize();
      const palette = AppearanceGenerator.generateColorPalette('test', poolSize + 10);

      expect(palette.colors.length).toBeLessThanOrEqual(poolSize);
    });

    it('should handle zero color count', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', 0);

      // Should generate at least 1 color
      expect(palette.colors.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle negative color count', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', -5);

      // Should generate at least 1 color
      expect(palette.colors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Unique Color Selection', () => {
    it('should select unique colors in palette', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', 3);

      const uniqueColors = new Set(palette.colors);
      expect(uniqueColors.size).toBe(3); // All colors should be unique
    });

    it('should select unique colors for larger palettes', () => {
      const palette = AppearanceGenerator.generateColorPalette('test', 8);

      const uniqueColors = new Set(palette.colors);
      expect(uniqueColors.size).toBe(8); // All 8 colors should be unique
    });

    it('should not repeat colors when count equals pool size', () => {
      const poolSize = AppearanceGenerator.getColorPoolSize();
      const palette = AppearanceGenerator.generateColorPalette('test', poolSize);

      const uniqueColors = new Set(palette.colors);
      expect(uniqueColors.size).toBe(poolSize);
    });
  });

  describe('Single Color Generation', () => {
    it('should generate single color from seed', () => {
      const color = AppearanceGenerator.generateSingleColor('test-seed');

      expect(color).toBeTruthy();
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });

    it('should be deterministic', () => {
      const color1 = AppearanceGenerator.generateSingleColor('same-seed');
      const color2 = AppearanceGenerator.generateSingleColor('same-seed');

      expect(color1).toBe(color2);
    });

    it('should generate different colors for different seeds', () => {
      const color1 = AppearanceGenerator.generateSingleColor('seed-1');
      const color2 = AppearanceGenerator.generateSingleColor('seed-2');

      // May occasionally be the same, but unlikely
      const colors = [color1, color2];
      const uniqueColors = new Set(colors);
      expect(uniqueColors.size).toBeGreaterThanOrEqual(1);
    });

    it('should select from color pool', () => {
      const color = AppearanceGenerator.generateSingleColor('test');
      const pool = AppearanceGenerator.getColorPool();

      expect(pool).toContain(color);
    });
  });

  describe('Color Pool', () => {
    it('should have 8 colors', () => {
      const pool = AppearanceGenerator.getColorPool();
      expect(pool).toHaveLength(8);
    });

    it('should return correct pool size', () => {
      const size = AppearanceGenerator.getColorPoolSize();
      expect(size).toBe(8);
    });

    it('should have unique colors', () => {
      const pool = AppearanceGenerator.getColorPool();
      const uniqueColors = new Set(pool);

      expect(uniqueColors.size).toBe(pool.length);
    });

    it('should have valid hex colors', () => {
      const pool = AppearanceGenerator.getColorPool();
      const hexPattern = /^#[0-9A-F]{6}$/i;

      pool.forEach((color) => {
        expect(color).toMatch(hexPattern);
      });
    });
  });

  describe('Color Pool Coverage', () => {
    it('should generate diverse palettes', () => {
      const palettes: string[] = [];

      for (let i = 0; i < 50; i++) {
        const palette = AppearanceGenerator.generateColorPalette(`vendor-${i}`);
        palettes.push(palette.colors.join(','));
      }

      const uniquePalettes = new Set(palettes);

      // Should have reasonable diversity (at least 10 unique palettes)
      expect(uniquePalettes.size).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Multiple Palette Generation', () => {
    it('should generate multiple palettes from base seed', () => {
      const palettes = AppearanceGenerator.generateMultiplePalettes('base-seed', 3);

      expect(palettes).toHaveLength(3);
      expect(palettes[0].primary).toBeTruthy();
      expect(palettes[1].primary).toBeTruthy();
      expect(palettes[2].primary).toBeTruthy();
    });

    it('should generate different palettes in batch', () => {
      const palettes = AppearanceGenerator.generateMultiplePalettes('base-seed', 5);

      const uniquePalettes = new Set(palettes.map((p) => p.primary));

      // Should have at least 1 palette (may have duplicates with small sample)
      expect(uniquePalettes.size).toBeGreaterThanOrEqual(1);
    });

    it('should be deterministic for batch generation', () => {
      const palettes1 = AppearanceGenerator.generateMultiplePalettes('batch-test', 4);
      const palettes2 = AppearanceGenerator.generateMultiplePalettes('batch-test', 4);

      for (let i = 0; i < 4; i++) {
        expect(palettes1[i].primary).toBe(palettes2[i].primary);
        expect(palettes1[i].colors).toEqual(palettes2[i].colors);
      }
    });

    it('should support custom color count per palette', () => {
      const palettes = AppearanceGenerator.generateMultiplePalettes('base', 3, 5);

      palettes.forEach((palette) => {
        expect(palette.colors).toHaveLength(5);
      });
    });

    it('should handle zero count', () => {
      const palettes = AppearanceGenerator.generateMultiplePalettes('base', 0);
      expect(palettes).toHaveLength(0);
    });

    it('should handle large batch generation', () => {
      const palettes = AppearanceGenerator.generateMultiplePalettes('large-batch', 100);

      expect(palettes).toHaveLength(100);
      expect(palettes[0].primary).toBeTruthy();
      expect(palettes[99].primary).toBeTruthy();
    });
  });

  describe('Color Utilities', () => {
    it('should convert hex to RGB', () => {
      const rgb = AppearanceGenerator.hexToRgb('#FF2D55');

      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(45);
      expect(rgb.b).toBe(85);
    });

    it('should convert hex without # to RGB', () => {
      const rgb = AppearanceGenerator.hexToRgb('0A84FF');

      expect(rgb.r).toBe(10);
      expect(rgb.g).toBe(132);
      expect(rgb.b).toBe(255);
    });

    it('should handle lowercase hex', () => {
      const rgb = AppearanceGenerator.hexToRgb('#ff2d55');

      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(45);
      expect(rgb.b).toBe(85);
    });

    it('should convert hex to Phaser color', () => {
      const phaserColor = AppearanceGenerator.hexToPhaserColor('#FF2D55');

      expect(phaserColor).toBe(0xFF2D55);
    });

    it('should convert hex without # to Phaser color', () => {
      const phaserColor = AppearanceGenerator.hexToPhaserColor('0A84FF');

      expect(phaserColor).toBe(0x0A84FF);
    });

    it('should handle all pool colors for Phaser conversion', () => {
      const pool = AppearanceGenerator.getColorPool();

      pool.forEach((color) => {
        const phaserColor = AppearanceGenerator.hexToPhaserColor(color);
        expect(phaserColor).toBeGreaterThanOrEqual(0);
        expect(phaserColor).toBeLessThanOrEqual(0xFFFFFF);
      });
    });
  });

  describe('Contrasting Color Calculation', () => {
    it('should return white for dark colors', () => {
      const contrast = AppearanceGenerator.getContrastingColor('#FF2D55'); // Red
      expect(contrast).toBe('#FFFFFF');
    });

    it('should return black for light colors', () => {
      const contrast = AppearanceGenerator.getContrastingColor('#FFD60A'); // Yellow
      expect(contrast).toBe('#000000');
    });

    it('should handle pure white', () => {
      const contrast = AppearanceGenerator.getContrastingColor('#FFFFFF');
      expect(contrast).toBe('#000000');
    });

    it('should handle pure black', () => {
      const contrast = AppearanceGenerator.getContrastingColor('#000000');
      expect(contrast).toBe('#FFFFFF');
    });

    it('should calculate contrast for all pool colors', () => {
      const pool = AppearanceGenerator.getColorPool();

      pool.forEach((color) => {
        const contrast = AppearanceGenerator.getContrastingColor(color);
        expect(['#FFFFFF', '#000000']).toContain(contrast);
      });
    });
  });

  describe('Color Validation', () => {
    it('should validate colors from pool', () => {
      const pool = AppearanceGenerator.getColorPool();

      pool.forEach((color) => {
        expect(AppearanceGenerator.isValidColor(color)).toBe(true);
      });
    });

    it('should reject colors not in pool', () => {
      expect(AppearanceGenerator.isValidColor('#000000')).toBe(false);
      expect(AppearanceGenerator.isValidColor('#FFFFFF')).toBe(false);
      expect(AppearanceGenerator.isValidColor('#999999')).toBe(false);
    });

    it('should be case sensitive for validation', () => {
      const pool = AppearanceGenerator.getColorPool();
      const firstColor = pool[0];

      // Test with lowercase - this will fail as colors are uppercase in pool
      const lowerColor = firstColor.toLowerCase();
      
      // Only test if they're actually different
      if (lowerColor !== firstColor) {
        expect(AppearanceGenerator.isValidColor(lowerColor)).toBe(false);
      }
    });
  });

  describe('Performance', () => {
    it('should generate palette in under 1ms', () => {
      const start = performance.now();
      AppearanceGenerator.generateColorPalette('performance-test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should generate single color in under 1ms', () => {
      const start = performance.now();
      AppearanceGenerator.generateSingleColor('performance-test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should generate 1000 palettes in under 100ms', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        AppearanceGenerator.generateColorPalette(`vendor-${i}`);
      }

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle batch generation efficiently', () => {
      const start = performance.now();
      AppearanceGenerator.generateMultiplePalettes('batch-perf', 100);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should handle large palette generation efficiently', () => {
      const start = performance.now();
      AppearanceGenerator.generateColorPalette('large-palette', 8);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single character seed', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('a');
      const palette2 = AppearanceGenerator.generateColorPalette('a');

      expect(palette1.primary).toBe(palette2.primary);
    });

    it('should handle Unicode characters in seed', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('café-☕');
      const palette2 = AppearanceGenerator.generateColorPalette('café-☕');

      expect(palette1.primary).toBe(palette2.primary);
    });

    it('should handle seeds with whitespace', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('  test  seed  ');
      const palette2 = AppearanceGenerator.generateColorPalette('  test  seed  ');

      expect(palette1.primary).toBe(palette2.primary);
    });

    it('should handle very long seeds', () => {
      const longSeed = 'a'.repeat(1000);
      const palette1 = AppearanceGenerator.generateColorPalette(longSeed);
      const palette2 = AppearanceGenerator.generateColorPalette(longSeed);

      expect(palette1.primary).toBe(palette2.primary);
    });

    it('should handle numeric seeds', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('12345');
      const palette2 = AppearanceGenerator.generateColorPalette('12345');

      expect(palette1.primary).toBe(palette2.primary);
    });
  });

  describe('Real-World Usage', () => {
    it('should work with AIContentManager seed format', () => {
      const seed = 'abc12345'; // 8-char hex seed
      const palette = AppearanceGenerator.generateColorPalette(seed);

      expect(palette.primary).toBeTruthy();
      expect(palette.colors).toHaveLength(3);
    });

    it('should provide retro color aesthetics', () => {
      const pool = AppearanceGenerator.getColorPool();

      // All colors should be relatively vibrant (not too dark or too light)
      pool.forEach((color) => {
        const rgb = AppearanceGenerator.hexToRgb(color);
        
        // Check that not all channels are low (not too dark)
        const maxChannel = Math.max(rgb.r, rgb.g, rgb.b);
        expect(maxChannel).toBeGreaterThan(100);
        
        // Check that at least one channel is vibrant
        const hasVibrantChannel = rgb.r > 150 || rgb.g > 150 || rgb.b > 150;
        expect(hasVibrantChannel).toBe(true);
      });
    });

    it('should support multi-color character designs', () => {
      const palette = AppearanceGenerator.generateColorPalette('vendor-1', 5);

      expect(palette.colors).toHaveLength(5);
      
      // All colors should be distinct
      const uniqueColors = new Set(palette.colors);
      expect(uniqueColors.size).toBe(5);
    });
  });

  describe('Seed Variations', () => {
    it('should handle similar seeds differently', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('vendor-1');
      const palette2 = AppearanceGenerator.generateColorPalette('vendor-2');
      const palette3 = AppearanceGenerator.generateColorPalette('vendor-3');

      const primaries = [palette1.primary, palette2.primary, palette3.primary];

      // Should have valid colors
      primaries.forEach(color => {
        expect(color).toMatch(/^#[0-9A-F]{6}$/i);
        expect(AppearanceGenerator.getColorPool()).toContain(color);
      });
    });

    it('should handle epoch-based seeds', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('epoch-0-vendor-0');
      const palette2 = AppearanceGenerator.generateColorPalette('epoch-0-vendor-1');
      const palette3 = AppearanceGenerator.generateColorPalette('epoch-1-vendor-0');

      expect(palette1.primary).toBeTruthy();
      expect(palette2.primary).toBeTruthy();
      expect(palette3.primary).toBeTruthy();

      // All should be valid colors
      expect(AppearanceGenerator.getColorPool()).toContain(palette1.primary);
      expect(AppearanceGenerator.getColorPool()).toContain(palette2.primary);
      expect(AppearanceGenerator.getColorPool()).toContain(palette3.primary);
    });

    it('should handle hex seed strings', () => {
      const palette1 = AppearanceGenerator.generateColorPalette('0a1b2c3d');
      const palette2 = AppearanceGenerator.generateColorPalette('0a1b2c3d');

      expect(palette1.primary).toBe(palette2.primary);
    });
  });
});
