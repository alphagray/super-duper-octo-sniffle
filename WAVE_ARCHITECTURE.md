# Wave Calculation Architecture (Updated Column Logic & Debug Enhancements)

## Overview
Refactored wave propagation to use actual fan participation instead of pre-rolled probability.

## Data Flow (Updated)

### 1. Wave Propagation (WaveManager)
```
User clicks "START WAVE"
    ↓
WaveManager.startWave() → countdown starts
    ↓
Countdown reaches 0
    ↓
WaveManager.propagateWave()
    ├─ For each section (A → B → C):
    │  └─ emit 'sectionWave' with { section, strength }
    │     (Wait for scene to process)
    │
    └─ Check previous state: getLastSectionWaveState()
```

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
