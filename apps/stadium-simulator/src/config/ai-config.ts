/**
 * AI Configuration System
 * 
 * Centralized configuration for AI-powered game content including:
 * - Content epoch management (deterministic time-based content rotation)
 * - Cost tracking and budget enforcement
 * - Content freshness and variation controls
 * 
 * The epoch system allows for deterministic content generation based on timestamps,
 * ensuring consistent behavior across sessions and deployments while rotating
 * content at configurable intervals.
 */

/**
 * Environment type for epoch duration configuration
 */
export type Environment = 'development' | 'production';

/**
 * Epoch configuration settings
 */
export interface EpochConfig {
  /** Duration of each epoch in development (milliseconds) */
  developmentDuration: number;
  /** Duration of each epoch in production (milliseconds) */
  productionDuration: number;
  /** Epoch zero reference timestamp (Unix epoch in milliseconds) */
  epochZero: number;
}

/**
 * Cost tracking configuration
 */
export interface CostConfig {
  /** Enable cost tracking */
  enabled: boolean;
  /** Maximum cost per session (in cents) */
  maxCostPerSession: number;
  /** Maximum cost per user per day (in cents) */
  maxCostPerUserPerDay: number;
  /** Estimated cost per API call (in cents) */
  estimatedCostPerCall: number;
  /** Warning threshold as percentage of max (0-1) */
  warningThreshold: number;
}

/**
 * Content variation configuration
 */
export interface ContentVariationConfig {
  /** Enable content variation based on epochs */
  enabled: boolean;
  /** Number of content variants per personality type */
  variantsPerType: number;
  /** Minimum time between content refreshes (milliseconds) */
  minRefreshInterval: number;
}

/**
 * Complete AI configuration object
 */
export interface AIConfig {
  epoch: EpochConfig;
  cost: CostConfig;
  contentVariation: ContentVariationConfig;
}

/**
 * AI Configuration Constants
 * 
 * Centralized configuration for all AI-powered content generation,
 * cost management, and content rotation strategies.
 */
export const aiConfig: AIConfig = {
  /**
   * Epoch System Configuration
   * 
   * Epochs provide deterministic content rotation based on time.
   * - Development: Short epochs (1 hour) for rapid iteration and testing
   * - Production: Longer epochs (24 hours) for stable, daily content rotation
   * - Epoch zero: Reference point for all epoch calculations (2025-01-01 00:00:00 UTC)
   */
  epoch: {
    developmentDuration: 60 * 60 * 1000, // 1 hour in milliseconds
    productionDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    epochZero: Date.UTC(2025, 0, 1, 0, 0, 0), // 2025-01-01 00:00:00 UTC
  },

  /**
   * Cost Tracking and Budget Enforcement
   * 
   * Prevents runaway AI API costs with configurable limits:
   * - Session limit: Maximum cost per game session
   * - Daily limit: Maximum cost per user per day
   * - Warning threshold: Alert when approaching limits (e.g., 80%)
   * - Estimated cost: Used for predictive budget enforcement
   */
  cost: {
    enabled: true,
    maxCostPerSession: 50, // 50 cents per session
    maxCostPerUserPerDay: 200, // $2.00 per user per day
    estimatedCostPerCall: 5, // 5 cents per API call (conservative estimate)
    warningThreshold: 0.8, // Warn at 80% of limit
  },

  /**
   * Content Variation Configuration
   * 
   * Controls how AI content varies across epochs and sessions:
   * - Enable/disable epoch-based content rotation
   * - Number of personality variants per type (vendor, mascot, announcer)
   * - Minimum refresh interval to prevent excessive API calls
   */
  contentVariation: {
    enabled: true,
    variantsPerType: 5, // 5 personality variants per type
    minRefreshInterval: 5 * 60 * 1000, // 5 minutes minimum between refreshes
  },
};

