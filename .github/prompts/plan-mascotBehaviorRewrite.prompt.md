## Plan: Mascot Behavior Architectural Rewrite

Rewrite mascot feature so all decision/ability logic lives in `MascotActor` + `MascotBehavior` under `actors/`, with `sprites/Mascot.ts` reduced to pure visual/animation concerns. Migrate personality + ability execution, targeting, perimeter movement, analytics, and context transitions from sprite/systems layer into a unified behavior state machine (mirroring `DrinkVendorBehavior`). Provide clean events for ability lifecycle and crowd stat effects routed through `GameStateManager` / `AnnouncerService`. Ensure reuse of `PathfindingService` and existing grid access patterns; no dangling wrappers.

### Steps
1. Introduce `MascotActor` (`src/actors/MascotActor.ts`) extending `AnimatedActor`, holding refs to `Mascot` sprite, personality data, and a `MascotBehavior`.
2. Create `MascotBehavior` (`src/actors/behaviors/MascotBehavior.ts`) implementing `AIActorBehavior` with states (entrance, hyping, patrolling, executingAbility, ultimate, exit) and ability/target selection logic.
3. Refactor `sprites/Mascot.ts` to strip AI/personality fields (personality, targetingAI, analytics) retaining only animation, visual state, and simple setters (e.g. `setContextVisual(ctx)`, `playAbilityEffect(effect)`).
4. Add `MascotManager` (`src/managers/MascotManager.ts`) or extend `AIManager` to spawn/manage one mascot: session hooks, scheduling ability triggers, emitting `mascotAbilityStart/end`, delegating path requests via `PathfindingService`.
5. Move or reference personality & ability configs from `types/personalities.ts` into `config/gameBalance.ts` (link section) or dedicated `config/mascotConfig.ts`; expose lookup API to `MascotBehavior`.
6. Integrate announcer + crowd effects: on ability resolution, `MascotBehavior` emits events consumed by `GameStateManager` (stat boosts) and `AnnouncerService` (commentary), updating fans via existing section queries.

### Further Considerations
1. Manager choice: Option A new `MascotManager`; Option B fold into `AIManager` to reduce overhead.
2. Ability targeting scope? Single section vs global vs nearest low-attention cluster.
3. Ultimate cadence config: fixed interval vs performance-based trigger (waves succeeded %).
