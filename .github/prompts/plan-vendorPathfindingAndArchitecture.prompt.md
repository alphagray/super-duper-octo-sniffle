# Vendor Pathfinding & Architecture Refactoring Plan

## Overview

This plan implements vendor pathfinding and navigation across the stadium, enabling vendors to climb stairs between sections, target thirsty fans, and integrate with the existing actor system. It also addresses critical separation of concerns issues identified in the codebase.

## Current State Analysis

### What Works
- **HybridPathResolver**: Fully implemented Dijkstra pathfinding with navigation graph, node types (corridor/stair/row entry/seat), and target scoring
- **ActorRegistry**: Has `update()` method (lines 103-107) for actor lifecycle management
- **AIManager**: Complete vendor state machine (idle/planning/movingSegment/serving/cooldown/distracted)
- **VendorActor**: Exists as adapter wrapper for Vendor sprites
- **GridManager**: Grid/world coordinate conversion with height level support
- **LevelService**: Extensible data structure for sections, fans, vendors

### What's Missing
- **ActorRegistry.update()** not called in StadiumScene update loop
- **Game logic split**: StadiumSection sprite contains logic that should be in SectionActor
  - `updateFanStats()` (lines 130-145)
  - `getAggregateStats()` (lines 152-156)
  - `calculateColumnParticipation()` (lines 192-257, duplicates actor logic)
- **Pathfinding integration**: AIManager line 464 has TODO instead of calling `pathResolver.findPath()`
- **Vendor movement**: Uses linear interpolation stub (lines 295-344) instead of following path segments
- **Stairs infrastructure**: No StairsActor, level data missing stairs, GridManager can't handle vertical navigation
- **Visual environment**: No ground/skybox actors for context

## Implementation Phases

### Phase 1: Actor System Integration (Foundation) ✅ COMPLETE

**Purpose**: Fix separation of concerns, enable actor update loop

**Tasks**:
1. ✅ Wire ActorRegistry into scene loop
   - Added `this.actorRegistry.update(delta)` to `StadiumScene.update()` at line 500
   - Actors with `update()` methods are now called each frame

2. ✅ Move game logic from StadiumSection → SectionActor
   - Added `updateFanStats()` method to `SectionActor` - callable, not automatic
   - Added `getAggregateStats()` method to `SectionActor` with cached aggregates
   - Added `getSectionWaveBonus()` method to `SectionActor`
   - Added `updateAggregateCache()` private method for performance
   - Added `updateFanIntensity()` method to `SectionActor` - updates fan visual colors
   - Added `resetFanWaveState()` method to `SectionActor` - clears wave flags before calculations
   - Added `calculateColumnParticipation()` method to `SectionActor` - wave participation logic with peer pressure
   - Added `playColumnAnimation()` method to `SectionActor` - triggers fan wave animations
   - Deprecated all game logic methods in StadiumSection sprite (temporary delegation for backwards compatibility)
   - StadiumScene now calls SectionActor methods via actorRegistry for stats updates

**Files Modified**:
- ✅ `src/scenes/StadiumScene.ts` (added actorRegistry.update call, switched to actor methods for stats)
- ✅ `src/actors/adapters/SectionActor.ts` (added all game logic methods: updateFanStats, getAggregateStats, getSectionWaveBonus, updateFanIntensity, resetFanWaveState, calculateColumnParticipation, playColumnAnimation)
- ✅ `src/sprites/StadiumSection.ts` (deprecated game logic methods with @deprecated tags, kept temporary delegation)

**Known Tech Debt**:
- ⚠️ StadiumScene still stores `sections: StadiumSection[]` sprite references
- ⚠️ Wave event handlers (columnWaveReached, sectionWave) still call deprecated sprite methods
- ⚠️ Need to refactor StadiumScene to use actor references from actorRegistry for wave methods
- ⚠️ Deprecated sprite methods should be removed once all callers migrated

**Validation**:
- ✅ Fan stats update correctly during gameplay
- ✅ Actor update methods called each frame via actorRegistry
- ✅ All game logic duplicated from sprite to actor
- ✅ No TypeScript errors
- ⚠️ Wave system still uses deprecated sprite methods (backwards compatibility maintained)

---

### Phase 2: Stairs & Navigation Infrastructure ✅ COMPLETE

**Purpose**: Enable vertical navigation between sections via stairs

#### 2.1: Create StairsActor ✅

