# Actor Autonomy Refactor - Design Proposal

## Problem Statement

Current architecture has fragmented responsibilities across Scene, Managers, and Actors:

```typescript
// CURRENT (Fragmented):
Vendor → Behavior.selectTarget() → AIManager.serveFan() → Event → Scene → FanActor.drinkServed()
WaveManager → Event → Scene listener → Updates multiple actors
GameStateManager → updateStats() → Loops all fans for decay

// DESIRED (Orchestrated Autonomy):
AIManager.update() → Actors update themselves → AIManager orchestrates cross-actor effects
Vendor → Behavior.serveFan(targetFanActor) → FanActor.drinkServed() (direct)
FanActor.update() → Self-manages stat decay
WaveManager → AIManager → Actor momentum updates → AIManager re-emits for UI
```

**Key Issues:**
1. Behaviors can't directly modify their targets (have to go through manager)
2. Scene handles actor-related events that belong in AIManager
3. Stat decay logic in GameStateManager instead of individual FanActors
4. No clear update order for actor categories
5. Wave events managed by Scene instead of actor lifecycle manager

## Proposed Architecture

### Event Usage Guidelines

**Use Events For (Manager → Scene):**
- ✅ Wave propagation results (affects announcer, UI, audio)
- ✅ Session state changes (start, complete, score)
- ✅ Vendor spawn requests (scene creates sprite)
- ✅ Major narrative moments (mascot entrance, special events)

**Use Direct Calls For (Actor → Actor):**
- ✅ Vendor serving drinks to fans
- ✅ Mascot affecting fan attention
- ✅ Fan participating in waves
- ✅ Pathfinding requests
- ✅ Any actor modifying another actor's state

### Refactored Flow: Drink Service Example

#### Current Implementation
```typescript
// 1. Behavior selects target
const target = behavior.selectTarget(); // Returns {fanActor, fan, position}

// 2. Behavior tells manager about target
// (This happens in AIManager.update loop)

// 3. Manager calls serveFan
aiManager.serveFan(vendorId, fan);

// 4. Manager looks up FanActor and serves
const fanActor = sectionActor.getFanActorAt(row, col);
fanActor.drinkServed(timestamp);

// 5. Manager emits event
this.emit('serviceComplete', {vendorId, fanServed: true});
```

#### Proposed Implementation
```typescript
// 1. Behavior owns the entire service cycle
class DrinkVendorBehavior {
  private targetFanActor: FanActor | null = null;
  private serviceTimer: number = 0;
  
  public tick(deltaTime: number): void {
    switch (this.state) {
      case 'idle':
        // Select target directly
        const target = this.selectTarget();
        if (target) {
          this.targetFanActor = target.fanActor;
          this.state = 'moving';
          this.requestPath(target.x, target.y);
        }
        break;
        
      case 'moving':
        // VendorActor handles movement, calls onArrival when done
        break;
        
      case 'serving':
        this.serviceTimer -= deltaTime;
        
        // Continuously reduce thirst during service
        if (this.targetFanActor && this.serviceTimer > 0) {
          const reductionRate = 100 / this.config.serviceTime; // 100 thirst over serviceTime ms
          const reduction = reductionRate * deltaTime;
          
          const currentThirst = this.targetFanActor.getThirst();
          this.targetFanActor.setThirst(currentThirst - reduction);
        }
        
        if (this.serviceTimer <= 0) {
          this.onServeComplete();
        }
        break;
    }
  }
  
  public onArrival(): void {
    if (this.state === 'moving' && this.targetFanActor) {
      // Start serving directly
      this.state = 'serving';
      this.serviceTimer = this.config.serviceTime;
      
      // Optional: Emit event for UI feedback (celebration animation, sound)
      this.vendorActor.emit('serviceStarted', {
        fanPosition: this.targetFanActor.getPosition()
      });
    }
  }
  
  public onServeComplete(): void {
    if (this.targetFanActor) {
      // Final happiness boost
      const happiness = this.targetFanActor.getHappiness();
      this.targetFanActor.setHappiness(happiness + 15);
      
      // Optional: Emit event for UI (particle effect, sound)
      this.vendorActor.emit('serviceComplete', {
        fanPosition: this.targetFanActor.getPosition()
      });
    }
    
    this.targetFanActor = null;
    this.state = 'idle';
  }
}
```

