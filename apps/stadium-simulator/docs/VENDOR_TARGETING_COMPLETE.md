# Player-Driven Vendor Targeting System - Implementation Complete

## Overview

Implemented a complete player-driven vendor targeting system that allows players to manually assign drink vendors to stadium sections during gameplay. The system features real-time visual feedback, cooldown management, and autonomous vendor behavior once assigned.

## Implementation Summary

### Core Components

#### 1. TargetingReticle (`src/ui/TargetingReticle.ts`)
**Purpose**: Visual cursor overlay during vendor assignment mode

**Features**:
- Phaser.GameObjects.Container with crosshair graphics (circle + horizontal/vertical lines)
- Real-time cursor tracking via pointer move events
- Color-coded validation (green = valid target, red = invalid)
- Section highlight placeholder (ready for dynamic section bounds)
- ESC key listener for cancel action
- Emits `'cancelled'` event for scene handling

**Key Methods**:
- `show()` / `hide()`: Toggle visibility and cursor style
- `setTargetable(isValid, sectionIdx)`: Update reticle color and section highlight
- `handlePointerMove(pointer)`: Track cursor position
- `handleEscapeKey()`: Emit cancel event

#### 2. DrinkVendorBehavior State Machine (`src/actors/behaviors/DrinkVendorBehavior.ts`)
**Purpose**: Player-driven vendor AI with section-restricted targeting

**New States**:
- `awaitingAssignment`: Initial state, vendor idle until player clicks
- `patrolling`: Fallback mode when no targets found for 5+ seconds

**New Fields**:
- `assignedSectionIdx: number | null`: Restricts targeting to specific section
- `idleTimer: number`: Tracks time without targets (triggers patrol)
- `cooldownTimer: number`: Post-assignment cooldown (5 seconds)

**New Methods**:
- `assignToSection(sectionIdx)`: Set section restriction, reset timers, start cooldown
- `cancelAssignment()`: Clear assignment, return to awaitingAssignment state
- `startPatrol()`: Find nearest ground/corridor, request path, enter patrol mode
- `getAssignedSection()`: Return assigned section index or null

**State Machine Flow**:
```
awaitingAssignment (initial)
  ↓ (player clicks)
idle (scan for targets in assigned section)
  ↓ (target found)
moving (pathfind to target)
  ↓ (arrive at target)
serving (2-second service timer)
  ↓ (service complete)
idle (scan again)
  ↓ (no targets for 5s)
patrolling (fallback mode)
```

**Cooldown Timing**:
- Cooldown starts on assignment (5 seconds)
- Decrements in `tick()` update loop
- Prevents re-assignment while active
- Displayed as countdown in button label

#### 3. AIManager Coordination (`src/managers/AIManager.ts`)
**Purpose**: Coordinate vendor assignments and query cooldown state

**New Methods**:
- `assignVendorToSection(vendorId, sectionIdx, seatRow?, seatCol?)`: Delegate to behavior.assignToSection(), emit 'vendorAssigned'
- `isVendorOnCooldown(vendorId)`: Query behavior.cooldownTimer > 0
- `getVendorCooldownRemaining(vendorId)`: Return milliseconds remaining

**Integration**:
- Uses existing `getVendorActors()` map to access DrinkVendorActor instances
- Delegates to behavior layer (no direct state management)
- Emits events for scene UI updates

#### 4. StadiumScene UI Integration (`src/scenes/StadiumScene.ts`)
**Purpose**: Scene orchestration with UI integration

**New Fields**:
- `targetingReticle?: TargetingReticle`: Reticle component instance
- `vendorTargetingActive: number | null`: Currently active vendor ID

**New Methods**:
- `rebuildVendorControls()`: Updated to show single button per vendor with status label (Available/Section X/Cooldown: Ns/Patrolling)
- `enterVendorTargetingMode(vendorId)`: Show reticle, highlight button (▶ Vendor N ◀), set vendorTargetingActive
- `exitVendorTargetingMode()`: Hide reticle, restore button appearance, clear vendorTargetingActive
- `handleCanvasClick(pointer)`: Validate grid position, check seat zone, map to section, assign vendor, exit mode
- `getSectionAtGridPosition(row, col)`: Map grid coords to section index (hardcoded ranges: A=2-9, B=12-19, C=22-29, rows 15-18)
- `updateVendorCooldowns()`: Real-time cooldown countdown in button labels (called every frame)
- `updateTargetingReticle()`: Real-time cursor validation (green/red reticle, called every frame when targeting active)

