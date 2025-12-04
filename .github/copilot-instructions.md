# Stadium Simulator — AI Coding Agent Quickstart

Concise, repo-specific guidance to make AI agents immediately productive. Keep changes minimal, follow existing patterns, and reference files by path.

## Architecture Essentials

**Actor Pattern** — Three-layer separation for all dynamic entities:
- `Actor` (pure stats/state) → `Behavior` (AI/logic) → `Sprite` (visual). See `src/actors/`, `src/actors/behaviors/`, `src/sprites/`.
- Example: `FanActor` manages `happiness`/`thirst`/`attention` stats, derives `FanState` (`happy`|`thirsty`|`disengaged`), and delegates visuals to `Fan` sprite.
- States are **derived** from stats via `deriveStateFromStats()`, never set manually. Transitions trigger `updateContinuousVisuals()`.

**CRITICAL: Never Manipulate Sprites Directly from External Events**
- ❌ WRONG: `sprite.playAnimation()` called from scene event handlers
- ✅ RIGHT: Modify actor stats → actor derives new state → actor calls sprite methods
- **Flow**: Event → Actor.modifyStats() → Actor.deriveStateFromStats() → Actor.transitionToState() → Sprite.playAnimation()
- Example: T-shirt cannon hit → `fanActor.modifyStats({happiness: +3})` → fan derives `excited` state → `sprite.playExcitedJump()`
- **Always** route through the actor's state machine. Sprites are dumb visual objects with no business logic.

**Managers** — Domain logic in `src/managers/`:
- `GameStateManager`: Central game state (score, timer, sections)
- `WaveManager`: Wave propagation logic with event emission (`sectionSuccess`, `waveComplete`)
- `AIManager`: Vendor AI coordination and mascot targeting
- `GridManager`: World coordinate system, zone types (sky/seat/aisle/stairs/ground), pathfinding support
- All managers extend `BaseManager` (in `managers/helpers/`) and use event-driven API: `manager.on(event, handler)`, `manager.emit(event, data)`.

**Scenes** — Pure orchestration in `src/scenes/`:
- `StadiumScene.ts` is the main game scene. Scenes call `manager.update(delta)`, listen to manager events, and create/update sprites.
- **No game logic in scenes**: No stat checks, no state transitions, no thresholds. Managers decide, scenes visualize.

**Sprites** — Pure Phaser visuals in `src/sprites/`:
- Extend `BaseActorContainer` or `BaseActorSprite` (in `sprites/helpers/`).
- No game rules or config access. Sprites expose methods like `setIntensity(val)`, `playAnimation(name)`, called by actors.

**Config** — All tuning in `src/config/gameBalance.ts`:
- Fan stats, vendor behavior, wave mechanics, thresholds. **Never hardcode magic numbers.**

## Core Patterns

**Actor Update Loop:**
```typescript
update(delta: number) {
  this.updateStats(delta);           // Modify raw stats (thirst, happiness)
  this.updateContinuousVisuals();    // Sync sprite intensity/animations
  const newState = this.deriveStateFromStats();  // Calculate state from stats
  if (newState !== this.state) {
    this.transitionToState(newState); // Trigger state change + visuals
  }
}
```
Example: `FanActor.ts` transitions to `disengaged` when `attention < 30 && happiness < 40`.

**Vendor Behavior States:**
- `DrinkVendorBehavior` (in `src/actors/behaviors/`) implements `AIActorBehavior` interface.
- States: `awaitingAssignment` → `idle` → `targeting` → `moving` → `serving` → `recalling`.
- On service complete: `fan.drinkServed()` adjusts stats (thirst -100, happiness +15).

**Wave Mechanics:**
- `WaveManager.propagateWave()` iterates sections/columns via `ActorRegistry` and `GridManager`.
- Success chance formula: `80 + happiness*0.2 - thirst*0.3 + vendorEffects`.
- Emits: `sectionSuccess`, `sectionFail`, `waveComplete` with context.

**ActorRegistry API:**
- `register(actor)`, `unregister(id)`, `get(id)`, `getByCategory(category)`, `query(filter)`.
- Example: `actorRegistry.query({ category: 'fan', type: 'fan' })` returns all fan actors.
- IDs via `ActorFactory.generateId()` format: `actor:type-identifier` (e.g., `actor:fan-0-0`).