**Implementation**: Created `src/actors/adapters/StairsActor.ts`
- SceneryActor with gridBounds, connectsSections, worldBounds
- White rectangle sprite (2 columns × 4 rows grid tiles), depth -50
- Stores reference to Phaser rectangle sprite
- getSnapshot() method for registry queries

#### 2.2: Update GridManager for Vertical Navigation ✅

**Option A** (Implemented): Mark stair cells as passable in occupancy grid
- Stairs NOT marked as occupied in GridManager
- Cells remain traversable for pathfinding
- No vertical neighbor cost needed (handled by stair nodes in navigation graph)

#### 2.3: Update HybridPathResolver ✅

**Implementation**:
- Added ActorRegistry parameter to constructor
- Modified `buildNavigationGraph()` to query `ActorRegistry.getByCategory('stairs')`
- Creates navigation nodes for each StairsActor
- Connects stair nodes to adjacent sections' corridor nodes (top/front)
- Applies stair traversal cost (1.5× base movement cost)
- Fallback to legacy hardcoded stairs if ActorRegistry unavailable

#### 2.4: Extend Level Data Structure ✅

**Interface**: Added `StairData` to `src/services/LevelService.ts`
```typescript
export interface StairData {
  id: string;
  gridLeft: number;
  gridTop: number;
  width: number;
  height: number;
  connectsSections: [string, string];
}
```

**Mock Data**:
- Section A: gridLeft 2-9 (with left gutter)
- Stairs A-B: gridLeft 10-11 (2 columns, 4 rows)
- Section B: gridLeft 12-19 (abutting stairs)
- Stairs B-C: gridLeft 20-21 (2 columns, 4 rows)
- Section C: gridLeft 22-29 (abutting stairs)
- Vendors repositioned to gridCol 6 and 16

**Files Modified**:
- ✅ `src/actors/adapters/StairsActor.ts` (new file)
- ✅ `src/actors/interfaces/ActorTypes.ts` (added 'stairs' to ActorCategory)
- ✅ `src/actors/ActorFactory.ts` (added 'stairs' to ActorType)
- ✅ `src/managers/GridManager.ts` (stair cells passable - no changes needed)
- ✅ `src/managers/HybridPathResolver.ts` (integrated stair nodes from registry)
- ✅ `src/managers/AIManager.ts` (pass actorRegistry to HybridPathResolver)
- ✅ `src/services/LevelService.ts` (added StairData interface, mock stairs data)
- ✅ `src/scenes/StadiumScene.ts` (instantiate StairsActor from level data, pass actorRegistry to AIManager)

**Validation**:
- ✅ Stairs render as white rectangles between sections
- ✅ Navigation graph includes stair nodes from ActorRegistry
- ✅ Pathfinding can route through stairs (ready for Phase 4 testing)
- ✅ No TypeScript errors

---

### Phase 3: Visual Environment ✅ COMPLETE

**Purpose**: Add ground and skybox for visual context

**Tasks**:
1. ✅ Create `GroundActor` (SceneryActor)
   - Medium-dark green fill (0x2d5016)
   - Renders from `groundLineY` (60% of canvas height) to canvas bottom
   - Depth -100
   - Created in `src/actors/adapters/GroundActor.ts`

2. ✅ Create `SkyboxActor` (SceneryActor)
   - Sky blue color (0x87CEEB) - solid color for now
   - Renders from canvas top to `groundLineY`
   - Depth -101
   - Created in `src/actors/adapters/SkyboxActor.ts`
   - Note: Gradient fill deferred (requires Phaser.Graphics upgrade)

3. ✅ Integrate into StadiumScene.create()
   - Instantiated before sections
   - Added to ActorRegistry
   - groundLineY calculated as 60% of canvas height

**Files Modified**:
- ✅ `src/actors/adapters/GroundActor.ts` (new file)
- ✅ `src/actors/adapters/SkyboxActor.ts` (new file)
- ✅ `src/actors/interfaces/ActorTypes.ts` (added 'ground' and 'skybox' to ActorCategory)
- ✅ `src/actors/ActorFactory.ts` (added 'ground' and 'skybox' to ActorType)
- ✅ `src/config/gameBalance.ts` (added visual config section)
- ✅ `src/scenes/StadiumScene.ts` (instantiate ground/skybox before sections)

**Validation**:
- ✅ Ground and skybox render behind all game objects
- ✅ No z-index conflicts (depths -101 and -100)
- ✅ No TypeScript errors

---