### Manager Responsibilities (Expanded)

**AIManager becomes universal actor orchestrator and event hub:**

```typescript
class AIManager {
  // KEEP: Lifecycle management
  public spawnVendor(profile: VendorProfile): VendorActor { }
  public removeVendor(vendorId: number): void { }
  public registerMascot(actor: MascotActor): void { }
  
  // KEEP: Data access
  public getSectionActors(): SectionActor[] { }
  public getVendorActors(): VendorActor[] { }
  public getMascotActors(): MascotActor[] { }
  
  // NEW: Universal update orchestrator (category-ordered)
  public update(deltaTime: number): void {
    // 1. Update scenery (aggregate recalculation)
    this.updateSceneryActors(deltaTime);
    
    // 2. Update utility actors (wave state if needed)
    this.updateUtilityActors(deltaTime);
    
    // 3. Update fans (stat decay)
    this.updateFanActors(deltaTime);
    
    // 4. Update vendors (behavior tick + movement)
    this.updateVendorActors(deltaTime);
    
    // 5. Update mascots (behavior tick)
    this.updateMascotActors(deltaTime);
    
    // 6. Orchestration: cross-actor logic
    this.handleVendorCollisions();
    this.balanceVendorDistribution();
    this.checkMascotVendorInterference();
  }
  
  // NEW: User input routing (vendors/mascots are player-controlled)
  public commandVendor(vendorId: string, targetPosition: {x: number, y: number}): void { }
  public commandMascot(mascotId: string, action: 'ability' | 'ultimate'): void { }
  
  // NEW: Wave event handling (moved from Scene)
  public handleWaveSuccess(data: WaveResultData): void {
    // Update momentum counters for vendors/mascots
    this.vendorActors.forEach(v => v.getBehavior().onWaveSuccess());
    this.mascotActors.forEach(m => m.getBehavior().onWaveSuccess());
    // Re-emit for UI/announcer
    this.emit('waveSuccessProcessed', data);
  }
  
  // REMOVE: Service logic (behaviors handle directly)
  // public serveFan(vendorId: number, fan: Fan): void { }
  
  // REMOVE: Target selection (player commands or behaviors decide)
  // public selectNextDrinkTarget(vendorId: number): Target | null { }
}
```

### Actor Update Pattern

**VendorActor owns its behavior update:**

```typescript
class VendorActor extends AnimatedActor {
  private behavior: AIActorBehavior;
  
  public update(deltaTime: number, scene: Phaser.Scene): void {
    // Update movement (if path active)
    super.update(deltaTime, scene);
    
    // Update behavior state machine
    this.behavior.tick(deltaTime);
    
    // Check if arrived at destination
    if (this.hasPath() && this.isAtDestination()) {
      this.behavior.onArrival();
    }
  }
}
```

**Scene only updates actors:**

```typescript
class StadiumScene extends Phaser.Scene {
  public update(time: number, delta: number): void {
    // Update game state (stat decay)
    this.gameState.updateStats(delta);
    
    // Update all actors (they handle themselves)
    const vendors = this.actorRegistry.getByCategory('vendor');
    vendors.forEach(vendor => vendor.update(delta, this));
    
    // No need to call aiManager.update() anymore!
    
    // Update wave state
    this.waveManager.update(delta);
  }
}
**Scene delegates to managers:**

```typescript
class StadiumScene extends Phaser.Scene {
  public update(time: number, delta: number): void {
    // AIManager handles ALL actor updates in proper order
    this.aiManager.update(delta);
    
    // Wave state updates (still in WaveManager)
    this.waveManager.update(delta);
    
    // Session timing (GameStateManager)
    this.gameState.updateSession(delta);
  }
  
