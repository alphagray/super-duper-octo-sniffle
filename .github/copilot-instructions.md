# Stadium Simulator - AI Coding Agent Instructions

## Project Overview

**Stadium Simulator** is an 8-bit retro Phaser 3 game where players initiate stadium waves across three sections while managing fan engagement (happiness, thirst, attention). The game features AI-powered announcer commentary via Claude API and grid-based vendor AI pathfinding. Game runs 100-second timed sessions only (run mode).

## Architecture Overview

### 0. **CRITICAL: Actor State Machine Pattern & Separation of Concerns**

**ALL dynamic game entities (Fans, Vendors, Mascots) MUST follow this architecture:**

#### Three-Layer Separation:
1. **Stats Layer** (Pure Data)
   - Raw numeric values: happiness, thirst, attention, position, etc.
   - Modified by `updateStats(delta)`, `setThirst()`, `modifyStats()`
   - NO visual updates, NO sprite manipulation
   - Example: `FanActor.updateStats()` modifies thirst++, happiness--, but does NOT call sprite methods

2. **State Machine Layer** (Derived Logic)
   - State is derived from stats via threshold checks
   - States: `idle`, `engaged`, `disengaged`, `waving`, `drinking`, `moving`, `serving`, etc.
   - Implemented via `deriveStateFromStats()` → returns state based on conditions
   - State transitions trigger visual updates via `transitionToState(newState)`
   - Example: `FanActor.deriveStateFromStats()` checks `attention < 30 && happiness < 40` → returns `'disengaged'`

3. **Visual Layer** (Presentation)
   - Sprite methods called ONLY during state transitions or continuous update loops
   - State-based visuals: alpha, tint, scale (applied on state change)
   - Continuous visuals: color interpolation, jiggle timers (applied every frame)
   - Example: `updateVisualsForState('disengaged')` sets alpha=0.7, tint=gray

#### Update Flow (Every Frame):
```typescript
// In Actor.update(delta):
updateStats(delta);              // 1. Modify raw stats
updateContinuousVisuals();       // 2. Smooth visual updates (color, jiggle)
newState = deriveStateFromStats(); // 3. Check thresholds
if (newState !== state) {
  transitionToState(newState);   // 4. Trigger state-based visuals
}
```

#### Examples:

**FanActor State Machine:**
- Stats: `happiness`, `thirst`, `attention` (0-100)
- States: `idle` (default), `engaged` (attention > 70), `disengaged` (attention < 30 && happiness < 40), `drinking` (thirst < 10 && freeze active), `waving` (during wave animation)
- Continuous visuals: `fan.setIntensity(thirst/100)` every frame (color + jiggle)
- State-based visuals: alpha/tint applied only when transitioning to/from `disengaged`

**VendorActor State Machine (via DrinkVendorBehavior):**
- Stats: `position`, `speed`, `serviceTimer`
- States: `idle`, `moving`, `serving`, `patrolling`, `recalling`
- State transitions: `idle` → scan for target → `moving` → arrive at fan → `serving` → timer expires → `idle`
- Visuals: sprite position updated during `moving`, animation played during `serving`

#### Anti-Patterns (DO NOT DO THIS):
```typescript
// ❌ BAD: Stat update triggers visual directly
public setThirst(value: number): void {
  this.thirst = value;
  this.fan.setIntensity(value / 100); // WRONG! Tight coupling
}

// ❌ BAD: Scene manually checks fan conditions
if (fan.getThirst() > 50 && fan.getHappiness() < 40) {
  fan.setAlpha(0.7); // WRONG! Scene shouldn't know fan states
}

// ✅ CORRECT: Stat update is pure data
public setThirst(value: number): void {
  this.thirst = Phaser.Math.Clamp(value, 0, 100);
  // Visual update deferred to update() state machine
}

// ✅ CORRECT: State machine handles visuals
public update(delta: number): void {
  this.updateContinuousVisuals(); // Color/jiggle every frame
  const newState = this.deriveStateFromStats();
  if (newState !== this.state) {
    this.transitionToState(newState); // Alpha/tint on state change
  }
}
```

