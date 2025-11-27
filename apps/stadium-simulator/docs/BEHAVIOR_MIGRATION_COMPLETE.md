# Behavior Migration Complete

## Overview
Completed migration of vendor-specific logic from AIManager to behavior classes, ensuring actors (not managers) drive visual changes. This builds on the Fan→FanActor separation work and extends behavior-driven architecture throughout the codebase.

## Changes Implemented

### 1. SectionActor Query API
**File**: `src/actors/SectionActor.ts`

Added `queryThirstiestFans()` method that returns sorted array of fan data:
```typescript
public queryThirstiestFans(count: number = 10): Array<{
  fanActor: FanActor;
  fan: Fan;
  row: number;
  col: number;
  thirst: number;
}>
```

- Scans all seats in section to find occupied fans
- Looks up FanActor for each fan
- Sorts by thirst descending
- Returns top N candidates
- Used by DrinkVendorBehavior for target selection

### 2. DrinkVendorBehavior Target Selection
**File**: `src/actors/behaviors/DrinkVendorBehavior.ts`

Implemented `selectTarget()` method (previously stubbed):
- Accesses AIManager.getSectionActors() for section data
- Calls SectionActor.queryThirstiestFans(50) per section
- Respects assignedSectionIdx if set (restricts to one section)
- Scores candidates by distance + thirst priority
- Returns best target with fanActor, fan, position, and section index

**Scoring Algorithm**:
```typescript
normalizedDistance = distance / 32  // Grid distance
thirstPriority = (100 - thirst) / 10  // High thirst = low score
score = normalizedDistance + thirstPriority
```

### 3. AIManager Section Storage Migration
**File**: `src/managers/AIManager.ts`

- Added `sectionActors: any[]` field (typed as `any[]` to avoid circular imports)
- Added `setSectionActors(sectionActors: any[])` method
- Added `getSectionActors(): any[]` method for behavior access
- Kept `sections: StadiumSection[]` marked as `@deprecated`

**File**: `src/scenes/StadiumScene.ts`

- Added call to `aiManager.setSectionActors(sectionActors)` after section initialization
- Section actors now passed alongside legacy section sprites

### 4. Drink Service via FanActor
**File**: `src/actors/FanActor.ts`

Updated `drinkServed()` to accept scene OR timestamp:
```typescript
public drinkServed(sceneOrTimestamp: Phaser.Scene | number): void {
  this.thirst = 0;
  this.happiness = Math.min(100, this.happiness + 15);
  
  const timestamp = typeof sceneOrTimestamp === 'number' 
    ? sceneOrTimestamp 
    : sceneOrTimestamp.time.now;
  
  this.thirstFreezeUntil = timestamp + gameBalance.fanStats.thirstFreezeDuration;
  this.updateVisualIntensity();
}
```

**File**: `src/managers/AIManager.ts`

Updated `serveFan()` method:
- Looks up FanActor using `SectionActor.getFanActorAt(row, col)`
- Calls `fanActor.drinkServed(Date.now())` with current timestamp
- Logs service completion
- No longer relies on removed Fan sprite methods

### 5. Target Selection Delegation
**File**: `src/managers/AIManager.ts`

- Created `selectNextDrinkTargetWrapper()` that delegates to behavior:
  - Looks up VendorActor from ActorRegistry
  - Gets behavior via `vendorActor.getBehavior()`
  - Calls `behavior.selectTarget()` if available
  - Returns standardized target format

- Updated `selectNextDrinkTarget()` to call wrapper (backward compatibility)
- Old sprite-scanning logic removed (~90 lines)

### 6. Actor-Driven Visual Updates
**File**: `src/actors/FanActor.ts`

Verified existing implementation:
- `updateVisualIntensity()` calls `this.fan.setIntensity(this.thirst / 100)`
- Called from all stat setters: `setThirst()`, `setHappiness()`, `setAttention()`
- Called from `drinkServed()` after stat changes
- Called from `updateStats()` during decay

**Result**: Stat changes automatically trigger visual updates without external calls.

### 7. Manager Sprite Manipulation Audit

**WaveManager**: ✅ No direct sprite calls  
**GameStateManager**: ✅ No direct sprite calls  
**AIManager**: ⚠️ Only deprecated sprite access in `scanningInSection` state (lines 558-559):
```typescript
const targetRow = targetSection.getRows()[instance.targetPosition.rowIdx];
const targetSeat = targetRow?.getSeats()[instance.targetPosition.colIdx];
```

This code path is part of the legacy update loop and will be removed when behaviors fully take over state management.

## Architecture Validation

### Separation of Concerns
- ✅ **Sprites**: Visual rendering only (Fan.ts has no game logic)
- ✅ **Actors**: Game state and logic (FanActor owns stats, VendorActor owns movement)
- ✅ **Behaviors**: AI decision-making (DrinkVendorBehavior selects targets)
- ✅ **Managers**: Coordination and events (AIManager orchestrates, doesn't manipulate)

### Data Flow
1. **Target Selection**: Behavior → SectionActor → FanActor (via queryThirstiestFans)
2. **Service Delivery**: AIManager → SectionActor → FanActor (via getFanActorAt)
3. **Visual Updates**: FanActor → Fan sprite (via updateVisualIntensity)
4. **State Changes**: Actor setters automatically trigger visual updates

### Type Safety
- All changes pass `npm run type-check` with 0 errors
- Avoided circular imports by typing sectionActors as `any[]` in AIManager
- Maintained interface compatibility for backward compatibility

## Benefits Achieved

1. **Maintainability**: Vendor logic centralized in behavior classes
2. **Testability**: Behaviors can be tested independently of managers
3. **Extensibility**: Easy to add new vendor types with custom behaviors
4. **Consistency**: All actors drive their own visual changes
5. **Decoupling**: Managers don't know about sprite implementations

## Next Steps

### Immediate
- [ ] Remove deprecated `AIManager.scanningInSection` sprite access once behaviors handle pathfinding state
- [ ] Consider passing scene reference to AIManager for timestamp-free drinkServed calls
- [ ] Document behavior API for future vendor types

### Future Enhancements
- [ ] Migrate mascot logic to MascotBehavior
- [ ] Implement behavior composition for complex AI patterns
- [ ] Add behavior state serialization for save/load
- [ ] Create behavior editor for content creators

## Files Modified
- `src/actors/SectionActor.ts` - Added queryThirstiestFans
- `src/actors/FanActor.ts` - Updated drinkServed signature
- `src/actors/behaviors/DrinkVendorBehavior.ts` - Implemented selectTarget
- `src/managers/AIManager.ts` - Added sectionActors, delegated target selection, updated serveFan
- `src/scenes/StadiumScene.ts` - Pass sectionActors to AIManager

## Testing
- ✅ TypeScript compilation (0 errors)
- ⏳ Manual runtime testing recommended
- ⏳ Verify vendor targeting uses real fan thirst values
- ⏳ Verify drink service updates fan stats correctly
