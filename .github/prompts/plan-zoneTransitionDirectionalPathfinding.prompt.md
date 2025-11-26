Plan: Zone + Transition Tagged Directional Pathfinding

Goal
Introduce per-cell zone and transition metadata plus directional entry/exit flags to unify open-ground and constrained movement, ensure legal seat/corridor/stair traversal, eliminate post-path rejection loops, and support external JSON-driven stadium layouts.

Zone Types
- ground: Open movement, optional diagonals
- corridor: Above/around seating footprint (Manhattan only)
- seat: Row interior + seat footprint (Manhattan only, higher cost)
- rowEntry: Boundary cell permitting corridor/ground <-> seat transitions
- stair: Vertical traversal cells (special cost)
- sky: Non-navigable filler outside stadium footprint

Transition Types (optional tag on a cell)
- rowBoundary: Legal ingress/egress between seat and non-seat zones
- stairLanding: Stair <-> corridor linkage cell
- corridorEntry: Ground <-> corridor linkage cell (optional if adjacency alone suffices)

Directional Metadata
- allowedIncoming: Record<top|right|bottom|left, boolean>
- allowedOutgoing: Record<top|right|bottom|left, boolean>
Default true unless constrained (e.g., seat interiors block lateral incoming except from rowEntry).
Walls remain hard blockers independent of directional flags.

JSON Configuration (Option A: Flat List)
StadiumSceneConfig schema (single file for all scene content):
{
  gridConfig: { rows, cols, cellSize },
  cellRanges: CellRangeDescriptor[],
  cells: CellDescriptor[],
  sections: SectionDescriptor[],
  stairs: StairDescriptor[],
  fans: FanDescriptor[]
}

CellDescriptor (single cell):
{ row, col, zoneType, transitionType?, allowedIncoming?, allowedOutgoing?, passable? }

CellRangeDescriptor (contiguous rectangular zones):
{ rowStart, rowEnd, colStart, colEnd, zoneType, transitionType?, allowedIncoming?, allowedOutgoing?, passable? }
Applies zoneType and properties to all cells in the inclusive range [rowStart..rowEnd] × [colStart..colEnd].

Unspecified directional flags default to true; passable default derives from zoneType (sky false, others true unless overridden).
Loader processes ranges first, then individual cells (individual cells override range defaults).

SectionDescriptor:
{ id: string, label: string, gridBounds: {top, left, width, height}, rows: number, seatsPerRow: number }

StairDescriptor:
{ id: string, gridBounds: {top, left, width, height}, connectsSections: [sectionIdA, sectionIdB] }

FanDescriptor:
{ sectionId: string, rowIdx: number, seatIdx: number, fanType?: 'normal'|'grumpy'|'super', initialStats?: {happiness, thirst, attention} }
Omitted FanDescriptor means seat is empty.

GridManager Changes
1. Extend internal GridCell with zoneType, transitionType?, allowedIncoming, allowedOutgoing.
2. Add loadZoneConfig(data: StadiumSceneConfig): validates bounds, applies metadata, builds caches.
   - Process cellRanges first (fill rectangular regions)
   - Process cells second (override specific cells)
   - Validate sections/stairs gridBounds match cell zones
3. Build boundary caches: rowEntryCells, stairLandingCells, corridorEntryCells.
4. Expose helpers: getZoneType(row,col), isTransition(row,col,type), getBoundarySet(type), isPassableDirection(fromRow,fromCol,toRow,toCol).
5. isPassableDirection logic:
   - Bounds & passable checks
   - Determine direction (from -> to)
   - walls[from][dir] == false && walls[to][opp] == false
   - allowedOutgoing[from][dir] && allowedIncoming[to][dir]
   - Zone / transition rules:
     * seat -> corridor/ground only via rowBoundary (from or intermediate rowEntry)
     * corridor/ground -> seat only if neighbor zone is rowEntry or transitionType=rowBoundary
     * stair access only via stairLanding cell
     * Diagonal allowed only when both zones ground

GridPathfinder Changes
1. Add directionalCache Map<"r1,c1->r2,c2", boolean>.
2. Subscribe to gridChanged and zonesLoaded: clear passableCache + directionalCache.
3. Refactor neighbor generation in astar():
   - Candidate directions: 4-way; if current zoneType ground and vendor allows diagonal, include 4 diagonals.
   - For each candidate, call gridManager.isPassableDirection. Skip rejected immediately.
4. Movement cost incorporates zone modifiers (gameBalance.vendorMovement.zoneCosts).
5. Heuristic: Manhattan for constrained zones; optionally Manhattan for ground for visual consistency. Add small transitionCrossPenalty per boundary crossing.
6. After path reconstruction: dev assertion that each step is axis-aligned unless both cells zoneType ground and diagonal permitted.

