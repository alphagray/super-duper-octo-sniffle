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
   * Fan disengagement configuration
   * Controls visual state for disinterested fans (low attention + low happiness)
   */
  fanDisengagement: {
    attentionThreshold: 30, // attention must be below this
    happinessThreshold: 40, // happiness must be below this
    visualOpacity: 0.7, // reduced opacity for disinterested fans
    visualTint: 0x888888, // gray tint for disinterested fans
    tintMixRatio: 0.5, // ratio for mixing original color with gray tint (0-1)
    jiggleReduction: 0.5, // reduce jiggle frequency by 50%
    stateCheckInterval: 500, // ms between state checks (performance optimization)
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
   * Autonomous wave triggering system configuration
   * Controls how the crowd initiates waves based on section happiness
   */
  waveAutonomous: {
    // Master toggle for autonomous wave system
    enabled: true,

    // Triggering thresholds
    waveStartHappinessThreshold: 0.60, // section avg happiness (0-100) must be >= this (60%) to trigger wave
    
    // Cooldown durations (milliseconds)
    successCooldown: 5000, // 5 seconds after successful wave completes
    failureCooldown: 9000, // 9 seconds after failed wave (5s base + 4s penalty)
    sectionStartCooldown: 8000, // 8 seconds before same section can initiate another wave
    
    // Happiness decay configuration (replaces linear decay)
    thirstHappinessDecayThreshold: 50, // happiness only decays when thirst > this value
    thirstHappinessDecayRate: 1.0, // happiness decay rate (points per second) when thirsty
    
    // Peer pressure mechanics (section aggregate behavior)
    peerPressureHappinessThreshold: 75, // section avg happiness must be >= this for peer pressure boost
    peerPressureAttentionBoost: 0.5, // attention boost (points per second) for all fans in section
    
    // Wave completion rewards
    waveCompletionHappinessBoost: 15, // temporary happiness boost when wave completes successfully
    waveCompletionAttentionBoost: 20, // temporary attention boost when wave completes successfully
    waveBoostDuration: 5000, // duration (ms) of temporary boosts
    
    // Section position weights (edge sections more likely to start waves)
    // Keys represent total section count, values are arrays of weights by position
    sectionPositionWeights: {
      3: [1.5, 0.5, 1.5], // edges favored, center suppressed
      4: [1.3, 1.0, 1.0, 1.3], // edges slightly favored
      5: [1.5, 1.2, 0.5, 1.2, 1.5], // edges favored, center suppressed
    },
    
    // Visual configuration
    incomingCueDuration: 3000, // duration (ms) of incoming wave cue animation
    sectionStatOffsetY: 20, // vertical offset (px) for section stat overlays below section sprites
    
    // Special wave types (currently stubbed for future implementation)
    specialWaveTypes: {
      SUPER: {
        enabled: false, // disabled until implemented
        speedMultiplier: 2.0, // waves travel twice as fast
        scoreMultiplier: 1.5, // 50% bonus points
      },
      DOUBLE_DOWN: {
        enabled: false, // disabled until implemented
        reverseAfterComplete: true, // wave reverses direction after completing
        scoreMultiplier: 2.0, // double points
      },
    },
  },

  /**
   * Wave timing configuration (all in milliseconds, converted to seconds where needed)
   */
  waveTiming: {
    triggerCountdown: 10000, // 10 seconds before wave fires
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

  /**
   * World grid configuration (used by WorldScene & GridManager)
   */
  grid: {
    enabled: true,
    cellSize: 32, // pixels per cell (seat ~28px wide fits comfortably)
    offsetX: 0, // world-space offset for grid origin (left edge)
    offsetY: 0, // world-space offset for grid origin (top edge)
    margins: {
      top: 120,
      right: 96,
      bottom: 160,
      left: 96,
    },
    // Defines the row treated as ground-level; top edges lock unless overridden
    groundLine: {
      enabled: true,
      // Move ground just under halfway up the grid
      // For a 24-row grid (32px cells on 768px), this places ground near midline
      rowsFromBottom: 6, // 0 = bottom-most row, higher = higher ground
    },
    // Directional wall defaults ensure outside-the-stadium cells are non-traversable
    defaultExteriorWall: true,
    // Debug rendering options
    debug: {
      initialVisible: false,
      gridColor: 0x00ffff,
      gridAlpha: 0.2,
      wallColor: 0xff5555,
      wallAlpha: 0.85,
      gridLineWidth: 1,
      wallLineWidth: 3,
      toggleKey: 'G',
      depth: 10000, // Render on top of everything for debug visibility
    },
  },

  /**
   * Wave sprite visualization configuration
   */
  waveSprite: {
    visible: true, // Set to true to show wave sprite by default.
    speed: 266, // pixels per second (baseline; runtime may multiply)
    debugColor: 0x00ffff, // cyan
    debugAlpha: 0.8,
    debugRadius: 12,
    trailLength: 5, // number of trail points to show
    trailFadeRate: 0.15, // how quickly trail points fade
  },

  /**
   * Section row rendering and pathing configuration
   */
  sectionRows: {
    dividerHeightRatio: 0.15,
    gradientLightness: {
      min: 30,
      max: 90,
    },
    debugLabelColor: '#fffbcc',
  },

  /**
   * Vendor movement and pathfinding configuration
   */
  vendorMovement: {
    // Base movement speeds (pixels per second)
    baseSpeedCorridor: 100, // fastest - no obstacles
    baseSpeedStair: 80, // moderate - vertical movement
    baseSpeedRow: 50, // slowest - navigating through seated fans
    
    // Terrain penalties (0-1 multipliers reducing speed)
    rowBasePenalty: 0.10, // 10% slowdown when moving through any row
    occupiedSeatPenalty: 0.20, // additional 20% slowdown per occupied seat
    emptySeatPenalty: 0, // no penalty for empty seats
    grumpPenaltyMultiplier: 2.0, // multiply base penalty by this for grumps
    maxTerrainPenalty: 0.90, // cap total penalty at 90% slowdown
    
    // Pathfinding parameters
    detourToleranceBase: 0.25, // penalty threshold to trigger local detour search
    pathRecalcInterval: 2000, // ms between path recalculations for dynamic updates
    
    // Navigation graph parameters
    corridorWidth: 40, // pixels - spacing for corridor nodes above/below sections
    stairTransitionCost: 60, // base cost for stair traversal between sections
    rowEntryToCorridor: 50, // base cost for entering row from corridor
    rowVerticalTransition: 30, // cost for moving between adjacent rows
  },

  /**
   * Mascot movement and behavior configuration
   */
  mascot: {
    // Movement speeds (pixels per second)
    movementSpeed: 50, // base perimeter patrol speed

    // Activation duration (milliseconds)
    minDuration: 15000, // 15 seconds minimum active time
    maxDuration: 20000, // 20 seconds maximum active time

    // Cooldown duration (milliseconds)
    minCooldown: 45000, // 45 seconds minimum cooldown
    maxCooldown: 60000, // 60 seconds maximum cooldown

    // Patrol behavior
    pauseAtCornerMin: 1000, // minimum pause at corners (ms)
    pauseAtCornerMax: 3000, // maximum pause at corners (ms)
    cornerPauseProbability: 0.4, // 40% chance to pause at each corner

    // Path behavior
    edgePadding: 10, // pixels from section edge for perimeter path
    shortcutProbability: 0.15, // 15% chance to take shortcut across section
    shortcutSpeedMultiplier: 0.7, // slower when cutting across (70% speed)

    // Auto-rotation mode
    autoRotationEnabled: false, // default to manual mode
    autoRotationSectionCooldown: 10000, // 10s cooldown before switching sections

    // Depth factor for targeting (used by t-shirt cannon AI)
    depthFactorBack: 1.0, // at back of section (best for long throws)
    depthFactorFrontSides: 0.3, // at front or sides (worse for long throws)
  },

  /**
   * Grump/difficult terrain configuration
   * Foundation for future grump fan type
   */
  grumpConfig: {
    // Thresholds for difficult terrain classification
    unhappyThreshold: 40, // happiness below this triggers difficult terrain
    disappointmentThreshold: 50, // disappointment above this triggers difficult terrain
    
    // Grump-specific stat growth (disabled until grump type implemented)
    disgruntlementGrowthRate: 0, // points per second (grump-only)
    disappointmentGrowthRate: 0, // points per second when thirsty + unhappy
    
    // Movement penalty application
    applyToAllFans: false, // if true, all fans can be difficult terrain; if false, grump-only
  },

  /**
   * Vendor quality tier configuration
   * Affects pathfinding efficiency, distraction likelihood, and penalty tolerance
   */
  vendorQuality: {
    excellent: {
      efficiencyModifier: 1.3, // 30% faster pathfinding/movement
      distractionChance: 0, // never gets distracted
      penaltyTolerance: 0.35, // higher tolerance before detour
    },
    good: {
      efficiencyModifier: 1.0, // baseline performance
      distractionChance: 0.05, // 5% chance per check
      penaltyTolerance: 0.25, // standard tolerance
    },
    average: {
      efficiencyModifier: 0.8, // 20% slower
      distractionChance: 0.15, // 15% chance per check
      penaltyTolerance: 0.20, // lower tolerance
    },
    poor: {
      efficiencyModifier: 0.6, // 40% slower
      distractionChance: 0.30, // 30% chance per check
      penaltyTolerance: 0.15, // easily triggered detours
    },
    
    // Distraction behavior
    distractionDuration: 1500, // ms vendor pauses when distracted
    distractionCheckInterval: 3000, // ms between distraction rolls
  },

  /**
   * Vendor type configurations
   */
  vendorTypes: {
    // Drink vendor (in-section service)
    drink: {
      serviceTime: 2000, // ms to serve one fan
      thirstReductionAmount: 100, // full thirst reset
      happinessBoost: 15, // points added to happiness
      canEnterRows: true, // allowed to navigate section rows
      rangedOnly: false, // must approach fans directly
    },
    
    // Ranged AoE vendor (t-shirt cannon, front-only service)
    rangedAoE: {
      // AoE mechanics
      baseRadius: 30, // pixels - default AoE radius
      centerHappinessBoost: 30, // happiness boost at epicenter
      falloffPerRing: 5, // happiness reduction per distance ring
      
      // Attention mechanics
      attentionReductionRate: 2.0, // points per second while in range
      attentionReductionCap: 0.5, // max rate when stacked with other effects
      attentionRecoveryDelay: 3000, // ms delay before recovery starts
      attentionRecoveryRate: 1.5, // points per second during recovery
      
      // Targeting
      targetUnhappyThreshold: 60, // prioritize fans below this happiness
      excludeDifficultTerrain: true, // don't target grumps
      
      // Timing
      chargeDuration: 1500, // ms to charge before firing
      cooldownDuration: 4000, // ms between shots
      
      // Movement restrictions
      canEnterRows: false, // stays in front corridor
      rangedOnly: true, // fires from distance
    },
  },

  /**
   * Session default vendor spawning
   */
  sessionDefaults: {
    initialVendorCount: 2, // start with 2 vendors
    initialVendorType: 'drink' as const, // both are drink vendors
    initialVendorQuality: 'good' as const, // good quality tier
  },

  /**
   * Vendor debug configuration
   */
  vendorDebug: {
    enabled: false, // toggle debug logging and overlays
    logPathPlanning: true, // log path calculation details
    logTargetSelection: true, // log target scoring
    logMovement: false, // log movement updates (verbose)
    renderPaths: true, // draw debug lines for paths
    renderAoE: true, // draw AoE radius circles
  },

  /**
   * Ripple propagation configuration
   * Controls cascading engagement effects when fans catch t-shirts
   */
  ripplePropagation: {
    enabled: true, // master toggle for ripple system
    baseEffect: 40, // attention boost at epicenter (0-100)
    maxRadius: 4, // maximum Manhattan distance for ripple spread
    disinterestedBonus: 5, // extra attention boost for disinterested fans
    decayType: 'linear' as const, // decay function: 'linear' | 'exponential'
  },

  /**
   * Mascot T-Shirt Cannon configuration
   * Controls targeting AI and firing mechanics for mascot t-shirt cannon
   */
  mascotCannon: {
    // Shot timing and quantity
    minShotsPerActivation: 3, // minimum shots during mascot activation
    maxShotsPerActivation: 5, // maximum shots during mascot activation
    minShotInterval: 3000, // minimum ms between shots
    maxShotInterval: 5000, // maximum ms between shots

    // Global boosts (applied to ALL fans in section on successful hit)
    globalAttentionBoost: 5, // attention points added to all section fans
    globalHappinessBoost: 3, // happiness points added to all section fans

    // Targeting mechanics
    minCatchersPerShot: 1, // minimum fans who catch per shot
    maxCatchersPerShot: 3, // maximum fans who catch per shot (AOE cluster)
    disinterestedTargetingWeight: 3.0, // multiplier for disinterested fan selection (3x more likely)
    distanceWeight: 0.5, // weight for distance from mascot (farther = higher priority)

    // Timing and animation
    chargeDuration: 1500, // ms mascot pauses to charge before firing
    targetingPreviewDuration: 1000, // ms targeting indicator shown before fire
    projectileFlightTime: 1000, // ms delay before effects apply (projectile travel time)

    // Performance
    maxSimultaneousMascots: 5, // maximum mascots that can fire simultaneously
  },

  /**
   * Visual environment configuration
   */
  visual: {
    groundColor: 0x2d5016, // Medium-dark green
    skyTopColor: 0x30a2d1, // Sky blue
    skyBottomColor: 0x4682B4, // Steel blue (for future gradient)
    stairsColor: 0xffffff, // White
    stairsDepth: -50,
    groundDepth: -100,
    skyDepth: -101,
  },

  /**
   * Visual effects configuration for particles, indicators, and animations
   */
  visuals: {
    // Targeting indicator
    targetingReticleRadius: 25,
    targetingReticleColor: 0xFFFF00, // Yellow
    targetingDuration: 1000, // 1 second
    
    // Catch particles
    catchParticleCount: 15,
    catchParticleLifespan: 600,
    catchParticleColor: 0xFFD700, // Gold
    
    // Re-engagement
    reEngageScalePop: 1.3,
    reEngageFlashDuration: 100,
    reEngageFlashColor: 0xFFFFFF, // White
    reEngageSparkleCount: 8,
    
    // Performance
    maxSimultaneousParticleEmitters: 10,
  },
};

export type GameBalance = typeof gameBalance;