  public create(): void {
    // Wire wave events TO AIManager (not Scene)
    this.waveManager.on('waveSuccess', (data) => {
      this.aiManager.handleWaveSuccess(data);
    });
    
    this.waveManager.on('waveFail', (data) => {
      this.aiManager.handleWaveFail(data);
    });
    
    // Scene only listens for UI-relevant events FROM AIManager
    this.aiManager.on('waveSuccessProcessed', (data) => {
      this.playWaveAnimation(data);
      this.announcer.commentOnWave(data);
    });
  }
}
```

## Benefits of This Approach

### 1. **Locality of Behavior**
All drink vendor logic lives in `DrinkVendorBehavior` - no manager intermediary

### 2. **Direct Actor Interaction**
```typescript
// Vendor directly modifies fan state
this.targetFanActor.setThirst(newValue); // Clear and simple!
```

### 3. **Easier Testing**
```typescript
// Test behavior in isolation
const behavior = new DrinkVendorBehavior(vendorActor, ...deps);
const target = behavior.selectTarget();
behavior.onArrival();
expect(target.fanActor.getThirst()).toBe(0);
```

### 4. **Scalability**
Adding new vendor types is just a new behavior class - no manager changes needed

### 5. **Events Only for Important Things**
Events become **notifications** not **control flow**:
```typescript
// UI listens for celebration triggers
this.vendorActor.on('serviceComplete', (data) => {
  this.playParticleEffect(data.fanPosition);
  this.playSound('drink-served');
});
```

## Migration Plan

### Phase 1: Behavior Self-Sufficiency

### Phase 2: Actor Update Loop

### Phase 3: Scene Update Simplification

### Phase 4: Cleanup
### Phase 1: Behavior Self-Sufficiency ✅ COMPLETE
- [x] Add `targetFanActor: FanActor` to DrinkVendorBehavior
- [x] Move service timer to behavior
- [x] Implement continuous thirst reduction in `tick()`
- [x] Implement `onArrival()` and `onServeComplete()`

### Phase 2: Actor Update Loop ✅ COMPLETE
- [x] Add `update(deltaTime)` to VendorActor
- [x] Call `behavior.tick(deltaTime)` from VendorActor.update
- [x] Call `behavior.onArrival()` when path complete

### Phase 3: Universal Actor Orchestration ✅ COMPLETE
- [x] Refactor `AIManager.update()` to iterate actors by category (scenery → utility → fans → vendors → mascots)
- [x] Add `FanActor.update()` for per-fan stat decay (remove from GameStateManager)
- [x] Add `SectionActor.update()` for on-demand aggregate recalculation
- [x] Ensure category update order: scenery → utility → fans → vendors → mascots
- [x] Pass scene parameter to actors for time.now access
- [x] Remove redundant actor.draw() calls (actors handle own rendering)

### Phase 4: Wave Event Migration ✅ COMPLETE
- [x] Move wave event listeners from StadiumScene to AIManager
- [x] AIManager handles `waveSuccess`/`waveFail` → updates actor momentum
- [x] AIManager re-emits `waveSuccessProcessed` for Scene UI/announcer
- [x] WaveManager still emits primary events (AIManager becomes subscriber)
- [x] Scene listens to AIManager's processed events for visual effects only

### Phase 5: Player-Driven Vendor Targeting System
**Goal**: Replace auto-targeting with click-to-assign interaction flow

**Status**: IN PROGRESS

**Completed**:
- [x] Add `vendorAssignment` config to gameBalance.ts (cooldownMs, idleTimeoutMs, patrolIntervalMs, patrolRangeColumns)
- [x] Add `awaitingAssignment` state to AIActorState enum
- [x] Update DrinkVendorBehavior with assignment state machine (assignToSection, cancelAssignment, startPatrol)
- [x] Add idle/cooldown timers to behavior, track idle timeout (5s → patrol)
- [x] Update `AIManager.assignVendorToSection()` to delegate to behavior
- [x] Add `AIManager.isVendorOnCooldown()` and `getVendorCooldownRemaining()` methods

**UI Changes** (`StadiumScene.ts`):
- [ ] Replace `rebuildVendorControls()` section buttons with single vendor assignment button per vendor
- [ ] Button states: `idle` (available), `targeting` (reticle active), `assigned` (+ section name), `cooldown` (+ countdown timer), `patrolling` (fallback state)
- [ ] Add `enterVendorTargetingMode(vendorId)` / `exitVendorTargetingMode()` methods
- [ ] Track `vendorTargetingActive: number | null` (active vendor during targeting)
- [ ] Update button display on vendor state events: `assigned`, `cooldownComplete`, `idleTimeout`

**Targeting Reticle** (New: `src/ui/TargetingReticle.ts`): ✅
- [x] Create Phaser.GameObjects.Container with circle graphics following cursor
- [x] Section highlight on hover (validate hover is over seat zone)
- [x] ESC key listener to cancel targeting
- [x] Emit `cancelled` on ESC/invalid click
- [x] Show/hide methods called by StadiumScene
- [x] `setTargetable(isValid, sectionIdx)` to change reticle color (green/red) and highlight section

**Behavior Updates** (`DrinkVendorBehavior.ts`): ✅
- [x] Add state: `awaitingAssignment` (initial state, idle until player clicks)
- [x] Add fields: `assignedSectionIdx: number | null`, `idleTimer: number`, `cooldownTimer: number`
- [x] Add methods: `assignToSection(sectionIdx)`, `cancelAssignment()`, `startPatrol()`, `getAssignedSection()`
- [x] `selectTarget()`: Filter candidates by `assignedSectionIdx` (restrict to assigned section only)
- [x] `tick()`: Check idle timer (5s without target → `startPatrol()`), update cooldown timer
- [x] `startPatrol()`: Find nearest ground/corridor via `GridManager.getNearestVerticalAccess()`, patrol randomly ±5 columns

**AIManager Coordination** (`AIManager.ts`): ✅
- [x] Add `assignVendorToSection(vendorId: number, sectionIdx: number, seatRow?: number, seatCol?: number)` method
- [x] Query methods: `isVendorOnCooldown(vendorId): boolean`, `getVendorCooldownRemaining(vendorId): number`

**Input Handling** (`StadiumScene.ts`): ✅
- [x] Add `handleCanvasClick(pointer)` method (active during targeting mode)
- [x] Convert click world → grid position via `gridManager.worldToGrid()`
- [x] Validate click is within seat zone (check `cell.zoneType === 'seat'`)
- [x] Map grid position to section index via `getSectionAtGridPosition(row, col): number | null`
- [x] Call `aiManager.assignVendorToSection(vendorId, sectionIdx, row, col)` on valid click
- [x] Cancel targeting on ESC or invalid tile (sky, ground, stairs, corridor)
- [x] Add `enterVendorTargetingMode(vendorId)` / `exitVendorTargetingMode()` methods
- [x] Add `updateVendorCooldowns()` for real-time cooldown countdown
- [x] Add `updateTargetingReticle()` for real-time cursor validation

**Configuration** (`gameBalance.ts`): ✅
- [x] Add section:
  ```typescript
  vendorAssignment: {
    cooldownMs: 5000,
    idleTimeoutMs: 5000,
    patrolIntervalMs: 3000,
    patrolRangeColumns: 5
  }
  ```

**User Flow**:
1. Player clicks vendor button → `enterVendorTargetingMode(vendorId)`
2. TargetingReticle appears, follows cursor
3. Hover over section → section highlights (validates seat zone)
4. Click section → `aiManager.assignVendorToSection(vendorId, sectionIdx, row, col)`
5. Vendor behavior: `assignToSection(sectionIdx)` → pathfind to nearest seat → scan for thirsty fans (restricted to section)
6. Button shows cooldown (5s), then displays assigned section name
7. If no target found for 5s → `startPatrol()` → button shows "Patrolling"
8. Player can reassign after cooldown expires
9. ESC or invalid click cancels targeting, returns to idle

### Phase 6: Cleanup ✅ COMPLETE
- [x] Remove `AIManager.serveFan()` (deprecated stub removed)
- [x] Remove `AIManager.selectNextDrinkTarget()` and `selectNextDrinkTargetWrapper()` (deprecated wrappers removed)
- [x] Remove `VendorInstance` interface and state machine (fully deprecated, replaced by VendorActor + Behavior)
- [x] Remove `AIManager.vendors` Map (VendorInstance tracking removed)
- [x] Remove `AIManager.getVendorInstances()` and `getVendorInstance()` (replaced by `getVendorActors()` and `getVendorActor()`)
- [x] Mark `GameStateManager.updateStats()` as deprecated (fan stat decay moved to FanActor.update())
- [x] Update StadiumScene to use `getVendorActor()` instead of `getVendorInstance()`
- [x] Update vendor position tracking to use `VendorActor.getPosition()` instead of `instance.position`

## Open Questions

1. **Should VendorActor emit events or just behavior?**
   - Proposal: VendorActor emits, behavior triggers emission
   - Example: `this.vendorActor.emit('serviceComplete', data)`

2. **How do we handle pathfinding requests?**
   - Keep PathfindingService as-is (behaviors call it directly)
   - VendorActor checks path progress, notifies behavior on arrival

3. **What about vendor distraction logic?**
   - Move to behavior: `tick()` can roll for distraction
   - Quality tier affects distraction chance in behavior config

4. **Should manager still track VendorInstance objects?**
   - Maybe simplify to just Map<vendorId, VendorActor>
   - VendorActor.getState() delegates to behavior.getState()
## Architecture Decisions (Finalized)

1. **AIManager as Universal Orchestrator** ✅
  - AIManager handles ALL actor updates via category-ordered iteration
  - Single point for cross-actor orchestration (collisions, balancing, interference)
  - Potential bottleneck if actor count >1000 (profile if needed, unlikely for stadium sim)

2. **User-Driven Vendor/Mascot Control** ✅
  - Player commands vendors/mascots via `AIManager.commandVendor/Mascot()`
  - Behaviors execute autonomously (pathfinding, service cycle)
  - NO fallback AI when idle (player must target explicitly)

3. **Category Update Order** ✅
  - Scenery (aggregate recalc) → Utility (wave state) → Fans (decay) → Vendors → Mascots
  - Ensures fresh stat data for AI targeting decisions

4. **Wave Events Through AIManager** ✅
  - WaveManager emits → AIManager handles actor updates → AIManager re-emits for Scene/UI
  - Wave as UtilityActor managed by WaveManager, but lifecycle events routed through AIManager

5. **Event Emission Pattern** ✅
  - VendorActor/MascotActor emit, behaviors trigger emission
  - Example: `this.vendorActor.emit('serviceComplete', data)`

6. **VendorInstance Simplification** ✅
  - Remove state machine (behavior owns state)
  - Simplify to `Map<vendorId, VendorActor>` or remove entirely

## Example: Complete Service Cycle

```typescript
// Frame 1: Vendor idle, selects target
behavior.tick(16.67); // 60fps
→ const target = selectTarget();
→ this.targetFanActor = target.fanActor; // Direct reference!
→ this.state = 'moving';
→ this.pathfindingService.calculatePath(vendorPos, targetPos);

