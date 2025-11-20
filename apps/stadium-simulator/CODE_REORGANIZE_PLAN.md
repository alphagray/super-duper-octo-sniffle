# Code Reorganization Plan

## Overview

This plan reorganizes the Stadium Simulator codebase to:
1. Separate **core game logic** from **stadium-specific code**
2. Move all **sprites under actors/sprites/** folder hierarchy
3. Convert **Seat** to a **utility actor** (similar to Wave)
4. Move **GridOverlay** with **GridManager** to core
5. Create comprehensive tests for Steps 6-7 features

**Feature Branch:** `sb/big-structural-refactor`  
**Deployment Strategy:** Feature branch → full validation → merge to main  
**Import Automation:** Shell script using `find` + `sed` for consistent updates

---

## Workflow Rules

⚠️ **CRITICAL:** Follow this workflow for EACH step:

1. **Plan**: Review this document for the step details
2. **Create Todo List**: Build a todo list for the step's sub-tasks
3. **Implement**: Execute one step at a time
4. **Check Status**: Run tests, type-check, verify no breakage
5. **Check In**: Report status to user with:
   - What was completed
   - Any issues encountered
   - Whether manual validation is needed
6. **User Confirmation**: Wait for user approval
7. **Update Plan**: Mark step as complete in this document
8. **Move to Next**: Only proceed to next step after user approval

---

## Target File Structure

### New Organization

```
src/
├── core/                          # 🎮 Reusable game logic (stadium-agnostic)
│   ├── managers/
│   │   ├── base/
│   │   │   └── BaseManager.ts
│   │   ├── GameStateManager.ts
│   │   ├── WaveManager.ts
│   │   └── Wave.ts
│   ├── grid/
│   │   ├── GridManager.ts
│   │   └── GridOverlay.ts        # ⚡ MOVED from scenes/
│   └── services/
│       ├── LoggerService.ts
│       └── AnnouncerService.ts
│
├── stadium/                       # 🏟️ Stadium-specific domain
│   ├── managers/
│   │   ├── SeatManager.ts
│   │   ├── VendorManager.ts
│   │   └── HybridPathResolver.ts
│   └── scenes/
│       ├── StadiumScene.ts
│       ├── WorldScene.ts
│       ├── MenuScene.ts
│       ├── ScoreReportScene.ts
│       ├── GameOverScene.ts
│       ├── TestSectionScene.ts
│       ├── TestSectionDebugScene.ts
│       └── TestStadiumScene.ts
│
├── actors/                        # 🎭 Actor system + all visual sprites
│   ├── Actor.ts
│   ├── ActorFactory.ts
│   ├── ActorRegistry.ts
│   ├── ActorTypes.ts
│   ├── adapters/
│   │   ├── FanActor.ts
│   │   ├── VendorActor.ts
│   │   ├── SectionActor.ts
│   │   ├── WaveActor.ts
│   │   ├── WaveSpriteActor.ts
│   │   └── SeatActor.ts          # ⚡ NEW: Seat adapter
│   ├── utilities/
│   │   └── Seat.ts               # ⚡ MOVED: Now utility actor
│   └── sprites/                  # 🎨 All Phaser visual components
│       ├── shared/
│       │   ├── BaseActor.ts
│       │   └── ActorLogger.ts
│       └── stadium/
│           ├── StadiumSection.ts
│           ├── SectionRow.ts
│           ├── Fan.ts
│           ├── Vendor.ts
│           ├── Mascot.ts
│           └── WaveSprite.ts
│
├── wrappers/                      # 🔌 Manager logging bridges
│   ├── AnnouncerServiceWrapper.ts
│   ├── GameStateManagerWrapper.ts
│   ├── SeatManagerWrapper.ts
│   ├── VendorManagerWrapper.ts
│   └── WaveManagerWrapper.ts
│
├── config/
│   └── gameBalance.ts
├── types/
│   └── GameTypes.ts
├── main.ts
└── config.ts
```

### Corresponding Test Structure

```
src/__tests__/
├── core/
│   ├── managers/
│   │   ├── base/
│   │   ├── GameStateManager.test.ts
│   │   ├── WaveManager.test.ts
│   │   └── Wave.test.ts          # ⚡ NEW
│   ├── grid/
│   │   ├── GridManager.test.ts   # ⚡ NEW
│   │   └── GridOverlay.test.ts   # ⚡ NEW
│   └── services/
│       └── AnnouncerService.test.ts
├── stadium/
│   ├── managers/
│   │   ├── VendorManager.test.ts
│   │   ├── HybridPathResolver.test.ts  # ⚡ NEW
│   │   └── SeatManager.test.ts   # ⚡ NEW
│   └── (scenes not unit testable)
├── actors/
│   ├── ActorFactory.test.ts
│   ├── ActorRegistry.test.ts
│   ├── utilities/
│   │   └── Seat.test.ts          # ⚡ MOVED & UPDATED
│   ├── adapters/
│   │   └── SeatActor.test.ts     # ⚡ NEW
│   └── sprites/
│       └── stadium/
│           └── WaveSprite.test.ts # ⚡ NEW
└── wrappers/
    ├── AnnouncerServiceWrapper.test.ts
    ├── GameStateManagerWrapper.test.ts
    ├── SeatManagerWrapper.test.ts
    ├── VendorManagerWrapper.test.ts
    └── WaveManagerWrapper.test.ts
```

---

## Phase 1: Create Missing Tests (Before Reorganization)

**Goal:** Write tests for critical untested Steps 6-7 features using current file paths

**Why First?** Ensures we validate functionality before moving files. If tests fail, issues are easier to debug in original structure.

**Test Files to Create:**

### Phase 1 Steps

#### Step 1.1: Create GridManager.test.ts
- **File Location:** `src/__tests__/managers/GridManager.test.ts`
- **Test Coverage:**
  - Grid initialization (rows, cols, cellSize)
  - World-to-grid coordinate conversion
  - Grid-to-world conversion
  - Cell passability and terrain penalties
  - Wall registration and neighbor detection
  - Occupant tracking (addOccupant, removeOccupant)
  - Ground line wall application
  - Pathfinding neighbor calculation (getPassableNeighbors)
  - Edge cases: boundaries, invalid cells, wall conflicts

**Status:** ✅ Complete (55 tests, all passing)

#### Step 1.2: Create HybridPathResolver.test.ts
- **File Location:** `src/__tests__/managers/HybridPathResolver.test.ts`
- **Test Coverage:**
  - Navigation graph construction (corridor, stair, rowEntry nodes)
  - Node creation and edge connections
  - Dijkstra's algorithm pathfinding
  - Path finding through valid corridors
  - Detour around obstacles
  - Segment cost calculation with vendor abilities
  - Target scoring for drink service priority
  - Detour detection and local rerouting
  - Graph rebuild on section changes

**Status:** ✅ Complete (39/39 tests passing)

#### Step 1.3: Create WaveSprite.test.ts
- **File Location:** `src/__tests__/sprites/WaveSprite.test.ts`
- **Test Coverage:**
  - Movement state machine (idle → moving → complete)
  - Section collision detection (enter/exit events)
  - Speed calculation based on wave strength
  - Direction handling (left vs right)
  - Debug visual updates
  - Event emission (movementStarted, pathComplete)
  - Mock Phaser dependencies using test doubles

**Status:** ✅ Complete (49/49 tests passing)

#### Step 1.4: Create SeatManager.test.ts
- **File Location:** `src/__tests__/managers/SeatManager.test.ts`
- **Test Coverage:**
  - Seat initialization from sections
  - Fan population logic
  - Crowd density calculation
  - Thirsty fan filtering
  - Seat assignment and removal
  - Replace current wrapper-only stub test

**Status:** ✅ Complete (50/50 tests passing)

#### Step 1.5: Create Wave.test.ts
- **File Location:** `src/__tests__/managers/Wave.test.ts`
- **Test Coverage:**
  - Wave creation and initialization
  - Path calculation from section IDs
  - Direction determination (longest side, tie-breaking)
  - Section result recording
  - JSON export for history

**Status:** ✅ Complete (47/47 tests passing)

#### Step 1.6: Create Actor Adapter Tests
- **File Locations:**
  - `src/__tests__/actors/adapters/FanActor.test.ts`
  - `src/__tests__/actors/adapters/VendorActor.test.ts`
  - `src/__tests__/actors/adapters/SectionActor.test.ts`
  - `src/__tests__/actors/adapters/WaveActor.test.ts`
  - `src/__tests__/actors/adapters/WaveSpriteActor.test.ts`
- **Test Coverage:**
  - Adapter wrapping of sprite/actor instances
  - ID generation and storage
  - Update and draw method delegation
  - Type and category properties

**Status:** ✅ Complete (110 tests total: FanActor 20, VendorActor 19, SectionActor 23, WaveActor 22, WaveSpriteActor 26)

#### Step 1.7: Create Seat.test.ts
- **File Location:** `src/__tests__/sprites/Seat.test.ts`
- **Test Coverage:**
  - Seat assignment and removal
  - Traversal penalty calculation
  - Vendor ability overrides
  - Grump penalty logic
  - Prepare for conversion to utility actor

**Status:** ✅ Complete (41/41 tests passing)

---

**🎉 PHASE 1 COMPLETE: All Pre-Reorganization Tests Created**

Total test coverage established:
- GridManager: 55 tests
- HybridPathResolver: 39 tests
- WaveSprite: 49 tests
- SeatManager: 50 tests
- Wave: 47 tests
- Actor Adapters: 110 tests (5 files)
- Seat: 41 tests

**Grand Total: 391 tests, all passing** ✅

**Phase 1 Validation:**
- ✅ All new tests pass
- ✅ Coverage increases from 73% to 90%+ for managers
- ✅ No breaking changes to existing tests

---

## Phase 2: Design & Prepare (Preparation Only)

**Goal:** Convert Seat to utility actor and prepare tooling

### Phase 2 Steps

#### Step 2.1: Convert Seat.ts to Utility Actor
- **File:** `src/sprites/Seat.ts`
- **Changes:**
  - Import Actor base class
  - Extend Actor instead of plain class
  - Add required `update()` and `draw()` methods
  - Maintain all existing functionality
  - Update SeatManager to provide unique IDs

**Status:** ⬜ Not Started

#### Step 2.2: Create SeatActor Adapter
- **File:** `src/actors/adapters/SeatActor.ts` (new)
- **Content:**
  - Extend UtilityActor
  - Wrap Seat instance
  - Delegate to Seat methods
  - Provide getSeat() accessor

**Status:** ⬜ Not Started

#### Step 2.3: Update Path Aliases
- **Files:**
  - `vite.config.ts`
  - `tsconfig.json`
- **Changes:**
  - Add aliases: `@core`, `@stadium`, `@actors`, `@wrappers`
  - Ensure type-check passes with new aliases

**Status:** ⬜ Not Started

**Phase 2 Validation:**
- ✅ Seat.test.ts passes with Actor-based Seat
- ✅ SeatActor.test.ts passes with new adapter
- ✅ Type-check passes with aliases defined
- ✅ No files moved yet (just code changes)

---

## Phase 3: Move Core Files

**Goal:** Move core game logic (reusable, stadium-agnostic)

### Phase 3 Steps

#### Step 3.1: Move Shared Utilities
- **Source → Destination:**
  - `src/services/LoggerService.ts` → `src/core/services/LoggerService.ts`
  - `src/managers/base/BaseManager.ts` → `src/core/managers/base/BaseManager.ts`
- **Sub-Steps:**
  1. Create destination directories
  2. Move files
  3. Update all imports across codebase
  4. Run type-check
  5. Run tests

**Status:** ⬜ Not Started

#### Step 3.2: Move Core Managers
- **Source → Destination:**
  - `src/managers/GameStateManager.ts` → `src/core/managers/GameStateManager.ts`
  - `src/managers/WaveManager.ts` → `src/core/managers/WaveManager.ts`
  - `src/managers/Wave.ts` → `src/core/managers/Wave.ts`
  - `src/managers/AnnouncerService.ts` → `src/core/services/AnnouncerService.ts`
  - `src/managers/GridManager.ts` → `src/core/grid/GridManager.ts`
  - `src/scenes/GridOverlay.ts` → `src/core/grid/GridOverlay.ts`
- **Sub-Steps:**
  1. Move files with `mv`
  2. Update all imports via script
  3. Run type-check
  4. Run tests

**Status:** ⬜ Not Started

#### Step 3.3: Move Wrappers
- **Source → Destination:**
  - `src/managers/wrappers/*` → `src/wrappers/`
- **Sub-Steps:**
  1. Move all wrapper files
  2. Update imports
  3. Update test paths
  4. Run type-check
  5. Run tests

**Status:** ⬜ Not Started

**Phase 3 Validation:**
- ✅ Type-check passes
- ✅ All tests pass (including moved tests)
- ✅ Dev server starts successfully
- ✅ Manual test: grid debug overlay still works

---

## Phase 4: Move Actor System & Sprites

**Goal:** Move all sprites under actors folder hierarchy

### Phase 4 Steps

#### Step 4.1: Move Seat to Utilities
- **Source → Destination:**
  - `src/sprites/Seat.ts` → `src/actors/utilities/Seat.ts`
- **Sub-Steps:**
  1. Create `src/actors/utilities/` directory
  2. Move Seat.ts
  3. Update all imports
  4. Update test paths
  5. Run type-check
  6. Run tests

**Status:** ⬜ Not Started

#### Step 4.2: Move Shared Sprites
- **Source → Destination:**
  - `src/sprites/BaseActor.ts` → `src/actors/sprites/shared/BaseActor.ts`
  - `src/sprites/ActorLogger.ts` → `src/actors/sprites/shared/ActorLogger.ts`
- **Sub-Steps:**
  1. Create `src/actors/sprites/shared/` directory
  2. Move files
  3. Update all imports
  4. Run type-check
  5. Run tests

**Status:** ⬜ Not Started

#### Step 4.3: Move Stadium Sprites
- **Source → Destination:**
  - `src/sprites/StadiumSection.ts` → `src/actors/sprites/stadium/StadiumSection.ts`
  - `src/sprites/SectionRow.ts` → `src/actors/sprites/stadium/SectionRow.ts`
  - `src/sprites/Fan.ts` → `src/actors/sprites/stadium/Fan.ts`
  - `src/sprites/Vendor.ts` → `src/actors/sprites/stadium/Vendor.ts`
  - `src/sprites/Mascot.ts` → `src/actors/sprites/stadium/Mascot.ts`
  - `src/sprites/WaveSprite.ts` → `src/actors/sprites/stadium/WaveSprite.ts`
- **Sub-Steps:**
  1. Create `src/actors/sprites/stadium/` directory
  2. Move all files
  3. Update all imports
  4. Run type-check
  5. Run tests

**Status:** ⬜ Not Started

#### Step 4.4: Add SeatActor Adapter
- **File:** `src/actors/adapters/SeatActor.ts` (move from prep)
- **Sub-Steps:**
  1. Ensure SeatActor is in adapters/
  2. Verify adapter test path is `src/__tests__/actors/adapters/SeatActor.test.ts`
  3. Run type-check
  4. Run tests

**Status:** ⬜ Not Started

**Phase 4 Validation:**
- ✅ Type-check passes
- ✅ All tests pass
- ✅ Dev server starts successfully
- ✅ Manual test: all sprite functionality works

---

## Phase 5: Move Stadium-Specific Code

**Goal:** Move stadium domain logic and scenes

### Phase 5 Steps

#### Step 5.1: Move Stadium Managers
- **Source → Destination:**
  - `src/managers/SeatManager.ts` → `src/stadium/managers/SeatManager.ts`
  - `src/managers/VendorManager.ts` → `src/stadium/managers/VendorManager.ts`
  - `src/managers/HybridPathResolver.ts` → `src/stadium/managers/HybridPathResolver.ts`
- **Sub-Steps:**
  1. Create `src/stadium/managers/` directory
  2. Move files
  3. Update all imports
  4. Update test paths
  5. Run type-check
  6. Run tests

**Status:** ⬜ Not Started

#### Step 5.2: Move Scenes
- **Source → Destination:**
  - All files from `src/scenes/` → `src/stadium/scenes/`
  - (Except GridOverlay, already moved to core/grid)
- **Sub-Steps:**
  1. Create `src/stadium/scenes/` directory
  2. Move all scene files
  3. Update all imports
  4. Update config.ts scene registration
  5. Run type-check
  6. Run tests

**Status:** ⬜ Not Started

**Phase 5 Validation:**
- ✅ Type-check passes
- ✅ All tests pass
- ✅ Dev server starts successfully
- ✅ Manual test: stadium scene loads correctly

---

## Phase 6: Finalize & Validate

**Goal:** Comprehensive validation and cleanup

### Phase 6 Steps

#### Step 6.1: Remove Empty Directories
- **Directories to Delete:**
  - `src/sprites/` (after all moved)
  - `src/managers/` (after all moved)
  - `src/managers/wrappers/` (after wrappers moved)
  - `src/scenes/` (after scenes moved)
- **Sub-Steps:**
  1. Verify directories are empty
  2. Delete directories
  3. Run type-check
  4. Run tests

**Status:** ⬜ Not Started

#### Step 6.2: Create .git-blame-ignore-revs
- **File:** `.git-blame-ignore-revs` (root of repo)
- **Content:**
  - Documentation of refactor commits
  - Helps with git blame tracking across reorganization
- **Sub-Steps:**
  1. Create file at repo root
  2. Document refactor commit hash
  3. Commit file

**Status:** ⬜ Not Started

#### Step 6.3: Update Documentation
- **Files:**
  - `.github/copilot-instructions.md`
  - `README.md`
  - `WORLD_GRID_PLAN.md`
  - Create new `ARCHITECTURE.md`
- **Changes:**
  - Update file paths in instructions
  - Document new structure
  - Explain core vs stadium separation
  - Explain utility actors concept

**Status:** ⬜ Not Started

#### Step 6.4: Full Validation Suite
- **Steps:**
  1. Run `npm test` → All tests pass
  2. Run `npm run type-check` → Zero errors
  3. Run `npm run build` → Build succeeds
  4. Run `npm run dev` → Dev server starts
  5. Manual testing:
     - Menu loads
     - Stadium scene initializes
     - Fans populate and stats decay
     - Wave system works
     - WaveSprite propagates correctly
     - Vendors pathfind correctly
     - Grid overlay toggles
     - All features functional

**Status:** ⬜ Not Started

**Phase 6 Validation:**
- ✅ No broken imports
- ✅ No type errors
- ✅ All tests pass
- ✅ Build succeeds
- ✅ Dev server runs
- ✅ Manual testing complete
- ✅ Empty directories removed

---

## Phase 7: Git Commit & Merge

**Goal:** Commit changes and prepare for merge to main

### Phase 7 Steps

#### Step 7.1: Create Commit Sequence
- **Commit 1:** Core game logic
  ```
  refactor: move core game logic to core/ folder

  - GameStateManager, WaveManager, Wave → core/managers/
  - GridManager, GridOverlay → core/grid/
  - AnnouncerService, LoggerService → core/services/
  - BaseManager → core/managers/base/
  ```

- **Commit 2:** Seat utility actor
  ```
  refactor: convert Seat to utility actor

  - Seat now extends Actor base class
  - Created SeatActor adapter for registry integration
  - Moved to actors/utilities/ (future: may become SceneryActor)
  ```

- **Commit 3:** Stadium-specific code
  ```
  refactor: move stadium-specific code to stadium/ folder

  - SeatManager, VendorManager, HybridPathResolver → stadium/managers/
  - All scenes → stadium/scenes/
  ```

- **Commit 4:** Sprites
  ```
  refactor: move all sprites under actors/sprites/

  - BaseActor, ActorLogger → actors/sprites/shared/
  - Stadium sprites → actors/sprites/stadium/
  - Sprites now properly nested under actor system
  ```

- **Commit 5:** Wrappers
  ```
  refactor: extract manager wrappers to wrappers/ folder

  - Separated wrappers from managers for clarity
  - All logging bridges now in dedicated folder
  ```

- **Commit 6:** Build config & cleanup
  ```
  chore: update build config for new file structure

  - Added path aliases for @core, @stadium, @actors, @wrappers
  - Removed empty directories from old structure
  - Created .git-blame-ignore-revs for refactor commits
  ```

- **Commit 7:** Documentation
  ```
  docs: update documentation for reorganized structure

  - Updated file path references
  - Created ARCHITECTURE.md
  - Updated copilot-instructions.md
  - Updated README.md
  ```

**Status:** ⬜ Not Started

#### Step 7.2: Push Feature Branch
- **Command:** `git push origin sb/big-structural-refactor`
- **Verification:**
  - All commits present on remote
  - CI/CD pipeline passes (if configured)

**Status:** ⬜ Not Started

#### Step 7.3: Merge to Main
- **Option A:** Create PR and merge (if using GitHub workflow)
- **Option B:** Direct merge locally
  ```bash
  git checkout main
  git merge sb/big-structural-refactor
  git push origin main
  ```
- **Verification:**
  - All changes in main
  - No conflicts
  - Remote is up to date

**Status:** ⬜ Not Started

**Phase 7 Validation:**
- ✅ Commits follow logical grouping
- ✅ All commits on feature branch
- ✅ Feature branch pushed to remote
- ✅ Merged to main successfully
- ✅ Main builds and tests pass

---

## Checkpoint Workflow Summary

For **EACH step**, follow this sequence:

1. **📋 Plan Review**
   - Read step details above
   - Understand dependencies and scope

2. **✅ Create Todo List**
   - Build todo list for sub-tasks
   - Mark status as `in-progress`

3. **🔨 Implement**
   - Execute one step at a time
   - Run as we go: `npm run type-check`, `npm test`
   - Commit changes

4. **📊 Check Status**
   - Report to user:
     - ✅ What completed successfully
     - ⚠️ Any issues or warnings
     - ❓ Whether manual validation needed

5. **⏸️ Check In with User**
   - Present status report
   - Ask for approval to proceed
   - Ask if clarification needed

6. **✓ User Confirms**
   - User reviews and approves
   - Provides any feedback
   - Confirms ready for next step

7. **📝 Update Plan Document**
   - Change status from ⬜ Not Started to ✅ Complete
   - Record any notes about the step
   - Update summary

8. **➡️ Move to Next Step**
   - Only proceed when user approves
   - Repeat cycle

---

## Progress Tracking

| Phase | Step | Status | Completed | Notes |
|-------|------|--------|-----------|-------|
| 1 | 1.1 - GridManager.test.ts | ✅ | 2025-11-16 | 55 tests, all passing |
| 1 | 1.2 - HybridPathResolver.test.ts | ✅ | 2025-11-16 | 39 tests, all passing |
| 1 | 1.3 - WaveSprite.test.ts | ✅ | 2025-11-16 | 49 tests, all passing |
| 1 | 1.4 - SeatManager.test.ts | ✅ | 2025-11-16 | 50 tests, all passing |
| 1 | 1.5 - Wave.test.ts | ✅ | 2025-11-16 | 47 tests, all passing |
| 1 | 1.6 - Actor adapters tests | ✅ | 2025-11-16 | 110 tests across 5 files, all passing |
| 1 | 1.7 - Seat.test.ts | ✅ | 2025-11-16 | 41 tests, all passing |
| **PHASE 1** | **COMPLETE** | ✅ | **2025-11-16** | **391 total tests, all passing** |
| 2 | 2.1 - Convert Seat to Actor | ⬜ | - | - |
| 2 | 2.2 - Create SeatActor adapter | ⬜ | - | - |
| 2 | 2.3 - Update path aliases | ⬜ | - | - |
| 3 | 3.1 - Move shared utilities | ⬜ | - | - |
| 3 | 3.2 - Move core managers | ⬜ | - | - |
| 3 | 3.3 - Move wrappers | ⬜ | - | - |
| 4 | 4.1 - Move Seat to utilities | ⬜ | - | - |
| 4 | 4.2 - Move shared sprites | ⬜ | - | - |
| 4 | 4.3 - Move stadium sprites | ⬜ | - | - |
| 4 | 4.4 - Add SeatActor adapter | ⬜ | - | - |
| 5 | 5.1 - Move stadium managers | ⬜ | - | - |
| 5 | 5.2 - Move scenes | ⬜ | - | - |
| 6 | 6.1 - Remove empty dirs | ⬜ | - | - |
| 6 | 6.2 - Create blame-ignore file | ⬜ | - | - |
| 6 | 6.3 - Update documentation | ⬜ | - | - |
| 6 | 6.4 - Full validation suite | ⬜ | - | - |
| 7 | 7.1 - Create commit sequence | ⬜ | - | - |
| 7 | 7.2 - Push feature branch | ⬜ | - | - |
| 7 | 7.3 - Merge to main | ⬜ | - | - |

---

## Notes

- **File moves use `mv`:** Git will auto-detect renames with >50% similarity
- **Imports updated via script:** Use `find` + `sed` for consistency
- **One step at a time:** Ensures no compound failures, easier debugging
- **Manual validation between steps:** Prevents cascading issues
- **Feature branch strategy:** All work on `sb/big-structural-refactor`, merge when complete

---

## Implementation Commands Reference

### Git Status & History
```bash
git status
git log --oneline -10
git diff --stat
```

### Testing
```bash
npm test                  # Run all tests
npm test -- specific.test.ts  # Run specific test
npm run test:ui         # Interactive test UI
```

### Type Checking
```bash
npm run type-check      # Run TypeScript compiler
```

### Building
```bash
npm run build           # Production build
npm run dev             # Dev server
```

### File Operations
```bash
# Create directories
mkdir -p src/core/managers/base
mkdir -p src/core/services
mkdir -p src/core/grid
mkdir -p src/stadium/managers
mkdir -p src/stadium/scenes
mkdir -p src/actors/utilities
mkdir -p src/actors/sprites/shared
mkdir -p src/actors/sprites/stadium
mkdir -p src/wrappers

# Move files
mv src/file.ts src/destination/

# List files
ls -la src/core/managers/
find src -name "*.ts" -path "*/core/*" | head -20

# Remove empty directories
rmdir src/sprites 2>/dev/null || true
```

### Import Update Script
```bash
# Update imports in all TypeScript files
find src -name "*.ts" -exec sed -i \
  -e 's|@/managers/GameStateManager|@core/managers/GameStateManager|g' \
  -e 's|@/managers/GridManager|@core/grid/GridManager|g' {} \;
```

---

## Questions or Issues?

If at any point during implementation:
- Type-check fails
- Tests fail
- Unclear on step requirements
- Need clarification on dependencies

**Stop and check in with user** rather than pushing forward.

