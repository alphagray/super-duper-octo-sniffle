import { gameBalance } from '@/config/gameBalance';
import type { AIActorBehavior } from '@/actors/interfaces/AIBehavior';
// Lightweight import types (avoid circular heavy deps)
// SectionActor shape used for attention aggregates & fan scanning
import type { SectionActor } from '@/actors/SectionActor';

// Mascot-specific behavior states (separate from vendor AIActorState to avoid overload)
export type MascotBehaviorState =
  | 'entrance'
  | 'hyping'
  | 'patrolling'
  | 'executingAbility'
  | 'ultimate'
  | 'exit';

export interface MascotBehaviorDebugState {
  state: MascotBehaviorState;
  cycleIndex: number;
  targetingPhase: 'section' | 'global' | 'cluster';
  lastUltimateAt: number;
  nextUltimateEtaMs: number;
  consecutiveWaveSuccesses: number;
  pendingAbility?: string;
}

/**
 * MascotBehavior: Drives mascot state machine, targeting cycle, and ultimate cadence.
 * Pure logic: no direct rendering; emits events via actor (attached later).
 */
export class MascotBehavior implements AIActorBehavior {
  // Reference to MascotActor will be injected after both are constructed
  private mascotActor: any; // MascotActor (typed as any until MascotActor file exists)
  private aiManager?: any; // AIManager reference injected for section access

  // State machine tracking
  private state: MascotBehaviorState = 'entrance';
  private cycleIndex: number = 0; // index into targetingCycle array
  private lastCycleAdvanceAt: number = 0;

  // Ultimate scheduling
  private lastUltimateAt: number = 0;
  private consecutiveWaveSuccesses: number = 0;
  private momentumEffectivenessFactor: number = 1.0; // reduced by diminishing returns after ultimate
  
  // Attention economy (Phase 4.2)
  private attentionBank: number = 0; // 0-100 range
  private ultimateReady: boolean = false; // true when attentionBank >= 30

  // Timers
  private abilityTimer: number = 0;
  private tickAccumulator: number = 0; // coarse tick scheduling

  // Cached config slices
  private readonly cycleOrder = gameBalance.mascotBehavior.targetingCycle;
  private readonly abilityEffects = gameBalance.mascotBehavior.abilityEffects;
  private readonly ultimateCfg = gameBalance.mascotUltimate;
  private readonly behaviorCfg = gameBalance.mascotBehavior;

  constructor(mascotActor?: any, aiManager?: any) {
    if (mascotActor) this.mascotActor = mascotActor;
    if (aiManager) this.aiManager = aiManager;
    this.lastUltimateAt = performance.now();
  }

  /** Inject MascotActor post-construction to resolve circular dependency */
  public attachActor(actor: any) { this.mascotActor = actor; }
  public attachAIManager(manager: any) { this.aiManager = manager; }

  /** Current targeting phase based on cycle index */
  private getTargetingPhase(): 'section' | 'global' | 'cluster' {
    return this.cycleOrder[this.cycleIndex % this.cycleOrder.length];
  }

  /** Advance targeting cycle and emit event */
  private advanceCycle(): void {
    this.cycleIndex = (this.cycleIndex + 1) % this.cycleOrder.length;
    this.lastCycleAdvanceAt = performance.now();
    this.emit('mascotTargetCycleAdvance', { cycleIndex: this.cycleIndex, phase: this.getTargetingPhase() });
  }

  /** Determine if ultimate should trigger (hybrid conditions) */
  private shouldTriggerUltimate(now: number): boolean {
    const elapsed = now - this.lastUltimateAt;
    // Forced interval trigger (always fires after max interval)
    if (elapsed >= this.ultimateCfg.maxIntervalMs) return true;
    // Momentum-based reduction with diminishing returns factor
    const rawMomentumReduction = Math.min(
      this.consecutiveWaveSuccesses * this.ultimateCfg.momentumStepPercent,
      this.ultimateCfg.momentumMaxPercent
    );
    const effectiveMomentumReduction = rawMomentumReduction * this.momentumEffectivenessFactor;
    const effectiveCooldown = Math.max(
      this.ultimateCfg.baseCooldownMs * (1 - effectiveMomentumReduction),
      this.ultimateCfg.minFloorMs
    );
    if (elapsed >= effectiveCooldown) return true;
    // Attention-based early trigger
    const avgAttention = this.getAverageAttentionEstimate();
    if (avgAttention < this.ultimateCfg.attentionTriggerThreshold) return true;
    return false;
  }

