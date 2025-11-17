import Phaser from 'phaser';
import type { VendorState } from '@/managers/interfaces/VendorTypes';
import { BaseActorContainer } from './helpers/BaseActor';

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

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'vendor', false); // disabled by default

    // Body: green rectangle (20x30 pixels)
    this.bottom = scene.add.rectangle(0, 0, 20, 30, 0x00aa00).setOrigin(0.5, 0.5);

    // Head: randomized square (reuse Fan color logic)
    const headColor = Vendor.randomHeadColor();
    this.top = scene.add.rectangle(0, -20, 18, 18, headColor).setOrigin(0.5, 0.5);

    this.add([this.bottom, this.top]);
    this.currentState = 'idle';
    this.logger.debug(`Spawned at (${x}, ${y})`);

    // Note: Don't call scene.add.existing here - let the caller decide
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

      case 'movingSegment':
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

      case 'planning':
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
          if (this.currentState === 'movingSegment') {
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
