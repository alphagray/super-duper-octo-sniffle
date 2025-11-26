## Plan: Mascot Behavior Architectural Rewrite (Revised)

Goal: Fully migrate mascot logic into Actor + Behavior architecture. All decision and ability/timing logic lives in `MascotActor` + `MascotBehavior`. `sprites/Mascot.ts` becomes purely visual (animations, tinting, context display). No dangling wrapper stubs; behaviors mirror vendor pattern for consistency. Provide clean event surface for ability lifecycle, stat effects, announcer triggers, and analytics.

### Core Changes
1. `MascotActor` (`src/actors/MascotActor.ts`): Extends `AnimatedActor`; holds reference to `Mascot` sprite, personality config, cycle state, and a `MascotBehavior` instance.
2. `MascotBehavior` (`src/actors/behaviors/MascotBehavior.ts`): Implements `AIActorBehavior`; state machine with states: `entrance`, `hyping`, `patrolling`, `executingAbility`, `ultimate`, `exit`, plus internal cooldown and targeting cycle management.
3. Refactor `sprites/Mascot.ts`: Remove AI systems (targetingAI, perimeter logic timings, ability timers, analytics). Keep: visual customization (`applyVisualCustomization`), context visual setter (`setContextVisual`), ability visual triggers (`playAbilityEffect`, cannon charge/firing animations), and basic `updateVisual(state)`.
4. Integrate into existing `AIManager` (no new manager) to register mascot actor, route per-frame `behavior.tick(delta)`, and expose scheduling helpers (`requestMascotUltimate`, `getMascotCycleIndex`).
5. Config consolidation: Add `mascotBehavior` & `mascotUltimate` sub-sections in `gameBalance` for cooldown ranges, momentum modifiers, attention thresholds, targeting cycle parameters. Personalities remain in `types/personalities.ts`; ability numeric tuning migrates into `gameBalance.mascotBehavior`.
6. Event Surface: Behavior emits: `mascotAbilityStart`, `mascotAbilityEnd`, `mascotUltimateStart`, `mascotUltimateEnd`, `mascotTargetCycleAdvance`, `mascotReengagementPulse`. `GameStateManager` listens to apply stat deltas; `AnnouncerService` listens for entrance, ability start, ultimate start, exit.
7. Targeting Cycle: Sequential rotation per activation: (a) Single Section focus; (b) Global boost; (c) Nearest Low-Attention Cluster. Cycle index stored on behavior; emits `mascotTargetCycleAdvance` after each activation completes.
8. Hybrid Ultimate Cadence: Base cooldown window (e.g. 90s) reduced by consecutive wave successes (−10% per success up to −40%), forced trigger if: (a) time since last ultimate ≥ 120s OR (b) average stadium attention < 45. Apply diminishing returns floor (never < 60s). Config parameters adjustable.

### Detailed Steps
1. Implement `MascotActor` skeleton: constructor, `update(delta)` bridging to behavior, `applyPersonalityVisuals()`, accessors for cycle index & personality.
2. Implement `MascotBehavior` state machine: internal timers, cycle index, targeting strategy dispatcher, ultimate cadence tracker, stat effect emission methods.
3. Migrate personality effect handling: Map `AbilityEffect` types → standardized stat delta payloads consumed by `GameStateManager`.
4. Refactor `sprites/Mascot.ts`: remove movement/cannon logic into behavior; keep purely visual helpers; adapt public API used by scenes (`playAbilityEffect`, `showCharge`, `showFire`, `setContextVisual`).
5. Extend `gameBalance`: add `mascotBehavior` (cooldowns, cycle settings) & `mascotUltimate` (baseCooldownMs, maxIntervalMs, successMomentumPercent, attentionTriggerThreshold, minFloorMs, diminishingReturnFactor).
6. Extend `AIManager`: add `registerMascot(actor)`, `updateMascot(delta)`, `triggerMascotAbility(kind)` delegation; ensure no legacy vendor interference.
7. Implement targeting resolvers within behavior: 
	- Single Section: choose section with lowest avg attention or rotate through sections.
	- Global: apply scaled effect stadium-wide.
	- Nearest Low-Attention Cluster: scan grid for cluster below threshold.
8. Implement hybrid ultimate scheduling: track lastUltimateTimestamp, consecutiveWaveSuccesses; compute next eligibility; force trigger conditions.
9. Wire announcer integration: on entrance, ability start, ultimate start, exit → build concise context prompt; fallback phrase included.
10. Analytics: replace sprite-level MascotAnalytics with behavior-driven metrics collector (participation uplift, re-engagement count, average attention delta). Emit summary on exit.
11. Update documentation: revise `plan-mascotBehaviorRewrite`, add short usage block in relevant README or new `docs/MASCOT_BEHAVIOR.md`.

### Open Choice Points (Need Confirmation Before Finalizing Parameters)
1. Ultimate base cooldown (`baseCooldownMs`): propose 90000ms. Accept?
2. Success momentum reduction per consecutive success: propose 10% step, capped at 40%. Accept?
3. Forced trigger max interval (`maxIntervalMs`): propose 120000ms. Accept?
4. Attention trigger threshold: propose stadium avg attention < 45. Accept?
5. Diminishing returns floor (`minFloorMs`): propose 60000ms. Accept?
6. Ability stat effect scale ranges (section vs global vs cluster) – need desired magnitude (e.g. attention +6 / happiness +3 section; global half; cluster variable). Provide guidance.
7. Event names confirmed as listed? Any naming adjustments?

### Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Over-frequent ultimates | Stat inflation / trivial waves | Hybrid cadence + floor enforcement |
| Target cycle imbalance | Perceived randomness / unfair boosts | Deterministic rotation & telemetry logging |
| Performance scanning clusters | Frame spikes | Cache fan attention map; scan every N ms (e.g. 1500ms) |
| Refactor regression in existing sprite references | Runtime errors | Incremental PR: introduce Actor/Behavior, adapt scene calls, then remove old fields |
| Announcer prompt spam | API rate limits | Debounce ability/ultimate events (min 2s apart) |

### Telemetry & Debug Hooks
- Behavior exposes `getDebugState()` returning: currentState, cycleIndex, nextUltimateEtaMs, consecutiveWaveSuccesses, activeAbilityId.
- Optional debug overlay draws target cycle and ultimate countdown (guarded by `gameBalance.vendorDebug.enabled`).

### Implementation Phases (Execution Order)
P1: Actor & Behavior scaffolding + config additions.
P2: Sprite refactor (remove logic, keep visuals) + AIManager integration.
P3: Targeting strategies & stat effect pipeline.
P4: Ultimate cadence logic + announcer events.
P5: Analytics & telemetry + docs.

### Completion Criteria
- Mascot functionality matches previous feature set (perimeter movement, ability firing, t-shirt effects) through Actor/Behavior.
- No AI logic remains in `sprites/Mascot.ts` beyond visuals.
- Target cycle rotates deterministically and visible via debug state.
- Ultimate fires per hybrid cadence with enforced floor and force conditions.
- GameState & Announcer integrations receive events successfully.
- Documentation updated.

### Next Actions
Proceed with parameter confirmation, then implement Phase 1.
