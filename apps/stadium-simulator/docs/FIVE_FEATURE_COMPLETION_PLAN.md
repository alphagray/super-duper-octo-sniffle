# Five-Feature Game Completion Pass

**Status**: In Progress  
**Branch**: `sb/fix-pathfinding-and-target-acquisition`  
**Start Date**: November 30, 2025

## Overview

This plan adds five major features to complete the core game loop:
1. Vendor scoring/dropoff system with point pocketing
2. Wave-vendor collision with splat mechanics (risk/reward)
3. Mascot system reintegration (t-shirt cannon + ultimate ability)
4. Announcer box scenery with event callouts
5. Fan stat decay refactor (cluster-based, auto-wave triggers)

## Architecture Principles

- **Actors**: Game objects with state and logic
- **Sprites**: Pure render objects (visual only)
- **Behaviors**: Encapsulated AI logic attached to actors
- **AIManager**: Event orchestrator for actor interactions
- **State Machine Pattern**: Stats → State Derivation → Visual Updates
- **Separation of Concerns**: Stats layer, state layer, visual layer remain decoupled

---

## Phase 1: Grid Configuration & Foundation Updates

### 1.1 Update Stadium Grid Configuration ✅
**Files**: `stadium-grid-config.json`, `gameBalance.ts`

- ✅ Seats remain at rows 15-18 (original position - correct)
- ✅ Corridor row 14 configured with drop zones
- ✅ Drop zones added at cells (14,10) and (14,21) with `dropZone: true`
- ✅ Drop zone walls configured: `{top: true, left: false, right: false, bottom: false}`
- ✅ Ground zone at rows 19-23 (original position)
- ✅ Depth max remains at 350 (sufficient for current grid)

**Verification**:
- ✅ Grid loads without errors
- ✅ Corridor row 14 configured
- ✅ Drop zones marked at (14,10) and (14,21)
- ✅ Seats render in correct position (rows 15-18)
- ✅ Sections positioned correctly

---

### 1.2 Update GridManager & Pathfinding
**Files**: `GridManager.ts`, `GridPathfinder.ts`

- [ ] Add `dropZone` flag parsing in `loadFromConfig()`
- [ ] Implement `getDropZones(): {row, col}[]` query method
- [ ] Update `GridPathfinder` A* neighbor selection to respect directional walls
- [ ] Test pathfinding to drop zones from various positions

**Verification**:
- `getDropZones()` returns correct positions
- Pathfinding respects wall direction constraints
- Vendors can path to drop zones from sides/bottom but not top

---

### 1.3 Update Actor Positions for New Grid
**Files**: `SectionActor.ts`, `StadiumScene.ts`, `AIManager.ts`

- [ ] Update `SectionActor.populateFromData()` fan row offset (+1 to all rows)
- [ ] Verify depth calculations work with new row ranges

**Verification**:
- Fans render in rows 14-17
- Vendors spawn in ground zone (rows 19-23)
- Depth sorting correct

---

## Phase 2: Vendor Scoring & Dropoff System

### 2.1 Add Point Tracking to Vendor Behavior
**Files**: `DrinkVendorBehavior.ts`, `VendorActor.ts`

- [ ] Add `pointsEarned: number` field to behavior state
- [ ] Increment points on `serviceComplete` event:
  - Base: +1 point
  - High thirst (>80): +2 points
  - Low happiness (<20): +3 points
- [ ] Add getter `getPointsEarned()` for external queries
- [ ] Reset points to 0 on dropoff completion

**Verification**:
- Points accumulate correctly on service
- Bonus points awarded for urgent fans
- Console log shows point totals

---

### 2.2 Create DropZoneActor
**Files**: `DropZoneActor.ts` (new), `ActorFactory.ts`

