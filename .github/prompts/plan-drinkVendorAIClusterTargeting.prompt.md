# Plan: DrinkVendor AI & Cluster-Based Targeting (Revised Architecture)

Implement polymorphic vendor behavior architecture with DrinkVendor **actor** (not sprite) for seat assignment, cluster-based fan targeting (Manhattan distance), bounded retries respecting adjacency rules, recall to nearest vertical access (corridor row 14 or ground row 19), and patrol. Wave penalty integration deferred.

---

## Phase 1: Grid Access Helper & Distance Utilities

**Goal:** Foundation for vertical access selection and distance calculations.

1. **Create `src/utils/gridMath.ts`**
   - Export `manhattanDistance(rowA: number, colA: number, rowB: number, colB: number): number` returning `Math.abs(rowA - rowB) + Math.abs(colA - colB)`

2. **Add `getNearestVerticalAccess()` to `GridManager.ts`**
   - Method signature: `getNearestVerticalAccess(seatRow: number, seatCol: number): { row: number; col: number; zone: 'corridor' | 'ground' } | null`
   - Evaluate two candidates at same column: corridor (row 14) and top ground (row 19)
   - Check each cell: passable + zoneType matches ('corridor' or 'ground')
   - Use `manhattanDistance` to pick closer candidate (vertical delta only since column fixed)
   - Return null if both blocked
   - Gate debug log via `gameBalance.vendorDebug.logAccessSelection` showing chosen cell + zone type

3. **Update `gameBalance.ts` vendorDebug section**
   - Add `logAccessSelection: boolean` (default `true` for early validation)

---

## Phase 2: Behavior Abstraction & Config Defaults

**Goal:** Define state machine interface and per-vendor configuration layer.

4. **Create `src/actors/interfaces/AIBehavior.ts`**
   - Export `AIActorState` enum: `'idle' | 'assigning' | 'moving' | 'serving' | 'recallPending' | 'recalling' | 'patrolling'`
   - Export `AIActorBehavior` interface:
     ```ts
     interface AIActorBehavior {
       requestAssignment(targetCell: { row: number; col: number }): void;
       requestRecall(): void;
       tick(deltaTime: number): void;
       onArrival(): void;
       onServeComplete(): void;
       getState(): AIActorState;
     }
     ```

5. **Add `gameBalance.vendor.drink` config**
   - Nested under `gameBalance.vendorTypes.drink`:
     ```ts
     targeting: {
       thirstWeight: 1.0,
       clusterSizeWeight: 0.5,
       distanceWeight: 0.3,
       clusterRadius: 3, // Manhattan radius for fan grouping
       minimumServeThirst: 25,
     },
     retry: {
       maxAttempts: 3,
       logOnlyFinalFailure: true,
     },
     patrol: {
       enabled: true,
       intervalMs: 4000, // time between random waypoint selections
       zones: ['corridor', 'ground'] as ZoneType[],
     }
     ```

---

## Phase 3: Actor Structure & Vendor Adapters

**Goal:** Separate actor (logic) from sprite (rendering) following existing Actor system patterns.

6. **Update `src/sprites/Vendor.ts` (rendering only)**
   - Keep as Phaser visual container (head + body rectangles)
   - Remove all business logic (state machine, targeting, pathfinding)
   - Add `updateVisualState(state: AIActorState)` method for visual feedback (tint, animation)
   - Keep personality integration for visual customization only

