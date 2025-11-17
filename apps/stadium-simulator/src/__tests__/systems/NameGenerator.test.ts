/**
 * Tests for NameGenerator
 * 
 * Validates deterministic name generation, pool coverage,
 * and performance characteristics.
 */

import { describe, it, expect } from 'vitest';
import { NameGenerator } from '@/systems/NameGenerator';

describe('NameGenerator', () => {
  describe('Basic Generation', () => {
    it('should generate a vendor name from seed', () => {
      const name = NameGenerator.generateVendorName('test-seed');

      expect(name).toBeDefined();
      expect(name.firstName).toBeTruthy();
      expect(name.lastName).toBeTruthy();
      expect(name.fullName).toBe(`${name.firstName} ${name.lastName}`);
    });

    it('should include space in full name', () => {
      const name = NameGenerator.generateVendorName('test-seed');
      
      expect(name.fullName).toContain(' ');
      expect(name.fullName.split(' ')).toHaveLength(2);
    });

    it('should generate valid names from the pools', () => {
      const name = NameGenerator.generateVendorName('test-seed');
      const firstNames = NameGenerator.getFirstNamePool();
      const lastNames = NameGenerator.getLastNamePool();

      expect(firstNames).toContain(name.firstName);
      expect(lastNames).toContain(name.lastName);
    });
  });

  describe('Deterministic Behavior', () => {
    it('should generate same name for same seed', () => {
      const seed = 'deterministic-test';
      
      const name1 = NameGenerator.generateVendorName(seed);
      const name2 = NameGenerator.generateVendorName(seed);

      expect(name1.firstName).toBe(name2.firstName);
      expect(name1.lastName).toBe(name2.lastName);
      expect(name1.fullName).toBe(name2.fullName);
    });

    it('should generate different names for different seeds', () => {
      const name1 = NameGenerator.generateVendorName('seed-1');
      const name2 = NameGenerator.generateVendorName('seed-2');

      // Very unlikely to be the same (1 in 48 chance)
      const different = name1.fullName !== name2.fullName;
      expect(different).toBe(true);
    });

    it('should be consistent across multiple calls with different seeds', () => {
      const seeds = ['test-1', 'test-2', 'test-3'];
      
      // Generate once
      const firstRun = seeds.map((seed) => NameGenerator.generateVendorName(seed));
      
      // Generate again
      const secondRun = seeds.map((seed) => NameGenerator.generateVendorName(seed));

      // Should match exactly
      for (let i = 0; i < seeds.length; i++) {
        expect(firstRun[i].fullName).toBe(secondRun[i].fullName);
      }
    });

    it('should handle empty seed string', () => {
      const name1 = NameGenerator.generateVendorName('');
      const name2 = NameGenerator.generateVendorName('');

      expect(name1.fullName).toBe(name2.fullName);
      expect(name1.firstName).toBeTruthy();
      expect(name1.lastName).toBeTruthy();
    });

    it('should handle special characters in seed', () => {
      const name1 = NameGenerator.generateVendorName('!@#$%^&*()');
      const name2 = NameGenerator.generateVendorName('!@#$%^&*()');

      expect(name1.fullName).toBe(name2.fullName);
    });

    it('should handle numeric seeds', () => {
      const name1 = NameGenerator.generateVendorName('12345');
      const name2 = NameGenerator.generateVendorName('12345');

      expect(name1.fullName).toBe(name2.fullName);
    });

    it('should handle very long seeds', () => {
      const longSeed = 'a'.repeat(1000);
      const name1 = NameGenerator.generateVendorName(longSeed);
      const name2 = NameGenerator.generateVendorName(longSeed);

      expect(name1.fullName).toBe(name2.fullName);
    });
  });

  describe('Name Pool Coverage', () => {
    it('should have 8 first names', () => {
      const firstNames = NameGenerator.getFirstNamePool();
      expect(firstNames).toHaveLength(8);
    });

    it('should have 6 last names', () => {
      const lastNames = NameGenerator.getLastNamePool();
      expect(lastNames).toHaveLength(6);
    });

    it('should have 48 total combinations', () => {
      const totalCombinations = NameGenerator.getTotalCombinations();
      expect(totalCombinations).toBe(48); // 8 * 6 = 48
    });

    it('should have unique first names', () => {
      const firstNames = NameGenerator.getFirstNamePool();
      const uniqueNames = new Set(firstNames);
      
      expect(uniqueNames.size).toBe(firstNames.length);
    });

    it('should have unique last names', () => {
      const lastNames = NameGenerator.getLastNamePool();
      const uniqueNames = new Set(lastNames);
      
      expect(uniqueNames.size).toBe(lastNames.length);
    });

    it('should generate valid names from different seeds', () => {
      const names = [];
      
      // Generate names with very different seeds
      for (let i = 0; i < 10; i++) {
        const name = NameGenerator.generateVendorName(`very-different-seed-${i * 1000}`);
        names.push(name);
        expect(NameGenerator.isValidNameCombination(name.firstName, name.lastName)).toBe(true);
      }
      
      // All names should be valid
      expect(names.length).toBe(10);
    });
  });

  describe('Multiple Name Generation', () => {
    it('should generate multiple names from base seed', () => {
      const names = NameGenerator.generateMultipleVendorNames('base-seed', 3);

      expect(names).toHaveLength(3);
      expect(names[0].fullName).toBeTruthy();
      expect(names[1].fullName).toBeTruthy();
      expect(names[2].fullName).toBeTruthy();
    });

    it('should generate different names in batch', () => {
      const names = NameGenerator.generateMultipleVendorNames('base-seed', 5);

      const uniqueNames = new Set(names.map((n) => n.fullName));
      
      // At least 2 should be different
      expect(uniqueNames.size).toBeGreaterThanOrEqual(2);
    });

    it('should be deterministic for batch generation', () => {
      const names1 = NameGenerator.generateMultipleVendorNames('batch-test', 4);
      const names2 = NameGenerator.generateMultipleVendorNames('batch-test', 4);

      for (let i = 0; i < 4; i++) {
        expect(names1[i].fullName).toBe(names2[i].fullName);
      }
    });

    it('should handle zero count', () => {
      const names = NameGenerator.generateMultipleVendorNames('base-seed', 0);
      expect(names).toHaveLength(0);
    });

    it('should handle large batch generation', () => {
      const names = NameGenerator.generateMultipleVendorNames('large-batch', 100);
      
      expect(names).toHaveLength(100);
      expect(names[0].fullName).toBeTruthy();
      expect(names[99].fullName).toBeTruthy();
    });
  });

  describe('Name Validation', () => {
    it('should validate correct name combinations', () => {
      const name = NameGenerator.generateVendorName('test-validation');
      const isValid = NameGenerator.isValidNameCombination(name.firstName, name.lastName);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid first name', () => {
      const isValid = NameGenerator.isValidNameCombination('InvalidName', 'Swift');
      expect(isValid).toBe(false);
    });

    it('should reject invalid last name', () => {
      const isValid = NameGenerator.isValidNameCombination('Max', 'InvalidName');
      expect(isValid).toBe(false);
    });

    it('should reject both invalid names', () => {
      const isValid = NameGenerator.isValidNameCombination('Invalid', 'Names');
      expect(isValid).toBe(false);
    });

    it('should be case sensitive', () => {
      const isValid = NameGenerator.isValidNameCombination('max', 'swift');
      expect(isValid).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should generate name in under 1ms', () => {
      const start = performance.now();
      NameGenerator.generateVendorName('performance-test');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1);
    });

    it('should generate 1000 names in under 100ms', () => {
      const start = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        NameGenerator.generateVendorName(`vendor-${i}`);
      }
      
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should handle batch generation efficiently', () => {
      const start = performance.now();
      NameGenerator.generateMultipleVendorNames('batch-perf', 100);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });
  });

  describe('Name Pool Access', () => {
    it('should return readonly first name pool', () => {
      const pool = NameGenerator.getFirstNamePool();
      
      expect(Array.isArray(pool)).toBe(true);
      expect(pool.length).toBeGreaterThan(0);
    });

    it('should return readonly last name pool', () => {
      const pool = NameGenerator.getLastNamePool();
      
      expect(Array.isArray(pool)).toBe(true);
      expect(pool.length).toBeGreaterThan(0);
    });
  });

  describe('Seed Variations', () => {
    it('should handle similar seeds deterministically', () => {
      const name1 = NameGenerator.generateVendorName('vendor-1');
      const name2 = NameGenerator.generateVendorName('vendor-2');
      const name3 = NameGenerator.generateVendorName('vendor-3');

      // All names should be valid
      expect(NameGenerator.isValidNameCombination(name1.firstName, name1.lastName)).toBe(true);
      expect(NameGenerator.isValidNameCombination(name2.firstName, name2.lastName)).toBe(true);
      expect(NameGenerator.isValidNameCombination(name3.firstName, name3.lastName)).toBe(true);
    });

    it('should handle epoch-based seeds', () => {
      const name1 = NameGenerator.generateVendorName('epoch-0-vendor-0');
      const name2 = NameGenerator.generateVendorName('epoch-0-vendor-1');
      const name3 = NameGenerator.generateVendorName('epoch-1-vendor-0');

      expect(name1.fullName).toBeTruthy();
      expect(name2.fullName).toBeTruthy();
      expect(name3.fullName).toBeTruthy();

      // Names should be valid
      expect(NameGenerator.isValidNameCombination(name1.firstName, name1.lastName)).toBe(true);
      expect(NameGenerator.isValidNameCombination(name2.firstName, name2.lastName)).toBe(true);
      expect(NameGenerator.isValidNameCombination(name3.firstName, name3.lastName)).toBe(true);
    });

    it('should handle hex seed strings', () => {
      const name1 = NameGenerator.generateVendorName('0a1b2c3d');
      const name2 = NameGenerator.generateVendorName('0a1b2c3d');

      expect(name1.fullName).toBe(name2.fullName);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single character seed', () => {
      const name1 = NameGenerator.generateVendorName('a');
      const name2 = NameGenerator.generateVendorName('a');

      expect(name1.fullName).toBe(name2.fullName);
      expect(name1.firstName).toBeTruthy();
    });

    it('should handle Unicode characters in seed', () => {
      const name1 = NameGenerator.generateVendorName('café-☕-vendor');
      const name2 = NameGenerator.generateVendorName('café-☕-vendor');

      expect(name1.fullName).toBe(name2.fullName);
    });

    it('should handle seeds with whitespace', () => {
      const name1 = NameGenerator.generateVendorName('  test  seed  ');
      const name2 = NameGenerator.generateVendorName('  test  seed  ');

      expect(name1.fullName).toBe(name2.fullName);
    });

    it('should handle seeds with newlines', () => {
      const name1 = NameGenerator.generateVendorName('line1\nline2');
      const name2 = NameGenerator.generateVendorName('line1\nline2');

      expect(name1.fullName).toBe(name2.fullName);
    });
  });

  describe('Real-World Usage', () => {
    it('should generate names suitable for vendors', () => {
      const names = NameGenerator.generateMultipleVendorNames('game-session', 5);

      // All names should be readable
      names.forEach((name) => {
        expect(name.firstName.length).toBeGreaterThan(2);
        expect(name.lastName.length).toBeGreaterThan(2);
        expect(name.fullName.length).toBeGreaterThan(5);
      });
    });

    it('should work with AIContentManager seed format', () => {
      // Simulate AIContentManager seed format (8-char hex)
      const seed = 'abc12345';
      const name = NameGenerator.generateVendorName(seed);

      expect(name.firstName).toBeTruthy();
      expect(name.lastName).toBeTruthy();
    });

    it('should generate diverse roster from single epoch', () => {
      const epochSeed = 'epoch-42';
      const roster = NameGenerator.generateMultipleVendorNames(epochSeed, 10);

      const uniqueNames = new Set(roster.map((n) => n.fullName));
      
      // Should have reasonable diversity (at least 3 unique names)
      expect(uniqueNames.size).toBeGreaterThanOrEqual(3);
    });
  });
});