- [ ] Create `DropZoneActor` extending `SceneryActor`
- [ ] Add dark square sprite (1x1 cell, depth 100)
- [ ] Implement white outline flash effect (500ms pulse)
- [ ] Register in `ActorFactory` and `ActorRegistry`
- [ ] Spawn two drop zones in `StadiumScene.create()` at (15,10) and (15,21)

**Verification**:
- Drop zones visible at corridor locations
- Flash effect triggers on vendor recall
- Zones registered in ActorRegistry

---

### 2.3 Implement Dropoff State Machine
**Files**: `DrinkVendorBehavior.ts`, `AIManager.ts`

- [ ] Add `droppingOff` state to vendor state machine
- [ ] Modify `forceRecallPatrol()` to path to nearest drop zone
- [ ] Implement dropoff sequence:
  - Fade out (2s, alpha 1.0→0.0)
  - Unavailable delay (3s)
  - Fade in (1s, alpha 0.0→1.0)
- [ ] Emit `vendorDropoff` event with `{vendorId, pointsEarned}`
- [ ] Transition to `awaitingAssignment` after dropoff

**Verification**:
- Vendors path to drop zones on recall
- Fade sequence plays correctly
- Vendors unavailable during dropoff

---

### 2.4 Wire Scoring Integration
**Files**: `GameStateManager.ts`, `StadiumScene.ts`

- [ ] Add `GameStateManager` listener for `vendorDropoff` event
- [ ] Call `addScore(points)` on dropoff
- [ ] Spawn floating text "+X pts" at drop zone position
  - Depth: 355
  - Color: green
  - Animation: move up 30px + fade over 1.5s
- [ ] Update score display UI

**Verification**:
- Score increases on dropoff
- Floating text appears at correct position
- Text visible above scenery

---

## Phase 3: Wave-Vendor Collision & Splat Mechanics

### 3.1 Implement Collision Detection
**Files**: `WaveSprite.ts`, `WaveManager.ts`

- [ ] Add `checkVendorCollisions(vendors: VendorActor[])` to WaveSprite
- [ ] Call collision check in `WaveManager.propagateWave()` per column
- [ ] Query vendors via `ActorRegistry.getByCategory('vendor')`
- [ ] Check vendor grid position matches wave column ±1 row in seat zones (16-19)
- [ ] Emit `vendorCollision` event with `{vendorId, sectionId, pointsAtRisk}`

**Verification**:
- Collision detection fires when wave hits vendor
- Event payload includes correct data
- Console logs show collision detection

---

### 3.2 Apply Collision Penalties
**Files**: `SectionActor.ts`, `AIManager.ts`

- [ ] Implement `SectionActor.applyCollisionPenalties(vendorPos, localRadius)`
- [ ] Apply section-wide attention penalty (-15 to all fans)
- [ ] Apply local happiness penalty (-10 to fans within 2-cell radius)
- [ ] Use `fanActor.modifyStats()` for stat changes
- [ ] Listen for collision events in AIManager/StadiumScene

**Verification**:
- Section attention drops on collision
- Local fans lose happiness
- Penalties apply correctly

---

### 3.3 Implement Splat Mechanics
**Files**: `DrinkVendorBehavior.ts`, `VendorActor.ts`, `gameBalance.ts`

- [ ] Calculate splat chance: `Math.min(0.50, pointsEarned * 0.05)`
- [ ] Roll random on collision, emit `vendorSplatted` if true
- [ ] Add `splatted` state to behavior
- [ ] Implement tumble animation:
  - Rotate sprite 720° over 1.5s
  - Scale bounce: 1.0→0.8→1.2→1.0
- [ ] Spawn floating text "-X pts SPILLED!" (depth 360, red)
- [ ] Force recall with +5s cooldown penalty
- [ ] Set `pointsEarned = 0` on splat

**Config**: `waveCollision: {sectionAttentionPenalty: 15, localHappinessPenalty: 10, localRadius: 2, splatChancePerPoint: 0.05, splatCooldownPenalty: 5000}`

