import Phaser from 'phaser';
import type { VendorState } from '@/managers/interfaces/VendorTypes';
import { BaseActorContainer } from './helpers/BaseActor';
import type { VendorPersonality, DialogueLine } from '@/types/personalities';
import type { DialogueManager } from '@/systems/DialogueManager';

/**
 * Vendor is a visual container composed of two rectangles:
 * - top: square (head), randomly colored like Fan heads
 * - bottom: taller rectangle (body) that is green to distinguish from fans
 * 
 * Supports movement state changes for visual feedback:
 * - idle: static appearance
 * - movingSegment: subtle animation during navigation
 * - serving: service animation
 * - distracted: shake/confusion effect
 */
export class Vendor extends BaseActorContainer {
  private top: Phaser.GameObjects.Rectangle;
  private bottom: Phaser.GameObjects.Rectangle;
  private currentState: VendorState;
  private stateAnimation?: Phaser.Time.TimerEvent;
    private personality: VendorPersonality | null;
  private dialogueManager: DialogueManager | null;
  private vendorId: string;

  constructor(scene: Phaser.Scene, x: number, y: number,
    personality?: VendorPersonality,
    dialogueManager?: DialogueManager
  ) {
    super(scene, x, y, 'vendor', false); // disabled by default

    // Body: green rectangle (20x30 pixels)
    this.bottom = scene.add.rectangle(0, 0, 20, 30, 0x00aa00).setOrigin(0.5, 0.5);

    // Head: randomized square (reuse Fan color logic)
    const headColor = Vendor.randomHeadColor();
    this.top = scene.add.rectangle(0, -20, 18, 18, headColor).setOrigin(0.5, 0.5);

    this.add([this.bottom, this.top]);
    this.currentState = 'idle';
    this.logger.debug(`Spawned at (${x}, ${y})`);

    this.personality = personality || null;
    this.dialogueManager = dialogueManager || null;
    this.vendorId = personality ? personality.id : 'unknown';

    // Apply visual customization if personality is provided
    if (this.personality) {
      this.applyVisualCustomization();
    }

    // Note: Don't call scene.add.existing here - let the caller decide
  }

  

  /**
   * Apply visual customization based on personality
   */
  private applyVisualCustomization(): void {
    if (!this.personality) return;

    // Apply color tint from personality palette
    if (this.personality.appearance.colorPalette.length > 0) {
      const primaryColor = this.personality.appearance.colorPalette[0];
      // this.bottom.setTint(parseInt(primaryColor.replace('#', '0x')));
    }

    // Apply scale from personality
    // this.setScale(this.personality.appearance.scale);
  }

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
   * Cleanup on destroy
   */
  public getVendorId(): string {
    return this.vendorId;
  }

  /**
   * Update vendor visual state based on state machine
   * @param state Current vendor state
   */
  public setMovementState(state: VendorState): void {
    // Stop any existing animation
    if (this.stateAnimation) {
      this.stateAnimation.remove(false);
      this.stateAnimation = undefined;
    }

    const prevState = this.currentState;
    this.currentState = state;
    if (prevState !== state) {
      this.logger.debug(`State: ${prevState} → ${state}`);
    }

    switch (state) {
      case 'idle':
        // Reset to neutral appearance
        this.bottom.setFillStyle(0x00aa00);
        this.rotation = 0;
        break;

        case 'movingToFan':
      case 'movingToSection':
        // Subtle bob animation while moving
        this.startBobAnimation();
        break;

      case 'serving':
        // Brighten body color during service
        this.bottom.setFillStyle(0x00ff00);
        this.startServiceAnimation();
        break;

      case 'distracted':
        // Shake effect
        this.startShakeAnimation();
        break;

      case 'cooldown':
        // Dimmed appearance
        this.bottom.setFillStyle(0x008800);
        break;

      case 'rangedCharging':
        // Neutral for now
        this.bottom.setFillStyle(0x00aa00);
        break;
    }
  }

  /**
   * Subtle bob animation during movement
   */
  private startBobAnimation(): void {
    const bobCycle = () => {
      this.scene.tweens.add({
        targets: this,
        y: this.y - 3,
        duration: 200,
        ease: 'Sine.easeInOut',
        yoyo: true,
        onComplete: () => {
          if (this.currentState === 'movingToSection' || this.currentState === 'movingToFan') {
            bobCycle();
          }
        },
      });
    };
    bobCycle();
  }