**When implementing new actor logic:**
1. Define states as type union: `type FanState = 'idle' | 'engaged' | ...`
2. Add `state` and `previousState` fields to actor
3. Implement `deriveStateFromStats()` with threshold checks
4. Implement `transitionToState(newState)` to trigger `updateVisualsForState()`
5. Split visuals into state-based (alpha, tint) vs continuous (color, position)
6. Call `update(delta)` from parent (e.g., SectionActor for fans)

### 1. **Actor System** (`src/actors/`)
Game entities use a three-level hierarchy, decoupled from Phaser GameObjects:
- **AnimatedActor**: Dynamic entities (Fans, Vendors, Mascots) with stats/state that affect logic
- **SceneryActor**: Static visuals (Stadium sections, rows, seats)
- **UtilityActor**: Non-visual logic entities (Wave states, waypoints, zones)

**Key Components:**
- `ActorFactory`: Generates unique IDs like `actor:fan-0`, `actor:section-A`
- `ActorRegistry`: Central registry for all actors; supports queries by category/kind with `query()`, `getByCategory()`, `snapshot()`
- `adapters/`: Wrapper classes connecting legacy Phaser sprites to Actor system (FanActor wraps Fan sprite, etc.)
- Location: `src/actors/interfaces/ActorTypes.ts` defines `ActorCategory`, `ActorKind`, `ActorSnapshot`

### 2. **Manager-Based Game Logic** (`src/managers/`)
Each manager handles one domain and emits events using `Map<string, Function[]>` pattern:
- **GameStateManager**: 3 stadium sections (A, B, C) with stat tracking; `on('eventName')`, `emit('eventName')`
- **WaveManager**: Wave countdown, section propagation, success chance calculation (`80 + happiness*0.2 - thirst*0.3`), sputter mechanics
- **AIManager**: Vendor spawning, state machine, distraction logic
- **GridManager**: World grid coordinate system (grid↔world conversions via `gridToWorld()`)
- **AnnouncerService**: Claude API integration (see Integration Points below)

**Interface Location**: `src/managers/interfaces/` contains `Section.ts`, `WaveState.ts`, `VendorTypes.ts`, etc.

### 3. **Scene Orchestration** (`src/scenes/StadiumScene.ts`)
Main game loop that:
- Instantiates all managers in `create()`
- Calls manager `update(deltaTime)` methods in Phaser's `update()` callback
- Listens to manager events, updates sprite visuals and text UI
- Manages sprite lifecycle (Fan, Vendor, WaveSprite instances created via event listeners)

Related scenes: MenuScene (start screen), WorldScene (container for grid), GridOverlay (debug visualization).

### 4. **Configuration Centralization** (`src/config/gameBalance.ts`)
**All magic numbers live here.** Never hardcode values. Examples:
- Fan stats: `thirstGrowthPerSecond: 2`, `happinessDecay: 1`
- Wave timing: `triggerCountdown: 3000ms`
- Session duration: `runModeDuration: 100000ms` (100 seconds)
- Success formula: `baseSuccessChance: 80`, happiness multiplier `0.2`, thirst multiplier `-0.3`
- Vendor config: `spawnCount: 2`, `quality: 'good'`

## Critical Data Flows

### Wave Propagation (Grid-Based, Asynchronous)
1. `waveManager.startWave()` begins 3-second countdown
2. Countdown ends → `propagateWave()` queries `ActorRegistry.getByCategory('section')` for all SectionActors
3. For each SectionActor's grid columns:
   - Calculate success chance: `baseChance + (happiness * happinessBonus) - (thirst * thirstPenalty)` + vendor interference
   - Roll random(0-100) vs chance
   - Emit `sectionSuccess` or `sectionFail` asynchronously with 1-second delay
   - Track participation rate and strength per column in `WaveCalculationResult[]`