**Verification**:
- Splat triggers based on probability
- Tumble animation plays
- Points lost and text displays
- Extended cooldown applies

---

## Phase 4: Mascot System Reintegration

### 4.1 Wire T-Shirt Cannon Ability
**Files**: `MascotBehavior.ts`, `MascotTargetingAI.ts`, `FanActor.ts`

- [ ] Implement `executeAbility()` stat application
- [ ] Call `MascotTargetingAI.selectTargets(sectionId, count)`
- [ ] Apply `tShirtCannon.statBoosts` to selected fans:
  - Attention: +6
  - Happiness: +3
- [ ] Use `fanActor.modifyStats()` for application
- [ ] Spawn expanding ripple sprite at section center
  - Scale: 0.5→3.0 over 800ms
  - Alpha: 1.0→0.0
  - Depth: 200

**Verification**:
- Ability targets correct fans
- Stats increase on targeted fans
- Ripple visual effect plays

---

### 4.2 Implement Attention Economy
**Files**: `MascotBehavior.ts`, `gameBalance.ts`

- [ ] Add `attentionBank: number` field (0-100)
- [ ] Drain `tShirtCannon.attentionDrain: 2` from each targeted fan
- [ ] Accumulate drained attention to mascot bank
- [ ] Clamp bank to 0-100 range
- [ ] Add getter `getAttentionBank()` for UI queries

**Verification**:
- Fans lose attention when targeted
- Mascot bank increases
- Bank respects max limit

---

### 4.3 Implement Ultimate Ability
**Files**: `MascotBehavior.ts`, `StadiumScene.ts`

- [ ] Add `ultimateReady` flag (true when `attentionBank >= 30`)
- [ ] Implement ultimate firing:
  - Target count × 2
  - Apply `ultimateStatBoosts` (attention +8, happiness +4)
  - Ripple radius × 1.5
  - Stadium white flash (depth 400, alpha 0.3, 200ms fade)
  - Drain bank to 0
- [ ] Hook `WaveManager.on('waveComplete')` listener
- [ ] Add +10 to bank on successful waves

**Verification**:
- Ultimate only fires when bank >=30
- Enhanced effects apply
- Flash effect visible
- Wave success boosts bank

---

### 4.4 Add Mascot UI Controls
**Files**: `StadiumScene.ts`, UI components

- [ ] Add mascot control panel below vendor controls
- [ ] "Target Section" button (cycles A→B→C→global)
- [ ] "Fire Ultimate" button (disabled when bank <30)
- [ ] Attention bank progress bar (0-100 fill)
- [ ] Display bank value text "Attention: X/100"
- [ ] Spawn mascot actor at (21, 16) with random personality

**Verification**:
- UI controls functional
- Target cycling works
- Ultimate button enables/disables correctly
- Progress bar updates in real-time

---

## Phase 5: Announcer Box & Event Callouts

### 5.1 Create Announcer Box Scenery
**Files**: `AnnouncerBoxActor.ts` (new), `StadiumScene.ts`

- [ ] Create `AnnouncerBoxActor` extending `SceneryActor`
- [ ] Gray rectangle: cols 10-21 (12-cell width), rows 12-13 (2 cells tall)
- [ ] Depth: 100
- [ ] Add two white horizontal "windows" (alpha 0.7):
  - Width: 10 cells each
  - Height: 0.3 cells
  - Positions: row offsets +0.3 and +1.2
- [ ] Instantiate in `StadiumScene.create()` at `gridToWorld(12, 15.5)`

**Verification**:
- Announcer box renders above corridor
- Windows visible with correct opacity
- Positioned centrally

---

### 5.2 Create Speech Bubble Overlay
**Files**: `SpeechBubble.ts` (update), `StadiumScene.ts`

- [ ] Create `SpeechBubbleOverlay` component (depth 350)
- [ ] White rounded rectangle (radius 8px)
- [ ] Black text with word wrap
- [ ] Triangular tail pointing to announcer box
- [ ] Auto-dismiss timer: 4000ms
- [ ] Queue system:
  - Max 3 queued callouts
  - 2000ms delay between displays

