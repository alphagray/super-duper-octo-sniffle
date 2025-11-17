/**
 * Appearance Generator
 * 
 * Deterministic appearance generation system using seeded random selection.
 * Generates consistent color palettes for character appearances from a
 * vibrant retro-themed color pool.
 * 
 * Features:
 * - Deterministic color selection from seed
 * - 8 vibrant retro colors (8-bit aesthetic)
 * - Consistent output for same seed
 * - Support for multi-color palettes
 * - Performance target: < 1ms per generation
 */

import { seedToNumber, seededRandom } from '@/utils/seedUtils';

/**
 * Color palette configuration for a character
 */
export interface ColorPalette {
  /** Primary color (hex string) */
  primary: string;
  /** Secondary color (hex string) */
  secondary: string;
  /** Accent color (hex string) */
  accent: string;
  /** All colors in the palette */
  colors: string[];
}

/**
 * Appearance Generator
 * 
 * Generates deterministic color palettes and appearance configurations
 * using seeded random selection from predefined color pools.
 */
export class AppearanceGenerator {
  /**
   * Pool of vibrant retro colors (8 distinctive options)
   * 
   * Colors are selected to be:
   * - High saturation and vibrant (8-bit aesthetic)
   * - Distinct from each other
   * - Suitable for retro game graphics
   * - Readable against various backgrounds
   * 
   * Color palette inspired by classic 8-bit games:
   * - Red: Bold primary
   * - Blue: Cool secondary
   * - Green: Natural accent
   * - Yellow: Bright highlight
   * - Magenta: Vibrant pop
   * - Cyan: Cool accent
   * - Orange: Warm energy
   * - Purple: Royal accent
   */
  private static readonly COLOR_POOL = [
    '#FF2D55', // Vibrant Red
    '#0A84FF', // Bright Blue
    '#32D74B', // Vivid Green
    '#FFD60A', // Bold Yellow
    '#FF2D92', // Hot Magenta
    '#64D2FF', // Electric Cyan
    '#FF9F0A', // Warm Orange
    '#BF5AF2', // Royal Purple
  ] as const;

  /**
   * Generate a deterministic color palette from a seed
   * 
   * Uses the seed to deterministically select primary, secondary, and accent
   * colors from the predefined pool. The same seed will always produce the
   * same palette.
   * 
   * @param seed - Seed string for deterministic selection
   * @param colorCount - Number of colors to include in palette (default: 3)
   * @returns Color palette object
   * 
   * @example
   * ```typescript
   * const palette1 = AppearanceGenerator.generateColorPalette('abc123');
   * const palette2 = AppearanceGenerator.generateColorPalette('abc123');
   * console.assert(palette1.primary === palette2.primary, 'Palettes must be deterministic');
   * 
   * const palette3 = AppearanceGenerator.generateColorPalette('xyz789');
   * console.assert(palette1.primary !== palette3.primary, 'Different seeds produce different palettes');
   * ```
   */
  public static generateColorPalette(seed: string, colorCount: number = 3): ColorPalette {
    // Ensure color count is within valid range
    const validCount = Math.max(1, Math.min(colorCount, this.COLOR_POOL.length));

    // Generate numeric seed from string
    const numericSeed = seedToNumber(seed);

    // Select colors without replacement
    const selectedIndices = this.selectUniqueIndices(numericSeed, validCount, this.COLOR_POOL.length);
    const selectedColors = selectedIndices.map((idx) => this.COLOR_POOL[idx]);

    return {
      primary: selectedColors[0],
      secondary: selectedColors[1] || selectedColors[0],
      accent: selectedColors[2] || selectedColors[1] || selectedColors[0],
      colors: selectedColors,
    };
  }

