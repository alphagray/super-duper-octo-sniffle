import Phaser from 'phaser';
import type { MascotPersonality } from '@/types/personalities';
import { BaseActorContainer } from './helpers/BaseActor';

// Visual-only contexts (logic lives in MascotBehavior)
export type MascotVisualContext = 'entrance' | 'hyping' | 'ability' | 'ultimate' | 'exit';

/**
 * Refactored Mascot sprite: visual presentation only.
 * All game logic (timers, targeting, stat changes, analytics) moved to MascotActor + MascotBehavior.
 * 
 * Mascot is composed of two circles:
 * - body: large circle (2x2 grid cells = 64px diameter), vibrant color
 * - head: smaller circle on top, contrasting color
 */
export class Mascot extends BaseActorContainer {
  private bodyCircle: Phaser.GameObjects.Ellipse;
  private headCircle: Phaser.GameObjects.Rectangle;
  private personality: MascotPersonality | null;
  private currentContext: MascotVisualContext = 'entrance';
  private originalBodyColor: number;
  private originalHeadColor: number;

  constructor(scene: Phaser.Scene, x: number, y: number, personality?: MascotPersonality) {
    super(scene, x, y, 'mascot', false); // disabled by default

    // Body: ellipse (1.75 cells wide x 1.5 cells tall = 56px x 48px)
    const bodyColor = 0x800000; // Maroon
    const headColor = 0xffaa00; // Orange-yellow gold
    
    // Position body so its bottom edge aligns with container bottom (y=0 is center, so body bottom is at y=24)
    this.bodyCircle = scene.add.ellipse(0, -24, 56, 48, bodyColor);
    this.bodyCircle.setStrokeStyle(3, headColor); // Stroke with head color
    this.originalBodyColor = bodyColor;

    // Head: square (24x24) tucked down closer to body
    // Body top is at y=-48, head tucked down 9px so center is at y=-51 (48 - 12 + 9)
    this.headCircle = scene.add.rectangle(0, -51, 24, 24, headColor);
    this.headCircle.setStrokeStyle(2, bodyColor); // Stroke with body color
    this.originalHeadColor = headColor;

    this.add([this.bodyCircle, this.headCircle]);
    this.personality = personality || null;
    this.applyPersonalityVisuals();

    // Note: Don't call scene.add.existing here - let the caller decide
  }

  /** Apply personality-driven static visuals (tint, scale) */
  public applyPersonalityVisuals(): void {
    if (!this.personality) return;
    if (this.personality.appearance.colorPalette.length > 0) {
      const primaryColor = this.personality.appearance.colorPalette[0];
      const color = parseInt(primaryColor.replace('#', '0x'));
      this.bodyCircle.setFillStyle(color);
      this.originalBodyColor = color;
    }
    this.setScale(this.personality.appearance.scale);
  }

  /** Update current visual context (used by behavior via actor) */
  public setContextVisual(ctx: MascotVisualContext): void {
    this.currentContext = ctx;
    switch (ctx) {
      case 'entrance':
        this.setAlpha(1);
        break;
      case 'hyping':
        this.flashTint(0xffff66, 120);
        break;
      case 'ability':
        this.flashTint(0x66ccff, 160);
        break;
      case 'ultimate':
        this.flashTint(0xff33aa, 220);
        this.scene.tweens.add({ targets: this, scale: this.scale * 1.15, yoyo: true, duration: 260 });
        break;
      case 'exit':
        this.setAlpha(0.5);
        break;
    }
  }

  /** Play generic ability visual pulse */
  public playAbilityEffect(phase: 'section' | 'global' | 'cluster', ultimate: boolean): void {
    const color = ultimate ? 0xff33aa : phase === 'section' ? 0x33ff99 : phase === 'global' ? 0x3399ff : 0xffcc33;
    this.flashTint(color, ultimate ? 240 : 140);
    this.scene.tweens.add({ targets: this, alpha: { from: 0.85, to: 1 }, duration: 200, yoyo: true });
  }

  /** Visual charge cue (e.g. t-shirt cannon) */
  public showCharge(duration: number = 1000): void {
    this.flashTint(0xffff00, duration);
    this.scene.tweens.add({ targets: this, scale: this.scale * 1.05, yoyo: true, duration: duration });
  }

  /** Visual firing cue (projectile launch) */
  public showFire(): void {
    this.flashTint(0xff6600, 160);
    this.scene.tweens.add({ targets: this, angle: { from: -6, to: 6 }, duration: 160, yoyo: true });
  }

  /** Helper to apply a quick tint flash */
  private flashTint(color: number, duration: number): void {
    this.bodyCircle.setFillStyle(color);
    this.scene.time.delayedCall(duration, () => {
      this.bodyCircle.setFillStyle(this.originalBodyColor);
    });
  }

  /** No logic update needed; behavior drives visuals via setter methods */
  public update(_delta: number): void {}
}