**Verification**:
- Bubble displays above all actors
- Tail points correctly
- Auto-dismiss works
- Queue prevents spam

---

### 5.3 Implement State Callouts
**Files**: `SectionActor.ts`, `AIContentManager.ts`

- [ ] Add stat monitoring in `SectionActor.update()`
- [ ] Throttle checks: `lastCalloutTime + 8000 < now`
- [ ] Trigger conditions:
  - Average thirst >70
  - Average attention <30
- [ ] Emit `stateCallout` event
- [ ] Generate vague hints via `AIContentManager.generateVagueCallout()`:
  - "The crowd is getting restless"
  - "Energy is dropping in the stands"
  - No section names or specific directions

**Config**: `announcer: {calloutDuration: 4000, minCalloutInterval: 8000, queueDelay: 2000, maxQueueLength: 3}`

**Verification**:
- Callouts trigger on threshold breach
- Throttling prevents spam
- Hints remain vague and helpful

---

### 5.4 Implement Wave Anticipation Callouts
**Files**: `WaveManager.ts`, `AIContentManager.ts`

- [ ] Hook `WaveManager.on('waveTriggered')` event
- [ ] Emit `waveAnticipation` with `{sectionId}`
- [ ] Generate callout with section name:
  - "Section {Name} is getting ready!"
  - "Something's brewing in Section {Name}!"
- [ ] Queue in speech bubble overlay

**Verification**:
- Callouts appear on wave trigger
- Section names display correctly
- Timing doesn't interfere with gameplay

---

## Phase 6: Fan Stat Decay Refactor

### 6.1 Implement Cluster-Based Happiness Decay
**Files**: `SectionActor.ts`, `gameBalance.ts`

- [ ] Cache `sessionLength` in `SectionActor` constructor
- [ ] Implement `updateClusterDecay(sessionTime)`:
  - Calculate progress: `sessionTime / sessionLength`
  - Interval timing:
    - Before 75% progress: every 7000ms
    - After 75% progress: every 3000ms
- [ ] On interval trigger:
  - Select random seed fan
  - Query `getAdjacentFans(seedRow, seedCol, radius: 2)`
  - Pick 3-7 fans from adjacency pool
  - Apply happiness decay to cluster only
- [ ] Decay formula based on session time:
  - Early (0-30s): -0.3 pts/sec
  - Mid (30-70s): -0.7 pts/sec
  - Late (70-100s): -1.5 pts/sec
- [ ] Skip fans in `engaged` or `drinking` states
- [ ] Clamp to min 0

**Config**: `clusterDecay: {earlyInterval: 7000, lateInterval: 3000, lateGameThreshold: 0.75, clusterSizeMin: 3, clusterSizeMax: 7, adjacencyRadius: 2}`

**Verification**:
- Cluster selection works correctly
- Decay rates match session time
- Intervals adjust at 75% mark

---

### 6.2 Refactor Thirst Buildup
**Files**: `FanActor.ts`, `gameBalance.ts`

- [ ] Remove random activation logic from `updateStats()`
- [ ] Implement two-phase linear buildup:
  - Phase 1 (0-60 thirst): +0.8 pts/sec
  - Phase 2 (60-100 thirst): +2.5 pts/sec
- [ ] Apply per-fan (not clustered)

**Verification**:
- Thirst builds slowly early
- Accelerates after 60 threshold
- No random jumps

---

### 6.3 Implement Auto-Wave Triggering
**Files**: `FanActor.ts`, `SectionActor.ts`, `WaveManager.ts`, `gameBalance.ts`

- [ ] Add `waveStartThreshold: 75` to config
- [ ] In `FanActor.updateStats()`:
  - Check if `happiness >= 75`
  - Set `waveReady = true`
  - Emit `fanWaveReady` event