  /**
   * Service animation (slight scale pulse)
   */
  private startServiceAnimation(): void {
    this.scene.tweens.add({
      targets: this.bottom,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 2,
    });
  }

  /**
   * Shake animation for distraction
   */
  private startShakeAnimation(): void {
    const shake = () => {
      const angle = (Math.random() - 0.5) * 0.3; // radians
      this.scene.tweens.add({
        targets: this,
        rotation: angle,
        duration: 80,
        ease: 'Sine.easeInOut',
        yoyo: true,
        onComplete: () => {
          if (this.currentState === 'distracted') {
            shake();
          } else {
            this.rotation = 0;
          }
        },
      });
    };
    shake();
  }

  /**
   * Play tumble animation when vendor gets splatted by wave
   * Rotate 720° + 90° over 3s, fall to ground with bounce landing
   * @param targetX Target X coordinate (ground cell center)
   * @param targetY Target Y coordinate (ground row)
   */
  public playTumbleAnimation(targetX: number, targetY: number): Promise<void> {
    return new Promise((resolve) => {
      const originalRotation = this.rotation;
      const originalScale = this.scale;
      const totalDuration = 3000; // 3 second total fall
      const startX = this.x;
      const startY = this.y;
      
      console.log(`[Vendor.playTumbleAnimation] Starting animation from (${startX}, ${startY}) to (${targetX}, ${targetY})`);
      
      // Rotate 720° + 90° (2.5 full rotations, ending prone) over 3s
      this.scene.tweens.add({
        targets: this,
        rotation: originalRotation + Math.PI * 4 + Math.PI / 2, // 720° + 90°
        duration: totalDuration,
        ease: 'Cubic.easeOut',
      });
      
      // Scale bounce: 1.0 → 0.8 → 1.2 → 1.0 over 3s
      this.scene.tweens.add({
        targets: this,
        scale: originalScale * 0.8,
        duration: totalDuration * 0.25, // 750ms
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: this,
            scale: originalScale * 1.2,
            duration: totalDuration * 0.25, // 750ms
            ease: 'Sine.easeInOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: this,
                scale: originalScale,
                duration: totalDuration * 0.5, // 1500ms
                ease: 'Sine.easeInOut',
              });
            },
          });
        },
      });
      
      // Fall to ground position over 3s with bounce at end
      // Use a custom object to tween and manually update position each frame
      const easeObj = { progress: 0 };
      this.scene.tweens.add({
        targets: easeObj,
        progress: 1,
        duration: totalDuration,
        ease: 'Bounce.easeOut',
        onUpdate: (tween) => {
          // Calculate interpolated Y position based on ease
          const t = tween.progress;
          const newY = startY + (targetY - startY) * t;
          // Use setPosition to ensure display is updated
          this.setPosition(startX, newY);
          
          if (Math.random() < 0.05) {
            console.log(`[Vendor.playTumbleAnimation] onUpdate t=${t.toFixed(2)}, y=${this.y.toFixed(1)}`);
          }
        },
        onComplete: () => {
          // Ensure we're at exact final position
          console.log(`[Vendor.playTumbleAnimation] Animation complete, final position (${targetX}, ${targetY})`);
          this.setPosition(targetX, targetY);
          resolve();
        }
      });
    });
  }

  /**
   * Recover from splat - rotate back to standing position
   */
  public recoverFromSplat(): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: this,
        rotation: 0,
        duration: 500,
        ease: 'Back.easeOut',
        onComplete: () => resolve()
      });
    });
  }

  /**
   * Random head color (pale yellow to medium brown, same as Fan)
   */
  private static randomHeadColor(): number {
    const a = 0xfff5b1; // pale yellow
    const b = 0xa67c52; // medium brown
    const t = Math.random();
    return Vendor.lerpColor(a, b, t);
  }

  /**
   * Linear interpolation between two hex colors
   */
  private static lerpColor(a: number, b: number, t: number): number {
    t = Phaser.Math.Clamp(t, 0, 1);
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return (rr << 16) + (rg << 8) + rb;
  }

  /**
   * Cleanup on destroy
   */
  public destroy(fromScene?: boolean): void {
    if (this.stateAnimation) {
      this.stateAnimation.remove(false);
    }
    super.destroy(fromScene);
  }
}
