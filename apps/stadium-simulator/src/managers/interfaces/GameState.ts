import { Section } from './Section';
import { WaveState } from './WaveState';

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
