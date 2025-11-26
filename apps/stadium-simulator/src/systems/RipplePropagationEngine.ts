// Simplified ACTOR-BASED stub for RipplePropagationEngine.
// Legacy grid traversal & Manhattan distance logic removed.
// Will be reimplemented using SectionActor seat graph + FanActor stats.
import type { SectionActor } from '@/actors/SectionActor';
import type { FanActor } from '@/actors/FanActor';
import { gameBalance } from '@/config/gameBalance';

export interface RippleConfig { baseEffect: number; disinterestedBonus: number; }
export interface RippleEffect { epicenterFanId: string; affected: Map<string, number>; }

export class RipplePropagationEngine {
  private config: RippleConfig;
  constructor(config?: Partial<RippleConfig>) {
    this.config = {
      baseEffect: config?.baseEffect ?? gameBalance.ripplePropagation.baseEffect,
      disinterestedBonus: config?.disinterestedBonus ?? gameBalance.ripplePropagation.disinterestedBonus
    };
  }

  /**
   * Calculate ripple using Manhattan distance with configurable decay.
   * - Includes disinterested bonus per target
   * - Respects maxRadius from game balance
   */
  public calculateRipple(epicenter: FanActor, section: SectionActor): RippleEffect {
    const affected = new Map<string, number>();
    const epiPos = epicenter.getGridPosition();
    const maxR = gameBalance.ripplePropagation.maxRadius;
    const decayType = gameBalance.ripplePropagation.decayType;
    const expBase = gameBalance.ripplePropagation.expDecayBase ?? 0.6;

    for (const fan of section.getFanActors()) {
      if (fan.id === epicenter.id) continue;
      const pos = fan.getGridPosition();
      const d = Math.abs(pos.row - epiPos.row) + Math.abs(pos.col - epiPos.col);
      if (d <= 0 || d > maxR) continue;

      let effect = 0;
      if (decayType === 'linear') {
        effect = this.config.baseEffect * (1 - d / maxR);
      } else {
        // exponential
        effect = this.config.baseEffect * Math.pow(expBase, d);
      }
      if (fan.getIsDisinterested()) effect += this.config.disinterestedBonus;
      if (effect > 0.01) affected.set(fan.id, effect);
    }
    return { epicenterFanId: epicenter.id, affected };
  }

  public applyRipple(ripple: RippleEffect, section: SectionActor): void {
    for (const fan of section.getFanActors()) {
      const boost = ripple.affected.get(fan.id);
      if (!boost) continue;
      const current = fan.getAttention();
      fan.modifyStats({ attention: Math.min(100, current + boost) });
    }
  }

  public combineRipples(ripples: RippleEffect[]): Map<string, number> {
    const combined = new Map<string, number>();
    for (const r of ripples) {
      r.affected.forEach((v, id) => combined.set(id, (combined.get(id) || 0) + v));
    }
    return combined;
  }

  public applyCombinedRipples(combined: Map<string, number>, section: SectionActor): void {
    for (const fan of section.getFanActors()) {
      const boost = combined.get(fan.id);
      if (!boost) continue;
      const current = fan.getAttention();
      fan.modifyStats({ attention: Math.min(100, current + boost) });
    }
  }
}

export default RipplePropagationEngine;
