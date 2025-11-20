# Code Organization - Stadium Simulator

## Overview
The codebase has been reorganized into a clean namespace-based structure with dedicated folders for interfaces and helpers within each namespace.

## Structure

```
src/
├── actors/                    # Actor system (entity management)
│   ├── interfaces/           # Actor-related interfaces
│   │   ├── ActorTypes.ts    # ActorCategory, ActorKind, ActorSnapshot, ActorQuery
│   │   └── index.ts         # Re-exports all actor interfaces
│   ├── helpers/              # (Reserved for future actor helpers)
│   ├── adapters/             # Adapter classes connecting Phaser sprites to Actor system
│   ├── Actor.ts              # Base Actor class
│   ├── ActorFactory.ts       # Factory for creating actors
│   └── ActorRegistry.ts      # Central registry for all actors
│
├── managers/                  # Game logic managers
│   ├── interfaces/           # Manager-related interfaces
│   │   ├── Section.ts       # Section, SectionConfig
│   │   ├── WaveState.ts     # WaveState
│   │   ├── GameState.ts     # GameState
│   │   ├── VendorTypes.ts   # VendorProfile, VendorState, PathSegment, etc.
│   │   └── index.ts         # Re-exports all manager interfaces
│   ├── helpers/              # Base manager classes
│   │   └── BaseManager.ts   # Base class for event-driven managers
│   ├── GameStateManager.ts   # Central game state (run mode only)
│   ├── WaveManager.ts        # Wave mechanics and propagation
│   ├── Wave.ts               # Wave instance data structure
│   ├── AIManager.ts          # Vendor AI and pathfinding
│   ├── GridManager.ts        # World grid coordinate system
│   ├── HybridPathResolver.ts # Vendor pathfinding algorithm
│   └── AnnouncerService.ts   # Claude API integration
│
├── scenes/                    # Phaser scenes
│   ├── MenuScene.ts          # Main menu
│   ├── WorldScene.ts         # World container + grid
│   ├── StadiumScene.ts       # Main game scene
│   └── GridOverlay.ts        # Debug grid visualization
│
├── services/                  # Utility services
│   ├── interfaces/           # (Reserved for future service interfaces)
│   ├── LevelService.ts       # Level data loading
│   └── LoggerService.ts      # Logging service
│
├── sprites/                   # Phaser sprite classes
│   ├── interfaces/           # Sprite-related interfaces
│   │   ├── SeatAssignment.ts # SeatAssignment interface
│   │   └── index.ts         # Re-exports all sprite interfaces
│   ├── helpers/              # Base sprite classes
│   │   ├── BaseActor.ts     # BaseActorContainer, BaseActorSprite
│   │   └── ActorLogger.ts   # Logging helper for sprites
│   ├── Fan.ts                # Fan sprite (container-based)
│   ├── Vendor.ts             # Vendor sprite
│   ├── StadiumSection.ts     # Section container
│   ├── SectionRow.ts         # Row container
│   ├── Seat.ts               # Seat sprite
│   ├── WaveSprite.ts         # Wave visualization
│   └── Mascot.ts             # Mascot sprite
│
├── config/                    # Configuration
│   └── gameBalance.ts        # All game balance tuning values
│
├── __tests__/                 # Tests
│   └── managers/
│       └── AnnouncerService.test.ts  # Only remaining test
│
├── config.ts                  # Phaser game configuration
└── main.ts                    # Application entry point
```

## Key Changes

### 1. Removed Legacy Code
- **Deleted all test files** except `AnnouncerService.test.ts`
- **Removed test scenes**: `TestStadiumScene`, `TestSectionScene`, `TestSectionDebugScene`, `ScoreReportScene`, `GameOverScene`
- **Removed eternal mode**: Game now only supports 'run' mode (100-second sessions)
- **Removed old type files**: `types/GameTypes.ts`, `actors/ActorTypes.ts`

### 2. Interface Organization
- Interfaces moved to `{namespace}/interfaces/` folders
- Each interface in its own file for clarity
- Index files (`index.ts`) provide convenient re-exports
- Import examples:
  ```typescript
  // Specific imports
  import type { Section } from '@/managers/interfaces/Section';
  import type { VendorProfile } from '@/managers/interfaces/VendorTypes';
  import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
  
  // Bulk imports (if needed)
  import type { Section, WaveState, GameState } from '@/managers/interfaces';
  ```

### 3. Helper Organization
- Helper/base classes moved to `{namespace}/helpers/` folders
- `BaseManager.ts` → `managers/helpers/`
- `BaseActor.ts` → `sprites/helpers/`
- `ActorLogger.ts` → `sprites/helpers/`

### 4. Simplified Game Modes
- **Before**: `GameMode = 'eternal' | 'run'`
- **After**: Only 'run' mode (100-second timed sessions)
- Removed all eternal mode logic from:
  - `GameStateManager`
  - `StadiumScene`
  - `WorldScene`
  - `config.ts`

## Import Patterns

### Managers
```typescript
import { GameStateManager } from '@/managers/GameStateManager';
import type { Section } from '@/managers/interfaces/Section';
import type { VendorProfile } from '@/managers/interfaces/VendorTypes';
```

### Actors
```typescript
import { Actor } from '@/actors/Actor';
import { ActorRegistry } from '@/actors/ActorRegistry';
import type { ActorCategory, ActorSnapshot } from '@/actors/interfaces/ActorTypes';
```

### Sprites
```typescript
import { Fan } from '@/sprites/Fan';
import { BaseActorContainer } from '@/sprites/helpers/BaseActor';
import type { SeatAssignment } from '@/sprites/interfaces/SeatAssignment';
```

### Helpers
```typescript
import { BaseManager } from '@/managers/helpers/BaseManager';
import { ActorLogger } from '@/sprites/helpers/ActorLogger';
```

## Testing

### Remaining Tests
- `api/__tests__/announcer.test.ts` - Claude API tests (kept)
- `src/__tests__/managers/AnnouncerService.test.ts` - Service wrapper tests (kept)

### Running Tests
```bash
npm test                 # Run all tests
npm run test:ui          # Interactive test UI
```

## Build & Development

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run type-check       # TypeScript check only
```

## Future Improvements

1. **Service Interfaces**: Create `services/interfaces/` for service contracts
2. **Helper Consolidation**: Consider moving common helpers to a shared `/helpers` folder if patterns emerge
3. **Test Restoration**: Rebuild test suite with new structure once core features stabilize
4. **Type Exports**: Create barrel exports at namespace root level if needed

## Migration Notes

If you need to import from the old locations, here's the mapping:

| Old Import | New Import |
|------------|------------|
| `@/types/GameTypes` | `@/managers/interfaces/Section` (or specific files) |
| `@/actors/ActorTypes` | `@/actors/interfaces/ActorTypes` |
| `@/sprites/BaseActor` | `@/sprites/helpers/BaseActor` |
| `@/sprites/ActorLogger` | `@/sprites/helpers/ActorLogger` |
| `@/managers/base/BaseManager` | `@/managers/helpers/BaseManager` |
| `GameMode` type | Removed (only 'run' mode exists) |
