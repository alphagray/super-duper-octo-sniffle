/**
 * Seed Utilities
 * 
 * Shared utilities for deterministic random number generation.
 * Used by NameGenerator and AppearanceGenerator for consistent seeded random behavior.
 */

/**
 * Convert seed string to numeric value
 * 
 * Uses djb2 hash algorithm with MurmurHash-inspired mixing for better distribution.
 * 
 * @param seed - Seed string
 * @returns Numeric seed value
 */
export function seedToNumber(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash) + seed.charCodeAt(i);
    hash = hash | 0; // Convert to 32-bit signed integer
  }
  
  // Additional mixing to improve distribution
  hash = hash ^ (hash >>> 16);
  hash = Math.imul(hash, 0x85ebca6b);
  hash = hash ^ (hash >>> 13);
  hash = Math.imul(hash, 0xc2b2ae35);
  hash = hash ^ (hash >>> 16);
  
  return Math.abs(hash);
}

/**
 * Generate seeded random number
 * 
 * Uses Linear Congruential Generator (LCG) algorithm for deterministic
 * random number generation.
 * 
 * @param seed - Numeric seed
 * @param offset - Offset for generating different sequences from same seed
 * @returns Random number (non-negative integer)
 */
export function seededRandom(seed: number, offset: number): number {
  // LCG parameters (same as used in glibc)
  const a = 1103515245;
  const c = 12345;
  const m = 0x7fffffff; // 2^31 - 1

  // Mix seed with offset better
  let mixed = seed;
  for (let i = 0; i <= offset; i++) {
    mixed = ((a * mixed + c) & m) >>> 0;
  }

  return mixed;
}
