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

  // Fan-level stats
  private happiness: number;
  private thirst: number;
  private attention: number;

  public _lastWaveParticipated: boolean = false;

  // Configurable rates (can be set from outside for environmental effects)
  public static thirstGrowthRate: number = 2; // points per second
  public static happinessDecayRate: number = 1.25; // points per second when thirsty
  public static thirstFreezeDuration: number = 4000; // ms

  private thirstFrozenUntil: number = 0;

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

    // Initialize stats with fixed values for more reliable participation
    this.happiness = 70;
    this.thirst = Math.random() * 30; // 0-30 range (start mostly satisfied)
    this.attention = 70;
  }

  public setIntensity(v?: number) {
    // If no value provided, use personal thirst as intensity
    const intensity = v !== undefined ? v : this.thirst / 100;
    const t = Phaser.Math.Clamp(intensity, 0, 1);

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
    // Fast, dramatic wave motion
    const up = -50;
    const originalY = this.y;
    return new Promise((resolve) => {
      // Up tween (fast)
      this.scene.tweens.add({
        targets: this,
        y: originalY + up,
        duration: 50, // faster up
        ease: 'Quad.easeIn',
        delay: delayMs,
        onComplete: () => {
          // Down tween (smooth return)
          this.scene.tweens.add({
            targets: this,
            y: originalY,
            duration: 300, // faster return
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

  // === Fan Stat Methods ===

  /**
   * Get all fan stats
   */
  public getStats(): { happiness: number; thirst: number; attention: number } {
    return {
      happiness: this.happiness,
      thirst: this.thirst,
      attention: this.attention
    };
  }

  /**
   * Get individual stat values
   */
  public getThirst(): number {
    return this.thirst;
  }

  public getHappiness(): number {
    return this.happiness;
  }

  public getAttention(): number {
    return this.attention;
  }

  /**
   * Vendor serves this fan a drink
   */
  public drinkServed(): void {
    this.thirst = 0;
    this.happiness = Math.min(100, this.happiness + 15);
    // Freeze thirst growth for a short duration
    this.thirstFrozenUntil = this.scene.time.now + Fan.thirstFreezeDuration;
  }

  /**
   * Update fan stats over time
   */
  public updateStats(deltaTime: number): void {
    // Convert ms to seconds for easier rate calculations
    const deltaSeconds = deltaTime / 1000;
    // Thirst freeze logic
    if (this.thirstFrozenUntil && this.scene.time.now < this.thirstFrozenUntil) {
      // Do not increase thirst while frozen
    } else {
      // Fans get thirstier over time (configurable)
      this.thirst = Math.min(100, this.thirst + deltaSeconds * Fan.thirstGrowthRate);
    }
    // Thirsty fans get less happy (configurable rate)
    if (this.thirst > 50) {
      this.happiness = Math.max(0, this.happiness - deltaSeconds * Fan.happinessDecayRate);
    }
    // Attention decays slightly over time (1.5 points per second)
    const attentionDecayRate = 1.5;
    this.attention = Math.max(30, this.attention - deltaSeconds * attentionDecayRate);
  }

  /**
   * Calculate this fan's chance to participate in the wave
   * @param sectionBonus - Bonus from section aggregate stats
   * @returns Success chance as percentage (0-100)
   */
  public calculateWaveChance(sectionBonus: number): number {
    // Base chance from personal stats
    // Happiness and attention help, thirst hurts
    const baseChance = (this.happiness * 0.5 + this.attention * 0.5) - (this.thirst * 0.3);

    // Apply section bonus (happier sections help individual fans participate)
    let totalChance = baseChance + sectionBonus;

    // Flat bonus to make success more likely
    totalChance += 10;

    return Math.max(0, Math.min(100, totalChance));
  }

  /**
   * Roll to see if this fan participates in the wave
   * @param sectionBonus - Bonus from section aggregate stats
   * @returns true if fan participates, false otherwise
   */
  public rollForWaveParticipation(sectionBonus: number): boolean {
    const chance = this.calculateWaveChance(sectionBonus);
    const result = Math.random() * 100 < chance;
    this._lastWaveParticipated = result;
    return result;
  }
}
