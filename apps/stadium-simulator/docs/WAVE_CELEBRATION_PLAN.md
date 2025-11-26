# Stadium Simulator: Wave Celebration Overlay System

## Purpose
Implement a flexible, non-diegetic overlay system for animated "celebration" callouts above sections during wave events, showing participation %, color-coded result, and stat-based reasons. Uses Z-depth layering for proper visual stacking.

---

## Implementation Progress

**Checklist:**
- ✅ Implement `GridManager.getDepthForWorld(x,y)` that interpolates within a cell to vary depth inside row band (above center = further back).
- ✅ Switch actors (Fan/Vendor/Mascot) to use `getDepthForWorld` when updating sprite positions; fall back to `getDepthForPosition` if needed.
- ✅ Document intra-cell interpolation and mark with ✅.

---

✅ BaseOverlay: implemented in `src/ui/overlays/BaseOverlay.ts` (lifecycle, depth, default drift+fade)
✅ OverlayManager: implemented in `src/managers/OverlayManager.ts` (per-section queues, `createWaveCelebration(...)`, default depth 75)
✅ Plan updated: Animated actors depth range set to 101–200; polygon masking removed in favor of Z-depth layering

✅ OverlayManager wired into `StadiumScene`: initialized, updated every frame, and overlays triggered on `sectionComplete` (reasons placeholder)
   - ✅ Position resolver set: `StadiumScene` provides section top world coords to `OverlayManager`

### Depth Integration

- ✅ Depth constants added to `gameBalance.ui.depths` (sky, ground, UI overlay, scenery, animated actor base/min/max, row penalty)
- ✅ `GridManager.getDepthForPosition(row,col)` returns clamped 101–200 depth with per-row −10 above ground

## Z-Depth Layering System

### Depth Layers (from back to front):
```
Sky:                    0
Ground:                 1
UI Overlays:           50-99 (between ground and scenery)
Sections/Stairs:       100
Animated Actors:       101–200 (grid row adjusted)
```

### Grid Row Depth Calculation:
- **Base animated actor depth**: 150 (clamped to 101–200)
- **Per-row adjustment**: -10 for each grid row above ground plane
- **Formula**: `depth = clamp(101, 150 - (gridRow * 10), 200)`
- **Result**: Higher rows appear "further back" from camera

#### Intra-Cell Interpolation (Depth Within Band)
- ✅ Actors adjust depth within each 10-point row band based on world Y inside the tile.
- Above the cell center (toward sky) → slightly lower depth (further back).
- Below the cell center (toward ground) → slightly higher depth (closer).
- Implemented via `GridManager.getDepthForWorld(x,y)`: computes base band depth then applies an intra-band adjustment.

Examples:
- Actor on ground plane (row 0): depth = 150
- Actor 1 row above ground: depth = 140
- Actor 2 rows above ground: depth = 130
- Actor 5 rows above ground: depth = 100 → clamped to 101

### GridManager Integration:
- GridManager tracks depth layers per tile row
- Actors query `GridManager.getDepthForPosition(gridX, gridY)` to set sprite depth
- Sections/stairs always render at depth 100
- UI overlays render at depth 50-99 (always in front of ground, behind sections)

---

## Phase 1: Overlay System Foundation

1. **OverlayManager**
   - Create `src/managers/OverlayManager.ts`
   - Manages all non-diegetic overlays (celebrations, dialogue, particles)
   - Per-section overlay queues (max 2, older overlays fade out faster)
   - API: `createWaveCelebration(sectionId, participation, state, reasons)`
   - Sets overlay depth to 75 (mid-range of UI overlay layer)
   - STATUS: Implemented (basic text overlay with queueing + auto-fade)

2. **BaseOverlay**
   - Create `src/ui/overlays/BaseOverlay.ts`
   - Abstract class: lifecycle (`create/start/finish/destroy`), depth, tween helpers
   - No polygon masking needed - depth sorting handles visibility
   - STATUS: Implemented (container-based overlay with default drift+fade)

---

## Phase 2: Wave Celebration Overlay

1. **WaveCelebrationOverlay**
    - ✅ Create `src/ui/overlays/WaveCelebrationOverlay.ts` extending `BaseOverlay`
    - Renders:
     - Main: "85%!" (color: green/yellow/red by state)
     - Subline: stat reason(s) (e.g., "- low attention", "+ high happiness")
   - Font: default with stroke/shadow, size 28–32px (configurable)
   - Animation: starts 15px above section top, drifts up 40px over 1.5s, fades out
   - Depth: Set to 75 (UI overlay layer - in front of ground, behind sections)

2. **Config**
   - Add to `src/config/gameBalance.ts`:
       - `ui.waveCelebration`: colors, font, anim timings, queueMax, fadeFast
       - ✅ `ui.depths`: Depth constants (sky=0, ground=1, uiOverlay=75, scenery=100, animatedActorBase=150, animatedActorMin=101, animatedActorMax=200)

---

## Phase 3: GridManager Depth Integration

1. **GridManager Enhancements**
   - Add `getDepthForPosition(gridX: number, gridY: number): number`
   - Returns `clamp(101, 150 - (gridY * 10), 200)` for animated actor positions
   - Add `getSceneryDepth(): number` returns 100
   - Add `getUIOverlayDepth(): number` returns 75
    - NOTE: Overlays currently positioned via section sprite top; will switch to `SectionActor` bounds + `GridManager.gridToWorld` when available.

2. **Actor Depth Updates**
   - FanActor, VendorActor, MascotActor call `GridManager.getDepthForPosition()` on position changes
   - Update sprite depth: `this.sprite.setDepth(depth)`
   - Ensures higher grid rows render "further back"

3. **Section/Stair Actors**
   - SectionActor, StairActor set depth to 100 on creation
   - Ground plane actors set depth to 1
   - Sky actors set depth to 0

---

## Phase 4: Data Flow & Event Integration

1. **Participation Reasons (Option A)**
   - In `SectionActor.calculateColumnParticipation`, return `{willParticipate, intensity, reasons: string[]}` per fan
   - In `WaveManager`, aggregate reasons per section as columns are processed
   - On `sectionComplete`, emit `{ sectionId, state, avgParticipation, reasons: string[] }`

2. **Scene Integration**
   - In `StadiumScene`, instantiate `OverlayManager` after `WaveManager`
   - On `sectionComplete`, fetch section world top via `SectionActor.getSectionData()` + `GridManager.gridToWorld`
   - Call `overlayManager.createWaveCelebration(...)` with all required data
   - Add `overlayManager.update(delta)` to scene update loop

---

## Phase 4: Visual Polish & Extensibility

1. **Extensibility**
   - Document how to subclass `BaseOverlay` for dialogue bubbles, particles, etc.
   - Add example: `DialogueBubbleOverlay` (stub)

---

## Phase 5: Testing & Iteration

1. **Test celebration overlays for all wave outcomes**
2. **Test queueing and fade-out logic**
3. **Confirm depth sorting for all section shapes**
4. **Iterate on font/visuals as needed**

---

### Notes

- **WebFonts**: Phaser supports WebFont Loader, CSS `@font-face`, and bitmap fonts. For now, use default font with heavy stroke/shadow for cartoon effect. Switch to bitmap font if pixel-perfect needed.
- **Depths**: UI overlays render between ground and scenery using depth constants; no masking.
- **Performance**: OverlayManager should pool/recycle overlays for efficiency.
