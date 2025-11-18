# Plan: Fix Grid-Based Pathfinding & Alignment

## Analysis of Current Issues

1. **Sections/fans positioned in middle of cells** - Visual alignment issue
2. **Ground nodes not at ground level** - Navigation graph using wrong Y coordinates
3. **No stair entry points visible** - Stairs not properly connected to navigation graph
4. **Pathfinding in world space instead of grid space** - Fundamental architectural issue

## Plan: Fix Grid-Based Pathfinding & Alignment

This plan converts pathfinding from world-space to grid-space coordinates and fixes visual alignment.

### Steps

1. **✅ COMPLETED - Align sections and seats to grid cell corners** in `SectionActor.ts` and `Seat.ts`
   - ✅ Modified `Seat.getWorldPosition()` to add `cellSize / 2` offset to center seats within grid cells
   - Seats now properly centered in their grid cells instead of at grid coordinate positions
   - **Implementation**: Added offset calculation in `getWorldPosition()` method

2. **✅ COMPLETED - Convert HybridPathResolver to grid-space pathfinding** in `HybridPathResolver.ts`
   - ✅ Updated NavigationNode interfaces to include `gridRow, gridCol` + cached world `x, y`
   - ✅ Added helper methods: `gridToWorldCentered()` and `worldToGrid()`
   - ✅ Update corridor node creation (Phase 1) - calculate from seat row positions (top = row-1, front = row+1)
   - ✅ Update ground node creation (Phase 1.5) - use grid row from groundLine config (row 18 for 24-row grid)
   - ✅ Update stair node creation (Phase 2) - use grid bounds from StairsActor (center of stair area)
   - ✅ Update row entry node creation (Phase 3) - use seat grid positions from getGridPosition()
   - ✅ planPath() uses findNearestNode() which already works with cached world coordinates
   - ✅ nodeToSegment() already uses cached world coordinates (node.x, node.y) for PathSegments
   - **Implementation**: All navigation nodes now created from grid coordinates with cached world positions

3. **✅ COMPLETED - Fix ground node positioning** in `HybridPathResolver.ts`
   - ✅ Calculate ground grid row from `gameBalance.grid.groundLine.rowsFromBottom`
   - ✅ Created ground nodes at specific grid row (row 18 for 24-row grid with 6 rows from bottom)
   - ✅ Spaced ground nodes every 5 columns horizontally (from col 2 to gridCols-2)
   - ✅ Ground node creation: `gridRow = totalRows - groundRowsFromBottom, gridCol = col * spacing`
   - **Implementation**: Ground nodes now positioned at correct grid row with horizontal spacing

4. **✅ COMPLETED - Add stair entry/exit nodes at grid positions** in `HybridPathResolver.ts`
   - ✅ Query `ActorRegistry` for StairsActors, get their `gridBounds`
   - ✅ Create stair nodes at center of stairway (gridRow = top + height/2, gridCol = left + width/2)
   - ✅ Connect stairs to adjacent sections' corridor nodes using existing connection logic
   - ✅ Ensure bidirectional edges between stairs and corridors with stairTransitionCost
   - **Implementation**: Stairs now use grid bounds for positioning and proper corridor connections

5. **✅ COMPLETED - Update PathSegment conversion to world coordinates** in `HybridPathResolver.ts`
   - ✅ PathSegment interface keeps world `x, y` for vendor movement
   - ✅ `nodeToSegment()` helper already uses `node.x, node.y` (cached world coordinates)
   - ✅ World coordinates cached during node creation via `gridToWorldCentered()` helper
   - ✅ Vendors move to cell centers, not corners (helper applies cellSize/2 offset)
   - **Implementation**: PathSegments use cached world coordinates from navigation nodes

6. **✅ COMPLETED - GridOverlay visualization working correctly** in `GridOverlay.ts`
   - ✅ `renderNavigationNodes()` already uses `node.x, node.y` (cached world positions)
   - ✅ Edge rendering converts both endpoints using cached coordinates
   - ✅ No changes needed - visualization automatically uses correct cached world coordinates
   - **Implementation**: Grid overlay correctly renders nodes at their cached world positions

### Further Considerations

1. **Grid coordinate validation** - Should we add bounds checking when converting vendor positions to grid coordinates? Recommend yes, clamp to valid grid range.

2. **Corridor positioning** - Where exactly should corridor nodes be in grid space? Top corridor = section top row - 1, front corridor = section bottom row + 1? Or use section bounds directly?

3. **Row entry nodes** - Should these be at the left/right edges of each row's grid bounds, or offset by 1 cell into the aisle? Recommend edge of section bounds for simplicity.

4. **Performance impact** - Grid-to-world conversions on every pathfinding call might add overhead. Should we cache world positions? Recommend profiling first, optimize if needed.

5. **Backwards compatibility** - This changes NavigationNode structure. Any existing code expecting `x, y` properties? Need to audit VendorTypes.ts and ensure all consumers updated.