**GridManager Coordinates:**
- Actors/behaviors use **grid coords** (row, col): `gridManager.worldToGrid(x, y)`, `gridToWorld(row, col)`.
- Sprites use **world coords** (x, y pixels). Always convert at the boundary.
- Zone types: `sky`, `seat`, `aisle`, `stairs`, `ground`. Check `cell.passable` and `cell.zoneType`.

**Namespace Organization:**
- Interfaces in `{namespace}/interfaces/`: `import type { Section } from '@/managers/interfaces/Section'`.
- Helpers in `{namespace}/helpers/`: `import { BaseManager } from '@/managers/helpers/BaseManager'`.
- Path alias `@` maps to `src/`.

## Developer Workflows

**Dev Server:**
```bash
cd apps/stadium-simulator
npm run dev              # Vite at http://localhost:3000
npm run dev:full         # Vercel dev (includes serverless functions)
```

**Build & Type Check:**
```bash
npm run build            # TypeScript compile + Vite build
npm run type-check       # tsc --noEmit (strict mode)
```

**Testing:**
```bash
npm test                 # Vitest (happy-dom environment)
npm run test:ui          # Vitest UI browser
npm run test:coverage    # Coverage report
npm run test:api         # API tests only (vitest.api.config.ts)
```

**Debug Tools:**
- Add `?demo=debug` to URL to load debug scene.
- Press `G` in-game to toggle grid overlay (if enabled).
- Check `gameBalance.debug.*` flags in `src/config/gameBalance.ts` for verbose logging.

**Deployment:**
- GitHub Pages: `.github/workflows/deploy.yml` auto-deploys on push to `main`.
- Vercel: `npm run vercel:deploy` (requires env vars: `ANTHROPIC_API_KEY`, `ADMIN_API_KEY`).
- Base path: `/stadium-simulator/` for GitHub Pages, `/` for Vercel.

## Conventions

- **Scenes don't modify state:** Scenes listen to events and update visuals only.
- **Sprites don't read config:** All thresholds/rules in managers or actors.
- **Config is single source:** Edit `src/config/gameBalance.ts` for tuning, not inline constants.
- **Interfaces are separate:** Use `src/{namespace}/interfaces/` for type definitions.
- **Event cleanup:** Always unsubscribe from manager events in scene `shutdown()`.

**Score Display vs Tracking:**
- HUD shows only total running score via `GameStateManager.getTotalScore()`.
- Track breakdowns internally (wave gained, vendor gained, wave lost, vendor lost) for end-of-session reporting.

## Integration Points

**Claude AI Announcer:**
- API: `api/announcer.ts` (Vercel serverless function).
- Client: `AnnouncerService.ts` in `src/managers/`.
- Model: `claude-3-5-sonnet-20241022`, max tokens: 150.
- Events: `waveStart`, `sectionSuccess`, `sectionFail`, `waveComplete`.
- Fallback on error: "The crowd goes wild!".

**Level Data:**
- JSON config: `public/assets/stadium-grid-config.json` (2173 lines).
- Loader: `LevelService.ts` in `src/services/`.
- Structure: `gridConfig` (rows, cols, cellSize, zone ranges), `sections`, `vendors`, `stairs`, `fans`.

**Pathfinding:**
- Service: `PathfindingService.ts` (A* implementation).
- Integration: `GridManager` provides `getNeighbors(row, col)` with walls and transitions.
- Vendor behaviors use `pathfindingService.findPath(start, goal)`.

## Current Focus Areas

- Refactor remaining systems to use FanActor state machine (remove sprite dependencies).
- Complete `HybridPathResolver` for vendor navigation with collision avoidance.
- Implement MascotBehavior following same actor/behavior pattern as vendors.
- Scoring system for vendor performance (points earned tracked in behavior).

## Quick References

- Actor queries: `ActorRegistry.getByCategory('section')`, `query({ type: 'fan' })`.
- Grid conversion: `gridManager.worldToGrid(x, y)`, `gridToWorld(row, col)`.
- Depth sorting: `gridManager.getDepthForPosition(row, col)` or `getDepthForWorld(x, y)`.
- Tests: `apps/stadium-simulator/src/__tests__/` (490 passing), `api/__tests__/` (API tests).

Questions? Reference specific files and this doc will be refined.
