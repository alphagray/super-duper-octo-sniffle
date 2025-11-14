# Stadium Simulator - AI Coding Agent Instructions

## Project Overview

**Stadium Simulator** is an 8-bit retro Phaser 3 game where players initiate stadium waves across three sections while managing fan engagement (happiness, thirst, attention). The game features AI-powered announcer commentary via Claude API integration.

### Architecture Patterns

#### 1. **Manager-Based Game Logic**
Game state logic lives in separate manager classes that handle one domain:
- **GameStateManager**: Central state for 3 stadium sections (A, B, C) with stat tracking; emits events for state changes
- **WaveManager**: Wave timing, propagation logic, scoring; manages success chance calculation and sputter mechanics
- **VendorManager**: Vendor positioning and interference with wave propagation
- **SeatManager**: Maps fans to seats across stadium sections
- **AnnouncerService**: Claude API integration for dynamic commentary

Each manager implements an event listener pattern using `Map<string, Function[]>` for `on()` and `emit()` methods.

#### 2. **Phaser Scene Orchestration**
`StadiumScene` is the main game loop that:
- Instantiates all managers in `create()`
- Calls manager `update()` methods in Phaser's `update()` callback
- Listens to manager events and updates visual sprites/text
- Passes scene context to managers that need it (e.g., SeatManager takes `this`)

Scene transitions: MenuScene → StadiumScene → ScoreReportScene/GameOverScene

#### 3. **Configuration Centralization**
All magic numbers live in `src/config/gameBalance.ts`:
- Fan stats (thirst growth: 2 pts/sec, happiness decay: 1.25 pts/sec when thirsty)
- Wave strength dynamics (success bonus: +8, failure penalty: -20)
- Session timers (run mode: 100s, eternal mode: infinite)
- Grade thresholds (S+ ≥8 completed waves, percentage-based fallback)
- UI dimensions (meter width: 40px, countdown font: 120px)

**Never hardcode values**—update `gameBalance` instead.

#### 4. **Type Safety**
TypeScript strict mode enforced. All data structures defined in `src/types/GameTypes.ts`:
- `Section`: { id, happiness, thirst, attention }
- `GameState`: { sections[], wave, score }
- `WaveState`: { countdown, active, currentSection, multiplier }

Managers export type definitions for their state (e.g., `SessionScore`, `WaveCalculationResult`).

### Key Workflows

#### Development
```bash
cd apps/stadium-simulator
npm run dev          # Start Vite dev server (http://localhost:3000)
npm run type-check   # Run TypeScript without emitting
npm test             # Run Vitest (uses happy-dom, not browser)
npm run test:ui      # Interactive test runner
npm run build        # TypeScript + Vite minification
```

#### Testing Patterns
- Tests live in `src/__tests__/` mirroring source structure
- Use `happy-dom` for DOM simulation (no browser needed)
- Vitest setup in `src/__tests__/setup.ts` provides globals
- Test managers in isolation; mock dependencies in constructor
- Example: `GameStateManager.test.ts` tests stat calculations without Phaser

#### Debug Mode
URL parameter `?demo=debug` loads `TestSectionDebugScene` instead of normal flow—use for isolated feature testing.

### Critical Data Flows

#### Wave Propagation (Asynchronous)
1. User initiates wave → `waveManager.startWave()` starts 3-second countdown
2. Countdown reaches zero → `propagateWave()` evaluates sections A→B→C sequentially
3. For each section: calculate success chance (formula: `80 + happiness*0.2 - thirst*0.3`) + vendor penalty (-25%)
4. Roll random(0-100) vs success chance
5. If success: award 100 points, increment `totalSectionSuccesses`; if fail: reset multiplier, emit `sectionFail` event
6. Emit `sectionSuccess`/`sectionFail` events **asynchronously** per section with 1-second delay
7. On propagation end: emit `waveComplete` with all results

Wave strength changes per column during visual animation (not part of this propagation logic yet).

#### Session Management (Run vs Eternal Mode)
- `startSession(mode)`: Sets `sessionState='countdown'`, snapshots initial stats
- `activateSession()`: Called when countdown overlay finishes, sets `sessionState='active'`
- For 'run' mode: `updateSession(deltaTime)` decrements `sessionTimeRemaining`; when 0, calls `completeSession()`
- `calculateSessionScore()`: Compares final vs initial aggregate stats, assigns grade letter + points

#### State Updates
`gameState.updateStats(deltaTime)` runs every frame:
- All sections: happiness -= 1 pts/sec, thirst += 2 pts/sec (independent of wave state)
- Called from `StadiumScene.update()` to keep stats decaying

### Integration Points

#### Claude API (AnnouncerService)
- Endpoint: `import.meta.env.VITE_ANTHROPIC_API_URL` (default: https://api.anthropic.com/v1/messages)
- Model: `claude-3-5-sonnet-20241022`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`
- Max tokens: 150
- Fallback: Returns "The crowd goes wild!" on network error
- Called from scenes/managers when significant game events occur

#### Vite Path Aliases
`@` resolves to `src/` (configured in `vite.config.ts`). Import as:
```typescript
import { GameStateManager } from '@/managers/GameStateManager';
import type { Section } from '@/types/GameTypes';
```

#### GitHub Pages Deployment
- Base path: `/stadium-simulator/` (set in vite.config)
- Workflow: `.github/workflows/deploy.yml` (auto-deploys `main` branch to `gh-pages`)
- Run `npm run build` locally to generate `dist/`

### Common Pitfalls

1. **Don't bypass gameBalance.ts**: Changing hardcoded values won't persist across refactors
2. **Event listener cleanup**: Listeners accumulate if not removed; scenes need cleanup in `shutdown`
3. **Async propagation**: `propagateWave()` uses `emitAsync()` to wait for listeners; ensure listeners return promises
4. **Type exports**: Managers export interfaces at bottom of file; update those if state shape changes
5. **Phaser version**: Project uses Phaser 3.80.1; check API compatibility for advanced features
6. **Environment variables**: Only `VITE_*` prefix exposed to client; secret keys go in `.env` (not committed)

### File Organization Conventions

- **Managers**: Pure business logic, no Phaser dependencies (except type imports)
- **Scenes**: Orchestration + Phaser rendering; call manager methods, listen to events
- **Sprites**: Phaser GameObjects; extend Phaser classes, minimal state logic
- **Types**: Interfaces and type aliases only; no implementations
- **Config**: Export single const objects or functions; no side effects

### Next Implementation Priorities

- [ ] Visual wave propagation animation in seat columns
- [ ] Vendor movement and interference detection
- [ ] Mascot special abilities
- [ ] Complete UI overlays (score tracking, session timer display)
- [ ] Menu and GameOverScene implementations
- [ ] Pixel art asset creation + sprite sheet integration
- [ ] Howler.js 8-bit audio event triggers