4. On final section: emit `waveComplete` with cumulative results

**Grid Integration**: `SectionActor` (in `actors/adapters/SectionActor.ts`) composes `SectionRowActor` instances which contain `SeatActor` children. Wave propagation traverses the grid column-by-column.

### Session Management (Run Mode Only)
- `gameState.startSession('run')`: Snapshots initial stats across 3 sections
- `gameState.activateSession()`: Begins session (called after countdown overlay)
- `gameState.updateSession(deltaTime)`: Decrements `sessionTimeRemaining`; at 0, calls `completeSession()`
- `gameState.calculateSessionScore()`: Compares final vs initial stats, assigns grade (S+, S, A, B, C, D, F based on wave count and percentage)

### Stat Decay (Every Frame)
`gameState.updateStats(deltaTime)` runs in `StadiumScene.update()`:
- Happiness: `-1 pt/sec` (always)
- Thirst: `+2 pts/sec` (always)
- Attention: `-0.5 pts/sec` (always, when not engaged)

All stats are 0-100 bounded.

### Vendor AI & Pathfinding
- **VendorManager** (`AIManager`): Spawns vendors, manages state machine (idle → planning → movingSegment → serving → cooldown)
- **HybridPathResolver** & **GridManager**: Vendor pathfinding uses A* on navigation grid; currently stubbed with linear movement
- **Vendor Events**: `vendorSpawned`, `vendorReachedTarget`, `serviceComplete`, `vendorDistracted`
- **Fan Integration**: When vendor reaches target, calls `fan.drinkServed()` (thirst -100, happiness +15)

## Development Workflows

```bash
cd apps/stadium-simulator

# Development
npm run dev              # Vite dev server (http://localhost:3000)
npm run type-check       # TypeScript check only
npm run build            # Production build (dist/)

# Testing (now minimal - most old tests deleted)
npm test                 # Run Vitest (uses happy-dom, not browser)
npm run test:ui          # Interactive test runner

# Debugging
# URL: ?demo=debug loads TestSectionDebugScene (isolated feature testing)
```

## Key Conventions

### File Organization
- **Managers**: Pure business logic, no Phaser dependencies (except type imports for `Phaser.Scene`)
- **Scenes**: Orchestration + rendering; call manager methods, listen to events
  - **Scenes NEVER directly manipulate actor stats or check thresholds**
  - Scenes only call actor `update(delta)` and listen to manager events
- **Adapters** (`actors/adapters/`): Wrapper classes that connect legacy Phaser sprites to Actor system
- **Sprites** (`sprites/`): Phaser GameObjects (Fan, Vendor, WaveSprite, etc.); extend Phaser classes; **PURE VISUAL ONLY**
  - Sprites expose methods like `setIntensity()`, `setAlpha()`, `playAnimation()`
  - Sprites DO NOT contain game logic, stat management, or condition checks
  - Sprites DO NOT reference `gameBalance` config directly (actors pass values)
- **Interfaces**: Each namespace has `interfaces/` subfolder (managers, actors, sprites)
- **Helpers**: Each namespace has `helpers/` subfolder (BaseManager, BaseActor, ActorLogger)
- **Behaviors** (`actors/behaviors/`): Encapsulate complex AI logic (targeting, pathfinding, state machines)
  - Behaviors are attached to actors and called via `behavior.tick(delta)`
  - Example: `DrinkVendorBehavior` handles vendor target selection and movement

### Type Imports
```typescript
// Interfaces live in namespace/interfaces/
import type { Section } from '@/managers/interfaces/Section';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { VendorProfile } from '@/managers/interfaces/VendorTypes';

// Or bulk import via index
import type { Section, WaveState } from '@/managers/interfaces';
```

