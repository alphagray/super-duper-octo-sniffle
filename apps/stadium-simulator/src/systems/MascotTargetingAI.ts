// Simplified ACTOR-BASED stub for MascotTargetingAI.
// Legacy sprite & distance weighting logic removed.
// Will be reimplemented with proper spatial queries once path/grid finalized.
import { gameBalance } from '@/config/gameBalance';
import type { SectionActor } from '@/actors/SectionActor';
import type { FanActor } from '@/actors/FanActor';
import type { MascotActor } from '@/actors/MascotActor';

export class MascotTargetingAI {
  private targetedFanActorIds: Set<string> = new Set();

  /**
   * Select a set of fans for mascot interaction (t‑shirt catchers).
   * Strategy:
   * 1) Exclude previously targeted fans in this activation window
   * 2) Score by disinterested weight and normalized distance from mascot
   * 3) Pick top N fans by score
   */
  public selectCatchers(section: SectionActor, mascot: MascotActor): FanActor[] {
    const all = section.getFanActors();
    const available = all.filter(f => !this.targetedFanActorIds.has(f.id));
    if (available.length === 0) return [];

    const min = gameBalance.mascotCannon.minCatchersPerShot;
    const max = gameBalance.mascotCannon.maxCatchersPerShot;
    const disWeight = gameBalance.mascotCannon.disinterestedTargetingWeight;
    const distWeight = gameBalance.mascotCannon.distanceWeight;
    const targetCount = Math.min(available.length, Phaser.Math.Between(min, max));

    // Normalize distance by max possible Manhattan distance within section bounds
    const data = section.getSectionData();
    const maxManhattan = Math.max(1, (data.gridRight - data.gridLeft) + (data.gridBottom - data.gridTop));
    const mPos = mascot.getGridPosition();

    const scored = available.map(f => {
      const fPos = f.getGridPosition();
      const d = Math.abs(fPos.row - mPos.row) + Math.abs(fPos.col - mPos.col);
      const dNorm = Math.min(1, d / maxManhattan);
      let score = 1;
      if (f.getIsDisinterested()) score *= disWeight;
      // farther fans slightly prioritized to hype back rows if configured
      score *= 1 + distWeight * dNorm;
      return { f, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const selection = scored.slice(0, targetCount).map(s => s.f);

    for (const f of selection) this.targetedFanActorIds.add(f.id);
    return selection;
  }

  public reset(): void { this.targetedFanActorIds.clear(); }
  public getTargetedCount(): number { return this.targetedFanActorIds.size; }
  public hasBeenTargeted(fanActor: FanActor): boolean { return this.targetedFanActorIds.has(fanActor.id); }
}

export default MascotTargetingAI;
