# World Grid & Wave Actor Implementation Plan

## Overview
Implement layered scenes with a foundational world grid, directional walls, and a semi-physical WaveActor that operates over the grid. StadiumScene will sit atop WorldScene, leveraging the grid for wave propagation and future pathfinding.

## Steps

1. **Create grid infrastructure and config** _(complete)_
   - Extend `gameBalance` with grid configuration.
   - Implement `GridManager` with world↔grid conversion, directional wall tracking, neighbor queries, and seat registration.
   - Implement `GridOverlay` graphics renderer with debug toggle.

### Step 1 To-Do
- [x] Add grid sizing, offsets, and debug styling to `gameBalance`.
- [x] Scaffold `GridManager` with conversion helpers, wall syncing, neighbor queries, and occupant registry.
- [x] Implement `GridOverlay` Phaser graphics with redraw scheduling and wall rendering.
- [x] Introduce ground line config with auto top-wall locking and occupant override support.

2. **Create WorldScene as root layer** _(complete)_
   - Instantiate grid, overlay, and expose GridManager.
   - Launch `StadiumScene` with `gridManager` reference and layer ordering.

### Step 2 To-Do
- [x] Create `WorldScene` class with lifecycle hooks (init, create, update).
- [x] Instantiate `GridManager` using camera dimensions; expose via getter.
- [x] Add `GridOverlay` with keyboard toggle (G key).
- [x] Launch `StadiumScene` as parallel scene via `scene.launch()`.
- [x] Register `WorldScene` in `config.ts` and update `MenuScene` to start `WorldScene`.

3. **Refactor StadiumScene to receive GridManager and register row walls** _(complete)_
   - Accept GridManager via init data.
   - Register seats and section row walls; mark stadium boundaries.
   - Share GridManager with vendor/seat managers.

### Step 3 To-Do
- [x] Update `StadiumScene.init()` to accept `gridManager` from init data and store as property.
- [x] Import `GridManager` type in `StadiumScene`, `SeatManager`, and `VendorManager`.
- [x] Update `SeatManager` constructor to accept optional `gridManager` parameter.
- [x] Update `VendorManager` constructor to accept optional `gridManager` parameter.
- [x] Pass `gridManager` to both managers when constructing in `StadiumScene.create()`.
- [x] Implement `SeatManager.registerSeatsAndWalls()` to register all seat positions with grid.
- [x] Register top-edge walls for each section row to enforce row boundaries.
- [x] Register perimeter walls around each stadium section to mark boundaries.

4. **Update scene registration in config** _(complete)_
   - Add `WorldScene` to config; adjust scene launch flow from `MenuScene`.

### Step 4 To-Do
- [x] Already completed in Step 2: `WorldScene` registered in `config.ts` scene array.
- [x] Already completed in Step 2: `MenuScene` updated to launch `WorldScene` instead of `StadiumScene`.

5. **Refactor WaveActor for movement and collision** _(complete)_
   - Add debug-only visuals, movement pathing, and collision hooks for vendors/obstacles.

### Step 5 To-Do
- [x] Create `WaveSprite` class extending `UtilityActor` with grid-aware position tracking.
- [x] Implement movement state machine (idle, moving, blocked, complete).
- [x] Add debug-only visual rendering (circle + direction indicator + path preview).
- [x] Implement grid-based movement logic with configurable speed and waypoint advancement.
- [x] Add collision detection for vendors (via grid occupants) and walls (via passable neighbors).
- [x] Emit events for movement milestones (`movementStarted`, `waypointReached`, `pathComplete`, `collisionDetected`, `pathBlocked`).
- [x] Create `WaveSpriteActor` adapter for ActorRegistry integration.

6. **Integrate WaveSprite with WaveManager** _(needs refactor)_
   - Generate grid paths, spawn WaveSprite, bridge events to column rolls, retain scoring/strength logic.
   - **ISSUE**: Current implementation spawns sprite immediately and uses timer-based propagation instead of sprite-driven collision detection.