- [ ] In `SectionActor`:
  - Listen for `fanWaveReady`
  - Increment `readyFanCount`
  - When `readyFanCount >= 5`, emit `sectionWaveInitiate({sectionId})`
- [ ] In `WaveManager`:
  - Listen for `sectionWaveInitiate`
  - Call `startWave(sectionId)` automatically

**Verification**:
- Fans reach threshold naturally
- Waves start automatically
- No manual player trigger needed

---

### 6.4 Add Section Blink Effect
**Files**: `SectionActor.ts`, `WaveManager.ts`

- [ ] Hook `WaveManager.emit('waveCountdownStarted', {sectionId})`
- [ ] In `SectionActor`, listen for matching section
- [ ] Apply light blue outline stroke:
  - Width: 3px
  - Depth: 99
- [ ] Blink sequence (total 2.25s):
  - Visible 0.5s
  - Hidden 0.25s
  - Visible 0.5s
  - Hidden 0.25s
  - Visible 0.5s
  - Hidden
- [ ] Remove outline after sequence

**Verification**:
- Blink plays during countdown
- Timing matches 3s countdown window
- Outline removed after completion

---

### 6.5 Adjust Initial Fan Stats
**Files**: `gameBalance.ts`

- [ ] Update `fanStats.defaultStats`:
  - `happiness: 60` (was 50)
  - `thirst: 20` (was 30)
  - `attention: 40` (was 50)
- [ ] Add cluster visual feedback:
  - Scale tween: 1.0→1.1→1.0 over 300ms
  - Apply to fans in decay cluster

**Verification**:
- Fans start with adjusted stats
- No immediate wave readiness
- Visual feedback on cluster decay

---

## Testing & Validation

### Integration Tests
- [ ] All five features work independently
- [ ] Features interact correctly (wave-vendor collision, mascot-wave synergy)
- [ ] No performance degradation with all features active
- [ ] UI remains responsive and clear

### Gameplay Tests
- [ ] Vendor dropoff creates meaningful risk/reward decisions
- [ ] Wave splat events feel fair and impactful
- [ ] Mascot abilities provide strategic options
- [ ] Announcer callouts are helpful without being intrusive
- [ ] Auto-wave triggering creates urgency without overwhelming player

### Edge Cases
- [ ] Multiple vendors splatted simultaneously
- [ ] Mascot ultimate during wave collision
- [ ] Callout queue overflow handling
- [ ] Cluster decay with very few fans remaining
- [ ] Pathfinding to occupied drop zones

---

## Configuration Summary

### New Config Values (`gameBalance.ts`)

```typescript
ui: {
  depths: {
    animatedActorMax: 360  // was 350
  }
}

waveCollision: {
  sectionAttentionPenalty: 15,
  localHappinessPenalty: 10,
  localRadius: 2,
  splatChancePerPoint: 0.05,
  splatCooldownPenalty: 5000
}

announcer: {
  calloutDuration: 4000,
  minCalloutInterval: 8000,
  queueDelay: 2000,
  maxQueueLength: 3
}

fanStats: {
  waveStartThreshold: 75,
  defaultStats: {
    happiness: 60,
    thirst: 20,
    attention: 40
  }
}

clusterDecay: {
  earlyInterval: 7000,
  lateInterval: 3000,
  lateGameThreshold: 0.75,
  clusterSizeMin: 3,
  clusterSizeMax: 7,
  adjacencyRadius: 2
}
```

### Grid Config Updates (`stadium-grid-config.json`)
- Seat rows: 16-19 (was 15-18)
- Corridor: row 15 (new)
- Ground: rows 20-24 (was 19-23)
- Drop zones: (15,10), (15,21) with directional walls

---

## Progress Tracking

**Last Updated**: November 30, 2025  
**Current Phase**: Phase 1 - Grid Configuration & Foundation Updates  
**Next Step**: 1.1 - Update Stadium Grid Configuration
