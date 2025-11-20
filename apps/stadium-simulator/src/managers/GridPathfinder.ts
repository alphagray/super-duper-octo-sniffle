import type { GridManager } from '@/managers/GridManager';
import type { PathSegment, VendorProfile } from '@/managers/interfaces/VendorTypes';
import { gameBalance } from '@/config/gameBalance';

/**
 * Grid-based A* pathfinding for vendors
 * Ensures vendors move cell-by-cell and respect stadium architecture
 */
export class GridPathfinder {
  private gridManager: GridManager;
  private passableCache: Map<string, boolean> = new Map();

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  /**
   * Find a path from start world position to end world position
   * Returns array of PathSegments representing grid cells to traverse
   */
  public findPath(
    vendor: VendorProfile,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): PathSegment[] {
    // Convert world coordinates to grid
    const startGrid = this.gridManager.worldToGrid(fromX, fromY);
    const endGrid = this.gridManager.worldToGrid(toX, toY);

    if (!startGrid || !endGrid) {
      // console.warn('[GridPathfinder] Invalid start or end position', { 
      //   from: { x: fromX, y: fromY }, 
      //   to: { x: toX, y: toY },
      //   startGrid,
      //   endGrid
      // });
      return [];
    }

    // console.log(`[GridPathfinder] Finding path from (${startGrid.row},${startGrid.col}) to (${endGrid.row},${endGrid.col})`);

    // Run A* algorithm
    const path = this.astar(startGrid.row, startGrid.col, endGrid.row, endGrid.col);

    if (path.length === 0) {
      // console.warn(`[GridPathfinder] No path found from (${startGrid.row},${startGrid.col}) to (${endGrid.row},${endGrid.col})`);
      // console.warn(`[GridPathfinder] Start passable: ${this.isPassable(startGrid.row, startGrid.col)}, End passable: ${this.isPassable(endGrid.row, endGrid.col)}`);
      return [];
    }

    // console.log(`[GridPathfinder] Path found with ${path.length} grid cells`);

    // Convert grid path to PathSegments with world coordinates
    const segments: PathSegment[] = path.map((cell, index) => {
      const worldPos = this.gridManager.gridToWorld(cell.row, cell.col);
      const prevCell = index > 0 ? path[index - 1] : cell;
      const prevWorld = this.gridManager.gridToWorld(prevCell.row, prevCell.col);
      const cost = Math.sqrt(
        Math.pow(worldPos.x - prevWorld.x, 2) + 
        Math.pow(worldPos.y - prevWorld.y, 2)
      );

      return {
        nodeType: this.getCellType(cell.row, cell.col),
        sectionIdx: 0, // TODO: determine from cell position
        rowIdx: cell.row,
        colIdx: cell.col,
        gridRow: cell.row,
        gridCol: cell.col,
        x: worldPos.x,
        y: worldPos.y,
        cost,
      };
    });

    // console.log(`[GridPathfinder] Found path with ${segments.length} cells`);
    return segments;
  }

