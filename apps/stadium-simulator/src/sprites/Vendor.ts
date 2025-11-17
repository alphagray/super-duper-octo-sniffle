import Phaser from 'phaser';
import type { VendorPersonality, DialogueLine } from '@/types/personalities';
import type { DialogueManager } from '@/systems/DialogueManager';

export class Vendor extends Phaser.GameObjects.Sprite {
  private cooldown: number;
  private isServing: boolean;
  private personality: VendorPersonality | null;
  private dialogueManager: DialogueManager | null;
  private vendorId: string;

  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number,
    personality?: VendorPersonality,
    dialogueManager?: DialogueManager
  ) {
    super(scene, x, y, 'vendor'); // 'vendor' sprite key to be loaded
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cooldown = 0;
    this.isServing = false;
    this.personality = personality || null;
    this.dialogueManager = dialogueManager || null;
    this.vendorId = personality?.id || `vendor-${Math.random().toString(36).substr(2, 9)}`;

    // Apply visual customization if personality is provided
    if (this.personality) {
      this.applyVisualCustomization();
    }

    // TODO: Add animation setup
  }

  /**
   * Apply visual customization based on personality
   */
  private applyVisualCustomization(): void {
    if (!this.personality) return;

    // Apply color tint from personality palette
    if (this.personality.appearance.colorPalette.length > 0) {
      const primaryColor = this.personality.appearance.colorPalette[0];
      this.setTint(parseInt(primaryColor.replace('#', '0x')));
    }

    // Apply scale from personality
    this.setScale(this.personality.appearance.scale);
  }

  /**
   * Get behavior-modified movement speed
   */
  public getMovementSpeed(): number {
    if (!this.personality) {
      return 100; // Default speed
    }
    return this.personality.movement.speed;
  }

  /**
   * Get pause duration at sections
   */
  public getPauseDuration(): number {
    if (!this.personality) {
      return 2000; // Default 2 seconds
    }
    return this.personality.movement.pauseDuration;
  }

  /**
   * Get section preference weight for a given section
   */
  public getSectionPreference(sectionId: string): number {
    if (!this.personality) {
      return 1.0; // Neutral preference
    }
    return this.personality.movement.sectionPreferences[sectionId] || 1.0;
  }

  /**
   * Check if vendor avoids active wave sections
   */
  public avoidsActiveWave(): boolean {
    if (!this.personality) {
      return false;
    }
    return this.personality.movement.avoidsActiveWave;
  }

  /**
   * Trigger dialogue for a specific context
   */
  public triggerDialogue(
    event: 'vendorServe' | 'waveComplete' | 'sectionSuccess' | 'sectionFail',
    gameContext: {
      score: number;
      waveState: 'active' | 'inactive' | 'countdown';
      sectionStats?: {
        happiness: number;
        thirst: number;
        attention: number;
      };
    }
  ): string | null {
    if (!this.personality || !this.dialogueManager) {
      return null;
    }

    const dialogueLine = this.dialogueManager.selectDialogue(
      this.vendorId,
      this.personality.dialogue,
      {
        event,
        ...gameContext,
      }
    );

    return dialogueLine?.text || null;
  }

  /**
   * Get vendor's personality
   */
  public getPersonality(): VendorPersonality | null {
    return this.personality;
  }

  /**
   * Get vendor's unique ID
   */
  public getVendorId(): string {
    return this.vendorId;
  }

  public serve(): void {
    // TODO: Implement serving logic
    if (this.cooldown <= 0) {
      this.isServing = true;
      this.cooldown = 60; // 1 second cooldown at 60 FPS
    }
  }

  public update(delta: number): void {
    // TODO: Update cooldown timer
    if (this.cooldown > 0) {
      this.cooldown -= delta;
    } else {
      this.isServing = false;
    }
  }

  public getBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }
}
