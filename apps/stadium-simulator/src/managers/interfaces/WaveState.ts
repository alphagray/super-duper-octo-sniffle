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
