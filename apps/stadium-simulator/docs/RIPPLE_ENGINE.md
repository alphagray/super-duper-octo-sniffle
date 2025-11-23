# Ripple Propagation Engine

## Overview

The Ripple Propagation Engine calculates cascading fan engagement effects when fans catch t-shirts from the mascot. Effects spread spatially using Manhattan distance-based decay, creating realistic "ripple" patterns of excitement through stadium sections.

## Core Concepts

### Manhattan Distance
Distance is calculated using grid coordinates (rows and seats):
```
distance = |row1 - row2| + |seat1 - seat2|
```

Examples:
- Adjacent horizontally or vertically: distance = 1
- Diagonal neighbor: distance = 2
- Two rows and three seats away: distance = 5

### Linear Decay Formula
Effect strength decreases linearly with distance:
```
effect = baseEffect × max(0, 1 - distance/maxRadius)
```

Decay progression (with default baseEffect=40, maxRadius=4):
- Distance 0 (epicenter): 100% → 40 attention
- Distance 1: 75% → 30 attention
- Distance 2: 50% → 20 attention
- Distance 3: 25% → 10 attention
- Distance 4+: 0% → no effect

### Disinterested Fan Bonus
Fans with low attention + low happiness receive extra boost to encourage re-engagement:
- Base effect + 5 attention bonus
- Applied at all distances within radius

## Configuration

Located in `src/config/gameBalance.ts`:

```typescript
ripplePropagation: {
  enabled: true,              // Master toggle
  baseEffect: 40,             // Attention boost at epicenter
  maxRadius: 4,               // Maximum Manhattan distance
  disinterestedBonus: 5,      // Extra boost for disinterested fans
  decayType: 'linear',        // 'linear' or 'exponential' (exponential not yet implemented)
}
```

## Usage

### Basic Usage (Single Ripple)

```typescript
import { RipplePropagationEngine } from '@/systems/RipplePropagationEngine';

// Create engine (uses gameBalance config by default)
const engine = new RipplePropagationEngine();

// When a fan catches a t-shirt
const catcher = /* fan who caught t-shirt */;
const section = /* section containing the fan */;

// Calculate ripple effects
const ripple = engine.calculateRipple(catcher, section);

// Apply effects to all affected fans
engine.applyRipple(ripple);
```

### Multiple Simultaneous Ripples

```typescript
// Multiple fans catch t-shirts at nearly the same time
const catcher1 = /* first catcher */;
const catcher2 = /* second catcher */;
const catcher3 = /* third catcher */;

// Calculate all ripples
const ripple1 = engine.calculateRipple(catcher1, section);
const ripple2 = engine.calculateRipple(catcher2, section);
const ripple3 = engine.calculateRipple(catcher3, section);

// Combine ripples (additive in overlap areas)
const combined = engine.combineRipples([ripple1, ripple2, ripple3]);

// Apply combined effects (100 attention cap enforced)
engine.applyCombinedRipples(combined);
```

### Custom Configuration

```typescript
// Create engine with custom parameters
const customEngine = new RipplePropagationEngine({
  baseEffect: 50,        // Stronger base effect
  maxRadius: 6,          // Larger spread radius
  disinterestedBonus: 10 // Bigger re-engagement bonus
});

const ripple = customEngine.calculateRipple(catcher, section);
customEngine.applyRipple(ripple);
```

### Inspect Ripple Effects

```typescript
const ripple = engine.calculateRipple(catcher, section);

// Ripple metadata
console.log(`Epicenter at row ${ripple.epicenterRow}, seat ${ripple.epicenterSeat}`);
console.log(`Affected ${ripple.affectedFans.size} fans`);

// Examine individual fan boosts
ripple.affectedFans.forEach((boost, fan) => {
  console.log(`Fan ${fan.getId()} receives +${boost} attention`);
});
```

## API Reference

### RipplePropagationEngine

#### Constructor
```typescript
constructor(config?: Partial<RippleConfig>)
```
Create new engine instance. Config defaults to `gameBalance.ripplePropagation`.

#### Methods

**calculateRipple(epicenter: Fan, section: StadiumSection): RippleEffect**
- Calculates ripple effects from an epicenter fan
- Returns RippleEffect with affected fans and boost amounts
- Section boundary enforcement: only affects fans in provided section
- Returns empty result if epicenter not found in section

**applyRipple(ripple: RippleEffect): void**
- Applies calculated ripple effects to all affected fans
- Automatically enforces 100 attention cap
- Safe to call with empty ripples

**combineRipples(ripples: RippleEffect[]): Map<Fan, number>**
- Combines multiple ripples additively
- Fans in overlapping areas receive sum of all boosts
- Returns map of fans to total combined boost