### Phase 4: Vendor Pathfinding Implementation (Core Gameplay)

**Purpose**: Wire up vendor pathfinding and movement

#### 4.1: Implement Pathfinding Call in AIManager

**Location**: Line 464 in `src/managers/AIManager.ts`

**Current Code**:
```typescript
// TODO: Implement pathfinding
const path = { segments: [], totalCost: 0 };
```

**Replacement**:
```typescript
const path = this.pathResolver.findPath(
  instance.position,
  target.position,
  instance.profile
);

if (!path || path.segments.length === 0) {
  this.logger.warn(`No path found for vendor ${instance.id} to target`, { target });
  instance.state = 'idle';
  continue;
}
```

#### 4.2: Replace Linear Movement with Path Following

**Location**: Lines 295-344 in `src/managers/AIManager.ts` (updateVendorPositions)

**Current**: Linear interpolation between start/end positions

**Replacement**:
- Track current segment index in VendorInstance
- Each frame, move along current segment
- When segment complete, advance to next segment
- When all segments complete, emit `vendorReachedTarget`

**Pseudocode**:
```typescript
private updateVendorPositions(deltaTime: number) {
  for (const instance of this.vendorInstances.values()) {
    if (instance.state !== 'movingSegment') continue;
    
    const segment = instance.path!.segments[instance.currentSegmentIndex];
    const speed = instance.profile.baseSpeed; // pixels/second
    const distance = speed * (deltaTime / 1000);
    
    // Move toward segment end
    const dx = segment.end.x - instance.position.x;
    const dy = segment.end.y - instance.position.y;
    const distanceToEnd = Math.sqrt(dx * dx + dy * dy);
    
    if (distanceToEnd <= distance) {
      // Reached segment end
      instance.position = { ...segment.end };
      instance.currentSegmentIndex++;
      
      if (instance.currentSegmentIndex >= instance.path!.segments.length) {
        // Reached final destination
        this.emit('vendorReachedTarget', { vendorId: instance.id, target: instance.target });
        instance.state = 'serving';
        instance.stateTimer = this.getServingDuration(instance);
      }
    } else {
      // Move along segment
      const ratio = distance / distanceToEnd;
      instance.position.x += dx * ratio;
      instance.position.y += dy * ratio;
    }
  }
}
```

#### 4.3: Add Vendor Section Assignment

**Purpose**: Allow player to assign vendors to sections via UI

**Implementation**:
```typescript
// Add to AIManager
public assignVendorToSection(vendorId: string, sectionIndex: number): void {
  const instance = this.vendorInstances.get(vendorId);
  if (!instance) {
    this.logger.warn(`Cannot assign unknown vendor ${vendorId}`);
    return;
  }
  
  instance.assignedSection = sectionIndex;
  this.logger.info(`Vendor ${vendorId} assigned to section ${sectionIndex}`);
  
  // If vendor is idle, immediately plan route to assigned section
  if (instance.state === 'idle') {
    instance.state = 'planning';
  }
}
```

**Files Modified**:
- `src/managers/AIManager.ts` (implement pathfinding call, path following, section assignment)
- `src/managers/interfaces/VendorTypes.ts` (add currentSegmentIndex to VendorInstance)

**Validation**:
- Vendors follow path segments from HybridPathResolver
- Vendors climb stairs to reach other sections
- Vendors emit `vendorReachedTarget` at destination
- Section assignment triggers replanning

---

### Phase 5: Level Data Integration

**Purpose**: Load stairs from level data, integrate into navigation graph

**Tasks**:
1. Update StadiumScene.create() to parse stairs from levelData
   - Loop through `levelData.stairs`
   - Instantiate StairsActor for each
   - Register with ActorRegistry
   - Create Phaser rectangle sprite for rendering

2. Update HybridPathResolver.buildNavigationGraph()
   - Query `ActorRegistry.getByKind('stairs')` instead of hardcoded positions
   - Create stair nodes dynamically based on StairsActor grid bounds
   - Connect to adjacent sections' corridor/row entry nodes

**Files Modified**:
- `src/scenes/StadiumScene.ts` (parse and instantiate stairs)
- `src/managers/HybridPathResolver.ts` (read stairs from registry)

**Validation**:
- Stairs load from level data
- Navigation graph updates automatically when stairs change
- Pathfinding routes through stairs dynamically

---

## Testing Strategy

### Per-Phase Testing