  /**
   * Generate a single deterministic color from a seed
   * 
   * @param seed - Seed string for deterministic selection
   * @returns Hex color string
   * 
   * @example
   * ```typescript
   * const color = AppearanceGenerator.generateSingleColor('vendor-1');
   * console.log(color); // '#FF2D55'
   * ```
   */
  public static generateSingleColor(seed: string): string {
    const numericSeed = seedToNumber(seed);
    const index = seededRandom(numericSeed, 0) % this.COLOR_POOL.length;
    return this.COLOR_POOL[index];
  }

  /**
   * Select unique indices from a range
   * 
   * Uses Fisher-Yates shuffle algorithm with seeded random to select
   * unique indices without replacement.
   * 
   * @param seed - Numeric seed
   * @param count - Number of indices to select
   * @param max - Maximum index value (exclusive)
   * @returns Array of unique indices
   */
  private static selectUniqueIndices(seed: number, count: number, max: number): number[] {
    // Create array of all indices
    const indices = Array.from({ length: max }, (_, i) => i);
    const selected: number[] = [];

    // Fisher-Yates shuffle with seeded random
    let currentSeed = seed;
    for (let i = 0; i < count; i++) {
      // Generate random index
      currentSeed = seededRandom(currentSeed, i);
      const randomIndex = currentSeed % (max - i);

      // Select and remove index
      selected.push(indices[randomIndex]);
      indices[randomIndex] = indices[max - i - 1];
    }

    return selected;
  }

  /**
   * Get all colors in the pool
   * 
   * @returns Array of all available colors
   */
  public static getColorPool(): readonly string[] {
    return this.COLOR_POOL;
  }

  /**
   * Get total number of colors available
   * 
   * @returns Number of colors in the pool
   */
  public static getColorPoolSize(): number {
    return this.COLOR_POOL.length;
  }

  /**
   * Convert hex color to RGB components
   * 
   * @param hex - Hex color string (e.g., '#FF2D55')
   * @returns RGB object with r, g, b values (0-255)
   */
  public static hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Parse hex to RGB
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    return { r, g, b };
  }

  /**
   * Convert hex color to Phaser color number
   * 
   * Phaser uses numeric color values (0xRRGGBB format).
   * 
   * @param hex - Hex color string (e.g., '#FF2D55')
   * @returns Phaser-compatible color number
   */
  public static hexToPhaserColor(hex: string): number {
    const cleanHex = hex.replace('#', '');
    return parseInt(cleanHex, 16);
  }

  /**
   * Generate multiple unique color palettes from sequential seeds
   * 
   * Generates multiple palettes by appending sequence numbers to the base seed.
   * Useful for creating a roster of characters with distinct color schemes.
   * 
   * @param baseSeed - Base seed string
   * @param count - Number of palettes to generate
   * @param colorCount - Colors per palette (default: 3)
   * @returns Array of color palettes
   * 
   * @example
   * ```typescript
   * const palettes = AppearanceGenerator.generateMultiplePalettes('epoch-5', 3);
   * // Returns 3 different palettes based on 'epoch-5-0', 'epoch-5-1', 'epoch-5-2'
   * ```
   */
  public static generateMultiplePalettes(
    baseSeed: string,
    count: number,
    colorCount: number = 3
  ): ColorPalette[] {
    const palettes: ColorPalette[] = [];

    for (let i = 0; i < count; i++) {
      const seed = `${baseSeed}-${i}`;
      palettes.push(this.generateColorPalette(seed, colorCount));
    }

    return palettes;
  }

  /**
   * Check if a color exists in the pool
   * 
   * @param color - Hex color string to check
   * @returns True if color exists in the pool
   */
  public static isValidColor(color: string): boolean {
    return this.COLOR_POOL.includes(color as any);
  }

  /**
   * Get contrasting color for readability
   * 
   * Returns either white or black depending on the brightness of the input color.
   * Useful for text overlays on colored backgrounds.
   * 
   * @param hex - Hex color string
   * @returns '#FFFFFF' for dark colors, '#000000' for light colors
   */
  public static getContrastingColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    
    // Calculate relative luminance (perceived brightness)
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

    // Return white for dark colors, black for light colors
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }
}

export default AppearanceGenerator;
