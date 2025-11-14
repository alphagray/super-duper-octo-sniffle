# Wave Architecture (Autonomous Triggering, Directional Path & Column Classification)

## Overview
The wave system has evolved from manual button starts to a fully autonomous mechanic driven by crowd happiness, position weights, and cooldowns. Waves now:
1. Trigger probabilistically per section (weighted edges) after global & per-section cooldowns.
2. Instantiate a `Wave` object with a calculated directional path (longest side; tie favors left→right).
3. Run a 10s trigger countdown (configurable) before propagation.
4. Propagate section-by-section along the path, emitting `sectionWave` events; the scene classifies each column in that section based on real fan participation.
5. Adjust wave strength & record outcomes (success / sputter / death) using transitional logic informed by the previous section state.
6. Apply scoring, cooldown durations (success vs failure), boosts, and store wave history.

## High-Level Data Flow

### 1. Autonomous Wave Initiation
```
Session active & startup delay (5s) elapsed
    ↓
Global cooldown check (success/failure cooldown window)
    ↓
Weighted section ordering (position weights from config)
    ↓
For each candidate section:
  ├─ Per-section cooldown check
  ├─ Average happiness → probability band:
  │     <20 → 40% | 20-60 → 60% | >60 → 90%
  ├─ Roll vs band probability
  └─ On success: createWave(origin) → startWave()
```

### 2. Wave Creation & Countdown
```
Wave.calculatePath(allSections, origin)
  → Determine direction (first vs last alphabetical)
Wave object created (id, origin, path, direction, timestamps)
Emit 'waveCreated' (incoming cue visuals)
Set active = true; countdown = triggerCountdown (10s)
```

### 3. Section Propagation (WaveManager.propagateWave)
```
Countdown hits 0
    ↓
For each section in wave.path (directional order):
  ├─ Emit 'sectionWave' { section, strength, direction }
  ├─ StadiumScene processes columns (see next)
  ├─ Scene calls setLastSectionWaveState(state)
  ├─ Scene calls adjustWaveStrength(state, participationRate)
  ├─ Strength & results recorded
  └─ Death state short-circuits remaining sections
Finalize (waveComplete + cooldown)
```

### 4. Column Classification (Scene Layer)
```
On 'sectionWave':
  reset fan wave sprites
  consume forced flags (sputter/death) if debug
  For each column (direction determines iteration order):
    ├─ Compute per-fan participation probability from currentWaveStrength × booster multiplier
    ├─ Count participating fans → participationRate (0-1)
    ├─ Classify column:
    │     ≥0.60 success | ≥0.40 sputter | else death (config-driven)
    ├─ Record column state (debug grid) + pushColumnParticipation()
    ├─ Enhanced recovery check (prev sputter → current success) → bonus multiplier
    ├─ Update visuals (success/sputter/death animation variant)
  Aggregate section participation & majority outcome → section state
  Set lastSectionWaveState(section state) & adjustWaveStrength(section state, participationRate)
```

### 5. Strength Adjustment Logic (WaveManager.adjustWaveStrength)
```
Transition rules:
From success:
  success: +5 (momentum) | sputter: -15 | death: -30
From sputter:
  participation ≥0.60: +10 (recovery)
  0.40–0.60: -8 (maintain sputter)
  <0.40: -25 (collapse)
From death:
  participation ≥0.60: +15 (miraculous recovery)
  0.40–0.60: -10 (still weak)
  <0.40: -5 (stays dead)
All adjustments scaled by active booster multiplier (momentum/recovery/participation).
```

### 6. Wave Completion & Cooldowns
```
All sections processed OR death encountered
    ↓
Compute waveSuccess (no deaths) → finalizeWave(success)
    ↓
Emit 'waveFinalized', 'waveComplete'
    ↓
Start successCooldown (5s) OR failureCooldown (9s)
    ↓
Per-section start timestamp recorded for origin (8s cooldown)
```

### 7. GameState Interactions
```
updateStats(deltaTime): thirst +2/sec always; happiness decays only if thirst > threshold (50)
Peer pressure: happiness ≥75 boosts attention +0.5/sec
Wave completion success: +15 happiness & +20 attention temporary boost (5s)
Session scoring uses completed wave count + aggregate stat deltas
```