**Phase 1**:
- [ ] ActorRegistry.update() called each frame (add debug log)
- [ ] Fan stats update correctly (verify thirst/happiness changes)
- [ ] No duplicate logic warnings in console

**Phase 2**:
- [ ] Stairs render as white rectangles between sections
- [ ] Navigation graph includes stair nodes (debug overlay shows connections)
- [ ] Manual pathfinding test: vendor can route from Section A to Section C via stairs

**Phase 3**:
- [ ] Ground/skybox render behind all objects
- [ ] No visual artifacts or z-index issues

**Phase 4**:
- [ ] Vendors follow curved/multi-segment paths (not straight lines)
- [ ] Vendors climb stairs when navigating between sections
- [ ] VendorReachedTarget event fires at correct positions
- [ ] Section assignment UI triggers vendor replanning

**Phase 5**:
- [ ] Changing level data stairs updates navigation graph
- [ ] Multiple stair configurations work (1 stair, 3 stairs, etc.)

**Phase 1.5** (Tech Debt Cleanup - after Phase 5):
- [ ] StadiumScene stores `sectionActors: SectionActor[]` instead of sprite array
- [ ] Wave event handlers call actor methods directly (not deprecated sprite methods)
- [ ] Remove all @deprecated methods from StadiumSection sprite
- [ ] All section interactions go through ActorRegistry

### Integration Testing

**Full Gameplay Loop**:
1. Start session
2. Assign vendor to Section C (requires stairs from spawn in Section A)
3. Observe vendor pathfinding and stair climbing
4. Vendor reaches thirsty fan in Section C
5. Vendor serves drink (thirst -100, happiness +15)
6. Vendor returns to idle, awaits new assignment

**Wave Interference**:
1. Start wave in Section B
2. Vendor currently in Section B should enter `distracted` state
3. Vendor path should recalculate to avoid active wave zone
4. Vendor resumes normal movement after wave completes

---

## Risk Assessment

### Low Risk
- Phase 1 (Actor system integration): Moves existing logic, no new features
- Phase 3 (Visual environment): Pure rendering, no gameplay impact

### Medium Risk
- Phase 2.2 (GridManager vertical navigation): May need option B if option A causes issues
- Phase 4.2 (Path following): Complex state management, test thoroughly

### High Risk
- Phase 2.3 (Navigation graph stairs): Incorrect node connections could break all pathfinding
- Phase 4 (Vendor pathfinding): Core gameplay feature, many integration points

**Mitigation**: Implement debug overlay showing navigation graph nodes/edges, vendor current path, target position

---

## Configuration Changes

All new values go in `src/config/gameBalance.ts`:

```typescript
export const VENDOR_CONFIG = {
  // ...existing
  stairTraversalCost: 1.5, // Multiplier for stair movement cost
  pathRecalculationInterval: 2000, // ms, how often to recalculate path if blocked
};

export const VISUAL_CONFIG = {
  groundColor: 0x2d5016, // Medium-dark green
  skyTopColor: 0x87CEEB, // Sky blue
  skyBottomColor: 0x4682B4, // Steel blue
  stairsColor: 0xffffff, // White
  stairsDepth: -50,
  groundDepth: -100,
  skyDepth: -101,
};
```

---

## Implementation Order

1. **Phase 1** (foundation, enables all others) ✅ COMPLETE
2. **Phase 2** (stairs infrastructure) - IN PROGRESS
3. **Phase 3** (visual polish, can be done anytime)
4. **Phase 4** (core gameplay, requires Phases 1-2 complete)
5. **Phase 5** (final integration, requires all previous phases)
6. **Phase 1.5** (tech debt cleanup, safe to do after Phase 5)

---

## Success Criteria

- [ ] Vendors navigate stadium using HybridPathResolver pathfinding
- [ ] Vendors climb stairs to reach different sections
- [ ] Vendors target thirsty fans in assigned sections
- [ ] Vendor movement follows multi-segment paths (not linear)
- [ ] ActorRegistry update loop called each frame
- [ ] Game logic separated from Phaser sprites into Actors
- [ ] Navigation graph dynamically built from level data
- [ ] Debug overlay shows vendor paths and navigation nodes

---

## Future Enhancements (Out of Scope)

- Vendor collision avoidance (multiple vendors on same path)
- Dynamic obstacle detection (wave zones, mascot interference)
- Vendor AI personality traits (speed variance, route preference)
- Player-controlled vendor micro-management UI
- Vendor satisfaction/happiness stat (affects service quality)
