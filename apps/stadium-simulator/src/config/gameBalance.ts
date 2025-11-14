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
   * Wave timing configuration (all in milliseconds, converted to seconds where needed)
   */
  waveTiming: {
    triggerCountdown: 3000, // 3 seconds before wave fires
    baseCooldown: 10000, // 10 seconds between waves
    successRefund: 5000, // refund this much if all sections succeed
    columnDelay: 22, // ms between column animations
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
  },

  /**
   * UI configuration
   */
  ui: {
    // Wave strength meter
    meterWidth: 40,
    meterHeight: 250,
    meterPanelWidth: 100,
    meterPanelHeight: 300,
    meterCornerRadius: 8,
    // Countdown display
    countdownFontSize: 120,
    waveCountdownFontSize: 48,
  },
};

export type GameBalance = typeof gameBalance;