### Step 6 To-Do
- [x] Add `GridManager` parameter to `WaveManager` constructor (optional).
- [x] Update `WaveManagerWrapper` to accept and pass through `gridManager`.
- [x] Update `StadiumScene` to pass `gridManager` to `WaveManagerWrapper`.
- [x] Implement `generateGridPath()` method that converts section IDs (e.g., ['A','B','C']) to grid waypoints using `SeatManager.getSectionCenterPosition()` and `GridManager.worldToGrid()`.
- [x] Add `getSectionCenterPosition()` method to `SeatManager` to retrieve section center positions.
- [x] Implement `spawnWaveSprite()` method that creates `WaveSprite` with generated path and subscribes to sprite events.
- [x] Call `spawnWaveSprite()` from `StadiumScene` on `waveStart` event with active wave path.
- [x] Bridge `WaveSprite` events: `waypointReached` → emit `sectionWaveVisual`, `pathComplete` → emit `wavePathComplete`, `collisionDetected` → adjust wave strength and emit `waveCollision`.
- [x] Implement `getSectionIdFromWaypoint()` helper to map grid waypoints back to section IDs using proximity calculations.
- [x] Preserve existing wave strength, scoring, multiplier, and section success tracking (WaveSprite adds visual movement only).

6b. **Refactor WaveSprite to drive wave propagation** _(complete)_
   - Redesigned sprite as vertical sweep line, delayed spawn until countdown ends, made sprite movement trigger wave checks.

### Step 6b To-Do
- [x] Change WaveSprite visual from circle to vertical line (ground to section top).
- [x] Remove grid-based pathfinding - wave moves horizontally unrestricted across sections.
- [x] Move `spawnWaveSprite()` call from `waveStart` to after countdown reaches zero in `updateCountdown()`.
- [x] Add `checkSectionCollision()` method to detect when sprite enters/exits section bounds.
- [x] Emit `waveSpriteEntersSection` and `waveSpriteExitsSection` events with section ID.
- [x] Update WaveManager to listen to sprite events instead of autonomous `propagateWave()` loop.
- [x] Calculate wave speed based on wave strength (higher strength = faster movement).
- [x] Update vendor collision to only apply penalty if vendor is in/assigned to the intersecting section.
- [x] Make StadiumScene trigger column animations when `waveSpriteEntersSection` fires (real-time, not timer-based).
- [x] Remove timer-based 1-second delays between section propagation.

7. **Build pathfinding foundation for vendor movement** _(complete)_
   - Utilize `GridManager` neighbor data in `HybridPathResolver` for grid-aware pathfinding.

### Step 7 To-Do
- [x] Add `GridManager` parameter to `HybridPathResolver` constructor (optional).
- [x] Implement `buildNavigationGraph()` to create hierarchical navigation nodes (corridor, stair, rowEntry).
- [x] Connect navigation nodes with bidirectional edges using gameBalance cost parameters.
- [x] Implement Dijkstra's algorithm in `planPath()` for shortest path calculation.
- [x] Add helper methods: `findNearestNode()`, `getNodeId()`, `nodeToSegment()`, `dijkstra()`.
- [x] Update `VendorManager.initializeSections()` to pass `GridManager` to `HybridPathResolver`.
- [x] Add navigation graph config to `gameBalance.vendorMovement` (corridorWidth, stairTransitionCost, etc.).
- [x] Add logging to `rebuildGraph()` for debugging navigation graph construction.

## Refactor Notes (Step 6b)
**Current Issues:**
- WaveSprite spawns immediately on `waveStart` and moves independently
- `propagateWave()` still uses timer-based sequential section processing
- Wave checks happen via WaveManager loop, not sprite collision
- Visual is a circle, not a vertical sweep line

**Target Architecture:**
- Countdown (3-2-1) runs without sprite movement
- WaveSprite spawns at countdown=0, positioned at left edge of first section
- Sprite is vertical line from ground to section top, moves horizontally
- As sprite crosses section boundary → emit `waveSpriteEntersSection` → WaveManager calculates fan participation
- As sprite exits section → emit `waveSpriteExitsSection` → finalize section results (success/sputter/death)
- Movement speed = base speed × (wave strength / 100) - faster waves for higher strength
- Vendor collision penalty only applies if vendor assigned to current section
- No grid pathfinding - linear horizontal movement only

## Notes
- Grid cells sized so a seat/fan mostly fills one cell; overlapping allowed.
- Directional walls enforce row boundaries, stairs, and ground plane constraints.
- WaveSprite visual controlled by `gameBalance.waveSprite.visible` (default false, toggle with W key).
- Plan accommodates future zoom/pan via coordinated cameras.