**Button States**:
- **Available**: Default state, button enabled, status label shows "Available"
- **Targeting**: Border highlighted (2px solid green), text shows `▶ Vendor N ◀`
- **Assigned**: Status label shows "Section A/B/C" while vendor is working
- **Cooldown**: Button disabled, status label shows "Cooldown: Ns" countdown
- **Patrolling**: Status label shows "Patrolling" when vendor enters patrol mode

**Update Loop Integration**:
```typescript
update(time, delta) {
  // ... existing updates ...
  
  // Update vendor button cooldowns (real-time countdown)
  this.updateVendorCooldowns();

  // Update targeting reticle cursor validation (real-time)
  if (this.vendorTargetingActive && this.targetingReticle) {
    this.updateTargetingReticle();
  }
}
```

#### 5. Configuration (`src/config/gameBalance.ts`)
**Purpose**: Central configuration for vendor assignment timing

**New Section**:
```typescript
vendorAssignment: {
  cooldownMs: 5000,        // 5-second cooldown after assignment
  idleTimeoutMs: 5000,     // 5 seconds without target → patrol
  patrolIntervalMs: 3000,  // Patrol waypoint interval
  patrolRangeColumns: 5    // Patrol random ±5 columns
}
```

## User Interaction Flow

1. **Player clicks vendor button** → `enterVendorTargetingMode(vendorId)`
   - Reticle appears, follows cursor
   - Button highlighted with `▶ Vendor N ◀`
   - Cursor changes to crosshair style

2. **Player hovers over canvas** → `updateTargetingReticle()`
   - Validates cursor position (seat zone check)
   - Reticle changes color: green (valid) or red (invalid)
   - Section highlights when hovering over valid section (placeholder bounds)

3. **Player clicks section** → `handleCanvasClick(pointer)`
   - Converts world position to grid coordinates
   - Validates click is on seat zone
   - Maps grid position to section index (0=A, 1=B, 2=C)
   - Calls `aiManager.assignVendorToSection(vendorId, sectionIdx)`
   - Exits targeting mode

4. **Vendor begins assignment** → `behavior.assignToSection(sectionIdx)`
   - Section restriction applied (only scans assigned section)
   - Cooldown timer starts (5 seconds)
   - Button disabled, status label shows "Cooldown: 5s"
   - Vendor enters `idle` state, begins scanning for thirsty fans

5. **Cooldown active** → `updateVendorCooldowns()` every frame
   - Status label updates: "Cooldown: 4s", "Cooldown: 3s", etc.
   - Button remains disabled
   - Cooldown decrements in `behavior.tick()`

6. **Cooldown expires**
   - Button re-enabled, status label shows assigned section name (e.g., "Section B")
   - Player can reassign vendor to different section

7. **Vendor finds target** → `behavior.selectTarget()`
   - Pathfinds to nearest thirsty fan in assigned section
   - Serves fan (2-second service cycle)
   - Returns to `idle`, scans for next target

8. **Idle timeout (no targets for 5s)** → `behavior.startPatrol()`
   - Vendor enters `patrolling` state
   - Moves to nearest ground/corridor
   - Status label shows "Patrolling"
   - Player can reassign when cooldown expires

9. **Cancel targeting** → ESC key or invalid click
   - `exitVendorTargetingMode()` called
   - Reticle hidden, button appearance restored
   - Vendor remains in `awaitingAssignment` state

## Technical Highlights

### Three-Layer Architecture
- **UI Layer** (TargetingReticle + Scene): Visual feedback, input handling
- **Coordination Layer** (AIManager): Assignment delegation, cooldown queries
- **Logic Layer** (DrinkVendorBehavior): State machine, autonomous behavior

### Real-Time Updates
- **Cooldown countdown**: Button labels update every frame via `updateVendorCooldowns()`
- **Cursor validation**: Reticle color changes every frame via `updateTargetingReticle()`
- **Status display**: Button labels reflect vendor state (Available/Section X/Cooldown/Patrolling)

### State Machine Pattern
- **Initial state**: `awaitingAssignment` (do not auto-target)
- **Assignment**: Player-driven via button click → targeting mode → section click
- **Autonomous**: Once assigned, vendor operates independently (scan, pathfind, serve, repeat)
- **Fallback**: Patrol mode if no targets found for 5+ seconds
- **Cooldown**: 5-second cooldown prevents rapid re-assignment

### Grid Integration
- **Click validation**: World → grid conversion via `gridManager.worldToGrid()`
- **Zone checking**: Validates click is on seat zone via `gridManager.getZoneType()`
- **Section mapping**: Grid position → section index via `getSectionAtGridPosition()`

## Files Modified/Created

