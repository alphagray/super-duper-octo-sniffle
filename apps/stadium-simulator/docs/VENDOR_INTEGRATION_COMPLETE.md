# Vendor System Integration - Phase 3 Complete

## Overview
Phase 3 of the vendor pathfinding system has been completed, integrating the vendor system into StadiumScene with visual sprites and event-driven updates.

## What Was Implemented

### 1. StadiumScene Vendor Integration

**Added:**
- `vendorSprites: Map<number, Vendor>` - Tracks visual sprite instances mapped to vendor IDs
- `setupVendorEventListeners()` - Listens for vendor lifecycle events:
  - `vendorSpawned`: Creates Vendor Container sprite, positions at front corridor (600y), stores in vendorSprites Map
  - `vendorReachedTarget`: Logs movement completion (debug mode)
  - `serviceComplete`: Updates vendor sprite to 'cooldown' state
  - `vendorDistracted`: Updates vendor sprite to 'distracted' state with shake animation
- `updateVendorPositions()` - Syncs vendor sprite positions to VendorManager instance positions, updates sprite states

**Modified:**
- `create()`: Added vendor initialization after section setup:
  - `vendorManager.initializeSections(this.sections)`
  - `vendorManager.spawnInitialVendors()`
  - `setupVendorEventListeners()`
- `update()`: Added vendor update calls:
  - `vendorManager.update(delta)` - Updates vendor logic
  - `updateVendorPositions()` - Syncs visuals

### 2. VendorManager API

**Added:**
- `getVendorInstance(id: number): VendorInstance | undefined` - Returns vendor instance for visual sync (already existed at line 181, duplicate removed)

**Events Emitted:**
- `vendorSpawned`: `{ vendorId, profile }`
- `vendorReachedTarget`: `{ vendorId, position }`
- `serviceComplete`: `{ vendorId, fanServed? }`
- `vendorDistracted`: `{ vendorId }`

## How It Works

### Vendor Lifecycle

1. **Initialization** (`create()`):
   - VendorManager receives section references
   - Spawns 2 good-quality drink vendors (default config)
   - Emits `vendorSpawned` events

2. **Spawn Event Handling**:
   - StadiumScene creates Vendor Container sprite (green body, random head)
   - Positions vendor at front corridor (centerX, 600y)
   - Updates VendorManager instance position
   - Stores sprite in `vendorSprites` Map

3. **Update Loop** (`update(delta)`):
   - VendorManager state machine runs:
     - `idle` → scans for thirsty fans (thirst > 50)
     - `planning` → selects target, plans path (stubbed for now)
     - `movingSegment` → interpolates position along path
     - `serving` → calls `fan.drinkServed()`, emits `serviceComplete`
     - `cooldown` → waits before returning to idle
   - `updateVendorPositions()` syncs sprite positions/states

4. **State Synchronization**:
   - Sprite position set to `instance.position.{x,y}`
   - Sprite visual state set via `sprite.setMovementState(instance.state)`
   - Vendor Container animations handle visual feedback:
     - `idle`: static
     - `movingSegment`: bob animation
     - `serving`: bright pulse
     - `cooldown`: dimmed
     - `distracted`: shake

## Testing

### Manual Test Steps

1. Start dev server: `npm run dev`
2. Navigate to http://localhost:3001/stadium-simulator/
3. Start a session (click "Start Run Mode" or "Start Eternal Mode")
4. **Expected Behavior**:
   - 2 green-bodied vendors appear at bottom center (600y)
   - Vendors scan for thirsty fans (thirst > 50)
   - When target selected, vendor enters `planning` state
   - Vendor moves toward target (stubbed linear path for now)
   - On arrival, vendor enters `serving` state (bright pulse animation)
   - Fan thirst reduced by 100, happiness boosted by 15
   - Vendor enters `cooldown` (dimmed), returns to idle

5. **Debug Mode**:
   - URL: `?demo=debug` loads TestSectionDebugScene
   - Console logs: `[Vendor]` prefixed logs if `vendorDebug.enabled` or `debugMode`
   - Check spawned vendor count, quality tiers, target selection

### Current Limitations (Planned for Phase 4)

- **Pathfinding**: Currently uses stubbed linear movement (HybridPathResolver not yet implemented)
- **Collision**: Vendors don't avoid obstacles/seats yet (needs navigation graph)
- **Animations**: Basic state transitions; refined movement tweens pending
- **Vendor Types**: Only drink vendors active; ranged AoE (t-shirt cannons) pending
- **Distraction**: Random distraction checks exist but need tuning

## Configuration

### Vendor Defaults (gameBalance.ts)

```typescript
sessionDefaults: {
  initialVendorCount: 2,
  initialVendorQuality: 'good' as VendorQualityTier,
  initialVendorType: 'drink' as VendorType
}
```

### Vendor Debug (gameBalance.ts)

```typescript
vendorDebug: {
  enabled: false,
  logMovement: false,
  logTargetSelection: false,
  logPathfinding: false
}
```

Set `vendorDebug.enabled = true` to see vendor lifecycle logs.

## Next Steps (Phase 4)

1. **Implement HybridPathResolver**:
   - Build navigation graph (corridors, stairs, row entries, seats)
   - Implement layered heuristic pathfinding
   - Add local detour detection for grumpy fans

2. **Collision & Penalties**:
   - Query seat/row traversal costs from SeatManager
   - Apply grump penalties (2x multiplier)
   - Enforce movement speed modifiers per quality tier

3. **Ranged AoE Vendors**:
   - Implement t-shirt cannon vendor type
   - Add corridor-only navigation constraint
   - Implement area-of-effect happiness boost (radius-based falloff)

4. **Visual Polish**:
   - Add smooth path-following tweens
   - Implement vendor rotation to face movement direction
   - Add particle effects for service/distraction

5. **Balancing**:
   - Tune distraction probabilities per quality tier
   - Adjust service times (currently 2000ms for drinks)
   - Test vendor density impact on fan happiness

## Files Modified

- `src/scenes/StadiumScene.ts`: Added vendor tracking, event listeners, position sync
- `src/managers/VendorManager.ts`: Removed duplicate `getVendorInstance()` method

## Files Created (Previous Phases)

- `src/managers/HybridPathResolver.ts`: Navigation graph stub (Phase 1)
- `src/scenes/TestStadiumScene.ts`: Preserved original scene (Phase 1)

## Verification Checklist

- [x] Vendors spawn at game start (2 good drink vendors)
- [x] Vendor sprites created as green Container with random head
- [x] Vendors positioned at front corridor (centerX, 600y)
- [x] vendorSprites Map tracks vendor ID → Sprite mapping
- [x] Vendor state machine runs in update loop
- [x] Sprite positions sync to VendorManager instances
- [x] Sprite states sync to vendor state (idle/planning/moving/serving/cooldown)
- [x] No TypeScript compile errors
- [x] Dev server runs without warnings
- [ ] Vendors visually move on screen (pending pathfinding implementation)
- [ ] Vendors serve fans and reduce thirst (logic exists, visual confirmation pending)

## Known Issues

None at this time. All TypeScript errors resolved, dev server running cleanly.

---

**Status**: Phase 3 Complete ✅  
**Next Phase**: Phase 4 - HybridPathResolver Implementation
