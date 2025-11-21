# Actor Autonomy Refactor - Design Proposal

## Problem Statement

Current architecture has too much indirection for simple actor-to-actor interactions:

```typescript
// CURRENT (Over-engineered):
Vendor → Behavior.selectTarget() → AIManager.serveFan() → Event → Scene → FanActor.drinkServed()

// DESIRED (Direct):
Vendor → Behavior.serveFan(targetFanActor) → FanActor.drinkServed()
```

**Key Issues:**
1. Behaviors can't directly modify their targets (have to go through manager)
2. Manager acts as unnecessary middleman for actor interactions
3. Events used for everything, even simple state changes
4. Service logic split between Behavior, Manager, and Scene

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

### Manager Responsibilities (Reduced)

**AIManager becomes a coordinator, not a controller:**

```typescript
class AIManager {
  // KEEP: Vendor lifecycle management
  public spawnVendor(profile: VendorProfile): VendorActor { }
  public removeVendor(vendorId: number): void { }
  
  // KEEP: Global vendor coordination
  public assignVendorToSection(vendorId: number, sectionIdx: number): void { }
  
  // KEEP: Providing access to game data
  public getSectionActors(): SectionActor[] { }
  
  // REMOVE: Per-frame update logic (actors handle themselves)
  // public update(deltaTime: number): void { } // Actors call their own behavior.tick()
  
  // REMOVE: Service logic (behaviors handle directly)
  // public serveFan(vendorId: number, fan: Fan): void { }
  
  // REMOVE: Target selection (behaviors do this)
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
- [ ] Add `targetFanActor: FanActor` to DrinkVendorBehavior
- [ ] Move service timer to behavior
- [ ] Implement continuous thirst reduction in `tick()`
- [ ] Implement `onArrival()` and `onServeComplete()`

### Phase 2: Actor Update Loop
- [ ] Add `update(deltaTime, scene)` to VendorActor
- [ ] Call `behavior.tick(deltaTime)` from VendorActor.update
- [ ] Call `behavior.onArrival()` when path complete

### Phase 3: Scene Update Simplification
- [ ] Update StadiumScene to call vendorActor.update() directly
- [ ] Remove AIManager.update() call
- [ ] Keep only lifecycle events (spawn, assign)

### Phase 4: Cleanup
- [ ] Remove AIManager.serveFan()
- [ ] Remove AIManager.selectNextDrinkTarget()
- [ ] Remove AIManager per-vendor update loop
- [ ] Remove VendorInstance state machine (behavior owns state)

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
- Proof of concept for direct actor interaction
- Cleaner separation of concerns
- Foundation for removing manager middleman

Once working, phases 2-4 are straightforward cleanup.