7. **Create `src/actors/adapters/VendorActor.ts` (base actor)**
   - Extends `AnimatedActor` (parallel to existing FanActor, WaveSpriteActor)
   - Wraps `Vendor` sprite for rendering
   - Contains: position tracking, path following, movement state
   - Properties: `currentPath`, `currentSegmentIndex`, `position: { x, y }`
   - Methods: `setPath()`, `updateMovement(dt)`, `getGridPosition()`
   - **Does NOT contain targeting/assignment logic** (that's in behavior layer)

8. **Create `src/actors/adapters/DrinkVendorActor.ts`**
   - Extends `VendorActor`
   - Adds reference to `DrinkVendorBehavior` instance
   - Constructor: `constructor(sprite: Vendor, behavior: DrinkVendorBehavior, ...actorParams)`
   - Delegates `update(dt)` to behavior: `this.behavior.tick(dt)`
   - Exposes behavior state via `getState()` wrapper

9. **Create `src/actors/behaviors/DrinkVendorBehavior.ts`**
   - Implements `AIActorBehavior` interface
   - Constructor accepts: `vendorActor: DrinkVendorActor`, `aiManager`, `gridManager`, `actorRegistry`, optional config overrides
   - Merge instance overrides with `gameBalance.vendorTypes.drink` defaults
   - Store state machine: `private state: AIActorState = 'idle'`
   - Store current assignment: `targetSeat`, `assignedFan`, `currentCluster`, `retryCount`
   - **All targeting, retry, cluster, patrol logic lives here**

---

## Phase 4: Seat Assignment with Bounded Retries

**Goal:** Implement adjacency-aware seat targeting with up to 3 attempts.

10. **Add `findAdjacentSeatCandidates()` to `DrinkVendorBehavior`**
    - Input: `targetRow: number, targetCol: number, section: StadiumSection`
    - Returns: `Array<{ row: number; col: number }>`
    - Order: target cell → horizontal left (col-1) → horizontal right (col+1) → vertical up/down (if edge column OR stair boundary)
    - Vertical adjacency check:
      - Always allowed if `targetCol === 0` or `targetCol === section.getMaxColumn()`
      - OR if cell shares boundary with stair zone (call helper `isStairAdjacent(row, col)` checking neighbors for `zoneType === 'stair'`)

11. **Add `isStairAdjacent()` helper to `DrinkVendorBehavior`**
    - Check 4-directional neighbors via `gridManager.getCell()`
    - Return true if any neighbor has `zoneType === 'stair'`

12. **Implement `requestAssignment()` in `DrinkVendorBehavior`**
    - Set `state = 'assigning'`
    - Get candidates via `findAdjacentSeatCandidates()`
    - Loop up to `maxAttempts`:
      - Try candidate cell: check passable + zoneType compatible
      - If valid: assign seat, request path via `aiManager`, break loop
      - Else: increment `retryCount`, continue
    - On 3rd failure: log warning (if `logOnlyFinalFailure`), call `requestRecall()`, emit `actorAutoRecalled` event

---

## Phase 5: Fan Clustering & Scoring

**Goal:** Group fans by proximity, score clusters, select highest-value target.

13. **Add `buildFanClusters()` to `DrinkVendorBehavior`**
    - Input: `fans: Fan[], centerRow: number, centerCol: number, radius: number`
    - Output: `Array<{ fans: Fan[], avgThirst: number, center: {row, col} }>`
    - Algorithm:
      - Filter fans within Manhattan radius from center
      - Group fans into clusters (simple: all fans in radius = 1 cluster for now; future: DBSCAN)
      - Calculate `avgThirst` per cluster

14. **Add `scoreCluster()` to `DrinkVendorBehavior`**
    - Formula: `(avgThirst * thirstWeight) + (clusterSize * clusterSizeWeight) - (distance * distanceWeight)`
    - Distance = Manhattan distance from vendor position to cluster center

15. **Implement `selectBestFanTarget()` in `DrinkVendorBehavior`**
    - Build clusters from assigned section's fans
    - Score each cluster
    - Pick highest-scoring cluster
    - Within cluster: select fan with highest thirst (tie-break: nearest via Manhattan)
    - Return `{ fan: Fan, seatCell: { row, col } }`

16. **Update `requestAssignment()` to call cluster logic**
    - After getting section assignment, call `selectBestFanTarget()`
    - Use returned seat cell for adjacency retry logic

---

## Phase 6: Service Loop & Recall

**Goal:** Re-evaluate targets after service, trigger recall when no valid fans remain.

17. **Implement `onServeComplete()` in `DrinkVendorBehavior`**
    - Decrement fan's thirst, increment happiness (call `fan.drinkServed()`)
    - Re-run `selectBestFanTarget()` on current section
    - If result fan thirst < `minimumServeThirst`: set `state = 'recallPending'`, call internal `initiateRecall()`
    - Else: assign new fan, request path

18. **Implement `initiateRecall()` in `DrinkVendorBehavior`**
    - Call `gridManager.getNearestVerticalAccess(currentRow, currentCol)`
    - If result null: fallback to section home corridor cell (via `actorRegistry` or hardcoded row 14, center col)
    - Request path to access cell
    - Set `state = 'recalling'`
    - Emit `vendorRecalling` event with `{ vendorId, targetZone: 'corridor' | 'ground' }`

19. **Implement `onArrival()` in `DrinkVendorBehavior`**
    - If `state === 'recalling'`: transition to `'patrolling'`, start patrol timer
    - If `state === 'moving'`: transition to `'serving'`, call service animation

---

## Phase 7: Patrol Behavior

**Goal:** Time-sliced random movement in neutral zones when unassigned.

20. **Add `patrolTimer` and `currentPatrolWaypoint` to `DrinkVendorBehavior` state**
    - Initialize `patrolTimer = 0`

21. **Implement patrol logic in `tick(deltaTime)` for `state === 'patrolling'`**
    - Decrement `patrolTimer -= deltaTime`
    - When timer ≤ 0:
      - Get passable cells in current zone (corridor or ground) via `gridManager.getAllCells().filter(...)`
      - Pick random cell within ±5 columns of current position (prevent cross-stadium walks)
      - Request path to waypoint
      - Reset `patrolTimer = patrol.intervalMs`
      - Set `state = 'moving'` (transition back to patrol after arrival)

22. **Update `onArrival()` to handle patrol loop**
    - If `previousState === 'patrolling'`: reset `state = 'patrolling'`, restart timer

---

## Phase 8: AIManager Integration

**Goal:** Hook behavior into vendor lifecycle and expose assignment API.

23. **Update `AIManager.spawnInitialVendors()` to instantiate DrinkVendorActor**
    - When `type === 'drink'`:
      - Create `Vendor` sprite (visual only)
      - Create `DrinkVendorBehavior` instance
      - Create `DrinkVendorActor` wrapping sprite + behavior
      - Register actor in `ActorRegistry`
      - Store reference in `VendorInstance.actor`

24. **Add `AIManager.requestVendorAssignment(vendorId, sectionIdx)`**
    - Validate vendor exists and is idle/patrolling
    - Get `DrinkVendorActor` from registry
    - Call `actor.behavior.requestAssignment({ targetCell: sectionHomeSeat })`
    - Emit `vendorAssignmentStarted` event

25. **Add `AIManager.requestVendorRecall(vendorId)`**
    - Call `actor.behavior.requestRecall()`

26. **Update `AIManager.update(deltaTime)` to call actor updates**
    - Loop through vendor actors
    - Call `actor.update(deltaTime)` which delegates to `behavior.tick(dt)`

---

## Phase 9: UI Integration

**Goal:** Wire StadiumScene buttons to assignment/recall flow.

27. **Update `StadiumScene` vendor button click handler**
    - On click: call `aiManager.requestVendorAssignment(vendorId, clickedSectionIdx)`
    - Listen to `vendorAssignmentStarted`, `actorAutoRecalled` events
    - Update button visual state (color, label) based on vendor state

28. **Add visual feedback for vendor state changes**
    - Subscribe to `actorStateChanged` event from behaviors
    - Call `vendorSprite.updateVisualState(newState)`
    - Apply tint/overlay based on state (e.g., yellow outline during assignment, red during recall)

---

## Phase 10: Pathfinding Enhancements

**Goal:** Support multi-segment paths with access anchor cells.

29. **Update `HybridPathResolver.findPath()` signature**
    - Add optional parameter: `accessAnchor?: { row: number; col: number }`
    - If provided: insert anchor as waypoint before seat infiltration segment
    - Modify path array: `[start → anchor → rowEntry → seat]` instead of `[start → rowEntry → seat]`

30. **Update `DrinkVendorBehavior.requestAssignment()` path request**
    - Get access cell via `gridManager.getNearestVerticalAccess(targetSeatRow, targetSeatCol)`
    - Pass as `accessAnchor` to pathfinder

---

## Phase 11: Logging & Debug Visualization

**Goal:** Validate behavior with targeted logging and optional debug overlays.

31. **Add conditional logging in `DrinkVendorBehavior`**
    - Gate all logs via `gameBalance.vendorDebug.enabled`
    - Log cluster selection (debug level): `Selected cluster with ${clusterSize} fans, avgThirst=${avgThirst}, score=${score}`
    - Log seat retry only on 3rd failure (warn level): `Failed all ${maxAttempts} seat attempts at (${row},${col}), auto-recalling`
    - Log access selection via existing `getNearestVerticalAccess()` debug flag

32. **Optional: Add debug overlay in `GridOverlay`**
    - Render cluster circles (radius = `clusterRadius` cells) around assigned vendor
    - Draw line from vendor to target fan
    - Show access anchor cell with distinct marker

---

## Revised File Structure

```
src/
├── actors/
│   ├── VendorActor.ts          # Base vendor actor (path/movement)
│   ├── DrinkVendorActor.ts     # Drink vendor actor (adds behavior)
│   ├── behaviors/
│   │   └── DrinkVendorBehavior.ts  # All targeting/cluster/patrol logic
│   └── interfaces/
│       └── AIBehavior.ts            # State enum + behavior interface
├── sprites/
│   └── Vendor.ts                    # Visual only (Phaser container)
├── managers/
│   ├── AIManager.ts                 # Orchestrates vendor actors
│   └── GridManager.ts               # +getNearestVerticalAccess()
├── utils/
│   └── gridMath.ts                  # manhattanDistance()
└── config/
    └── gameBalance.ts               # +drink config, +logAccessSelection
```

---

## Further Considerations

1. **Stair boundary caching** – Should `GridManager` build a stair-adjacent seat cache during `loadZoneConfig()`? (Faster than runtime neighbor checks; adds ~20 cells to cache.)

2. **Cluster algorithm evolution** – Current plan uses simple radius filter; future DBSCAN or k-means could split dense crowds into multiple clusters. (Leave interface extensible.)

3. **Patrol zone fallback** – If no valid patrol cells in current zone (blocked), should vendor switch zones or remain idle? (Option A: stay idle; B: find any passable ground; C: emit stuck event.)

4. **Config hot-reload** – Should behavior weights support runtime adjustment via debug panel? (Useful for tuning without restart; requires reactive config binding.)

---

## Execution Order

Phase 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

## Validation Milestones

- After Phase 4: Verify seat retry logic with manual assignment to blocked cells
- After Phase 5: Check cluster scoring via debug logs in high-density section
- After Phase 7: Observe patrol movement in idle vendors (visual confirmation)
- After Phase 10: Trace full path with access anchor using grid overlay