/**
 * Calculate the current epoch number based on timestamp
 * 
 * Provides deterministic epoch calculation for consistent content generation.
 * The same timestamp will always return the same epoch number, ensuring
 * reproducible behavior across different runs and deployments.
 * 
 * Formula: epoch = floor((timestamp - epochZero) / epochDuration)
 * 
 * @param timestamp - Unix timestamp in milliseconds (defaults to current time)
 * @param environment - Environment type (development or production)
 * @returns Current epoch number (non-negative integer)
 * 
 * @example
 * ```typescript
 * // Get current epoch in production
 * const epoch = getCurrentEpoch();
 * 
 * // Get epoch for specific timestamp in development
 * const testEpoch = getCurrentEpoch(Date.UTC(2025, 0, 2, 12, 0, 0), 'development');
 * 
 * // Same timestamp always returns same epoch
 * const epoch1 = getCurrentEpoch(1735689600000);
 * const epoch2 = getCurrentEpoch(1735689600000);
 * console.assert(epoch1 === epoch2, 'Epochs must be deterministic');
 * ```
 */
export function getCurrentEpoch(
  timestamp: number = Date.now(),
  environment: Environment = 'production'
): number {
  const { epochZero, developmentDuration, productionDuration } = aiConfig.epoch;
  
  // Select duration based on environment
  const duration = environment === 'development' ? developmentDuration : productionDuration;
  
  // Calculate elapsed time since epoch zero
  const elapsed = timestamp - epochZero;
  
  // Handle edge case: timestamp before epoch zero
  if (elapsed < 0) {
    return 0;
  }
  
  // Calculate epoch number (floor division)
  return Math.floor(elapsed / duration);
}

/**
 * Get the start timestamp for a specific epoch
 * 
 * Useful for debugging, testing, and calculating epoch boundaries.
 * 
 * @param epochNumber - The epoch number to get the start time for
 * @param environment - Environment type (development or production)
 * @returns Unix timestamp (milliseconds) when the epoch started
 * 
 * @example
 * ```typescript
 * const epoch = getCurrentEpoch();
 * const epochStart = getEpochStartTime(epoch);
 * const epochEnd = getEpochStartTime(epoch + 1);
 * console.log(`Current epoch ${epoch} runs from ${new Date(epochStart)} to ${new Date(epochEnd)}`);
 * ```
 */
export function getEpochStartTime(
  epochNumber: number,
  environment: Environment = 'production'
): number {
  const { epochZero, developmentDuration, productionDuration } = aiConfig.epoch;
  const duration = environment === 'development' ? developmentDuration : productionDuration;
  
  return epochZero + (epochNumber * duration);
}

/**
 * Get the end timestamp for a specific epoch
 * 
 * @param epochNumber - The epoch number to get the end time for
 * @param environment - Environment type (development or production)
 * @returns Unix timestamp (milliseconds) when the epoch ends
 */
export function getEpochEndTime(
  epochNumber: number,
  environment: Environment = 'production'
): number {
  return getEpochStartTime(epochNumber + 1, environment);
}

/**
 * Get time remaining in current epoch
 * 
 * Useful for UI displays and scheduling content refreshes.
 * 
 * @param timestamp - Unix timestamp in milliseconds (defaults to current time)
 * @param environment - Environment type (development or production)
 * @returns Milliseconds remaining until next epoch
 */
export function getTimeUntilNextEpoch(
  timestamp: number = Date.now(),
  environment: Environment = 'production'
): number {
  const currentEpoch = getCurrentEpoch(timestamp, environment);
  const nextEpochStart = getEpochStartTime(currentEpoch + 1, environment);
  return nextEpochStart - timestamp;
}

/**
 * Check if timestamp is within a specific epoch
 * 
 * @param timestamp - Unix timestamp to check
 * @param epochNumber - Epoch number to check against
 * @param environment - Environment type (development or production)
 * @returns True if timestamp falls within the specified epoch
 */
export function isInEpoch(
  timestamp: number,
  epochNumber: number,
  environment: Environment = 'production'
): boolean {
  const actualEpoch = getCurrentEpoch(timestamp, environment);
  return actualEpoch === epochNumber;
}

export type AIConfigType = typeof aiConfig;
