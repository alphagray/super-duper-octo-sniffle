# Stadium Simulator - AI Coding Agent Instructions

## Project Overview

**Stadium Simulator** is an 8-bit retro Phaser 3 game where players initiate stadium waves across three sections while managing fan engagement (happiness, thirst, attention). The game features AI-powered announcer commentary via Claude API and grid-based vendor AI pathfinding. Game runs 100-second timed sessions only (run mode).

## Architecture Overview

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
- **Adapters** (`actors/adapters/`): Wrapper classes that connect legacy Phaser sprites to Actor system
- **Sprites** (`sprites/`): Phaser GameObjects (Fan, Vendor, WaveSprite, etc.); extend Phaser classes
- **Interfaces**: Each namespace has `interfaces/` subfolder (managers, actors, sprites)
- **Helpers**: Each namespace has `helpers/` subfolder (BaseManager, BaseActor, ActorLogger)

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
2. **Event listener leaks**: Remove listeners in scene's `shutdown` event; unsubscribe in manager cleanup
3. **Actor ID conflicts**: Use `ActorFactory.generateId()` or specify custom suffix (e.g., `section-A`)
4. **Grid vs world coords**: GridManager handles conversion; actors use grid positions, sprites use world positions
5. **Type imports**: Import interfaces from `{namespace}/interfaces/`, not `types/` directory
6. **Environment variables**: Only `VITE_*` prefix exposed to client; sensitive keys in `.env` (not committed)
7. **Legacy sprites**: Some sprites (Fan, Vendor) still extend Phaser GameObjects; use adapters to integrate with Actor system

## Current State & Recent Changes

- **Actor System**: Fully implemented with adapters for FanActor, VendorActor, SectionActor, WaveSpriteActor
- **Behavior-Driven Architecture**: DrinkVendorBehavior handles AI targeting via SectionActor queries; actors drive visual updates
- **Fan Logic Migration**: All fan game logic moved from Fan sprite to FanActor (stats, wave participation, terrain penalties)
- **Vendor Integration**: Vendors spawn, pathfind (stubbed linear), select targets via behaviors, serve fans via FanActor.drinkServed
- **Code Reorganization**: Interfaces moved to `{namespace}/interfaces/`, helpers to `{namespace}/helpers/`
- **Test Cleanup**: Most old tests deleted except AnnouncerService.test.ts; focus on manual testing for now
- **Eternal Mode**: Removed; only run mode (100-second sessions) supported

## Next Implementation Priorities

- [ ] Complete HybridPathResolver A* pathfinding (currently linear)
- [ ] Vendor collision detection + navigation graph refinement
- [ ] Remove deprecated AIManager.scanningInSection sprite access when behaviors handle pathfinding state
- [ ] Mascot special abilities via MascotBehavior
- [ ] Menu and GameOverScene UI implementations
- [ ] Pixel art asset creation + sprite sheet integration
- [ ] Audio event triggers (Howler.js 8-bit sounds)
