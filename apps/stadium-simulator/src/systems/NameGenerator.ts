/**
 * Name Generator
 * 
 * Deterministic name generation system using seeded random selection.
 * Generates consistent vendor names from predefined pools of first and last names.
 * 
 * Features:
 * - Deterministic selection from seed
 * - 8 first names (diverse, retro-themed)
 * - 6 last names (memorable, varied)
 * - Consistent output for same seed
 * - Performance target: < 1ms per generation
 */

import { seedToNumber, seededRandom } from '@/utils/seedUtils';

/**
 * Vendor name components
 */
interface VendorName {
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Full name (firstName + lastName) */
  fullName: string;
}

/**
 * Name Generator
 * 
 * Generates deterministic vendor names using seeded random selection
 * from predefined name pools.
 */
export class NameGenerator {
  /**
   * Pool of first names (8 diverse options)
   * 
   * Names are selected to be:
   * - Memorable and distinctive
   * - Appropriate for a retro 8-bit game aesthetic
   * - Gender-neutral or varied
   * - Easy to read and pronounce
   */
  private static readonly FIRST_NAMES = [
    'Max',
    'Ruby',
    'Ace',
    'Luna',
    'Chip',
    'Nova',
    'Rex',
    'Zara',
  ] as const;

  /**
   * Pool of last names (6 memorable options)
   * 
   * Names are selected to be:
   * - Quirky and fun
   * - Thematically appropriate for stadium vendors
   * - Distinct from each other
   * - Easy to remember
   */
  private static readonly LAST_NAMES = [
    'Pepper',
    'Swift',
    'Blaze',
    'Stone',
    'Rivers',
    'Cruz',
  ] as const;

  /**
   * Generate a deterministic vendor name from a seed
   * 
   * Uses the seed to deterministically select first and last names from
   * predefined pools. The same seed will always produce the same name.
   * 
   * @param seed - Seed string for deterministic selection
   * @returns Vendor name object
   * 
   * @example
   * ```typescript
   * const name1 = NameGenerator.generateVendorName('abc123');
   * const name2 = NameGenerator.generateVendorName('abc123');
   * console.assert(name1.fullName === name2.fullName, 'Names must be deterministic');
   * 
   * const name3 = NameGenerator.generateVendorName('xyz789');
   * console.assert(name1.fullName !== name3.fullName, 'Different seeds produce different names');
   * ```
   */
  public static generateVendorName(seed: string): VendorName {
    // Generate numeric seed from string
    const numericSeed = seedToNumber(seed);

    // Select first name
    const firstNameIndex = seededRandom(numericSeed, 0) % this.FIRST_NAMES.length;
    const firstName = this.FIRST_NAMES[firstNameIndex];

    // Select last name (use different offset to ensure different selection)
    const lastNameIndex = seededRandom(numericSeed, 1) % this.LAST_NAMES.length;
    const lastName = this.LAST_NAMES[lastNameIndex];

    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
    };
  }

  /**
   * Get all possible first names
   * 
   * @returns Array of all first names in the pool
   */
  public static getFirstNamePool(): readonly string[] {
    return this.FIRST_NAMES;
  }

  /**
   * Get all possible last names
   * 
   * @returns Array of all last names in the pool
   */
  public static getLastNamePool(): readonly string[] {
    return this.LAST_NAMES;
  }

  /**
   * Get total number of possible name combinations
   * 
   * @returns Total unique names possible
   */
  public static getTotalCombinations(): number {
    return this.FIRST_NAMES.length * this.LAST_NAMES.length;
  }

  /**
   * Generate multiple unique vendor names from sequential seeds
   * 
   * Generates multiple vendor names by appending sequence numbers to the base seed.
   * Useful for creating a roster of vendors with related but distinct names.
   * 
   * @param baseSeed - Base seed string
   * @param count - Number of names to generate
   * @returns Array of vendor names
   * 
   * @example
   * ```typescript
   * const names = NameGenerator.generateMultipleVendorNames('epoch-5', 3);
   * // Returns 3 different vendor names based on 'epoch-5-0', 'epoch-5-1', 'epoch-5-2'
   * ```
   */
  public static generateMultipleVendorNames(baseSeed: string, count: number): VendorName[] {
    const names: VendorName[] = [];
    
    for (let i = 0; i < count; i++) {
      const seed = `${baseSeed}-${i}`;
      names.push(this.generateVendorName(seed));
    }

    return names;
  }

  /**
   * Check if a name combination exists in the pools
   * 
   * @param firstName - First name to check
   * @param lastName - Last name to check
   * @returns True if both names exist in their respective pools
   */
  public static isValidNameCombination(firstName: string, lastName: string): boolean {
    return (
      this.FIRST_NAMES.includes(firstName as any) &&
      this.LAST_NAMES.includes(lastName as any)
    );
  }
}

export default NameGenerator;