## Key Components
- WaveManager: Autonomous triggering, countdown, propagation, strength transitions, cooldown tracking.
- Wave: Immutable metadata (id, origin, path, direction, timestamps) + section results & JSON export.
- GameStateManager: Section stats, conditional decay, peer pressure, wave completion boosts, scoring.
- Config (`gameBalance`): Single source for thresholds, timings, boosters, position weights, decay parameters.
- StadiumScene: Visual column iteration, per-column participation calculation, classification, animations, state callbacks.

## Booster & Forced Flags
- Boosters (momentum | recovery | participation) are non-stacking; applying one overrides previous.
- Booster percent modifies participation probability and strength adjustments (via multiplier).
- Forced sputter/death flags (debug) consumed at section start; they influence initial classification path.

## Directional Path & Animation
- Path chosen by longest side from origin; tie favors rightward (A→B→C style) for natural reading order.
- Direction (`left` | `right`) passed to scene and used to reverse column iteration.

## Events
- waveCreated, waveStart, sectionWave, waveStrengthChanged, columnStateRecorded, waveComplete, waveCooldownStarted, waveFinalized.

## Scoring Snapshot
- Per successful or sputter section: +100 points.
- Wave history tracks maxPossible contributions for normalization.
- Session grade uses configurable thresholds & estimated max waves.

## Debug Panel Features
- Strength override, booster buttons, forced sputter/death toggles.
- Column grid (bounded size) showing S / SP / D & participation percent.
- Event log capped by config.

## Configuration Highlights (gameBalance.ts)
- `waveTiming.triggerCountdown`: 10000ms (10s)
- `waveAutonomous.successCooldown`: 5000ms | `failureCooldown`: 9000ms
- `waveAutonomous.sectionStartCooldown`: 8000ms
- Happiness decay only when thirst > 50 (rate 1.0/sec)
- Peer pressure threshold: happiness ≥75; attention boost 0.5/sec
- Column thresholds: success ≥0.60, sputter ≥0.40

## Future Extension Hooks
- Special wave types (SUPER / DOUBLE_DOWN) placeholder fields (speedMultiplier, reverseAfterComplete).
- Column-level momentum integration during animation (updateWaveStrength / isWaveDead hooks).
- Vendor interference penalty & seat-level granularity.

## Testing Alignment
- Tests reference config (no magic numbers for countdown).
- WaveManager tests mock propagation by calling `updateCountdown(triggerCountdownMs)`.
- GameStateManager tests verify conditional happiness decay & thirst growth.

## Summary
The architecture now cleanly separates autonomous triggering, deterministic path/direction, and column-based classification while centralizing all tunables in `gameBalance.ts`. Strength evolution is transparent and event-driven, enabling future visual and scoring enhancements without changing propagation logic.

### 2. Section Processing (StadiumScene) – Column-Oriented
```
sectionWave event received { section, strength }
    ↓
resetFanWaveState() on section
    ↓
Apply forced sputter if flagged (section A only)
    ↓
For each column (0-7):
  ├─ Calculate per-fan participation (waveStrength × participation booster if active)
  ├─ Compute column participation rate
  ├─ Classify column (success / sputter / death) via thresholds:
  │     success ≥ columnSuccessThreshold (0.60)
  │     sputter ≥ columnSputterThreshold (0.40)
  │     else death
  ├─ Record column state (debug grid)
  ├─ Enhanced recovery: if previous column was sputter and current is success
  │     apply bonus = baseRecoveryBonus × (1 + recoveryPowerMultiplier + recoveryBooster%) immediately
  └─ Animate column using visual mapping (success→full, sputter→sputter, death→death)
    │
After all columns:
  ├─ Count column states (success / sputter / death)
  ├─ Section state = simple majority with tie priority: success > sputter > death
  ├─ Aggregate participationRate = totalParticipating / totalFans
    │
    ├─ Call adjustWaveStrength(sectionState, participationRate)
    ├─ Call setLastSectionWaveState(sectionState) for next section
    ├─ Trigger poke jiggle for participating fans
    └─ Visual feedback (flash green/red, screen shake on success streak)
```

