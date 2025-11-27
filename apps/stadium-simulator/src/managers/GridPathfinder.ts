import type { GridManager } from '@/managers/GridManager';
import type { GridPathCell } from '@/managers/interfaces/VendorTypes';
import { gameBalance } from '@/config/gameBalance';
import { BaseManager } from '@/managers/helpers/BaseManager';

// Gate verbose pathfinding diagnostics behind an env flag
// Set VITE_DEBUG_PATHFIND=true to re-enable detailed logging
const DEBUG_PATHFIND = import.meta.env.VITE_DEBUG_PATHFIND === 'true';

/**
 * Event payload emitted when a path is calculated
 */
export interface PathCalculatedEvent {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  path: GridPathCell[];
  success: boolean;
}

/**
 * Grid-based A* pathfinding for any actor
 * Ensures actors move cell-by-cell and respect stadium architecture with directional constraints
 */
export class GridPathfinder extends BaseManager {
  private gridManager: GridManager;
  private passableCache: Map<string, boolean> = new Map();
  private directionalCache: Map<string, boolean> = new Map();

  constructor(gridManager: GridManager) {
    super({
      name: 'GridPathfinder',
      category: 'pathfinding',
      logLevel: 'info',
      enabled: true,
    });
    this.gridManager = gridManager;
    
    // Subscribe to grid events for cache invalidation
    this.gridManager.on('gridChanged', () => this.clearCache());
    this.gridManager.on('zonesLoaded', () => this.clearCache());
  }

