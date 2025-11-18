/**
 * Dialogue Display Manager
 * 
 * Manages on-screen display of character dialogue using toast/bubble UI.
 * Handles queuing, timing, and visual presentation of dialogue lines.
 * 
 * Features:
 * - Toast notifications for dialogue
 * - Automatic fade-in/fade-out
 * - Queue management for multiple dialogue lines
 * - Character name and text display
 */

import Phaser from 'phaser';

/**
 * Dialogue entry for display queue
 */
interface DialogueEntry {
  characterName: string;
  text: string;
  duration: number;
  startTime: number;
}

/**
 * Dialogue Display Manager
 * 
 * Manages on-screen display of dialogue using Phaser text objects.
 */
export class DialogueDisplayManager {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private background: Phaser.GameObjects.Rectangle | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;
  private dialogueText: Phaser.GameObjects.Text | null = null;
  private queue: DialogueEntry[] = [];
  private currentDialogue: DialogueEntry | null = null;
  private defaultDuration: number = 3000; // 3 seconds

  /**
   * Create a new DialogueDisplayManager
   * 
   * @param scene - Phaser scene to add dialogue to
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  /**
   * Create UI elements for dialogue display
   */
  private createUI(): void {
    // Create container for dialogue UI
    this.container = this.scene.add.container(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.height - 120
    );
    this.container.setDepth(1000); // Ensure it's on top

    // Background
    this.background = this.scene.add.rectangle(0, 0, 600, 80, 0x000000, 0.8);
    this.background.setStrokeStyle(2, 0xffffff, 1);
    this.container.add(this.background);

    // Character name
    this.nameText = this.scene.add.text(-280, -30, '', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffff00',
      fontStyle: 'bold',
    });
    this.container.add(this.nameText);

    // Dialogue text
    this.dialogueText = this.scene.add.text(-280, -5, '', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
      wordWrap: { width: 550 },
    });
    this.container.add(this.dialogueText);

    // Initially hide the container
    this.container.setAlpha(0);
  }

  /**
   * Show a dialogue line
   * 
   * @param characterName - Name of the character speaking
   * @param text - Dialogue text
   * @param duration - How long to display (milliseconds), defaults to 3000ms
   */
  public showDialogue(characterName: string, text: string, duration?: number): void {
    const entry: DialogueEntry = {
      characterName,
      text,
      duration: duration || this.defaultDuration,
      startTime: Date.now(),
    };

    // If nothing is currently showing, show immediately
    if (!this.currentDialogue && this.queue.length === 0) {
      this.displayDialogue(entry);
    } else {
      // Add to queue
      this.queue.push(entry);
    }
  }

  /**
   * Display a dialogue entry
   */
  private displayDialogue(entry: DialogueEntry): void {
    if (!this.container || !this.nameText || !this.dialogueText) {
      return;
    }

    this.currentDialogue = entry;

    // Update text
    this.nameText.setText(entry.characterName);
    this.dialogueText.setText(entry.text);

    // Fade in
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });
  }

  /**
   * Hide current dialogue
   */
  private hideDialogue(): void {
    if (!this.container) {
      return;
    }

    // Fade out
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.currentDialogue = null;
        
        // Show next in queue if available
        if (this.queue.length > 0) {
          const next = this.queue.shift()!;
          this.displayDialogue(next);
        }
      },
    });
  }

  /**
   * Update the dialogue display (call from scene update)
   * 
   * @param time - Current time
   * @param delta - Time since last frame
   */
  public update(time: number, delta: number): void {
    if (!this.currentDialogue) {
      return;
    }

    // Check if current dialogue has expired
    const elapsed = Date.now() - this.currentDialogue.startTime;
    if (elapsed >= this.currentDialogue.duration) {
      this.hideDialogue();
    }
  }

  /**
   * Clear all dialogue and queue
   */
  public clear(): void {
    this.queue = [];
    if (this.currentDialogue) {
      this.hideDialogue();
    }
  }

  /**
   * Destroy the dialogue display manager
   */
  public destroy(): void {
    this.clear();
    if (this.container) {
      this.container.destroy();
    }
  }

  /**
   * Get current queue length
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if dialogue is currently showing
   */
  public isShowing(): boolean {
    return this.currentDialogue !== null;
  }
}

export default DialogueDisplayManager;