  /** Placeholder until GameStateManager integration; returns synthetic value */
  private getAverageAttentionEstimate(): number {
    // Option B: derive from SectionActors via AIManager
    if (!this.aiManager || !this.aiManager.getSectionActors) return 60;
    const sections: SectionActor[] = this.aiManager.getSectionActors();
    if (!sections || sections.length === 0) return 60;
    let total = 0;
    for (const s of sections) {
      const agg = s.getAggregateStats();
      total += agg.attention;
    }
    return total / sections.length;
  }

  /** Request assignment (not used for mascot; stub to satisfy interface) */
  public requestAssignment(targetCell: { row: number; col: number }): void {
    // Mascot does not use seat assignment; could repurpose for forced relocation later
  }

  /** Recall request (mascot exit flow) */
  public requestRecall(): void {
    if (this.state !== 'exit') {
      this.state = 'exit';
      this.emit('mascotExit', { timestamp: performance.now() });
    }
  }

  /** Handle arrival (unused until path movement added) */
  public onArrival(): void {
    // Future: perimeter movement arrival checkpoints
  }

  /** Handle serve complete (unused for mascot) */
  public onServeComplete(): void {
    // Not applicable; mascot abilities handled via timers
  }

  /** Public getter of current behavior state */
  public getState(): any {
    return this.state;
  }

  /** Get attention bank value (Phase 4.2) */
  public getAttentionBank(): number {
    return this.attentionBank;
  }

  /** Check if ultimate is ready (Phase 4.3) */
  public isUltimateReady(): boolean {
    return this.ultimateReady;
  }

  /** Drain attention bank to 0 (called on ultimate fire) */
  public drainAttentionBank(): void {
    this.attentionBank = 0;
    this.ultimateReady = false;
  }

  /** Add attention to bank (from fan drains) */
  public addAttention(amount: number): void {
    this.attentionBank = Math.min(100, this.attentionBank + amount);
    this.ultimateReady = this.attentionBank >= 30;
  }

  /** External trigger from wave success to update momentum */
  public onWaveSuccess(): void {
    this.consecutiveWaveSuccesses++;
    // Gradually restore momentum effectiveness on wave successes (recovery mechanism)
    this.momentumEffectivenessFactor = Math.min(
      1.0,
      this.momentumEffectivenessFactor + 0.05 // restore 5% per wave success
    );
    // Add +10 to attention bank on wave success (Phase 4.3)
    this.attentionBank = Math.min(100, this.attentionBank + 10);
    this.ultimateReady = this.attentionBank >= 30;
  }

  /** External trigger from wave failure to reset momentum */
  public onWaveFailure(): void {
    this.consecutiveWaveSuccesses = 0;
  }

  /** Begin ability execution for current phase */
  private startAbility(now: number): void {
    const phase = this.getTargetingPhase();
    this.state = phase === 'cluster' ? 'executingAbility' : 'hyping';
    const baseDuration = 2000;
    this.abilityTimer = baseDuration;
    this.emit('mascotAbilityStart', { phase, timestamp: now });
    // Resolve targets & emit granular effect payload
    this.applyPhaseEffects(phase, false);
  }

  /** Complete ability execution */
  private completeAbility(now: number): void {
    this.emit('mascotAbilityEnd', { timestamp: now });
    this.advanceCycle();
    this.state = 'patrolling';
  }

  /** Trigger ultimate flow */
  private startUltimate(now: number): void {
    this.state = 'ultimate';
    this.lastUltimateAt = now;
    this.emit('mascotUltimateStart', { timestamp: now });
    const phase = this.getTargetingPhase();
    this.applyPhaseEffects(phase, true);
    this.abilityTimer = 2500;
  }

  /** Complete ultimate */
  private completeUltimate(now: number): void {
    this.emit('mascotUltimateEnd', { timestamp: now });
    // Apply diminishing returns: reduce momentum effectiveness for next ultimate cycle
    this.momentumEffectivenessFactor = Math.max(
      0.25, // never reduce below 25% effectiveness
      this.momentumEffectivenessFactor * (1 - this.ultimateCfg.diminishingReturnFactor)
    );
    // Reset momentum chain after ultimate
    this.consecutiveWaveSuccesses = 0;
    // Drain attention bank to 0 (Phase 4.3)
    this.attentionBank = 0;
    this.ultimateReady = false;
    this.state = 'patrolling';
    this.advanceCycle();
  }