  /**
   * Find a path from start world position to end world position
   * Returns array of GridPathCells representing grid cells to traverse
   */
  public findPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): GridPathCell[] {
    // Convert world coordinates to grid
    const startGrid = this.gridManager.worldToGrid(fromX, fromY);
    const endGrid = this.gridManager.worldToGrid(toX, toY);

    if (!startGrid || !endGrid) {
      if (DEBUG_PATHFIND) {
        console.warn('[GridPathfinder] Invalid start or end position', { 
          from: { x: fromX, y: fromY }, 
          to: { x: toX, y: toY },
          startGrid,
          endGrid
        });
      }
      return [];
    }

    if (DEBUG_PATHFIND) {
      console.log(`[GridPathfinder] Starting A* from (${startGrid.row},${startGrid.col}) to (${endGrid.row},${endGrid.col})`);
    }

    // Run A* algorithm
    const path = this.astar(startGrid.row, startGrid.col, endGrid.row, endGrid.col);

    if (path.length === 0) {
      if (DEBUG_PATHFIND) {
        console.warn(`[GridPathfinder] No path found from (${startGrid.row},${startGrid.col}) to (${endGrid.row},${endGrid.col})`);
        console.warn(`[GridPathfinder] Start passable: ${this.isPassable(startGrid.row, startGrid.col)}, End passable: ${this.isPassable(endGrid.row, endGrid.col)}`);
        console.warn('[GridPathfinder] Sampling cells between start and end:');
        for (let i = 0; i <= 4; i++) {
          const t = i / 4;
          const sampleRow = Math.round(startGrid.row + (endGrid.row - startGrid.row) * t);
          const sampleCol = Math.round(startGrid.col + (endGrid.col - startGrid.col) * t);
          const cell = this.gridManager.getCell(sampleRow, sampleCol);
          console.warn(`  (${sampleRow},${sampleCol}):`, cell?.zoneType, 'passable:', cell?.passable);
        }
      }
      // Emit pathCalculated event with failure (silent unless subscribed)
      this.emit('pathCalculated', {
        fromX,
        fromY,
        toX,
        toY,
        path: [],
        success: false,
      } as PathCalculatedEvent);
      return [];
    }

    if (DEBUG_PATHFIND) {
      console.log(`[GridPathfinder] Path found with ${path.length} grid cells`);
    }

    // Convert grid path to GridPathCells with world coordinates
    const cells: GridPathCell[] = path.map((cell, index) => {
      const worldPos = this.gridManager.gridToWorld(cell.row, cell.col);
      const prevCell = index > 0 ? path[index - 1] : cell;
      const prevWorld = this.gridManager.gridToWorld(prevCell.row, prevCell.col);
      const cost = Math.sqrt(
        Math.pow(worldPos.x - prevWorld.x, 2) + 
        Math.pow(worldPos.y - prevWorld.y, 2)
      );

      return {
        row: cell.row,
        col: cell.col,
        x: worldPos.x,
        y: worldPos.y,
        cost,
      };
    });

    // console.log(`[GridPathfinder] Found path with ${cells.length} cells`);
    
    // Emit pathCalculated event with success
    this.emit('pathCalculated', {
      fromX,
      fromY,
      toX,
      toY,
      path: cells,
      success: true,
    } as PathCalculatedEvent);
    
    return cells;
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
    let exploredCount = 0;

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
        if (DEBUG_PATHFIND) {
          console.log(`[GridPathfinder] Path found! Explored ${exploredCount} cells in ${iterations} iterations`);
        }
        return this.reconstructPath(cameFrom, current);
      }

      openSet.delete(current);
      closedSet.add(current);
      exploredCount++;

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
        
        // Diagnostic: log if this step is rejected due to passability or direction
        if (!this.isPassableInDirection(currentRow, currentCol, neighbor.row, neighbor.col)) {
          const fromCell = this.gridManager.getCell(currentRow, currentCol);
          const toCell = this.gridManager.getCell(neighbor.row, neighbor.col);
          if (DEBUG_PATHFIND) {
            console.warn(`[GridPathfinder][REJECTED] Step from (${currentRow},${currentCol}) to (${neighbor.row},${neighbor.col}) blocked.`, {
              fromZone: fromCell?.zoneType, toZone: toCell?.zoneType,
              fromAllowedOutgoing: fromCell?.allowedOutgoing, toAllowedIncoming: toCell?.allowedIncoming,
              fromPassable: fromCell?.passable, toPassable: toCell?.passable
            });
          }
          continue;
        }

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
    if (DEBUG_PATHFIND) {
      if (iterations >= maxIterations) {
        console.warn(`[GridPathfinder] Max iterations reached! Start: (${startRow},${startCol}), End: (${endRow},${endCol})`);
      } else {
        console.warn(`[GridPathfinder] OpenSet exhausted after ${iterations} iterations, explored ${exploredCount} cells`);
        console.warn(`[GridPathfinder] ClosedSet size: ${closedSet.size}, never reached end goal`);
      }
    }
    return [];
  }

  /**
   * Reconstruct path from A* cameFrom map
   * In dev mode, validates that all steps are axis-aligned and directionally legal
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

    // Dev-mode path validation
    if (import.meta.env.DEV) {
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1];
        const to = path[i];
        
        // Assert axis-aligned movement (no diagonals)
        const rowDiff = Math.abs(to.row - from.row);
        const colDiff = Math.abs(to.col - from.col);
        const isAxisAligned = (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
        
        if (!isAxisAligned) {
          console.error(`[GridPathfinder] Non-axis-aligned step detected: (${from.row},${from.col}) -> (${to.row},${to.col})`);
        }
        
        // Assert directional passability
        const isDirectionallyLegal = this.gridManager.isPassableDirection(from.row, from.col, to.row, to.col);
        if (!isDirectionallyLegal) {
          console.error(`[GridPathfinder] Illegal directional step: (${from.row},${from.col}) -> (${to.row},${to.col})`);
        }
      }
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
   * Uses zone types and transition penalties from gameBalance
   */
  private getMovementCost(fromRow: number, fromCol: number, toRow: number, toCol: number): number {
    const cellSize = this.gridManager.getWorldSize().cellSize;
    const toCell = this.gridManager.getCell(toRow, toCol);
    
    if (!toCell) return cellSize;

    // Base cost is cell size
    let cost = cellSize;

    // Apply zone-specific cost multipliers
    const zoneCosts = gameBalance.pathfinding.zoneCosts;
    const zoneType = toCell.zoneType || 'corridor';
    const multiplier = zoneCosts[zoneType] || 1.0;
    cost *= multiplier;

    // Apply transition crossing penalty if moving between different zones
    const fromCell = this.gridManager.getCell(fromRow, fromCol);
    if (fromCell && fromCell.zoneType !== toCell.zoneType) {
      cost += gameBalance.pathfinding.transitionCrossPenalty;
    }

    return cost;
  }

  /**
   * Check if movement is allowed from one cell to another (directional)
   * Uses GridManager's zone-aware directional passability checks
   */
  private isPassableInDirection(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const key = `${fromRow},${fromCol}->${toRow},${toCol}`;
    
    // Check directional cache
    if (this.directionalCache.has(key)) {
      return this.directionalCache.get(key)!;
    }

    // Delegate to GridManager's zone-aware directional check
    const passable = this.gridManager.isPassableDirection(fromRow, fromCol, toRow, toCol);
    this.directionalCache.set(key, passable);
    return passable;
  }

  /**
   * Check if a grid cell is passable for actors
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
   * Clear passability and directional caches (call when grid changes)
   */
  public clearCache(): void {
    this.passableCache.clear();
    this.directionalCache.clear();
    this.emit('cacheCleared', { timestamp: Date.now() });
  }
}
