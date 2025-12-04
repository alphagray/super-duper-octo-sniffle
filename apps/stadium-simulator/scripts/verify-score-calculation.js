#!/usr/bin/env node

/**
 * Manual verification script for dynamic score calculation
 * Run with: node scripts/verify-score-calculation.js
 */

console.log('='.repeat(80));
console.log('DYNAMIC SCORE CALCULATION VERIFICATION');
console.log('='.repeat(80));
console.log();

// Simulate the calculation logic from gameBalance.ts
function calculateMaxWavesEstimate(sessionDurationMs) {
  const triggerCountdown = 5000;  // from waveTiming.triggerCountdown
  const baseCooldown = 15000;     // from waveTiming.baseCooldown
  const avgWaveLength = 2000;     // ~2 seconds for wave to complete
  
  // Total time per wave cycle (worst case, no success refunds)
  const totalCycleTime = triggerCountdown + baseCooldown + avgWaveLength;
  
  // Calculate max waves (round up since partial waves still count)
  return Math.ceil(sessionDurationMs / totalCycleTime);
}

// Test cases from the issue
const testCases = [
  {
    name: '100-second session (default)',
    duration: 100000,
    expected: 5,
    description: 'Standard run mode session'
  },
  {
    name: '20-second session (short)',
    duration: 20000,
    expected: 1,
    description: 'Very short session edge case'
  },
  {
    name: '300-second session (long)',
    duration: 300000,
    expected: 14,
    description: 'Extended session for testing'
  },
  {
    name: '0-second session (edge)',
    duration: 0,
    expected: 0,
    description: 'Edge case: zero duration'
  }
];

console.log('Test Results:');
console.log('-'.repeat(80));

let allPassed = true;
testCases.forEach(test => {
  const actual = calculateMaxWavesEstimate(test.duration);
  const passed = actual === test.expected;
  const status = passed ? '✓ PASS' : '✗ FAIL';
  
  console.log(`${status} | ${test.name}`);
  console.log(`      Duration: ${test.duration}ms`);
  console.log(`      Expected: ${test.expected} waves`);
  console.log(`      Actual:   ${actual} waves`);
  console.log(`      ${test.description}`);
  console.log();
  
  if (!passed) allPassed = false;
});

console.log('-'.repeat(80));

// Grade calculation examples
console.log();
console.log('Grade Calculation Examples (100s session, max 5 waves):');
console.log('-'.repeat(80));

const gradeExamples = [
  { waves: 5, percentage: 1.0, expectedGrade: 'A+' },
  { waves: 4, percentage: 0.8, expectedGrade: 'A+' },
  { waves: 3, percentage: 0.6, expectedGrade: 'B+' },
  { waves: 2, percentage: 0.4, expectedGrade: 'D+' },
  { waves: 1, percentage: 0.2, expectedGrade: 'F' },
  { waves: 0, percentage: 0.0, expectedGrade: 'F' },
];

function determineGrade(completedWaves, maxWaves) {
  // S-tier thresholds (absolute)
  if (completedWaves >= 8) return 'S+';
  if (completedWaves >= 7) return 'S';
  if (completedWaves >= 6) return 'S-';
  
  // Percentage-based grading
  const percentage = completedWaves / maxWaves;
  if (percentage >= 0.75) return 'A+';
  if (percentage >= 0.70) return 'A';
  if (percentage >= 0.65) return 'A-';
  if (percentage >= 0.60) return 'B+';
  if (percentage >= 0.55) return 'B';
  if (percentage >= 0.50) return 'B-';
  if (percentage >= 0.475) return 'C+';
  if (percentage >= 0.45) return 'C';
  if (percentage >= 0.425) return 'C-';
  if (percentage >= 0.40) return 'D+';
  if (percentage >= 0.375) return 'D';
  if (percentage >= 0.35) return 'D-';
  return 'F';
}

gradeExamples.forEach(example => {
  const actualGrade = determineGrade(example.waves, 5);
  const passed = actualGrade === example.expectedGrade;
  const status = passed ? '✓' : '✗';
  
  console.log(`${status} ${example.waves}/5 waves (${(example.percentage * 100).toFixed(0)}%) → Grade: ${actualGrade}`);
  if (!passed) {
    console.log(`   Expected: ${example.expectedGrade}`);
    allPassed = false;
  }
});

console.log();
console.log('S-Tier Examples (absolute thresholds):');
console.log('-'.repeat(80));

const sTierExamples = [
  { waves: 8, expectedGrade: 'S+' },
  { waves: 7, expectedGrade: 'S' },
  { waves: 6, expectedGrade: 'S-' },
];

sTierExamples.forEach(example => {
  const actualGrade = determineGrade(example.waves, 5);
  const passed = actualGrade === example.expectedGrade;
  const status = passed ? '✓' : '✗';
  
  console.log(`${status} ${example.waves} waves → Grade: ${actualGrade} (${example.waves > 5 ? 'exceeds max!' : 'absolute threshold'})`);
  if (!passed) {
    console.log(`   Expected: ${example.expectedGrade}`);
    allPassed = false;
  }
});

console.log();
console.log('='.repeat(80));
console.log(allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗');
console.log('='.repeat(80));

process.exit(allPassed ? 0 : 1);