  /** Emit helper (defers if actor missing) */
  private emit(event: string, payload: any): void {
    if (this.mascotActor && this.mascotActor.emit) {
      this.mascotActor.emit(event, payload);
    }
  }

  /** 
   * Behavior tick called each frame 
   * @param deltaTime - Time elapsed in milliseconds
   * @param roundTime - Time relative to round start (negative = remaining, positive = elapsed)
   */
  public tick(deltaTime: number, roundTime: number): void {
    const now = performance.now();
    this.tickAccumulator += deltaTime;

    // Coarse logic tick
    if (this.tickAccumulator >= this.behaviorCfg.stateTickIntervalMs) {
      this.tickAccumulator = 0;

      // Ultimate scheduling check (not during exit)
      if (this.state !== 'exit' && this.state !== 'ultimate' && this.shouldTriggerUltimate(now)) {
        this.startUltimate(now);
      }

      // Ability lifecycle
      if (this.state === 'patrolling' && this.shouldStartAbility(now)) {
        this.startAbility(now);
      }
    }

    // Ability / ultimate timers count down continuously
    if ((this.state === 'executingAbility' || this.state === 'hyping' || this.state === 'ultimate') && this.abilityTimer > 0) {
      this.abilityTimer -= deltaTime;
      if (this.abilityTimer <= 0) {
        if (this.state === 'ultimate') {
          this.completeUltimate(now);
        } else {
          this.completeAbility(now);
        }
      }
    }
  }

  /** Determine if normal ability should start (config-driven cadence) */
  private shouldStartAbility(now: number): boolean {
    const sinceCycle = now - this.lastCycleAdvanceAt;
    return sinceCycle >= this.behaviorCfg.abilityBaseIntervalMs;
  }

  /**
   * Apply phase-specific stat effects by resolving targets.
   * Emits granular payload: { targets: FanActor[] | SectionActor[] | 'global', effect, ultimate }
   */
  private applyPhaseEffects(phase: 'section' | 'global' | 'cluster', ultimate: boolean): void {
    const multiplier = ultimate ? this.abilityEffects.ultimateMultiplier : 1;
    const base = this.abilityEffects[phase];
    const effect = {
      attention: Math.round(base.attention * multiplier),
      happiness: Math.round(base.happiness * multiplier)
    };
    const attentionDrain = this.abilityEffects.attentionDrain || 2;

    if (!this.aiManager || !this.aiManager.getSectionActors) {
      this.emit('mascotStatEffect', { phase, effect, ultimate, targets: 'global' });
      return;
    }

    const sections: SectionActor[] = this.aiManager.getSectionActors();
    if (sections.length === 0) {
      this.emit('mascotStatEffect', { phase, effect, ultimate, targets: 'global' });
      return;
    }

    if (phase === 'global') {
      // Global application to all fans
      let targetedFans: any[] = [];
      for (const s of sections) {
        targetedFans = targetedFans.concat(s.getFanActors());
      }
      this.applyStatsToFans(targetedFans, effect, attentionDrain);
      this.emit('mascotStatEffect', { phase, effect, ultimate, targets: 'global', fanCount: targetedFans.length });
      return;
    }

    if (phase === 'section') {
      // Choose lowest-attention section (tie-break rotate)
      let chosen: SectionActor | null = null;
      let lowestAttention = Infinity;
      for (const s of sections) {
        const att = s.getAggregateStats().attention;
        if (att < lowestAttention) {
          lowestAttention = att;
          chosen = s;
        }
      }
      if (!chosen) {
        this.emit('mascotStatEffect', { phase, effect, ultimate, targets: 'global' });
        return;
      }
      const fanActors = chosen.getFanActors();
      this.applyStatsToFans(fanActors, effect, attentionDrain);
      this.emit('mascotStatEffect', { phase, effect, ultimate, targets: [chosen], fanCount: fanActors.length });
      return;
    }

    // Cluster phase
    const targetCluster = this.findLowAttentionCluster(sections);
    if (targetCluster.length === 0) {
      // Fallback -> lowest attention section's fans
      let fallback: SectionActor | null = null;
      let lowest = Infinity;
      for (const s of sections) {
        const att = s.getAggregateStats().attention;
        if (att < lowest) { lowest = att; fallback = s; }
      }
      if (fallback) {
        const fanActors = fallback.getFanActors();
        this.applyStatsToFans(fanActors, effect, attentionDrain);
        this.emit('mascotStatEffect', { phase, effect, ultimate, targets: fanActors, fanCount: fanActors.length });
      } else {
        this.emit('mascotStatEffect', { phase, effect, ultimate, targets: 'global' });
      }
      return;
    }
    this.applyStatsToFans(targetCluster, effect, attentionDrain);
    this.emit('mascotStatEffect', { phase, effect, ultimate, targets: targetCluster, fanCount: targetCluster.length });
  }