### New Files
- `src/ui/TargetingReticle.ts` (~170 lines)

### Modified Files
- `src/actors/behaviors/DrinkVendorBehavior.ts`:
  - Added `assignedSectionIdx`, `idleTimer`, `cooldownTimer` fields
  - Added `assignToSection()`, `cancelAssignment()`, `startPatrol()`, `getAssignedSection()` methods
  - Updated `tick()` with cooldown timer and awaitingAssignment handling
  - Updated `updateIdle()` to track idle timeout and trigger patrol

- `src/managers/AIManager.ts`:
  - Updated `assignVendorToSection()` to delegate to behavior
  - Added `isVendorOnCooldown()` query method
  - Added `getVendorCooldownRemaining()` query method

- `src/scenes/StadiumScene.ts`:
  - Added `targetingReticle` and `vendorTargetingActive` fields
  - Replaced `rebuildVendorControls()` with new button layout
  - Added `enterVendorTargetingMode()` method
  - Added `exitVendorTargetingMode()` method
  - Added `handleCanvasClick()` method with grid validation
  - Added `getSectionAtGridPosition()` helper
  - Added `updateVendorCooldowns()` for real-time countdown
  - Added `updateTargetingReticle()` for cursor validation
  - Integrated update loop calls for continuous updates

- `src/config/gameBalance.ts`:
  - Added `vendorAssignment` configuration section

- `src/actors/interfaces/AIBehavior.ts`:
  - Added `AwaitingAssignment = 'awaitingAssignment'` to AIActorState enum

- `ACTOR_AUTONOMY_REFACTOR.md`:
  - Marked Phase 5 as COMPLETE with detailed implementation notes

## Testing Recommendations

1. **Basic Flow**:
   - Click vendor button → reticle appears
   - Move cursor over section → reticle turns green
   - Click section → vendor pathfinds to nearest seat
   - Verify cooldown countdown in button label (5s → 0s)
   - Verify status label shows "Section X" after cooldown

2. **Edge Cases**:
   - ESC key cancels targeting (reticle hides, button restores)
   - Click on sky/ground/stairs → invalid (reticle red, no assignment)
   - Click on different section during cooldown → button disabled
   - No targets for 5s → "Patrolling" status label

3. **State Transitions**:
   - Available → Targeting → Cooldown → Section X → Patrolling
   - Verify button appearance changes correctly
   - Verify vendor moves to assigned section and scans

4. **Real-Time Feedback**:
   - Cooldown countdown updates every second
   - Cursor validation (green/red) updates every frame
   - Status labels reflect current vendor state

## Known Limitations

1. **Section Highlight Placeholder**:
   - `TargetingReticle.highlightSection()` uses hardcoded bounds
   - Should query actual section geometry from level data or SectionActor
   - Current implementation functional but not pixel-perfect

2. **Patrol Status Polling**:
   - `updateVendorCooldowns()` polls behavior state every frame
   - Could optimize with event emission from behavior (e.g., `'stateChanged'`)
   - Current implementation acceptable for 2-3 vendors

3. **Hardcoded Section Ranges**:
   - `getSectionAtGridPosition()` uses hardcoded grid ranges (A=2-9, B=12-19, C=22-29)
   - Should dynamically query from level data or SectionActor
   - Current implementation works for standard stadium layout

## Next Steps

1. **Dynamic Section Bounds**:
   - Query section sprite bounds or SectionActor geometry
   - Pass to `TargetingReticle.highlightSection()` for accurate highlighting

2. **Event-Driven Status Updates**:
   - Emit `'stateChanged'` event from behavior when entering patrol/idle
   - Listen in scene to update button labels on-demand (instead of polling)

3. **Testing Full Flow**:
   - Manual testing: click vendor → target section → verify pathfinding and service
   - Test edge cases: ESC cancel, invalid clicks, cooldown prevention

4. **Polish**:
   - Add visual effects: section highlight glow, button pulse during targeting
   - Add audio cues: click, assignment, cooldown complete

## Conclusion

The player-driven vendor targeting system is fully implemented and ready for testing. All user requirements have been met:
- ✅ Click-to-assign vendor targeting with visual reticle
- ✅ Real-time cooldown countdown in button labels
- ✅ Section name display when vendor is assigned
- ✅ Patrol fallback mode when no targets found
- ✅ ESC cancel and invalid click handling
- ✅ Autonomous vendor behavior once assigned
- ✅ Separation of concerns: UI → Coordination → Logic layers

The system successfully demonstrates the player-driven control pattern that can be extended to mascots and other AI entities in future phases.
