Plan: Directional Passability + Axis-Aligned Movement

Goal
- Add per-cell directional entry/exit metadata and enforce it in the custom A* pathfinder.
- Ensure vendors move axis-aligned so movement never visually interpolates diagonally between cell centers.

Why
- Some cells must block entry from certain directions (e.g., seats only enterable from row edges).
- Current A* explores neighbors without directional constraints and path visual interpolation causes diagonals.
- Preserving custom GridManager keeps your actor model and dynamic occupancy logic intact.

High-level Steps
1. Add directional metadata
   - Update `GridManager`'s cell structure to include `allowedIncoming` and `allowedOutgoing` objects with keys `up|down|left|right` and boolean values.
   - Initialize defaults when creating the grid: corridors/ground have `true` for all, seat interiors have `incoming.up/down=false` etc.
   - Provide helper setters/getters for cell directional metadata.

2. Implement directional passability in A*
   - Add `isPassableDirection(fromRow, fromCol, toRow, toCol)` to `GridPathfinder.ts`.
   - Check bounds and both `fromCell.allowedOutgoing[dir]` and `toCell.allowedIncoming[dir]` and `toCell.passable`.
   - Replace `isPassable(...)` calls in `astar()` neighbor expansion with `isPassableDirection(...)`.

3. Orthogonal waypoint smoothing
   - After reconstructing the raw grid path, post-process to ensure each step only changes one axis.
   - For any diagonal step (both row and col change), insert an intermediate orthogonal cell (e.g., same row as start, col of destination), ensuring the inserted cell is passable directionally.
   - If neither intermediate cell is passable, keep the diagonal step as fallback (rare) and log/debug.

4. Axis-aligned movement enforcement
   - Modify `AIManager.advanceMovement()` to move along a single axis toward the target cell at a time.
   - Preferred rule: move along the axis with the greater remaining distance first, or follow the supplied orthogonal-only path.
   - Snap to axis-aligned positions precisely to avoid cumulative drift.

5. Grid change notifications & cache invalidation
   - Add `GridPathfinder.notifyGridChanged()` that clears `passableCache` and directional caches.
   - Call this from `GridManager` or `SectionActor` when seats/spawn/occupancy change.

6. Debug overlays & tests
   - Add a debug toggle in `GridOverlay` to visualize `allowedIncoming/outgoing` (colored arrows per cell) and the orthogonal path.
   - Add sanity logs/assertions for: path contains steps into disallowed directions, or no passable neighbor found near a seat target.

Performance & Safety
- Keep `passableCache` and directional caches and only invalidate on grid/occupancy changes.
- Keep A* iteration cap (e.g., 2500) and fallback to nearest passable entry cell if no path found.
- If pathfinding still heavy, consider incremental A* work per frame or switch to a worker/easystar for async calculations.

Compatibility & Migration Notes
- Prefer centralizing directional metadata in `GridManager` to keep Section/Actor creation consistent.
- Keep `SectionActor` building seats but call into `GridManager` to set directional rules for row edges.

Acceptance Criteria
- Vendors never visually move diagonally between cells.
- A* respects directional entry rules and doesn't create paths requiring forbidden entries.
- No regressions: session run mode still completes, vendors can reach seats via legal entries, and performance remains interactive.

Next Actions
- Implement Option 1 (full implementation): I can update `GridManager` and `GridPathfinder` and the `AIManager.advanceMovement()` to match.
- Or implement Option 2 (minimal): only add `isPassableDirection` and orthogonal smoothing in `GridPathfinder`, leaving cell metadata initialization to you.

Which option do you want? I can implement Option 2 now for quicker iteration, or Option 1 if you want the full change end-to-end.
