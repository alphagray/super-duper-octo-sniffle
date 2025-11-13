import Phaser from 'phaser';

/**
 * Fan is a small container composed of two rectangles:
 * - top: square (head), randomly colored between pale yellow and medium brown
 * - bottom: taller rectangle (body) that is white by default and shifts orange/red
 *
 * The Fan supports:
 * - setIntensity(value) where value is 0..1 (driven by thirst/distracted)
 * - jiggle when intensity > 0
 * - playWave(delay) to perform the quick up/down motion
 */
export class Fan extends Phaser.GameObjects.Container {
  private top: Phaser.GameObjects.Rectangle;
  private bottom: Phaser.GameObjects.Rectangle;
  private size: number;
  private jiggleTimer?: Phaser.Time.TimerEvent;
  private baseIntensity: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, size = 28) {
    // We'll shift the container origin so local (0,0) sits at the bottom extremity
    // of the fan's body. That makes rotating the container rotate around that point.
    super(scene, x, y);
    this.size = size;

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
  }

  public setIntensity(v: number) {
    // v: 0..1, determines both color shift and jiggle amplitude
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

  public playWave(delayMs = 0): Promise<void> {
    // Fast-in, ease-out wave: quick start upward, then gentle settle back
    // increase jump and make the up portion snappier so the motion is visible
    const up = -24;
    const originalY = this.y;
    return new Promise((resolve) => {
      // Up tween (fast-in)
      this.scene.tweens.add({
        targets: this,
        y: originalY + up,
        duration: 50,
        ease: 'Quad.easeIn',
        delay: delayMs,
        onComplete: () => {
          // Down tween (ease-out)
          this.scene.tweens.add({
            targets: this,
            y: originalY,
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => {
              resolve();
            }
          });
        },
      });
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
}
