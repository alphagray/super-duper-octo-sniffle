/**
 * Dialogue Manager
 * 
 * Context-aware dialogue selection system with usage tracking and cooldowns.
 * Selects appropriate dialogue lines based on game state, emotional context,
 * and prevents repetition through cooldown enforcement.
 * 
 * Features:
 * - O(1) usage tracking per character + line
 * - Weighted random selection with cumulative distribution
 * - Context condition evaluation (score, wave state, stats)
 * - Cooldown enforcement to prevent repetition
 * - Fallback to first line if all filtered
 * - Performance target: < 1ms per selection
 */

import type {
  DialogueLine,
  DialogueContext,
  GameEventType,
} from '@/types/personalities';
import type { Section } from '@/managers/interfaces/Section';

/**
 * Usage tracking entry for a dialogue line
 */
interface DialogueUsage {
  /** Character ID that used this line */
  characterId: string;
  /** Dialogue line ID */
  lineId: string;
  /** Last time this line was used (timestamp) */
  lastUsedAt: number;
  /** Total number of times this line has been used */
  useCount: number;
}

/**
 * Game state context for dialogue selection
 */
export interface DialogueSelectionContext {
  /** Current event type */
  event: GameEventType;
  /** Current game score */
  score: number;
  /** Current wave state */
  waveState: 'active' | 'inactive' | 'countdown';
  /** Optional section stats (for section-specific events) */
  sectionStats?: {
    happiness: number;
    thirst: number;
    attention: number;
  };
  /** Optional aggregate stats (average across all sections) */
  aggregateStats?: {
    happiness: number;
    thirst: number;
    attention: number;
  };
}

/**
 * Dialogue Manager
 * 
 * Manages context-aware dialogue selection with usage tracking and cooldowns.
 */
export class DialogueManager {
  /** Usage tracking map: key = "characterId:lineId" */
  private usageMap: Map<string, DialogueUsage>;

  /** Random number generator seed (optional, for testing) */
  private seed?: number;

  /**
   * Create a new DialogueManager
   * 
   * @param seed - Optional seed for deterministic random selection (testing only)
   */
  constructor(seed?: number) {
    this.usageMap = new Map();
    this.seed = seed;
  }

  /**
   * Select a dialogue line based on context
   * 
   * Filters available lines by context conditions, applies cooldowns,
   * and uses weighted random selection to choose the best line.
   * 
   * @param characterId - Unique identifier for the character
   * @param availableLines - Array of available dialogue lines
   * @param context - Current game state context
   * @returns Selected dialogue line or null if no lines available
   * 
   * @example
   * ```typescript
   * const manager = new DialogueManager();
   * const line = manager.selectDialogue('vendor-1', vendorDialogue, {
   *   event: 'vendorServe',
   *   score: 500,
   *   waveState: 'active',
   *   sectionStats: { happiness: 75, thirst: 30, attention: 80 }
   * });
   * if (line) {
   *   console.log(line.text);
   * }
   * ```
   */
  public selectDialogue(
    characterId: string,
    availableLines: DialogueLine[],
    context: DialogueSelectionContext
  ): DialogueLine | null {
    // Filter lines by context conditions
    const eligibleLines = this.filterByContext(availableLines, context);

    if (eligibleLines.length === 0) {
      // Fallback: return first line if no eligible lines
      return availableLines.length > 0 ? availableLines[0] : null;
    }

    // Filter by cooldown
    const cooledDownLines = this.filterByCooldown(characterId, eligibleLines);

    if (cooledDownLines.length === 0) {
      // Fallback: return first eligible line if all on cooldown
      return eligibleLines[0];
    }

    // Weighted random selection
    const selectedLine = this.weightedRandomSelection(cooledDownLines);

    // Track usage
    this.trackUsage(characterId, selectedLine);

    return selectedLine;
  }

