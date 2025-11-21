import Phaser from 'phaser';
import { BaseActorContainer } from './helpers/BaseActor';

/**
 * Fan is a small container composed of two rectangles:
 * - top: square (head), randomly colored between pale yellow and medium brown
 * - bottom: taller rectangle (body) that is white by default and shifts orange/red
 *
 * ARCHITECTURE NOTE:
 * Fan sprite is responsible for visual rendering and animations ONLY.
 * Game logic should be handled by FanActor, but for backward compatibility,
 * this sprite temporarily contains stat getters/setters that will be migrated.
 *
 * Supports:
 * - setIntensity(value) where value is 0..1 (driven by thirst from FanActor)
 * - jiggle when intensity > 0
 * - playWave(delay, intensity) to perform the quick up/down motion with variable intensity
 */
export class Fan extends BaseActorContainer {
    private _originalX: number;
    private _originalY: number;
  private top: Phaser.GameObjects.Rectangle;
  private bottom: Phaser.GameObjects.Rectangle;
  private size: number;
  private jiggleTimer?: Phaser.Time.TimerEvent;
  private baseIntensity: number = 0;

  // TEMPORARY: These will be migrated to FanActor
  // Keeping for backward compatibility during refactor
  private _stats = { happiness: 50, thirst: 0, attention: 100 };
  private _thirstMultiplier: number = 1.0;
  public reducedEffort: boolean = false;
  public _lastWaveParticipated: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 28) {
    // We'll shift the container origin so local (0,0) sits at the bottom extremity
    // of the fan's body. That makes rotating the container rotate around that point.
    super(scene, x, y, 'fan', false); // disabled by default (massive noise with 100+ fans)
    this.size = size;
    this._originalX = x;
    this._originalY = y;

    // Bottom is taller than it is wide
    const bottomW = Math.round(size * 0.6);
    const bottomH = Math.round(size * 1.6);

    // Choose top color between pale yellow and medium brown
    const topColor = Fan.randomTopColor();

    // We'll position children so that the local origin (0,0) is at the bottom-most
    // point of the bottom rectangle. This makes container rotation pivot at that point.
    const bottomCenterY = -Math.round(bottomH / 2);
    const topBottomY = -bottomH - 2;

    // Pivot the head around its bottom edge so rotation looks natural
    this.top = scene.add.rectangle(0, topBottomY, size, size, topColor).setOrigin(0.5, 1);
    // bottom center is placed so that bottom's bottom extremity equals local y=0
    this.bottom = scene.add.rectangle(0, bottomCenterY, bottomW, bottomH, 0xffffff).setOrigin(0.5, 0.5);

    this.add([this.top, this.bottom]);
    scene.add.existing(this);

    // Initialize default stats (will be overridden by setters if needed)
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const bellCurve = (r1 + r2 + r3) / 3;
    this._thirstMultiplier = 0.5 + bellCurve;
  }

  // NOTE: All stat/gameplay logic removed. Sprite remains purely visual.

  public setIntensity(v: number) {
    // Intensity drives visual color change only
    const t = Phaser.Math.Clamp(v, 0, 1);

    // Bottom color: interpolate from white -> orange -> red
    const color = Fan.lerpColor(0xffffff, 0xff8c00, t <= 0.6 ? t / 0.6 : 1);
    // If beyond 0.6, shift further toward a deeper red
    const finalColor = t > 0.6 ? Fan.lerpColor(0xff8c00, 0xff3300, (t - 0.6) / 0.4) : color;
    this.bottom.setFillStyle(finalColor);

    // Jiggle when t > 0 (handled by intermittent timers that trigger short tweens)
    this.baseIntensity = t;
    if (t > 0) {
      this.startJiggleTimer();
    } else {
      this.stopJiggleTimer();
    }
  }
  private startJiggleTimer() {
    if (this.jiggleTimer) return;
    const schedule = () => {
      if (this.jiggleTimer) this.jiggleTimer.remove(false);
      const interval = 600 + Math.random() * 1400; // 600ms - 2000ms
      this.jiggleTimer = this.scene.time.addEvent({
        delay: interval,
        callback: () => {
          // small random amplitude based on baseIntensity
          const amp = 1 + this.baseIntensity * (4 + Math.random() * 4);
          const horizontal = Math.random() < 0.65; // prefer left-right

          if (horizontal) {
            const dx = (Math.random() * 2 - 1) * amp; // -amp..+amp
            this.scene.tweens.add({
              targets: this,
              x: this.x + dx,
              duration: 120,
              ease: 'Sine.easeInOut',
              yoyo: true,
            });
            // small tilt of head/body
            const angle = (Math.random() * 0.06 - 0.03) * this.baseIntensity; // radians
            this.scene.tweens.add({
              targets: [this.top, this.bottom],
              rotation: angle,
              duration: 120,
              ease: 'Sine.easeInOut',
              yoyo: true,
            });
          } else {
            const dy = (Math.random() * 2 - 1) * (amp * 0.6); // smaller vertical
            this.scene.tweens.add({
              targets: this,
              y: this.y + dy,
              duration: 120,
              ease: 'Sine.easeInOut',
              yoyo: true,
            });
            const angle = (Math.random() * 0.06 - 0.03) * this.baseIntensity;
            this.scene.tweens.add({
              targets: [this.top, this.bottom],
              rotation: angle,
              duration: 120,
              ease: 'Sine.easeInOut',
              yoyo: true,
            });
          }

          schedule();
        }
      });
    };
    schedule();
  }

  private stopJiggleTimer() {
    if (this.jiggleTimer) {
      this.jiggleTimer.remove(false);
      this.jiggleTimer = undefined;
    }
    if (this.bottom) this.bottom.y = -Math.round(this.bottom.height / 2);
    // reset rotations
    this.rotation = 0;
    if (this.top) this.top.rotation = 0;
    if (this.bottom) this.bottom.rotation = 0;
  }

  /** Briefly increase jiggle frequency/amplitude (e.g., after a successful wave) */
  public pokeJiggle(intensityBoost = 0.6, durationMs = 900) {
    const originalBase = this.baseIntensity;
    this.baseIntensity = Math.min(1, originalBase + intensityBoost);
    const amp = 2 + this.baseIntensity * 6;
    // rotate the entire fan about the container origin (bottom extremity)
    const maxDeg = 15;
    const targetDeg = (Math.random() * 2 - 1) * maxDeg * this.baseIntensity;
    const targetRad = Phaser.Math.DegToRad(targetDeg);

    // quick tilt to target, then spring back with Elastic ease for springiness
    // scale durations to make the poke slower/more pronounced (~3x)
    const upDur = 120 * 3;
    const backDur = 700 * 3;
    const headDur = 120 * 3;

    this.scene.tweens.add({
      targets: this,
      rotation: targetRad,
      duration: upDur,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          rotation: 0,
          duration: backDur,
          ease: 'Elastic.easeOut',
        });
      }
    });

    // also nudge the head/body rotation a little for extra flair
    const headTilt = targetRad * 0.35;
    this.scene.tweens.add({
      targets: [this.top, this.bottom],
      rotation: headTilt,
      duration: headDur,
      ease: 'Quad.easeOut',
      yoyo: true,
    });

    this.scene.time.delayedCall(durationMs * 3, () => {
      this.baseIntensity = originalBase;
    });
  }

  public playWave(
    delayMs = 0,
    intensity: number = 1.0,
    visualState: 'full' | 'sputter' | 'death' = 'full',
    waveStrength: number = 70
  ): Promise<void> {
    // Adjust intensity for reduced-effort fans based on wave strength
    // Higher wave strength brings reduced-effort fans closer to full intensity
    let adjustedIntensity = intensity;
    if (intensity < 1.0) {
      adjustedIntensity = intensity + (1.0 - intensity) * (waveStrength / 100);
    }

    // Scale wave height based on wave strength (80% at strength 20, 130% at strength 100)
    const strengthMultiplier = 0.8 + (waveStrength / 100) * 0.5;
    const jumpHeight = -50 * adjustedIntensity * strengthMultiplier;
    const originalY = this.y;

    // Determine animation timing and easing based on visual state
    let upDuration: number;
    let downDuration: number;
    let upEase: string;
    let downEase: string;

    switch (visualState) {
      case 'sputter':
        // 90% duration, less energetic easing
        upDuration = 108; // 120ms * 0.9
        downDuration = 270; // 300ms * 0.9
        upEase = 'Sine.easeInOut';
        downEase = 'Sine.easeInOut';
        break;
      case 'death':
        // 60% duration, lifeless linear motion
        upDuration = 72; // 120ms * 0.6
        downDuration = 180; // 300ms * 0.6
        upEase = 'Linear';
        downEase = 'Linear';
        break;
      case 'full':
      default:
        // Normal duration and easing
        upDuration = 120;
        downDuration = 300;
        upEase = 'Sine.easeOut';
        downEase = 'Cubic.easeOut';
        break;
    }

    return new Promise((resolve) => {
      // Kill any existing tweens on this fan to prevent conflicts
      this.scene.tweens.killTweensOf(this);
      
      // Store the original Y position to ensure we return to correct spot
      const targetY = originalY;
      
      // Up tween (gradual rise with peak behind leading edge)
      this.scene.tweens.add({
        targets: this,
        y: targetY + jumpHeight,
        duration: upDuration,
        ease: upEase,
        delay: delayMs,
        onComplete: () => {
          // Down tween (smooth return)
          this.scene.tweens.add({
            targets: this,
            y: targetY,
            duration: downDuration,
            ease: downEase,
            onComplete: () => {
              // Ensure we're exactly at the target position
              this.y = targetY;
              resolve();
            }
          });
        },
      });
    });
  }

  /**
   * Play a named animation on this fan
   * @param animationName - The name of the animation ('wave', 'celebrate', 'boo', etc.)
   * @param options - Optional parameters for the animation
   */
  public playAnimation(animationName: string, options?: Record<string, any>): Promise<void> | void {
    switch (animationName) {
      case 'wave':
        return this.playWave(
          options?.delayMs ?? 0,
          options?.intensity ?? 1.0,
          options?.visualState ?? 'full',
          options?.waveStrength ?? 70
        );
      
      case 'celebrate':
        return this.playCelebrate(options?.delayMs ?? 0);
      
      case 'grumpy':
        return this.playGrumpy(options?.delayMs ?? 0);
      
      case 'boo':
        // TODO: Implement boo animation
        return Promise.resolve();
      case 'reset':
        this.resetPositionAndTweens();
        return Promise.resolve();
      
      default:
        console.warn(`Unknown animation '${animationName}' for Fan`);
        return Promise.resolve();
    }
  }

  /**
   * Reset all tweens and return fan to original position (after wave/celebrate)
   */
  public resetPositionAndTweens(): void {
    // Don't kill tweens - let wave animations finish naturally
    // Instead, chain the settle animation after any existing tweens complete
    
    // Check if fan is currently tweening
    const activeTweens = this.scene.tweens.getTweensOf(this);
    
    if (activeTweens.length > 0) {
      // Wait for current tweens to finish, then apply settle
      const lastTween = activeTweens[activeTweens.length - 1];
      lastTween.once('complete', () => {
        this.applySettleAnimation();
      });
    } else {
      // No active tweens, apply settle immediately
      this.applySettleAnimation();
    }
  }

  /**
   * Apply the settle animation back to original position
   */
  private applySettleAnimation(): void {
    this.scene.tweens.add({
      targets: this,
      x: this._originalX,
      y: this._originalY,
      rotation: 0,
      duration: 600,
      ease: 'Elastic.easeOut',
    });
    
    // Reset head/body rotation smoothly
    if (this.top || this.bottom) {
      this.scene.tweens.add({
        targets: [this.top, this.bottom].filter(Boolean),
        rotation: 0,
        duration: 600,
        ease: 'Elastic.easeOut'
      });
    }
  }

  /**
   * Play celebration animation (quick hop and rotate)
   */
  private playCelebrate(delayMs: number = 0): Promise<void> {
    return new Promise((resolve) => {
      const originalY = this.y;
      const originalRotation = this.rotation;
      
      // Randomize bounce height and duration for organic feel
      const bounceHeight = 20 + Math.random() * 15; // 20-35 pixels
      const upDuration = 80 + Math.random() * 40; // 80-120ms
      const downDuration = 120 + Math.random() * 60; // 120-180ms
      const rotationAmount = (Math.random() - 0.5) * 0.4; // ±0.2 radians
      
      // Quick celebratory hop with slight rotation
      this.scene.tweens.add({
        targets: this,
        y: originalY - bounceHeight,
        rotation: originalRotation + rotationAmount,
        duration: upDuration,
        ease: 'Sine.easeOut',
        delay: delayMs,
        onComplete: () => {
          this.scene.tweens.add({
            targets: this,
            y: originalY,
            rotation: originalRotation,
            duration: downDuration,
            ease: 'Bounce.easeOut',
            onComplete: () => resolve()
          });
        }
      });
    });
  }

  /**
   * Play grumpy jitter animation (angry shake for non-participants)
   */
  private playGrumpy(delayMs: number = 0): Promise<void> {
    return new Promise((resolve) => {
      const originalX = this.x;
      const originalRotation = this.rotation;
      
      // Randomize jitter intensity and timing
      const jitterAmount = 2 + Math.random() * 3; // 2-5 pixels
      const jitterDuration = 40 + Math.random() * 20; // 40-60ms per jitter
      const jitterCount = 3 + Math.floor(Math.random() * 3); // 3-5 jitters
      const rotationJitter = (Math.random() - 0.5) * 0.15; // ±0.075 radians
      
      let jittersCompleted = 0;
      
      const doJitter = () => {
        if (jittersCompleted >= jitterCount) {
          // Return to original position
          this.scene.tweens.add({
            targets: this,
            x: originalX,
            rotation: originalRotation,
            duration: jitterDuration,
            ease: 'Sine.easeOut',
            onComplete: () => resolve()
          });
          return;
        }
        
        const direction = (jittersCompleted % 2 === 0) ? 1 : -1;
        this.scene.tweens.add({
          targets: this,
          x: originalX + (direction * jitterAmount),
          rotation: originalRotation + (direction * rotationJitter),
          duration: jitterDuration,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            jittersCompleted++;
            doJitter();
          }
        });
      };
      
      this.scene.time.delayedCall(delayMs, () => doJitter());
    });
  }

  // linear interpolation between two hex colors (0xrrggbb)
  private static lerpColor(a: number, b: number, t: number) {
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

  private static randomTopColor(): number {
    // pale yellow (#FFF5B1) -> medium brown (#A67C52)
    const a = 0xfff5b1;
    const b = 0xa67c52;
    const t = Math.random();
    return Fan.lerpColor(a, b, t);
  }

  /**
   * Cleanup resources when fan is destroyed
   */
  public override destroy(fromScene?: boolean): void {
    this.stopJiggleTimer();
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.killTweensOf(this.top);
    this.scene.tweens.killTweensOf(this.bottom);
    super.destroy(fromScene);
  }
}