HybridPathResolver Alignment
1. Remove internal diagonal ground edges and skip links.
2. For node-to-node expansions use GridPathfinder.findPath between node grid coordinates.
3. If expansion fails due to blocked transition, select alternative boundary cell using boundary caches (choose minimal estimated total cost: entryCost + seatApproachCost).
4. Log fallback cases; if all fail, return empty path (AI may retry different target).

AIManager Integration
1. Initialize GridPathfinder after loading zones; ensure subscription active.
2. When choosing seat targets, optionally pre-filter seats whose nearest rowEntry boundary is not passable directionally.
3. On dynamic occupant changes rely on gridChanged events for cache invalidation.
4. Maintain axis-aligned interpolation; pathfinder already provides orthogonal steps.

GridOverlay Enhancements
1. Toggles: showZones, showTransitions, showDirectionalEdges.
2. Zone coloring: ground(green), corridor(blue), seat(gray), rowEntry(yellow), stair(orange), sky(transparent).
3. Transition glyphs: distinct marker per transitionType.
4. Directional edges: draw arrows on edges with allowedOutgoing; muted if incoming blocked.
5. Illegal step diagnostics: render red X and console warn if any path segment violates isPassableDirection (should never trigger).

Configuration (gameBalance additions)
- zoneCosts: { ground:0.7, corridor:0.8, seat:2.0, rowEntry:1.2, stair:stairTransitionCost }
- transitionCrossPenalty: small additive (e.g., 0.5 cell) to reduce oscillation
- groundDiagonalPenalty: multiplier (e.g., 1.15) keeping two orth moves cheaper
- maxIterations remains (2500) for safety

Testing Plan
Unit tests (__tests__/grid/):
1. zonesLoader.test: loads sample JSON; asserts zoneType and transition caches.
2. directionalPassability.test: verifies seat <-> corridor requires rowBoundary.
3. pathfindingManhattan.test: ensures no diagonals in non-ground zones.
4. boundarySelection.test: multiple rowEntry boundaries; choose minimal cost path.
5. cacheInvalidation.test: after wall change, directionalCache updates.
Integration test: vendor path to seat with single legal rowEntry (other blocked) uses that boundary; no illegal edges.

Migration Phases
✅ Phase 1: Schema + loader (COMPLETE - Nov 20 2025)
  - GridCell interface extended with zone/transition/directional fields
  - ZoneConfig.ts type definitions created
  - loadZoneConfig() implemented with range + cell processing
  - Boundary caches built (rowEntry/stairLanding/corridorEntry)
  - Helper methods added (getZoneType, isTransition, getBoundarySet, isPassableDirection)
  
✅ Phase 2: Directional passability + A* integration (COMPLETE - Nov 20 2025)
  - directionalCache added to GridPathfinder
  - Event subscriptions for gridChanged + zonesLoaded
  - A* neighbor expansion uses isPassableDirection
  - Movement costs updated with zone multipliers from gameBalance
  - Dev-mode path validation assertions added
  - gameBalance.pathfinding zone costs configuration added

✅ Phase 3: HybridPathResolver integration (COMPLETE - Nov 20 2025)
  - GridPathfinder instance added to HybridPathResolver
  - expandToGridPath delegates to GridPathfinder.findPath
  - Diagonal ground edges removed from graph building
  - Boundary fallback logic implemented (rowEntry → stairLanding fallback)
  - Logs boundary usage and warns on complete path failure

✅ Phase 4: Overlay visualization + debug features (COMPLETE - Nov 20 2025)
  - Zone visualization: Background tints for all 6 zone types (toggle: Z key)
  - Transition markers: Glyphs for rowBoundary/stairLanding/corridorEntry (toggle: T key)
  - Directional edges: Arrows showing allowed incoming/outgoing per direction (toggle: E key)
  - Illegal step detection: Red X markers on path segments violating isPassableDirection
  - Keyboard controls added to StadiumScene (G/N/V/Z/T/E keys)
  - Path rendering color-coded: green=legal, red=illegal with console warnings

✅ Phase 5: Test suite (COMPLETE - Nov 20 2025)
  - Unit tests created for GridManager zone loader (cellRanges, cells, boundaries)
  - Unit tests for directional passability (seat↔corridor, rowBoundary transitions, directional flags)
  - Unit tests for GridPathfinder Manhattan pathfinding (axis-aligned verification)
  - Unit tests for cache invalidation (gridChanged/zonesLoaded event handling)
  - All tests passing with no TypeScript errors

Phase 6: Integration testing + final validation.

Performance / Risk Mitigation
- Directional & passable caches cleared only on structural changes.
- Unified zone-aware neighbor expansion prevents wasted retries.
- Hierarchical fallback minimized; alternate boundary chosen only on failure.
- Assertions catch divergence early in development builds.

Future Extensions
- Crowd density affects terrainPenalty dynamically.
- Multi-source precompute distances from all rowEntry cells for faster seat heuristics.
- Dynamic transition toggling (temporary closures) via transitionType state.

