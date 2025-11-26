import Phaser from 'phaser';
import type { MascotPersonality } from '@/types/personalities';
import { BaseActorSprite } from './helpers/BaseActor';

// Visual-only contexts (logic lives in MascotBehavior)
export type MascotVisualContext = 'entrance' | 'hyping' | 'ability' | 'ultimate' | 'exit';

/**
 * Refactored Mascot sprite: visual presentation only.
 * All game logic (timers, targeting, stat changes, analytics) moved to MascotActor + MascotBehavior.
 */
export class Mascot extends BaseActorSprite {
  private personality: MascotPersonality | null;
  private currentContext: MascotVisualContext = 'entrance';

  constructor(scene: Phaser.Scene, x: number, y: number, personality?: MascotPersonality) {
    super(scene, x, y, 'mascot', 'mascot');
    scene.add.existing(this);
    this.personality = personality || null;
    this.applyPersonalityVisuals();
  }

  /** Apply personality-driven static visuals (tint, scale) */
  public applyPersonalityVisuals(): void {
    if (!this.personality) return;
    if (this.personality.appearance.colorPalette.length > 0) {
      const primaryColor = this.personality.appearance.colorPalette[0];
      this.setTint(parseInt(primaryColor.replace('#', '0x')));
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
    const original = (this as any).tintTopLeft;
    this.setTint(color);
    this.scene.time.delayedCall(duration, () => this.setTint(original));
  }

  /** No logic update needed; behavior drives visuals via setter methods */
  public update(_delta: number): void {}
}