**applyCombinedRipples(combinedEffects: Map<Fan, number>): void**
- Applies combined ripple effects to fans
- Enforces 100 attention cap
- More efficient than applying ripples individually

**getConfig(): RippleConfig**
- Returns current configuration (copy)

**updateConfig(config: Partial<RippleConfig>): void**
- Updates configuration dynamically
- Useful for testing different parameters

### Types

**RippleConfig**
```typescript
interface RippleConfig {
  baseEffect: number;           // Attention boost at epicenter
  maxRadius: number;            // Maximum Manhattan distance
  disinterestedBonus: number;   // Extra boost for disinterested fans
  decayType: 'linear' | 'exponential';
}
```

**RippleEffect**
```typescript
interface RippleEffect {
  epicenterFan: Fan;
  epicenterRow: number;
  epicenterSeat: number;
  affectedFans: Map<Fan, number>; // fan → attention boost
}
```

## Implementation Details

### Section Boundary Enforcement
- Ripples only affect fans within the provided section
- No cross-section spillover
- Grid search limited to section's row/seat structure

### Grid-Based Coordinates
- Uses row/seat indices exclusively (not world coordinates)
- Matches section's natural grid structure
- Efficient O(fans_in_section) iteration

### Zero-Effect Optimization
- Fans receiving 0 effect are not included in affectedFans map
- Fans beyond maxRadius excluded entirely
- Reduces memory usage and iteration overhead

### Attention Cap Enforcement
- All application methods enforce 100 attention maximum
- Applied after calculating combined boosts
- Prevents stat overflow

## Performance

- **Algorithm complexity**: O(fans_in_section)
- **Typical section**: 32 fans (4 rows × 8 seats)
- **Large section**: 200 fans (10 rows × 20 seats)
- **Target performance**: <5ms per ripple calculation
- **Memory**: Map storage for affected fans only

## Testing

Comprehensive test suite with 32 tests covering:
- Manhattan distance calculation
- Linear decay formula accuracy
- Disinterested fan bonus
- Section boundary enforcement
- Single and multiple ripple application
- Edge cases (empty sections, sparse seating, extreme radii)
- Configuration management

Run tests:
```bash
npm test -- RipplePropagationEngine.test.ts
```

## Future Enhancements

### Exponential Decay
Currently throws error. Implementation plan:
```typescript
if (decayType === 'exponential') {
  const decayFactor = Math.exp(-distance / (maxRadius / 2));
  effect *= decayFactor;
}
```

### Temporal Decay
Effects weaken over time after application (not in current scope).

### Visual Feedback
Ripple visualization with expanding circles/waves (Story 6).

### Sound Effects
Audio feedback for ripple propagation (Story 6).

## Integration Points

### Story 3: T-Shirt Cannon Targeting AI
Will call ripple engine when fans catch t-shirts:
```typescript
// In cannon firing logic
onFanCatch(catcher: Fan, section: StadiumSection) {
  const ripple = rippleEngine.calculateRipple(catcher, section);
  rippleEngine.applyRipple(ripple);
}
```

### Story 5: Wave Participation Integration
Ripples can boost wave participation by increasing attention.

## Examples

### Example 1: Simple Ripple
```typescript
// Fan at row 2, seat 3 catches t-shirt
// Fans in 5x5 grid (maxRadius=4 Manhattan distance)
//
// Effect distribution:
//    0  10  20  10   0
//   10  20  30  20  10
//   20  30  40  30  20  <- center at (2,2)
//   10  20  30  20  10
//    0  10  20  10   0
```

### Example 2: Overlapping Ripples
```typescript
// Two fans catch at (2,2) and (2,4)
// Overlapping areas receive both boosts
//
// Ripple 1:      Ripple 2:      Combined:
//    40 30          30 40          70 70
//    30 40          40 30          70 70
```

### Example 3: Disinterested Fan Re-engagement
```typescript
const fan = section.getFanAt(1, 2);
console.log(fan.getAttention());      // 25 (low)
console.log(fan.getIsDisinterested()); // true

const ripple = engine.calculateRipple(catcher, section);
// Normal fan at distance 1: +30 attention
// Disinterested fan at distance 1: +35 attention (+5 bonus)

engine.applyRipple(ripple);
console.log(fan.getAttention());      // 60 (re-engaged!)
```

## Related Documentation

- Issue #54: Ripple Propagation Engine specification
- `src/sprites/Fan.ts`: Fan stat management
- `src/sprites/StadiumSection.ts`: Section grid structure
- `src/config/gameBalance.ts`: Configuration values

## License

Part of the Stadium Simulator project.
