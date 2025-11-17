/**
 * Announcer System
 * 
 * Manages announcer commentary with context-aware dialogue selection.
 * Provides play-by-play commentary for wave events, scoring, and game milestones.
 * 
 * Features:
 * - Integration with DialogueManager for cooldown management
 * - Context-aware commentary selection
 * - Support for catchphrases on special triggers
 * - Event-driven commentary triggers
 */

import type { AnnouncerContent, DialogueLine, Catchphrase } from '@/types/personalities';
import type { DialogueManager } from './DialogueManager';

export type CommentaryContext = 
  | 'waveStart' 
  | 'waveSuccess' 
  | 'waveFail' 
  | 'perfectWave' 
  | 'comboBonus' 
  | 'gameOver' 
  | 'newHighScore';

/**
 * Announcer System
 * 
 * Manages announcer commentary for game events.
 */
export class AnnouncerSystem {
  private announcerContent: AnnouncerContent | null;
  private dialogueManager: DialogueManager | null;
  private announcerId: string;
  private consecutiveSuccesses: number;
  private lastScore: number;

  /**
   * Create a new AnnouncerSystem
   * 
   * @param announcerContent - Announcer personality content
   * @param dialogueManager - DialogueManager instance for cooldown management
   */
  constructor(
    announcerContent?: AnnouncerContent,
    dialogueManager?: DialogueManager
  ) {
    this.announcerContent = announcerContent || null;
    this.dialogueManager = dialogueManager || null;
    this.announcerId = announcerContent?.id || `announcer-${Math.random().toString(36).substr(2, 9)}`;
    this.consecutiveSuccesses = 0;
    this.lastScore = 0;
  }

  /**
   * Get commentary for a specific game context
   * 
   * @param context - Commentary context
   * @param gameState - Current game state
   * @returns Commentary text or null if no suitable commentary found
   */
  public getCommentary(
    context: CommentaryContext,
    gameState: {
      score: number;
      waveState: 'active' | 'inactive' | 'countdown';
      multiplier?: number;
      perfectWave?: boolean;
      aggregateStats?: {
        happiness: number;
        thirst: number;
        attention: number;
      };
    }
  ): string | null {
    if (!this.announcerContent || !this.dialogueManager) {
      return null;
    }

    // Update consecutive successes tracking
    if (context === 'waveSuccess') {
      this.consecutiveSuccesses++;
    } else if (context === 'waveFail') {
      this.consecutiveSuccesses = 0;
    }

    // Check for catchphrase triggers first
    const catchphrase = this.checkCatchphraseTriggers(context, gameState);
    if (catchphrase) {
      return catchphrase.text;
    }

    // Map context to game event type
    const eventMap: Record<CommentaryContext, 'waveStart' | 'waveComplete' | 'sectionSuccess' | 'sectionFail' | 'sessionEnd' | 'highScore'> = {
      waveStart: 'waveStart',
      waveSuccess: 'waveComplete',
      waveFail: 'sectionFail',
      perfectWave: 'waveComplete',
      comboBonus: 'waveComplete',
      gameOver: 'sessionEnd',
      newHighScore: 'highScore',
    };

    // Select dialogue line
    const dialogueLine = this.dialogueManager.selectDialogue(
      this.announcerId,
      this.announcerContent.commentary,
      {
        event: eventMap[context],
        ...gameState,
      }
    );

    this.lastScore = gameState.score;
    return dialogueLine?.text || null;
  }

  /**
   * Check for catchphrase triggers
   * 
   * @param context - Commentary context
   * @param gameState - Current game state
   * @returns Catchphrase if triggered, null otherwise
   */
  private checkCatchphraseTriggers(
    context: CommentaryContext,
    gameState: {
      score: number;
      multiplier?: number;
      perfectWave?: boolean;
    }
  ): Catchphrase | null {
    if (!this.announcerContent) {
      return null;
    }

    // Map context to game event type for catchphrases
    const eventMap: Record<CommentaryContext, 'waveStart' | 'waveComplete' | 'sectionSuccess' | 'sectionFail' | 'sessionEnd' | 'highScore'> = {
      waveStart: 'waveStart',
      waveSuccess: 'waveComplete',
      waveFail: 'sectionFail',
      perfectWave: 'waveComplete',
      comboBonus: 'waveComplete',
      gameOver: 'sessionEnd',
      newHighScore: 'highScore',
    };

    const event = eventMap[context];

    // Check each catchphrase
    for (const catchphrase of this.announcerContent.catchphrases) {
      if (catchphrase.trigger.event !== event) {
        continue;
      }

      // Check conditions
      const conditions = catchphrase.trigger.conditions;
      if (conditions) {
        if (conditions.minScore && gameState.score < conditions.minScore) {
          continue;
        }
        if (conditions.minMultiplier && (gameState.multiplier || 1) < conditions.minMultiplier) {
          continue;
        }
        if (conditions.consecutiveSuccesses && this.consecutiveSuccesses < conditions.consecutiveSuccesses) {
          continue;
        }
        if (conditions.perfectWave && !gameState.perfectWave) {
          continue;
        }
      }

      // Roll for rarity
      if (Math.random() < catchphrase.rarity) {
        return catchphrase;
      }
    }

    return null;
  }

  /**
   * Get announcer's personality content
   */
  public getAnnouncerContent(): AnnouncerContent | null {
    return this.announcerContent;
  }

  /**
   * Get announcer's unique ID
   */
  public getAnnouncerId(): string {
    return this.announcerId;
  }

  /**
   * Get consecutive successes count
   */
  public getConsecutiveSuccesses(): number {
    return this.consecutiveSuccesses;
  }

  /**
   * Reset consecutive successes count
   */
  public resetConsecutiveSuccesses(): void {
    this.consecutiveSuccesses = 0;
  }

  /**
   * Set announcer content
   */
  public setAnnouncerContent(content: AnnouncerContent): void {
    this.announcerContent = content;
    this.announcerId = content.id;
  }

  /**
   * Set dialogue manager
   */
  public setDialogueManager(manager: DialogueManager): void {
    this.dialogueManager = manager;
  }
}

export default AnnouncerSystem;