### Event Pattern (All Managers)
```typescript
// Subscribe to events
manager.on('eventName', (payload) => {
  // handle payload
});

// Emit events
manager.emit('eventName', payload);
```

## Integration Points

### Claude API (AnnouncerService)
- **Endpoint**: `import.meta.env.VITE_ANTHROPIC_API_URL` (default: https://api.anthropic.com/v1/messages)
- **Model**: `claude-3-5-sonnet-20241022`
- **Headers**: `x-api-key` (from env), `anthropic-version: 2023-06-01`
- **Max tokens**: 150
- **Fallback**: Returns "The crowd goes wild!" on network error
- **Called from**: StadiumScene on significant events (wave success, session start, vendor distraction)

### Vite Path Aliases
`@` resolves to `src/`. Use in all imports:
```typescript
import { GameStateManager } from '@/managers/GameStateManager';
import { ActorRegistry } from '@/actors/ActorRegistry';
```

### GitHub Pages Deployment
- **Base path**: `/stadium-simulator/`
- **Workflow**: `.github/workflows/deploy.yml` auto-deploys `main` → `gh-pages`
- **Build**: Run `npm run build` to generate `dist/`

## Common Pitfalls

1. **Hardcoded values**: Never add magic numbers; update `gameBalance.ts` instead
2. **Stat→Visual coupling**: Never call sprite methods from stat setters; use state machine
3. **Scene logic leakage**: Scenes orchestrate, they don't implement game rules or check thresholds
4. **Event listener leaks**: Remove listeners in scene's `shutdown` event; unsubscribe in manager cleanup
5. **Actor ID conflicts**: Use `ActorFactory.generateId()` or specify custom suffix (e.g., `section-A`)
6. **Grid vs world coords**: GridManager handles conversion; actors use grid positions, sprites use world positions
7. **Type imports**: Import interfaces from `{namespace}/interfaces/`, not `types/` directory
8. **Environment variables**: Only `VITE_*` prefix exposed to client; sensitive keys in `.env` (not committed)
9. **Sprite logic contamination**: If a sprite has `if (thirst > 50)` checks, refactor to actor state machine

## Current State & Recent Changes

- **Actor System**: Fully implemented with adapters for FanActor, VendorActor, SectionActor, WaveSpriteActor
- **State Machine Architecture**: FanActor fully refactored with state machine pattern (stats → state → visuals)
- **Behavior-Driven Architecture**: DrinkVendorBehavior handles AI targeting via SectionActor queries; actors drive visual updates
- **Fan Logic Migration**: All fan game logic moved from Fan sprite to FanActor (stats, wave participation, terrain penalties)
- **Sprite Purification**: Fan sprite is now purely visual (no stat checks, no game logic, no gameBalance references)
- **Vendor Integration**: Vendors spawn, pathfind (stubbed linear), select targets via behaviors, serve fans via FanActor.drinkServed
- **Code Reorganization**: Interfaces moved to `{namespace}/interfaces/`, helpers to `{namespace}/helpers/`
- **Test Cleanup**: Most old tests deleted except AnnouncerService.test.ts; focus on manual testing for now
- **Eternal Mode**: Removed; only run mode (100-second sessions) supported

## Next Implementation Priorities

- [ ] Refactor RipplePropagationEngine to use FanActor state machine (remove Fan sprite dependencies)
- [ ] Refactor MascotTargetingAI to use FanActor.getIsDisinterested() (remove Fan sprite dependencies)
- [ ] Implement MascotBehavior with state machine pattern (idle, scanning, targeting, firing, cooldown)
- [ ] Complete HybridPathResolver A* pathfinding (currently linear)
- [ ] Vendor collision detection + navigation graph refinement
- [ ] Remove deprecated AIManager.scanningInSection sprite access when behaviors handle pathfinding state
- [ ] Menu and GameOverScene UI implementations
- [ ] Pixel art asset creation + sprite sheet integration
- [ ] Audio event triggers (Howler.js 8-bit sounds)
