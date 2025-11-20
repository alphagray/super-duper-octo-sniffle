# SectionRow Actor Design

## Overview
SectionRow transitions from a passive rendering helper into a first-class actor that composes seats, registers grid occupancy, and exposes traversal metadata for vendors. The redesigned object resides under `src/actors/adapters/SectionRowActor.ts` (implementation detail) but retains a thin sprite helper for visual gradients.

### Goals
- Drive all layout from `LevelService` grid rectangles; no magic numbers.
- Allow vendors/pathfinding to treat rows as cells with traversal cost values.
- Keep rendering concerns isolated so SectionActor orchestration stays lean.
- Maintain compatibility with current `StadiumSection` visuals while enabling later pixel-art swaps.

## Responsibilities
1. **Grid-aware Seat Composition**
   - Build `SeatActor` instances per grid coordinate (row/col offsets relative to section).
   - Register each seat with `GridManager` (already handled in SectionActor) but store references for fast column lookups.
2. **Row Metadata**
   - Track world Y positions (floor, midline) so wave sprites can align animations.
   - Surface occupancy stats (count, rate) and traversal penalties.
3. **Rendering Wrapper**
   - Own a lightweight `SectionRowSprite` (Phaser container) that draws gradients + divider decals.
   - Seat sprites/fans get added to this container, enabling hide/show per row.
4. **Pathing Interface**
   - Provide `getTraversalCost(vendorAbilities)` returning base row penalty + seat penalties (delegates to seats but caches totals until invalidated).
   - Flag whether the row is temporarily blocked (e.g., mascot event).
5. **Event Hooks**
   - Emit events upwards (`rowOccupancyChanged`, `rowTraversalUpdated`) when seat/fan assignments change, enabling `VendorManager` & analytics.

## Construction Flow
```
SectionActor.populateFromData()
  -> new SectionRowActor({
         id: `${sectionId}-row-${row}`,
         sectionId,
         gridTop,
         gridLeft,
         rowIndex,
         seatCount,
         gridManager,
         scene,
         spriteConfig: { widthPx, heightPx, lightnessStops }
     })
  -> row.buildSeats(seatAssignments[row])
  -> row.attachToSectionContainer(stadiumSection)
```

### Required Inputs
- `gridBounds`: `{ top: number; left: number; right: number; bottom: number; }`
- `rowIndex`: zero-based, measured from top -> bottom within section.
- `seatCount`: derived from `(gridRight - gridLeft + 1)`.
- `rowHeightPx`: calculated by `StadiumSection` using section height ÷ rowCount.
- `lightnessStops`: `[targetLightness, nextRowLightness]` used for gradient.

## Public API Sketch
```ts
interface SectionRowActorOptions {
  id: string;
  sectionId: string;
  rowIndex: number;
  gridTop: number;
  gridLeft: number;
  seatCount: number;
  rowHeightPx: number;
  rowWidthPx: number;
  lightnessStops: { current: number; next: number };
  container: Phaser.GameObjects.Container; // parent section visual container
  scene: Phaser.Scene;
  gridManager: GridManager;
}

class SectionRowActor extends Actor {
  constructor(opts: SectionRowActorOptions);
  getRowIndex(): number;
  getSeats(): SeatActor[];
  getSeatAt(columnIdx: number): SeatActor | undefined;
  getOccupancyRate(): number;
  getFloorY(): number; // world coordinate
  assignFan(seatColumn: number, fan: Fan): void;
  releaseFan(seatColumn: number): Fan | null;
  getTraversalCost(vendorAbilities: VendorAbilities): number;
  setBlocked(blocked: boolean, reason?: string): void;
  isBlocked(): boolean;
  update(delta: number): void; // propagate to seats/fans if needed
}
```

## Rendering Strategy
- `SectionRowActor` instantiates `SectionRowSprite` which handles:
  - Background rectangle (HSL-driven color, using `gameBalance.sectionRows.lightnessVariance`).
  - Divider mini-rectangles (~15% of row height) for depth.
  - Optional debug overlay (grid row/column labels, toggled via debug key).
- Seats are positioned based on grid-to-world conversions, not manual pixel math; ensures alignment with `GridManager`.
- Sprite anchors remain centered inside `StadiumSection` container so existing layout code works.

## Pathing & Vendor Integration
- Each row caches `rowBasePenalty` (from `gameBalance.vendorMovement`) plus per-seat penalties.
- When a seat’s fan becomes “difficult terrain”, seat emits `seatPenaltyChanged`; row invalidates cache.
- `VendorManager` queries row actors via `ActorRegistry.getByCategory('section-row')` to feed `HybridPathResolver`.
- Row actor exposes `getPathNode()` returning `{ gridRowRange, gridColRange, traversalCost }` so pathing treats entire row as a single node.

## Event Flow
- `SectionRowActor` extends `Actor`, so it inherits `on/emit`.
- Emits:
  - `rowOccupancyChanged` `{ sectionId, rowIndex, occupiedCount, seatCount }`
  - `traversalCostChanged` `{ sectionId, rowIndex, cost }`
  - `waveAnimationStarted` when `playWave` triggered for logging.

## Data Dependencies
- Pull `rowBasePenalty`, `emptySeatPenalty`, `occupiedSeatPenalty`, `maxTerrainPenalty` from `gameBalance.vendorMovement`.
- Use `gameBalance.waveTiming.rowDelay` for animation staggering metadata (even if actual animation handled by fans).
- Lightness/dimensions reference a new `gameBalance.sectionRows` block (to add):
```ts
sectionRows: {
  baseHeightPx: 48, // fallback if gridManager unavailable
  dividerHeightRatio: 0.15,
  gradientMax: 90,
  gradientMin: 30,
}
```

## Transition Plan
1. Implement `SectionRowActor` & `SectionRowSprite` side-by-side with legacy `SectionRow`.
2. Update `StadiumSection` to instantiate the actor version (behind a feature flag for easy rollback). Keep old API signatures until roll-out complete.
3. Adjust tests (`SeatManager`, `HybridPathResolver`) to use the actor stub.
4. Delete legacy `SectionRow.ts` once all references move over.

## Open Questions
- Should rows register themselves with `GridManager` as contiguous obstacles? Proposed: add `gridManager.addWallSegment` for row boundaries to discourage diagonal vendor paths.
- Fan sprites currently live directly under `StadiumSection`; after refactor they should be children of the row container to simplify hide/show.
- Need to confirm whether rows can have heterogeneous seat counts (future levels). Actor design already supports it by reading `seatAssignments[row].length`.

## Acceptance Criteria
- All row/seating geometry derived from `LevelService` grid data.
- `VendorManager` can request traversal costs per row via registry lookup.
- Debug mode can toggle row outlines/labels to validate alignment.
- Unit tests cover `getTraversalCost` cache invalidation and occupancy events.
