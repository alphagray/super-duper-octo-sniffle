import Phaser from 'phaser';
import { gameBalance } from '@/config/gameBalance';
import { BaseActorContainer } from './helpers/BaseActor';

/**
 * Fan is a small container composed of two rectangles:
 * - top: square (head), randomly colored between pale yellow and medium brown
 * - bottom: taller rectangle (body) that is white by default and shifts orange/red
 *
 * The Fan supports:
 * - setIntensity(value) where value is 0..1 (driven by thirst/distracted)
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

  // Store original colors for tint restoration
  private topOriginalColor: number;
  private bottomOriginalColor: number = 0xffffff;
  private topDisinterestedColor!: number; // Pre-calculated in constructor (no default value)

  // Fan-level stats
  private happiness: number;
  private thirst: number;
  private attention: number;

  // Randomized thirst growth rate (environmental sensitivity)
  private thirstMultiplier: number;

  // Disinterested state tracking
  private isDisinterested: boolean = false;
  private lastDisinterestedCheck: number = 0;
  private savedBaseIntensity: number = 0; // Store original intensity when becoming disinterested
  private hasIntensitySaved: boolean = false; // Track whether intensity was saved

  // Grump/difficult terrain stats (foundation for future grump type)
  private disgruntlement: number = 0; // only grows for future grump type
  private disappointment: number = 0; // dynamic accumulator for unhappiness condition

  public _lastWaveParticipated: boolean = false;

  // Wave participation properties
  private waveStrengthModifier: number = 0;
  private attentionFreezeUntil: number = 0;
  private thirstFreezeUntil: number = 0;
  public reducedEffort: boolean = false;

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
    this.topOriginalColor = topColor;

    // Pre-calculate disinterested color for performance
    const tintColor = gameBalance.fanDisengagement.visualTint;
    const mixRatio = gameBalance.fanDisengagement.tintMixRatio;
    this.topDisinterestedColor = Fan.mixColors(topColor, tintColor, mixRatio);

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
    this.happiness = gameBalance.fanStats.initialHappiness;
    this.thirst = Math.random() * (gameBalance.fanStats.initialThirstMax - gameBalance.fanStats.initialThirstMin) + gameBalance.fanStats.initialThirstMin;
    this.attention = gameBalance.fanStats.initialAttention;
    
    // Randomize thirst growth rate: 0.5x to 1.5x (bell curve centered at 1.0)
    // Using normal distribution approximation with 3 random values
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const bellCurve = (r1 + r2 + r3) / 3; // Average of 3 randoms approximates normal distribution
    this.thirstMultiplier = 0.5 + bellCurve; // Maps 0-1 to 0.5-1.5
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
    // Only update baseIntensity if not currently disinterested (to preserve saved state)
    if (!this.isDisinterested) {
      this.baseIntensity = t;
    }
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

  // Mix two colors together with a given ratio
  private static mixColors(a: number, b: number, ratio: number): number {
    return Fan.lerpColor(a, b, ratio);
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

  public getThirstMultiplier(): number {
    return this.thirstMultiplier;
  }

  public getHappiness(): number {
    return this.happiness;
  }

  public getAttention(): number {
    return this.attention;
  }

  /**
   * Modify fan stats with automatic clamping to valid range (0-100)
   * @param stats - Object containing absolute values for stats to update
   * @example
   * fan.modifyStats({ attention: 75, happiness: 80 }); // Set attention to 75, happiness to 80
   * fan.modifyStats({ attention: fan.getAttention() + 10 }); // Increase attention by 10
   */
  public modifyStats(stats: {
    happiness?: number;
    thirst?: number;
    attention?: number;
  }): void {
    if (stats.happiness !== undefined) {
      this.happiness = Math.max(0, Math.min(100, stats.happiness));
    }
    if (stats.thirst !== undefined) {
      this.thirst = Math.max(0, Math.min(100, stats.thirst));
    }
    if (stats.attention !== undefined) {
      this.attention = Math.max(0, Math.min(100, stats.attention));
    }
  }

  /**
   * Check if this fan is in a disinterested state
   * Only checks every 500ms to avoid performance hit
   * @returns true if fan is disinterested (attention < 30 AND happiness < 40)
   */
  public checkDisinterestedState(): boolean {
    const now = this.scene.time.now;
    // Only check every 500ms to avoid performance hit
    if (now - this.lastDisinterestedCheck < gameBalance.fanDisengagement.stateCheckInterval) {
      return this.isDisinterested;
    }
    
    this.lastDisinterestedCheck = now;
    const wasDisinterested = this.isDisinterested;
    this.isDisinterested = (
      this.attention < gameBalance.fanDisengagement.attentionThreshold && 
      this.happiness < gameBalance.fanDisengagement.happinessThreshold
    );
    
    // Update visual if state changed
    if (wasDisinterested !== this.isDisinterested) {
      this.updateDisinterestedVisual();
    }
    
    return this.isDisinterested;
  }

  /**
   * Update visual appearance based on disinterested state
   */
  private updateDisinterestedVisual(): void {
    if (this.isDisinterested) {
      this.setAlpha(gameBalance.fanDisengagement.visualOpacity);
      // Apply pre-calculated gray tint to head
      if (this.top) {
        this.top.setFillStyle(this.topDisinterestedColor);
      }
      // For bottom, we'll let setIntensity handle the color and apply alpha
      // The reduced alpha combined with the gray-tinted top is sufficient visual feedback
      
      // Save original intensity and reduce jiggle
      // Always save, regardless of current value (including 0)
      if (!this.hasIntensitySaved) {
        // Stop jiggle first
        this.stopJiggleTimer();
        // Save BEFORE modifying
        this.savedBaseIntensity = this.baseIntensity;
        this.hasIntensitySaved = true;
        // Now reduce intensity
        this.baseIntensity = this.baseIntensity * gameBalance.fanDisengagement.jiggleReduction;
        if (this.baseIntensity > 0) {
          this.startJiggleTimer();
        }
      }
    } else {
      this.setAlpha(1.0);
      // Restore original head color
      if (this.top) {
        this.top.setFillStyle(this.topOriginalColor);
      }
      // Restore original jiggle intensity
      if (this.hasIntensitySaved) {
        this.stopJiggleTimer();
        this.baseIntensity = this.savedBaseIntensity;
        this.hasIntensitySaved = false;
        if (this.baseIntensity > 0) {
          this.startJiggleTimer();
        }
      }
      // Resume normal intensity-based coloring for body
      // Call without parameters to recalculate based on current thirst
      // (not saved intensity, since thirst may have changed while disinterested)
      this.setIntensity();
    }
  }

  /**
   * Get disinterested state
   * @returns true if fan is currently disinterested
   */
  public getIsDisinterested(): boolean {
    return this.isDisinterested;
  }

  /**
   * Vendor serves this fan a drink
   */
  public drinkServed(): void {
    this.thirst = 0;
    this.happiness = Math.min(100, this.happiness + 15);
    // Freeze thirst growth for a short duration
    this.thirstFreezeUntil = this.scene.time.now + gameBalance.fanStats.thirstFreezeDuration;
  }

  /**
   * Fan successfully participates in a wave
   * Resets attention and freezes attention decay temporarily
   * Also resets reducedEffort flag to clean up peer-pressure state
   */
  public onWaveParticipation(success: boolean): void {
    if (success) {
      this.attention = 100;
      this.attentionFreezeUntil = this.scene.time.now + gameBalance.fanStats.attentionFreezeDuration;
      // Reset reduced effort flag after wave participation
      this.reducedEffort = false;
    }
  }

  /**
   * Update fan stats over time
   */
  public updateStats(deltaTime: number, environmentalModifier: number = 1.0): void {
    // Convert ms to seconds for easier rate calculations
    const deltaSeconds = deltaTime / 1000;

    // Attention freeze logic
    if (this.attentionFreezeUntil && this.scene.time.now < this.attentionFreezeUntil) {
      // Do not decrease attention while frozen
    } else {
      // Attention decays slightly over time (configurable)
      this.attention = Math.max(
        gameBalance.fanStats.attentionMinimum,
        this.attention - deltaSeconds * gameBalance.fanStats.attentionDecayRate
      );
    }

    // Thirst freeze logic (separate timer from attention freeze)
    if (this.thirstFreezeUntil && this.scene.time.now < this.thirstFreezeUntil) {
      // Do not increase thirst while frozen
    } else {
      // Fans get thirstier over time (configurable, with per-fan multiplier and environmental modifier)
      // environmentalModifier: < 1.0 = shade/cool, 1.0 = normal, > 1.0 = hot/sunny
      const totalMultiplier = this.thirstMultiplier * environmentalModifier;
      this.thirst = Math.min(100, this.thirst + deltaSeconds * gameBalance.fanStats.thirstGrowthRate * totalMultiplier);
    }

    // Thirsty fans get less happy (configurable rate)
    if (this.thirst > 50) {
      this.happiness = Math.max(0, this.happiness - deltaSeconds * gameBalance.fanStats.happinessDecayRate);
    }

    // Disappointment accumulation (future grump-only feature)
    // Only accumulates when thirst > 50 AND happiness is actively decaying
    // Currently disabled via grumpConfig.disappointmentGrowthRate = 0
    if (this.thirst > 50 && this.happiness < gameBalance.grumpConfig.unhappyThreshold) {
      this.disappointment = Math.min(
        100,
        this.disappointment + deltaSeconds * gameBalance.grumpConfig.disappointmentGrowthRate
      );
    } else {
      // Gradually reduce disappointment when conditions improve
      this.disappointment = Math.max(0, this.disappointment - deltaSeconds * 0.5);
    }
  }

  /**
   * Calculate this fan's chance to participate in the wave
   * @param sectionBonus - Bonus from section aggregate stats
   * @returns Success chance as percentage (0-100)
   */
  public calculateWaveChance(sectionBonus: number): number {
    // Base chance from personal stats
    // Happiness and attention help, thirst hurts
    const baseChance =
      this.happiness * gameBalance.fanStats.waveChanceHappinessWeight +
      this.attention * gameBalance.fanStats.waveChanceAttentionWeight -
      this.thirst * gameBalance.fanStats.waveChanceThirstPenalty;

    // Apply section bonus and wave strength modifier
    let totalChance = baseChance + sectionBonus + this.waveStrengthModifier;

    // Flat bonus to make success more likely
    totalChance += gameBalance.fanStats.waveChanceFlatBonus;

    return Math.max(0, Math.min(100, totalChance));
  }

  /**
   * Set the wave strength modifier (applied to participation chance)
   * @param modifier - The modifier value
   */
  public setWaveStrengthModifier(modifier: number): void {
    this.waveStrengthModifier = modifier;
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

  // === Grump/Difficult Terrain Methods (Foundation) ===

  /**
   * Check if this fan qualifies as difficult terrain for vendor pathfinding
   * Based on happiness threshold or disappointment threshold
   * @returns true if fan is difficult terrain, false otherwise
   */
  public isDifficultTerrain(): boolean {
    return (
      this.happiness < gameBalance.grumpConfig.unhappyThreshold ||
      this.disappointment > gameBalance.grumpConfig.disappointmentThreshold
    );
  }

  /**
   * Get the terrain penalty multiplier for this fan
   * Used by vendor pathfinding to calculate movement penalties
   * @returns Penalty multiplier (1.0 for normal, higher for difficult terrain)
   */
  public getTerrainPenaltyMultiplier(): number {
    if (this.isDifficultTerrain()) {
      return gameBalance.vendorMovement.grumpPenaltyMultiplier;
    }
    return 1.0;
  }

  /**
   * Get disgruntlement level (future grump-only stat)
   * @returns Current disgruntlement value
   */
  public getDisgruntlement(): number {
    return this.disgruntlement;
  }

  /**
   * Get disappointment level (dynamic unhappiness accumulator)
   * @returns Current disappointment value
   */
  public getDisappointment(): number {
    return this.disappointment;
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
