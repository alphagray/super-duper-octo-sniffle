import Phaser from 'phaser';
import type { MascotPersonality, MascotAbility, AbilityEffect } from '@/types/personalities';
import type { DialogueManager } from '@/systems/DialogueManager';
import { BaseActorSprite } from './helpers/BaseActor';


export class Mascot extends BaseActorSprite {
  private cooldown: number;
  private isActive: boolean;
  private personality: MascotPersonality | null;
  private dialogueManager: DialogueManager | null;
  private mascotId: string;
  private activeAbility: MascotAbility | null;
  private abilityTimer: number;
  private currentContext: MascotContext;

  constructor(scene: Phaser.Scene, x: number, y: number,
        personality?: MascotPersonality,
    dialogueManager?: DialogueManager
  ) {
    super(scene, x, y, 'mascot'); // 'mascot' sprite key to be loaded
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.cooldown = 0;
    this.isActive = false;
    this.personality = personality || null;
    this.dialogueManager = dialogueManager || null;
    this.mascotId = personality?.id || `mascot-${Math.random().toString(36).substr(2, 9)}`;
    this.activeAbility = null;
    this.abilityTimer = 0;
    this.currentContext = 'entrance';

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
   * Trigger dialogue for a specific mascot context
   */
  public triggerDialogue(
    context: MascotContext,
    gameContext: {
      score: number;
      waveState: 'active' | 'inactive' | 'countdown';
      aggregateStats?: {
        happiness: number;
        thirst: number;
        attention: number;
      };
    }
  ): string | null {
    if (!this.personality || !this.dialogueManager) {
      return null;
    }

    this.currentContext = context;

    // Map mascot contexts to game events
    const eventMap: Record<MascotContext, 'mascotActivate' | 'waveComplete' | 'sectionSuccess' | 'sectionFail'> = {
      entrance: 'mascotActivate',
      hyping: 'mascotActivate',
      dancing: 'waveComplete',
      disappointed: 'sectionFail',
      ultimate: 'mascotActivate',
      exit: 'mascotActivate',
    };

    const dialogueLine = this.dialogueManager.selectDialogue(
      this.mascotId,
      this.personality.dialogue,
      {
        event: eventMap[context],
        ...gameContext,
      }
    );

    return dialogueLine?.text || null;
  }

  /**
   * Activate mascot ability by index
   */
  public activateAbility(abilityIndex: number = 0): boolean {
    if (!this.personality || this.cooldown > 0 || this.isActive) {
      return false;
    }

    const ability = this.personality.abilities[abilityIndex];
    if (!ability) {
      return false;
    }

    // Activate the ability
    this.isActive = true;
    this.activeAbility = ability;
    this.cooldown = ability.cooldown;
    this.abilityTimer = ability.duration;
    this.currentContext = 'ultimate';

    return true;
  }

  /**
   * Get active ability effects
   */
  public getActiveEffects(): AbilityEffect[] {
    if (!this.isActive || !this.activeAbility) {
      return [];
    }
    return this.activeAbility.effects;
  }

  /**
   * Get available abilities
   */
  public getAbilities(): MascotAbility[] {
    if (!this.personality) {
      return [];
    }
    return this.personality.abilities;
  }

  /**
   * Get mascot's personality
   */
  public getPersonality(): MascotPersonality | null {
    return this.personality;
  }

  /**
   * Get mascot's unique ID
   */
  public getMascotId(): string {
    return this.mascotId;
  }

  /**
   * Get current context
   */
  public getCurrentContext(): MascotContext {
    return this.currentContext;
  }

  /**
   * Set current context
   */
  public setContext(context: MascotContext): void {
    this.currentContext = context;
  }

  public activate(): void {
    // TODO: Implement mascot activation logic
    // Trigger special ability
    if (this.cooldown <= 0) {
      this.activateAbility(0); // Activate first ability by default
    }
  }

  public update(delta: number): void {
    // Update cooldown timer
    if (this.cooldown > 0) {
      this.cooldown -= delta;
    }

    // Update ability timer
    if (this.isActive && this.abilityTimer > 0) {
      this.abilityTimer -= delta;
      
      if (this.abilityTimer <= 0) {
        // Ability expired
        this.isActive = false;
        this.activeAbility = null;
      }
    }
  }

  public getBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }
}
