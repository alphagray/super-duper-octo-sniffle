/**
 * Centralized game balance configuration
 * All magic numbers and tuning parameters in one place for easy adjustments
 */

export const gameBalance = {
  /**
   * Fan stat configuration
   */
  fanStats: {
    // Initial stat ranges
    initialHappiness: 70,
    initialThirstMin: 0,
    initialThirstMax: 30,
    initialAttention: 70,

    // Decay rates (points per second)
    thirstGrowthRate: 2,
    happinessDecayRate: 1.25, // when thirst > 50
    attentionDecayRate: 1.5,
    attentionMinimum: 30,

    // Freeze durations (milliseconds)
    thirstFreezeDuration: 4000,
    attentionFreezeDuration: 5000,

    // Stat calculation modifiers
    waveChanceHappinessWeight: 0.5,
    waveChanceAttentionWeight: 0.5,
    waveChanceThirstPenalty: 0.3,
    waveChanceFlatBonus: 10,
  },

  /**
   * Wave strength and momentum configuration
   */
  waveStrength: {
    starting: 70,
    successBonus: 8,
    failurePenalty: -20,
    recoveryBonus: 10,
    recoveryThreshold: 30,
    deathThreshold: 20,
    recoveryMinimumFailures: 1,
    recoveryMaximumFailures: 2,
    consecutiveFailureThreshold: 3,
    strengthModifier: 0.004,
    columnSuccessThreshold: 0.6, // participation rate for column success
    peerPressureThreshold: 0.6, // % of column needed to trigger peer pressure
  },

  /**
   * Wave classification & debug / booster configuration (new)
   * Centralizes thresholds and tunables for per-column + per-section logic.
   */
  waveClassification: {
    // Column-level participation thresholds (0-1 range)
    columnSuccessThreshold: 0.60, // >= success
    columnSputterThreshold: 0.40, // >= sputter (else death)
    columnDeathThreshold: 0.25, // optional lower band (used for stronger visual death)
    // Section aggregation thresholds (simple majority outcome guidance)
    sectionSuccessThreshold: 0.60,
    sectionSputterThreshold: 0.40,
    // Enhanced recovery power multiplier (applied when sputter -> clean success)
    recoveryPowerMultiplier: 0.50, // 50% extra over base recovery
    // Forced event parameters
    forcedSputterDegradationMin: 30,
    forcedSputterDegradationMax: 50,
    forcedDeathStrength: 5,
    // Booster percentage multipliers (wave-only, non-stacking; override replaces prior)
    boosterPercents: {
      momentum: 0.15, // +15% to strength adjustments
      recovery: 0.25, // +25% to recovery bonuses
      participation: 0.20, // +20% effective participation probability
    },
    // Debug panel event log max entries
    maxDebugEvents: 20,
    // Enable column state text grid in debug mode
    enableColumnGrid: true,
    // Composite threshold factor (strength + last2Avg) can be compared against (0-100 basis)
    compositeStrengthWeight: 1.0, // weight multiplier for raw wave strength
    compositeAvgParticipationWeight: 100, // multiply average (0-1) by weight for composite comparison
  },

  /**
   * Wave timing configuration (all in milliseconds, converted to seconds where needed)
   */
  waveTiming: {
    triggerCountdown: 3000, // 3 seconds before wave fires
    baseCooldown: 10000, // 10 seconds between waves
    successRefund: 5000, // refund this much if all sections succeed
    columnDelay: 44, // ms between column animations
    rowDelay: 6, // ms between row animations within column
  },

  /**
   * Session configuration
   */
  sessionConfig: {
    runModeDuration: 100000, // 100 seconds for stadium run
    eternalModeDuration: Infinity, // unlimited time for eternal mode
  },

  /**
   * Scoring configuration
   */
  scoring: {
    // Grade thresholds based on number of completed waves
    gradeThresholds: {
      'S+': 8,
      'S': 7,
      'S-': 6,
    },
    // Percentage-based thresholds for A through F grades
    // These are applied when wave count doesn't hit the S-grade tier
    percentageThresholds: {
      'A+': 0.75,
      'A': 0.70,
      'A-': 0.65,
      'B+': 0.60,
      'B': 0.55,
      'B-': 0.50,
      'C+': 0.475,
      'C': 0.45,
      'C-': 0.425,
      'D+': 0.40,
      'D': 0.375,
      'D-': 0.35,
      'F': 0.0,
    },
    // Colors for grade display (RGB hex)
    gradeColors: {
      'S+': 0xffd700, // gold
      'S': 0xffd700,
      'S-': 0xffd700,
      'A+': 0x00ff00, // bright green
      'A': 0x00dd00,
      'A-': 0x00bb00,
      'B+': 0x0088ff, // bright blue
      'B': 0x0066dd,
      'B-': 0x0044bb,
      'C+': 0xffff00, // bright yellow
      'C': 0xdddd00,
      'C-': 0xbbbb00,
      'D+': 0xff8800, // orange
      'D': 0xff6600,
      'D-': 0xff4400,
      'F': 0xff0000, // red
    },
    // Points awarded for various achievements
    basePointsPerWave: 100,
    participationBonus: 10, // per percentage point of participation
    // Estimated max waves based on session duration and wave timing
    // Calculated as: Math.ceil(runModeDuration / (baseCooldown + triggerCountdown))
    maxWavesEstimate: 8, // ~100s session / ~12.5s per wave cycle
  },

  /**
   * UI configuration
   */
  ui: {
    // Wave strength meter (used in StadiumScene for creating/updating meter display)
    meterWidth: 24,
    meterHeight: 60,
    meterPanelWidth: 30,
    meterPanelHeight: 66,
    meterCornerRadius: 4,
    // Countdown display
    countdownFontSize: 120,
    waveCountdownFontSize: 48,
  },
};

export type GameBalance = typeof gameBalance;