### 3. Strength Adjustment (WaveManager.adjustWaveStrength)
```
Called with:
  - currentState: 'success' | 'sputter' | 'death' (just determined)
  - participationRate: 0-1 (aggregate for this section)

Reads:
  - this.lastSectionWaveState: previous section's state

Logic:
  ┌─ If lastState === 'success':
  │  ├─ currentState === 'success' → +5 × momentumBooster strength
  │  ├─ currentState === 'sputter' → -15 strength
  │  └─ currentState === 'death' → -30 strength
  │
  ├─ If lastState === 'sputter':
  │  ├─ participationRate ≥ 0.6 → +10 × momentumBooster strength (recovery)
  │  ├─ participationRate 0.4-0.6 → -8 strength (still struggling)
  │  └─ participationRate < 0.4 → -25 strength (cascading failure)
  │
    └─ If lastState === 'death':
      ├─ participationRate ≥ 0.6 → +15 × momentumBooster strength (miraculous recovery)
     ├─ participationRate 0.4-0.6 → -10 strength (sputter recovery attempt)
     └─ participationRate < 0.4 → -5 strength (still dead)

Result:
  Updates this.currentWaveStrength (clamped 0-100)
```

### 4. State Propagation
```
Wave starts
  ↓
Section A: lastSectionWaveState = null
  → Determine state A
  → Adjust strength (comparing 'success' vs state A)
  → setLastSectionWaveState(state A)
  │
Section B: lastSectionWaveState = state A
  → Determine state B
  → Adjust strength (comparing state A vs state B)
  → setLastSectionWaveState(state B)
  │
Section C: lastSectionWaveState = state B
  → Determine state C
  → Adjust strength (comparing state B vs state C)
  → setLastSectionWaveState(state C)
  │
Wave complete
```

## Key Improvements (Current Iteration)

1. **Actual Participation Calculation**: Wave success/failure now based on real fan participation, not pre-rolled probability
2. **State Tracking**: Each section knows previous section's result, enabling proper strength transitions
3. **Participation-Aware Adjustments**: Strength adjustment varies based on participation rate (e.g., sputter recovery logic)
4. **Momentum Mechanics**: Success→Success builds momentum (+5 × booster), Success→Sputter drops momentum (-15)
5. **Cascading Failure**: Sputter→Death drops significantly (-25), creating tension
6. **Recovery Mechanics**: Column-level enhanced recovery (sputter→success) applies immediate bonus (baseRecoveryBonus × (1 + recoveryPower + booster)).
7. **Booster System**: Non-stacking wave-only boosters (momentum, recovery, participation) override each other.
8. **Forced States**: Debug forced sputter/death flags modify initial section strength and classification path.
9. **Column Grid**: Live text grid shows classification per column in debug mode.

## Technical Details

### Parameter Passing
- `propagateWave()` emits `sectionWave` with current strength
- Scene calculates actual participation and determines state
- Scene calls `adjustWaveStrength()` which internally reads `lastSectionWaveState`
- Scene calls `setLastSectionWaveState()` for next section

### Visual Integration
- Wave strength determines fan participation probability
- Participation rate aggregated across section
- Visual state (full/sputter/death) reflects wave state
- Animation intensity scales with participation

### Debug Integration
- Debug Panel (toggle D): strength override, Force Sputter (with auto-recover checkbox), Force Death, booster buttons, event log, column state grid.
- Forced Sputter: Degrade strength by configured min/max.
- Forced Death: Set strength to configured forcedDeathStrength.
- Booster Buttons: Apply percentage multipliers (momentum affects gains, recovery enhances enhanced recovery, participation increases effective participation probability per column).
- Column Grid: Shows per-column state (S/SP/D) with participation percentage.

## Testing Scenarios

### Success → Success → Success
- Strength increases: 50 → 55 → 60
- Visual: Full wave animation all three sections
- Screen shake on 3rd section

### Success → Sputter → Recovery (Column Enhanced)
- Section A: majority success, +5 × momentum
- Section B: majority sputter, -15
- Mid-Section Columns: sputter column followed by success column triggers enhanced recovery (baseRecoveryBonus × (1 + recoveryPower [+ booster])) raising strength before next column roll.
- Section C: majority success yields section-level recovery adjustment.

### Success → Death → Dead
- Section A: success, +5 strength
- Section B: death (<40% participation), -30 strength
- Section C: wave stays dead, no animation

### Force Sputter Test
- Use panel Force Sputter: degrade strength by configured range; optional recovery booster pre-applied.
- Observe column states trending sputter; a subsequent success column triggers enhanced recovery log entry.

### Force Death Test
- Use panel Force Death: strength set to forcedDeathStrength; columns classify as death; section majority death halts momentum.

### Booster Participation Test
- Apply Participation booster: each column shows higher participation%; watch shift from sputter to success majority.