Acceptance Criteria
- Paths never violate directional or zone transition rules.
- Vendors never move diagonally outside ground zone.
- Seat entry always via rowEntry boundary cells.
- Cache invalidation works on gridChanged/zonesLoaded.
- Debug overlay clearly visualizes zones, transitions, and allowed directional edges.
- Single JSON file loads entire scene: grid zones, section layouts, stairs, and fan occupancy.

Mock JSON (Current 3-Section 8x4 Layout)
See example file below matching current programmatic scene:
- Grid: 24 rows × 32 cols, cellSize 32px
- 3 sections (A, B, C) each 8 rows × 4 seats
- All seats occupied with normal fans
- Stairs connecting A↔B and B↔C
- Ground plane (rows 18-23), sky plane (rows 0-5), corridors around sections

```json
{
  "gridConfig": {
    "rows": 24,
    "cols": 32,
    "cellSize": 32
  },
  "cellRanges": [
    {"rowStart": 0, "rowEnd": 5, "colStart": 0, "colEnd": 31, "zoneType": "sky", "passable": false},
    {"rowStart": 18, "rowEnd": 23, "colStart": 0, "colEnd": 31, "zoneType": "ground"},
    {"rowStart": 6, "rowEnd": 6, "colStart": 7, "colEnd": 24, "zoneType": "corridor"},
    {"rowStart": 15, "rowEnd": 15, "colStart": 7, "colEnd": 24, "zoneType": "corridor"},
    {"rowStart": 9, "rowEnd": 12, "colStart": 12, "colEnd": 13, "zoneType": "stair", "transitionType": "stairLanding"},
    {"rowStart": 9, "rowEnd": 12, "colStart": 18, "colEnd": 19, "zoneType": "stair", "transitionType": "stairLanding"}
  ],
  "cells": [
    {"row": 7, "col": 8, "zoneType": "rowEntry", "transitionType": "rowBoundary"},
    {"row": 7, "col": 11, "zoneType": "rowEntry", "transitionType": "rowBoundary"},
    {"row": 14, "col": 8, "zoneType": "rowEntry", "transitionType": "rowBoundary"},
    {"row": 14, "col": 11, "zoneType": "rowEntry", "transitionType": "rowBoundary"},
    {"row": 8, "col": 8, "zoneType": "seat", "allowedIncoming": {"top": true, "right": false, "bottom": false, "left": false}},
    {"row": 8, "col": 9, "zoneType": "seat", "allowedIncoming": {"top": true, "right": false, "bottom": false, "left": false}},
    {"row": 8, "col": 10, "zoneType": "seat", "allowedIncoming": {"top": true, "right": false, "bottom": false, "left": false}},
    {"row": 8, "col": 11, "zoneType": "seat", "allowedIncoming": {"top": true, "right": false, "bottom": false, "left": false}},
    {"comment": "... (define rowEntry boundaries and seat directional restrictions for sections B, C)"},
    {"comment": "Section A seats: rows 8-14, cols 8-11"},
    {"comment": "Section B seats: rows 8-14, cols 14-17"},
    {"comment": "Section C seats: rows 8-14, cols 20-23"}
  ],
  "sections": [
    {
      "id": "section-A",
      "label": "A",
      "gridBounds": {"top": 7, "left": 8, "width": 4, "height": 8},
      "rows": 8,
      "seatsPerRow": 4
    },
    {
      "id": "section-B",
      "label": "B",
      "gridBounds": {"top": 7, "left": 14, "width": 4, "height": 8},
      "rows": 8,
      "seatsPerRow": 4
    },
    {
      "id": "section-C",
      "label": "C",
      "gridBounds": {"top": 7, "left": 20, "width": 4, "height": 8},
      "rows": 8,
      "seatsPerRow": 4
    }
  ],
  "stairs": [
    {
      "id": "stairs-AB",
      "gridBounds": {"top": 9, "left": 12, "width": 2, "height": 4},
      "connectsSections": ["section-A", "section-B"]
    },
    {
      "id": "stairs-BC",
      "gridBounds": {"top": 9, "left": 18, "width": 2, "height": 4},
      "connectsSections": ["section-B", "section-C"]
    }
  ],
  "fans": [
    {"sectionId": "section-A", "rowIdx": 0, "seatIdx": 0, "fanType": "normal"},
    {"sectionId": "section-A", "rowIdx": 0, "seatIdx": 1, "fanType": "normal"},
    {"sectionId": "section-A", "rowIdx": 0, "seatIdx": 2, "fanType": "grumpy"},
    {"sectionId": "section-A", "rowIdx": 0, "seatIdx": 3, "fanType": "normal"},
    {"comment": "... (continue for all 96 seats: 3 sections × 8 rows × 4 seats)"}
  ]
}
```

Note: Full JSON would include all cell definitions (corridors, rowEntry boundaries, seat interiors with directional restrictions, ground cells, sky cells). The example above shows structure with efficient range-based definitions for contiguous zones (sky, ground, corridors, stairs) and individual cell overrides for boundaries and seats. Production file generator or visual editor would output complete data.
