import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { RippleEffect } from '@/systems/RipplePropagationEngine';
import { gameBalance } from '@/config/gameBalance';

/**
 * Tracks mascot effectiveness and impact on wave participation
 * Provides metrics for balancing and player feedback
 */
export interface MascotImpactMetrics {
  // Activation stats
  activationCount: number;
  totalShotsFired: number;
  totalFansAffected: number;
  totalAttentionBoost: number;

  // Re-engagement stats
  disinterestedReEngaged: number;
  averageReEngagementBoost: number;

  // Wave participation stats
  waveParticipationBefore: number; // Percentage
  waveParticipationAfter: number; // Percentage
  participationImprovement: number; // Delta

  // Section-specific stats
  sectionId: string;
  timestamp: number;
}

/**
 * Per-shot impact record
 */
export interface ShotImpactRecord {
  shotNumber: number;
  timestamp: number;
  catcherCount: number;
  fansAffected: number;
  totalBoost: number;
  disinterestedHit: number;
  averageBoost: number;
}

export class MascotAnalytics {
  private metrics: MascotImpactMetrics;
  private shotRecords: ShotImpactRecord[] = [];
  private baselineParticipation: number = 0;

  constructor(sectionId: string) {
    this.metrics = {
      activationCount: 0,
      totalShotsFired: 0,
      totalFansAffected: 0,
      totalAttentionBoost: 0,
      disinterestedReEngaged: 0,
      averageReEngagementBoost: 0,
      waveParticipationBefore: 0,
      waveParticipationAfter: 0,
      participationImprovement: 0,
      sectionId,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if reporting is enabled
   */
  private shouldReport(): boolean {
    return gameBalance.mascotAnalytics?.reportingEnabled !== false;
  }

  /**
   * Record baseline wave participation before mascot activation
   */
  public recordBaseline(section: StadiumSection): void {
    this.baselineParticipation = this.calculateParticipationRate(section);
    this.metrics.waveParticipationBefore = this.baselineParticipation;

    if (this.shouldReport()) {
      console.log(
        `[MascotAnalytics] Baseline participation: ${this.baselineParticipation.toFixed(1)}%`
      );
    }
  }

  /**
   * Record mascot activation event
   */
  public recordActivation(): void {
    this.metrics.activationCount++;
    this.shotRecords = [];
  }

  /**
   * Record individual cannon shot impact
   */
  public recordCannonShot(shotNumber: number, ripples: RippleEffect[]): void {
    this.metrics.totalShotsFired++;

    // Aggregate shot statistics
    const uniqueFans = new Set<Fan>();
    let totalBoost = 0;
    let disinterestedHit = 0;

    ripples.forEach((ripple) => {
      ripple.affectedFans.forEach((boost, fan) => {
        uniqueFans.add(fan);
        totalBoost += boost;

        // Check if was disinterested and got re-engaged
        if (fan.getIsDisinterested()) {
          disinterestedHit++;

          // Project if this will re-engage them
          const currentAttention = fan.getAttention();
          const threshold = gameBalance.mascotAnalytics?.reEngagementAttentionThreshold ?? 30;
          if (currentAttention + boost >= threshold) {
            // Will exceed threshold
            this.metrics.disinterestedReEngaged++;
          }
        }
      });
    });

    const fansAffected = uniqueFans.size;
    const averageBoost = fansAffected > 0 ? totalBoost / fansAffected : 0;

    // Update cumulative metrics
    this.metrics.totalFansAffected += fansAffected;
    this.metrics.totalAttentionBoost += totalBoost;

    // Record shot details
    const record: ShotImpactRecord = {
      shotNumber,
      timestamp: Date.now(),
      catcherCount: ripples.length,
      fansAffected,
      totalBoost,
      disinterestedHit,
      averageBoost,
    };

    this.shotRecords.push(record);

    if (this.shouldReport()) {
      console.log(
        `[MascotAnalytics] Shot ${shotNumber}: ${fansAffected} fans affected, ` +
          `avg boost: ${averageBoost.toFixed(1)}, disinterested hit: ${disinterestedHit}`
      );
    }
  }

  /**
   * Calculate current wave participation rate for section
   */
  private calculateParticipationRate(section: StadiumSection): number {
    const fans = section.getFans();
    if (fans.length === 0) return 0;

    // Calculate how many fans would participate in a wave right now
    const threshold = gameBalance.mascotAnalytics?.participationThreshold ?? 50;
    const wouldParticipate = fans.filter((fan) => {
      const chance = fan.calculateWaveChance(0);
      return chance > threshold; // Threshold for "likely to participate"
    }).length;

    return (wouldParticipate / fans.length) * 100;
  }

  /**
   * Record post-mascot wave participation and calculate improvement
   */
  public recordPostMascotParticipation(section: StadiumSection): void {
    const currentParticipation = this.calculateParticipationRate(section);
    this.metrics.waveParticipationAfter = currentParticipation;
    this.metrics.participationImprovement =
      currentParticipation - this.metrics.waveParticipationBefore;

    // Calculate average boost per re-engaged fan (not all fans)
    if (this.metrics.disinterestedReEngaged > 0 && this.metrics.totalFansAffected > 0) {
      // Use total boost divided by fans affected as a proxy for re-engagement boost
      this.metrics.averageReEngagementBoost =
        this.metrics.totalAttentionBoost / this.metrics.totalFansAffected;
    }

    if (this.shouldReport()) {
      console.log(
        `[MascotAnalytics] Post-mascot participation: ${currentParticipation.toFixed(1)}% ` +
          `(${this.metrics.participationImprovement > 0 ? '+' : ''}${this.metrics.participationImprovement.toFixed(1)}%)`
      );
    }
  }

  /**
   * Get complete metrics report
   */
  public getMetrics(): MascotImpactMetrics {
    return { ...this.metrics };
  }

  /**
   * Get shot-by-shot breakdown
   */
  public getShotRecords(): ShotImpactRecord[] {
    return [...this.shotRecords];
  }

  /**
   * Calculate average boost per fan
   */
  private getAverageBoostPerFan(): number {
    return this.metrics.totalFansAffected > 0
      ? this.metrics.totalAttentionBoost / this.metrics.totalFansAffected
      : 0;
  }

  /**
   * Generate summary report
   */
  public generateReport(): string {
    const lines = [
      '=== Mascot Impact Report ===',
      `Section: ${this.metrics.sectionId}`,
      `Activations: ${this.metrics.activationCount}`,
      `Total Shots: ${this.metrics.totalShotsFired}`,
      '',
      '--- Fan Impact ---',
      `Fans Affected: ${this.metrics.totalFansAffected}`,
      `Total Attention Boost: ${this.metrics.totalAttentionBoost}`,
      `Avg Boost/Fan: ${this.getAverageBoostPerFan().toFixed(1)}`,
      `Disinterested Re-Engaged: ${this.metrics.disinterestedReEngaged}`,
      '',
      '--- Wave Participation ---',
      `Before: ${this.metrics.waveParticipationBefore.toFixed(1)}%`,
      `After: ${this.metrics.waveParticipationAfter.toFixed(1)}%`,
      `Improvement: ${this.metrics.participationImprovement > 0 ? '+' : ''}${this.metrics.participationImprovement.toFixed(1)}%`,
      '',
      '--- Shot Breakdown ---',
    ];

    this.shotRecords.forEach((record) => {
      lines.push(
        `Shot ${record.shotNumber}: ${record.fansAffected} fans, ` +
          `avg boost ${record.averageBoost.toFixed(1)}`
      );
    });

    lines.push('========================');

    return lines.join('\n');
  }

  /**
   * Reset all metrics for new analysis
   */
  public reset(): void {
    const sectionId = this.metrics.sectionId;
    this.metrics = {
      activationCount: 0,
      totalShotsFired: 0,
      totalFansAffected: 0,
      totalAttentionBoost: 0,
      disinterestedReEngaged: 0,
      averageReEngagementBoost: 0,
      waveParticipationBefore: 0,
      waveParticipationAfter: 0,
      participationImprovement: 0,
      sectionId,
      timestamp: Date.now(),
    };
    this.shotRecords = [];
  }
}
