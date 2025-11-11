/**
 * Represents a section of the stadium with fan engagement metrics
 */
export interface Section {
  /** Unique identifier for the section */
  id: string;
  /** Happiness level of fans in this section (0-100) */
  happiness: number;
  /** Thirst level of fans in this section (0-100) */
  thirst: number;
  /** Attention level of fans in this section (0-100) */
  attention: number;
}

/**
 * Represents the current state of the wave animation
 */
export interface WaveState {
  /** Countdown timer before wave starts */
  countdown: number;
  /** Whether the wave is currently active */
  active: boolean;
  /** Index of the current section participating in the wave */
  currentSection: number;
  /** Score multiplier for the current wave */
  multiplier: number;
}

/**
 * Represents the state of a vendor in the stadium
 */
export interface VendorState {
  /** Current position of the vendor */
  position: number;
  /** Cooldown timer before vendor can serve again */
  cooldown: number;
  /** Whether the vendor is currently serving */
  isServing: boolean;
}

/**
 * Represents the state of the stadium mascot
 */
export interface MascotState {
  /** Cooldown timer before mascot can perform again */
  cooldown: number;
  /** Whether the mascot is currently active */
  isActive: boolean;
}

/**
 * Represents the overall game state
 */
export interface GameState {
  /** Array of all stadium sections */
  sections: Section[];
  /** Current wave state */
  wave: WaveState;
  /** Current game score */
  score: number;
}