  /** Apply stat effects to fans and drain attention to bank (Phase 4.1 & 4.2) */
  private applyStatsToFans(fanActors: any[], effect: { attention: number; happiness: number }, attentionDrain: number): void {
    for (const fanActor of fanActors) {
      if (fanActor && typeof fanActor.modifyStats === 'function') {
        // Apply stat boosts
        fanActor.modifyStats({ attention: effect.attention, happiness: effect.happiness });
        // Drain attention and add to bank
        fanActor.modifyStats({ attention: -attentionDrain });
        this.attentionBank = Math.min(100, this.attentionBank + attentionDrain);
      }
    }
    // Update ultimate ready flag
    this.ultimateReady = this.attentionBank >= 30;
  }

  /** Find a cluster of low-attention fans across sections */
  private findLowAttentionCluster(sections: SectionActor[]): any[] {
    const threshold = gameBalance.mascotBehavior.cluster.lowAttentionThreshold;
    const radius = gameBalance.mascotBehavior.cluster.scanRadius;
    const minSize = gameBalance.mascotBehavior.cluster.minClusterSize;
    // Collect all candidate fan actors below threshold
    const candidates: any[] = []; // FanActor[]
    for (const s of sections) {
      for (const fanActor of s.getFanActors()) {
        const stats = fanActor.getStats();
        if (stats.attention < threshold) candidates.push(fanActor);
      }
    }
    if (candidates.length < minSize) return [];
    // Simple clustering: pick seed with lowest attention; gather neighbors within radius (Manhattan) using grid positions
    let seed: any | null = null;
    let lowestAtt = Infinity;
    for (const f of candidates) {
      const att = f.getStats().attention;
      if (att < lowestAtt) { lowestAtt = att; seed = f; }
    }
    if (!seed) return [];
    const seedPos = seed.getGridPosition();
    const cluster: any[] = [];
    for (const f of candidates) {
      const pos = f.getGridPosition();
      const dist = Math.abs(pos.row - seedPos.row) + Math.abs(pos.col - seedPos.col);
      if (dist <= radius) cluster.push(f);
    }
    return cluster.length >= minSize ? cluster : [];
  }

  /** Provide debug state snapshot */
  public getDebugState(): MascotBehaviorDebugState {
    const now = performance.now();
    const elapsedSinceUltimate = now - this.lastUltimateAt;
    // Effective cooldown calc (mirrors shouldTriggerUltimate with diminishing returns)
    const rawMomentumReduction = Math.min(
      this.consecutiveWaveSuccesses * this.ultimateCfg.momentumStepPercent,
      this.ultimateCfg.momentumMaxPercent
    );
    const effectiveMomentumReduction = rawMomentumReduction * this.momentumEffectivenessFactor;
    const effectiveCooldown = Math.max(
      this.ultimateCfg.baseCooldownMs * (1 - effectiveMomentumReduction),
      this.ultimateCfg.minFloorMs
    );
    return {
      state: this.state,
      cycleIndex: this.cycleIndex,
      targetingPhase: this.getTargetingPhase(),
      lastUltimateAt: this.lastUltimateAt,
      nextUltimateEtaMs: Math.max(0, effectiveCooldown - elapsedSinceUltimate),
      consecutiveWaveSuccesses: this.consecutiveWaveSuccesses,
      pendingAbility: (this.state === 'patrolling' ? this.getTargetingPhase() : undefined),
    };
  }
}