// Frames 2-120: Vendor moving
vendorActor.update(16.67, scene);
→ updateMovement(); // AnimatedActor handles path following
→ behavior.tick(16.67); // State = 'moving', no action needed

// Frame 121: Vendor arrives
vendorActor.update(16.67, scene);
→ if (isAtDestination()) behavior.onArrival();
→→ this.state = 'serving';
→→ this.serviceTimer = 2000; // 2 seconds
→→ emit('serviceStarted'); // UI plays animation

// Frames 122-241: Serving (120 frames @ 16.67ms = 2 seconds)
behavior.tick(16.67);
→ this.serviceTimer -= 16.67;
→ const reduction = (100 / 2000) * 16.67; // Gradual thirst reduction
→ this.targetFanActor.setThirst(currentThirst - reduction); // DIRECT!

// Frame 242: Service complete
behavior.tick(16.67);
→ this.serviceTimer <= 0
→ this.onServeComplete();
→→ this.targetFanActor.setHappiness(happiness + 15); // DIRECT!
→→ emit('serviceComplete'); // UI plays celebration
→→ this.targetFanActor = null;
→→ this.state = 'idle';

// Next cycle begins...
```

## Recommendation

**Start with Phase 1**: Refactor DrinkVendorBehavior to be self-sufficient. This gives us:
## Implementation Status

**Phases 1-2: COMPLETE** ✅
- DrinkVendorBehavior fully self-sufficient with direct FanActor modification
- VendorActor autonomous update loop with behavior delegation
- MascotActor and MascotBehavior implemented with targeting cycle

**Phase 3: Universal Actor Orchestration - COMPLETE** ✅
- AIManager.update() orchestrates all actors in category order
- FanActor.update() handles per-fan stat decay (thirst/happiness/attention)
- SectionActor.update() delegates to fans and recalculates aggregates
- Category update order enforced: scenery → utility → (fans via sections) → vendors → mascots
- Scene parameter passed to actors for time.now access
- Removed redundant draw() calls from AIManager (actors self-render)

**Phase 4: Wave Event Migration - COMPLETE** ✅
- WaveManager events wired through AIManager first
- AIManager.handleWaveSuccess() and handleWaveFail() update vendor/mascot momentum
- AIManager re-emits 'waveSuccessProcessed' and 'waveFailProcessed' for Scene UI
- Scene listens to AIManager's processed events for camera shake, animations, announcer
- Clear separation: AIManager = actor logic, Scene = visual effects

**Phase 5: Player-Driven Vendor Targeting - COMPLETE** ✅
- TargetingReticle UI component with cursor tracking, ESC cancel, section highlighting
- DrinkVendorBehavior state machine: awaitingAssignment → idle (on assignment) → moving → serving → idle/patrolling
- Player-driven assignment flow: click vendor button → reticle appears → click section → vendor pathfinds and serves
- Cooldown system: 5-second cooldown after assignment, displayed in button label
- Status display: Available/Section X/Cooldown: Ns/Patrolling labels update in real-time
- Idle timeout: Vendor enters patrol mode if no target found for 5+ seconds
- Real-time updates: Cooldown countdown and cursor validation in update loop

**Phase 6: Cleanup - COMPLETE** ✅
- Removed all deprecated AIManager methods: `serveFan()`, `selectNextDrinkTarget()`, `selectNextDrinkTargetWrapper()`
- Removed VendorInstance interface and state machine (fully replaced by VendorActor + DrinkVendorBehavior)
- Removed `AIManager.vendors` Map and related methods (`getVendorInstances()`, `getVendorInstance()`)
- Replaced with clean actor-based API: `getVendorActors()`, `getVendorActor(id)`
- Updated StadiumScene to use actor-based position tracking via `VendorActor.getPosition()`
- Marked `GameStateManager.updateStats()` as deprecated (fan stat decay now in FanActor.update())

**Next Steps:**
- (Optional) Remove legacy `GameStateManager.updateStats()` entirely once autonomous wave system stable
- (Optional) Performance profiling for 1000+ fans to validate per-fan update approach

**Benefits Achieved:**
- ✅ Direct actor-to-actor interaction (no manager middleman for service)
- ✅ Behavior locality (all vendor logic in DrinkVendorBehavior)
- ✅ Easier testing (behaviors testable in isolation)
- ✅ Player-driven vendor control with visual feedback
- ✅ Real-time UI updates for cooldowns and status
- ✅ Universal orchestration (AIManager owns actor update lifecycle)
- ✅ Event consolidation (wave events flow through AIManager)
- ✅ Per-fan autonomy (each FanActor manages own stat decay)
- ✅ Scalable architecture (add new actor types by extending AIManager update categories)
- ✅ Clean codebase (all deprecated methods and legacy VendorInstance code removed)
- ✅ Actor-based API (unified interface: getVendorActors(), getVendorActor(), getMascotActors())