  /**
   * A* pathfinding algorithm
   */
  private astar(
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number
  ): Array<{ row: number; col: number }> {
    const openSet = new Set<string>();
    const closedSet = new Set<string>();
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();

    const startKey = `${startRow},${startCol}`;
    const endKey = `${endRow},${endCol}`;

    openSet.add(startKey);
    gScore.set(startKey, 0);
    fScore.set(startKey, this.heuristic(startRow, startCol, endRow, endCol, startRow, startCol));

    // Safety limit: prevent infinite loops
    // Grid is 24x32 = 768 cells, but with obstacles paths can be longer
    // Typical path across full grid is ~56 cells, allow 5x that for safety
    const maxIterations = 2500;
    let iterations = 0;

    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;
      
      // Find node in openSet with lowest fScore
      let current = '';
      let lowestF = Infinity;
      for (const key of openSet) {
        const f = fScore.get(key) || Infinity;
        if (f < lowestF) {
          lowestF = f;
          current = key;
        }
      }

      if (current === endKey) {
        // Reconstruct path
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      closedSet.add(current);

      const [currentRow, currentCol] = current.split(',').map(Number);

      // Check all neighbors (4-directional movement only)
      // Order neighbors to prefer moving toward goal (reduces zigzag paths)
      const rowDiff = endRow - currentRow;
      const colDiff = endCol - currentCol;
      
      const neighbors: Array<{ row: number; col: number; priority: number }> = [];
      
      // Add all 4 neighbors with priority based on direction to goal
      // Lower priority = explored first
      neighbors.push({ 
        row: currentRow - 1, 
        col: currentCol, 
        priority: rowDiff < 0 ? 0 : 2 // up: priority 0 if going up, 2 otherwise
      });
      neighbors.push({ 
        row: currentRow + 1, 
        col: currentCol, 
        priority: rowDiff > 0 ? 0 : 2 // down: priority 0 if going down, 2 otherwise
      });
      neighbors.push({ 
        row: currentRow, 
        col: currentCol - 1, 
        priority: colDiff < 0 ? 0 : 2 // left: priority 0 if going left, 2 otherwise
      });
      neighbors.push({ 
        row: currentRow, 
        col: currentCol + 1, 
        priority: colDiff > 0 ? 0 : 2 // right: priority 0 if going right, 2 otherwise
      });
      
      // Sort by priority (explore toward-goal directions first)
      neighbors.sort((a, b) => a.priority - b.priority);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.row},${neighbor.col}`;

        if (closedSet.has(neighborKey)) continue;
        if (!this.isPassable(neighbor.row, neighbor.col)) continue;

        const tentativeGScore = (gScore.get(current) || 0) + 
          this.getMovementCost(currentRow, currentCol, neighbor.row, neighbor.col);

        if (!openSet.has(neighborKey)) {
          openSet.add(neighborKey);
        } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
          continue;
        }

        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentativeGScore);
        fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor.row, neighbor.col, endRow, endCol, startRow, startCol));
      }
    }

    // No path found
    if (iterations >= maxIterations) {
      console.warn(`[GridPathfinder] Max iterations reached! Start: (${startRow},${startCol}), End: (${endRow},${endCol})`);
    }
    return [];
  }

  /**
   * Reconstruct path from A* cameFrom map
   */
  private reconstructPath(
    cameFrom: Map<string, string>,
    current: string
  ): Array<{ row: number; col: number }> {
    const path: Array<{ row: number; col: number }> = [];
    
    while (current) {
      const [row, col] = current.split(',').map(Number);
      path.unshift({ row, col });
      current = cameFrom.get(current) || '';
    }

    return path;
  }

  /**
   * Manhattan distance heuristic with tie-breaking
   * Uses cross-product to prefer straight-line paths
   */
  private heuristic(
    row1: number, 
    col1: number, 
    row2: number, 
    col2: number,
    startRow: number,
    startCol: number
  ): number {
    const dx = Math.abs(col1 - col2);
    const dy = Math.abs(row1 - row2);
    const manhattan = dx + dy;
    
    // Cross-product tie-breaker: penalize paths that deviate from straight line
    // This makes the pathfinder prefer moving in a straight line toward the goal
    const dx1 = col1 - col2;
    const dy1 = row1 - row2;
    const dx2 = startCol - col2;
    const dy2 = startRow - row2;
    const cross = Math.abs(dx1 * dy2 - dx2 * dy1);
    
    return manhattan + cross * 0.001;
  }

  /**
   * Get movement cost between two adjacent cells
   */
  private getMovementCost(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
    const cellSize = this.gridManager.getWorldSize().cellSize;
    const toType = this.getCellType(toRow, toCol);

    // Base cost is cell size
    let cost = cellSize;

    // Apply multipliers based on terrain type
    switch (toType) {
      case 'stair':
        cost *= gameBalance.vendorMovement.stairTransitionCost;
        break;
      case 'corridor':
        cost *= 0.8; // Corridors are fast
        break;
      case 'ground':
        cost *= 0.7; // Ground is fastest
        break;
      case 'rowEntry':
        cost *= 1.2; // Entering rows is slower
        break;
      case 'seat':
        cost *= 2.0; // Moving through seats is very slow
        break;
    }

    return cost;
  }

  /**
   * Check if a grid cell is passable for vendors
   */
  private isPassable(row: number, col: number): boolean {
    const key = `${row},${col}`;
    
    // Check cache
    if (this.passableCache.has(key)) {
      return this.passableCache.get(key)!;
    }

    // Check grid bounds
    const rowCount = this.gridManager.getRowCount();
    const colCount = this.gridManager.getColumnCount();
    if (row < 0 || row >= rowCount || col < 0 || col >= colCount) {
      this.passableCache.set(key, false);
      return false;
    }

    // Check grid manager for passability
    const cell = this.gridManager.getCell(row, col);
    if (!cell) {
      this.passableCache.set(key, false);
      return false;
    }

    // All cells are passable for now - we'll refine this later
    // TODO: Restrict to specific areas (corridors, stairs, ground, row edges)
    const passable = cell.passable;
    this.passableCache.set(key, passable);
    return passable;
  }

  /**
   * Get the type of cell for cost calculation
   */
  private getCellType(row: number, col: number): 'corridor' | 'stair' | 'ground' | 'rowEntry' | 'seat' {
    const cell = this.gridManager.getCell(row, col);
    if (!cell) return 'corridor';

    // Check occupants for type hints
    for (const occupant of cell.occupants.values()) {
      if (occupant.type === 'stairs') return 'stair';
      if (occupant.type === 'section') return 'seat';
    }

    // Determine by height level or position
    if (cell.heightLevel < 0) return 'ground';
    if (cell.heightLevel === 0) return 'corridor';
    
    return 'seat';
  }

  /**
   * Clear passability cache (call when grid changes)
   */
  public clearCache(): void {
    this.passableCache.clear();
  }
}