  /**
   * Filter dialogue lines by context conditions
   * 
   * @param lines - Available dialogue lines
   * @param context - Selection context
   * @returns Lines that match the context conditions
   */
  private filterByContext(
    lines: DialogueLine[],
    context: DialogueSelectionContext
  ): DialogueLine[] {
    return lines.filter((line) => {
      // Event type must match
      if (line.context.event !== context.event) {
        return false;
      }

      // Check score range if specified
      if (line.context.scoreRange) {
        const [min, max] = line.context.scoreRange;
        if (context.score < min || context.score > max) {
          return false;
        }
      }

      // Check wave state if specified
      if (line.context.waveState && line.context.waveState !== context.waveState) {
        return false;
      }

      // Check section stats if specified and available
      const stats = context.sectionStats || context.aggregateStats;
      if (stats) {
        // Happiness range
        if (line.context.minHappiness !== undefined && stats.happiness < line.context.minHappiness) {
          return false;
        }
        if (line.context.maxHappiness !== undefined && stats.happiness > line.context.maxHappiness) {
          return false;
        }

        // Thirst range
        if (line.context.minThirst !== undefined && stats.thirst < line.context.minThirst) {
          return false;
        }
        if (line.context.maxThirst !== undefined && stats.thirst > line.context.maxThirst) {
          return false;
        }

        // Attention range
        if (line.context.minAttention !== undefined && stats.attention < line.context.minAttention) {
          return false;
        }
        if (line.context.maxAttention !== undefined && stats.attention > line.context.maxAttention) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Filter dialogue lines by cooldown status
   * 
   * @param characterId - Character ID
   * @param lines - Dialogue lines to filter
   * @returns Lines that are not on cooldown
   */
  private filterByCooldown(characterId: string, lines: DialogueLine[]): DialogueLine[] {
    const now = Date.now();
    
    return lines.filter((line) => {
      const usageKey = this.getUsageKey(characterId, line.id);
      const usage = this.usageMap.get(usageKey);

      // If never used, not on cooldown
      if (!usage) {
        return true;
      }

      // Check if cooldown has elapsed
      const elapsedTime = now - usage.lastUsedAt;
      return elapsedTime >= line.cooldown;
    });
  }

  /**
   * Weighted random selection using cumulative distribution
   * 
   * @param lines - Eligible dialogue lines
   * @returns Selected dialogue line
   */
  private weightedRandomSelection(lines: DialogueLine[]): DialogueLine {
    // Calculate total weight (ensure non-negative priorities)
    const totalWeight = lines.reduce((sum, line) => sum + Math.max(0, line.priority), 0);

    // Handle zero-weight case (all priorities are 0 or negative)
    if (totalWeight === 0) {
      return lines[0];
    }

    // Generate random value
    const random = this.random() * totalWeight;

    // Select line using cumulative distribution
    let cumulative = 0;
    for (const line of lines) {
      const weight = Math.max(0, line.priority);
      cumulative += weight;
      if (random < cumulative) {
        return line;
      }
    }

    // Fallback (should never reach here due to floating point)
    return lines[lines.length - 1];
  }

  /**
   * Track usage of a dialogue line
   * 
   * @param characterId - Character ID
   * @param line - Dialogue line that was used
   */
  private trackUsage(characterId: string, line: DialogueLine): void {
    const usageKey = this.getUsageKey(characterId, line.id);
    const now = Date.now();

    const existing = this.usageMap.get(usageKey);
    if (existing) {
      existing.lastUsedAt = now;
      existing.useCount++;
    } else {
      this.usageMap.set(usageKey, {
        characterId,
        lineId: line.id,
        lastUsedAt: now,
        useCount: 1,
      });
    }
  }

  /**
   * Generate usage tracking key
   * 
   * @param characterId - Character ID
   * @param lineId - Dialogue line ID
   * @returns Usage key string
   */
  private getUsageKey(characterId: string, lineId: string): string {
    return `${characterId}:${lineId}`;
  }

  /**
   * Get random number between 0 and 1
   * 
   * Uses deterministic seeded random if seed provided (for testing),
   * otherwise uses Math.random().
   * 
   * @returns Random number [0, 1)
   */
  private random(): number {
    if (this.seed !== undefined) {
      // Simple seeded random (LCG algorithm)
      this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
      return this.seed / 0x7fffffff;
    }
    return Math.random();
  }

  /**
   * Get usage statistics for a character
   * 
   * @param characterId - Character ID
   * @returns Array of usage entries for the character
   */
  public getCharacterUsage(characterId: string): DialogueUsage[] {
    const usage: DialogueUsage[] = [];
    
    for (const value of this.usageMap.values()) {
      if (value.characterId === characterId) {
        usage.push({ ...value });
      }
    }

    return usage;
  }

  /**
   * Get usage statistics for a specific line
   * 
   * @param characterId - Character ID
   * @param lineId - Dialogue line ID
   * @returns Usage entry or null if never used
   */
  public getLineUsage(characterId: string, lineId: string): DialogueUsage | null {
    const usageKey = this.getUsageKey(characterId, lineId);
    const usage = this.usageMap.get(usageKey);
    return usage ? { ...usage } : null;
  }

  /**
   * Reset usage tracking (useful for testing or new game sessions)
   */
  public resetUsage(): void {
    this.usageMap.clear();
  }

  /**
   * Reset usage for a specific character
   * 
   * @param characterId - Character ID to reset
   */
  public resetCharacterUsage(characterId: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, value] of this.usageMap.entries()) {
      if (value.characterId === characterId) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.usageMap.delete(key);
    }
  }

  /**
   * Get total number of tracked usage entries
   * 
   * @returns Number of unique character+line combinations tracked
   */
  public getUsageCount(): number {
    return this.usageMap.size;
  }
}

export default DialogueManager;
