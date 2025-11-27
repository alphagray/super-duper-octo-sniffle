import { BaseManager } from '@/managers/helpers/BaseManager';
import { gameBalance } from '@/config/gameBalance';

// Gate verbose grid/zone logs behind the same flag as pathfinding
const DEBUG_PATHFIND = import.meta.env.VITE_DEBUG_PATHFIND === 'true';
import type { 
  ZoneType, 
  TransitionType, 
  DirectionalFlags, 
  StadiumSceneConfig,
  BoundaryCell 
} from '@/managers/interfaces/ZoneConfig';

export type CardinalDirection = 'top' | 'right' | 'bottom' | 'left';

export interface GridOccupant {
  id: string;
  type: string;
  metadata?: Record<string, unknown>;
  wallOverrides?: Partial<Record<CardinalDirection, boolean>>;
}

export interface GridManagerOptions {
  width: number;
  height: number;
  cellSize?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface GridNeighbor {
  row: number;
  col: number;
  cost: number;
}

interface GridCellData {
  row: number;
  col: number;
  passable: boolean;
  terrainPenalty: number;
  heightLevel: number;
  occupants: Map<string, GridOccupant>;
  walls: Record<CardinalDirection, boolean>;
  defaultWalls: Record<CardinalDirection, boolean>;
  zoneType: ZoneType;
  transitionType: TransitionType | null;
  allowedIncoming: Record<CardinalDirection, boolean>;
  allowedOutgoing: Record<CardinalDirection, boolean>;
}

const OPPOSITE_DIRECTION: Record<CardinalDirection, CardinalDirection> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
};

const CARDINAL_DIRECTIONS: CardinalDirection[] = ['top', 'right', 'bottom', 'left'];

export class GridManager extends BaseManager {
  private readonly worldWidth: number;
  private readonly worldHeight: number;
  private readonly cellSize: number;
  private readonly offsetX: number;
  private readonly offsetY: number;
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly rows: number;
  private readonly cols: number;
  private cells: GridCellData[][] = [];
  private pendingRedraw: boolean = false;
  
  // Zone and boundary caches
  private rowEntryCells: BoundaryCell[] = [];
  private stairLandingCells: BoundaryCell[] = [];
  private corridorEntryCells: BoundaryCell[] = [];

  constructor(options: GridManagerOptions) {
    super({ name: 'Grid', category: 'manager:grid', logLevel: 'info' });

    const cfg = gameBalance.grid;
    this.worldWidth = options.width;
    this.worldHeight = options.height;
    this.cellSize = options.cellSize ?? cfg.cellSize;
    // Center of the canvas
    this.centerX = this.worldWidth / 2;
    this.centerY = this.worldHeight / 2;
    // OffsetX/Y are now always zero (legacy, kept for compatibility)
    this.offsetX = 0;
    this.offsetY = 0;
    this.rows = Math.max(1, Math.ceil(this.worldHeight / this.cellSize));
    this.cols = Math.max(1, Math.ceil(this.worldWidth / this.cellSize));

    this.buildGrid();

    if (cfg.defaultExteriorWall) {
      this.applyExteriorWalls();
    }

    this.applyGroundLineWalls();
  }

  /**
   * Convert world coordinates to grid coordinates (row/col).
   */
  public worldToGrid(x: number, y: number): { row: number; col: number } | null {
    // Centered grid: (0,0) is at (centerX, centerY)
    const localX = x - this.centerX;
    const localY = y - this.centerY;
    // Use floor instead of round so that world positions at cell centers
    // (which include +cellSize/2 in gridToWorld) map back to the original
    // grid indices. Previous use of Math.round caused center coordinates
    // to shift (e.g. 5.5 -> 6) producing off-by-one errors.
    const col = Math.floor(localX / this.cellSize + 0.0000001); // tiny epsilon to counter FP edge cases
    const row = Math.floor(localY / this.cellSize + 0.0000001);
    if (!this.isValidCell(row + Math.floor(this.rows / 2), col + Math.floor(this.cols / 2))) return null;
    // Shift grid so (0,0) is center
    return {
      row: row + Math.floor(this.rows / 2),
      col: col + Math.floor(this.cols / 2)
    };
  }

  /**
   * Convert grid coordinates to world coordinates (cell center).
   */
  public gridToWorld(row: number, col: number): { x: number; y: number } {
    // Centered grid: (0,0) is at (centerX, centerY)
    const gridCol = col - Math.floor(this.cols / 2);
    const gridRow = row - Math.floor(this.rows / 2);
    return {
      x: this.centerX + gridCol * this.cellSize + this.cellSize / 2,
      y: this.centerY + gridRow * this.cellSize + this.cellSize / 2,
    };
  }

  /**
   * Get the top-left bounds for a grid cell in world coordinates.
   */
  public getCellBounds(row: number, col: number): { x: number; y: number; width: number; height: number } {
    return {
      x: this.offsetX + col * this.cellSize,
      y: this.offsetY + row * this.cellSize,
      width: this.cellSize,
      height: this.cellSize,
    };
  }

  public getRowCount(): number {
    return this.rows;
  }

  public getColumnCount(): number {
    return this.cols;
  }

  public getWorldSize(): { width: number; height: number; cellSize: number } {
    return { width: this.worldWidth, height: this.worldHeight, cellSize: this.cellSize };
  }

  public getOrigin(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  public getCell(row: number, col: number): GridCellData | null {
    if (!this.isValidCell(row, col)) return null;
    return this.cells[row][col];
  }

  public getCellAtWorld(x: number, y: number): GridCellData | null {
    const coords = this.worldToGrid(x, y);
    if (!coords) return null;
    return this.getCell(coords.row, coords.col);
  }

  /**
   * Get render depth for an animated actor at a grid position.
   * Applies per-row penalty above ground and clamps to [animatedActorMin, animatedActorMax].
   */
  public getDepthForPosition(row: number, col: number): number {
    // Determine rows above ground plane using configured ground line
    const rowsFromBottom = gameBalance.grid.groundLine.rowsFromBottom ?? 0;
    const groundRow = this.rows - 1 - rowsFromBottom;
    const rowsAboveGround = Math.max(0, row - groundRow);

    const base = gameBalance.ui.depths.animatedActorBase;
    const penalty = gameBalance.ui.depths.animatedActorRowPenalty * rowsAboveGround;
    const min = gameBalance.ui.depths.animatedActorMin;
    const max = gameBalance.ui.depths.animatedActorMax;
    const raw = base - penalty;
    return Math.max(min, Math.min(max, raw));
  }

  /**
   * Compute actor render depth using world position with intra-cell interpolation.
   * Above the cell center (toward sky) is "further back" (lower depth) within the row band.
   */
  public getDepthForWorld(x: number, y: number): number {
    // Determine grid cell and center
    const coords = this.worldToGrid(x, y);
    if (!coords) {
      // Fallback to mid-depth if outside grid
      return gameBalance.ui.depths.animatedActorBase;
    }
    const cellCenter = this.gridToWorld(coords.row, coords.col);

    // Base depth from row band
    let depth = this.getDepthForPosition(coords.row, coords.col);

    // Intra-cell interpolation within band width
    const bandWidth = gameBalance.ui.depths.animatedActorRowPenalty; // typically 10
    const intraRange = Math.max(0, bandWidth - 2); // leave 1-2 units buffer to avoid crossing bands
    const halfCell = this.cellSize / 2;

    // Positive fraction when above center (y smaller), negative when below center
    const fraction = (cellCenter.y - y) / halfCell; // range approx [-1, 1]
    const clampedFraction = Math.max(-1, Math.min(1, fraction));

    // Adjust depth: above center → reduce depth (further back), below center → increase depth (closer)
    const intraAdjustment = (intraRange / 2) * clampedFraction;
    depth = depth - intraAdjustment;

    // Final clamp to [min, max]
    const min = gameBalance.ui.depths.animatedActorMin;
    const max = gameBalance.ui.depths.animatedActorMax;
    return Math.max(min, Math.min(max, depth));
  }

  public setCellPassable(row: number, col: number, passable: boolean): void {
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.passable = passable;
    this.flagGridChanged({ type: 'cellPassable', row, col, passable });
  }

  public setCellTerrainPenalty(row: number, col: number, penalty: number): void {
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.terrainPenalty = Math.max(0, penalty);
    this.flagGridChanged({ type: 'cellPenalty', row, col, penalty: cell.terrainPenalty });
  }

  public setCellHeightLevel(row: number, col: number, level: number): void {
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.heightLevel = level;
    this.flagGridChanged({ type: 'cellHeight', row, col, level });
  }

  public registerWall(row: number, col: number, direction: CardinalDirection, impassable: boolean = true): void {
    this.setWallState(row, col, direction, impassable, true);
  }

  public clearWall(row: number, col: number, direction: CardinalDirection): void {
    this.setWallState(row, col, direction, false, true);
  }

  public isWallBetween(row: number, col: number, direction: CardinalDirection): boolean {
    const cell = this.getCell(row, col);
    if (!cell) return true;
    return !!cell.walls[direction];
  }

  public getPassableNeighbors(row: number, col: number): GridNeighbor[] {
    const origin = this.getCell(row, col);
    if (!origin || !origin.passable) return [];

    const neighbors: GridNeighbor[] = [];

    const directions: Array<{ dir: CardinalDirection; rowOffset: number; colOffset: number }> = [
      { dir: 'top', rowOffset: -1, colOffset: 0 },
      { dir: 'right', rowOffset: 0, colOffset: 1 },
      { dir: 'bottom', rowOffset: 1, colOffset: 0 },
      { dir: 'left', rowOffset: 0, colOffset: -1 },
    ];

    directions.forEach(({ dir, rowOffset, colOffset }) => {
      const neighborRow = row + rowOffset;
      const neighborCol = col + colOffset;
      if (!this.isValidCell(neighborRow, neighborCol)) return;

      if (this.isWallBetween(row, col, dir)) return;
      if (this.isWallBetween(neighborRow, neighborCol, OPPOSITE_DIRECTION[dir])) return;

      const neighbor = this.getCell(neighborRow, neighborCol);
      if (!neighbor || !neighbor.passable) return;

      const cost = 1 + neighbor.terrainPenalty;
      neighbors.push({ row: neighborRow, col: neighborCol, cost });
    });

    return neighbors;
  }

  public addOccupant(row: number, col: number, occupant: GridOccupant): void {
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.occupants.set(occupant.id, occupant);
    this.recalculateWallsForCell(cell);
    this.flagGridChanged({ type: 'occupantAdded', row, col, occupant });
  }

  public removeOccupant(row: number, col: number, occupantId: string): void {
    const cell = this.getCell(row, col);
    if (!cell) return;
    const occupant = cell.occupants.get(occupantId);
    if (!occupant) return;

    cell.occupants.delete(occupantId);
    this.recalculateWallsForCell(cell);
    this.flagGridChanged({ type: 'occupantRemoved', row, col, occupantId });
  }

  public getCellOccupants(row: number, col: number): GridOccupant[] {
    const cell = this.getCell(row, col);
    if (!cell) return [];
    return Array.from(cell.occupants.values());
  }

  public registerSeat(worldX: number, worldY: number, occupant: GridOccupant): void {
    const coords = this.worldToGrid(worldX, worldY);
    if (!coords) return;
    this.addOccupant(coords.row, coords.col, occupant);
  }

  public getAllCells(): GridCellData[] {
    return this.cells.flat();
  }

  public hasPendingRedraw(): boolean {
    return this.pendingRedraw;
  }

  public consumePendingRedraw(): boolean {
    const flag = this.pendingRedraw;
    this.pendingRedraw = false;
    return flag;
  }

  private buildGrid(): void {
    this.cells = [];
    for (let row = 0; row < this.rows; row++) {
      const rowCells: GridCellData[] = [];
      for (let col = 0; col < this.cols; col++) {
        rowCells.push({
          row,
          col,
          passable: true,
          terrainPenalty: 0,
          heightLevel: 0,
          occupants: new Map(),
          walls: { top: false, right: false, bottom: false, left: false },
          defaultWalls: { top: false, right: false, bottom: false, left: false },
          zoneType: 'corridor', // Default zone type
          transitionType: null,
          allowedIncoming: { top: true, right: true, bottom: true, left: true },
          allowedOutgoing: { top: true, right: true, bottom: true, left: true },
        });
      }
      this.cells.push(rowCells);
    }
  }

  private applyExteriorWalls(): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (row === 0) this.setWallState(row, col, 'top', true, false);
        if (row === this.rows - 1) this.setWallState(row, col, 'bottom', true, false);
        if (col === 0) this.setWallState(row, col, 'left', true, false);
        if (col === this.cols - 1) this.setWallState(row, col, 'right', true, false);
      }
    }
    this.flagGridChanged({ type: 'exteriorWallsApplied' });
  }

  private applyGroundLineWalls(): void {
    const groundConfig = gameBalance.grid.groundLine;
    if (!groundConfig || !groundConfig.enabled) return;

    const rowsFromBottom = groundConfig.rowsFromBottom ?? 0;
    const targetRow = this.rows - 1 - rowsFromBottom;
    if (!this.isValidCell(targetRow, 0)) return;
    // Existing implementation placed a horizontal wall on targetRow regardless of zone,
    // which (given current stadium config) fell inside seat/stair bands (row 17) and
    // blocked vertical ascent from stair cells to higher seat rows. We only want a
    // ground separation wall above actual ground cells, not within seating.
    // Revised logic: apply top walls ONLY on cells whose zoneType is currently 'ground'.
    // This preserves intended ground boundary while allowing vertical movement on stairs.
    for (let col = 0; col < this.cols; col++) {
      const cell = this.getCell(targetRow, col);
      if (!cell) continue;
      if (cell.zoneType === 'ground') {
        this.setWallState(targetRow, col, 'top', true, true, true);
      } else {
        // Ensure any previously set default top wall (from earlier builds) is cleared
        // to avoid stale blocking in seating/stair zones.
        if (cell.walls.top) {
          this.setWallState(targetRow, col, 'top', false, true, true);
        }
      }
    }
  }

  private recalculateWallsForCell(cell: GridCellData): void {
    const desiredWalls: Record<CardinalDirection, boolean> = {
      top: cell.defaultWalls.top,
      right: cell.defaultWalls.right,
      bottom: cell.defaultWalls.bottom,
      left: cell.defaultWalls.left,
    };

    cell.occupants.forEach((occupant) => {
      const overrides = occupant.wallOverrides;
      if (!overrides) return;

      CARDINAL_DIRECTIONS.forEach((direction) => {
        if (typeof overrides[direction] === 'boolean') {
          desiredWalls[direction] = overrides[direction] as boolean;
        }
      });
    });

    CARDINAL_DIRECTIONS.forEach((direction) => {
      this.setWallState(cell.row, cell.col, direction, desiredWalls[direction], true, false);
    });
  }

  private setWallState(
    row: number,
    col: number,
    direction: CardinalDirection,
    value: boolean,
    syncNeighbor: boolean,
    updateDefault: boolean = true
  ): void {
    const cell = this.getCell(row, col);
    if (!cell) return;

    const previous = cell.walls[direction];
    const defaultPrevious = cell.defaultWalls[direction];

    if (previous === value && (!updateDefault || defaultPrevious === value)) {
      if (syncNeighbor) {
        const neighborCoords = this.getNeighborCoordinates(row, col, direction);
        if (neighborCoords) {
          this.setWallState(neighborCoords.row, neighborCoords.col, OPPOSITE_DIRECTION[direction], value, false, updateDefault);
        }
      }
      return;
    }

    cell.walls[direction] = value;
    if (updateDefault) {
      cell.defaultWalls[direction] = value;
    }

    if (syncNeighbor) {
      const neighborCoords = this.getNeighborCoordinates(row, col, direction);
      if (neighborCoords) {
        this.setWallState(neighborCoords.row, neighborCoords.col, OPPOSITE_DIRECTION[direction], value, false, updateDefault);
      }
    }

    this.flagGridChanged({ type: 'wallUpdated', row, col, direction, value });
  }

  private getNeighborCoordinates(row: number, col: number, direction: CardinalDirection): { row: number; col: number } | null {
    switch (direction) {
      case 'top':
        return this.isValidCell(row - 1, col) ? { row: row - 1, col } : null;
      case 'right':
        return this.isValidCell(row, col + 1) ? { row, col: col + 1 } : null;
      case 'bottom':
        return this.isValidCell(row + 1, col) ? { row: row + 1, col } : null;
      case 'left':
        return this.isValidCell(row, col - 1) ? { row, col: col - 1 } : null;
      default:
        return null;
    }
  }

  private isValidCell(row: number, col: number): boolean {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  private flagGridChanged(payload: unknown): void {
    this.pendingRedraw = true;
    this.emit('gridChanged', payload);
  }

  /**
   * Load zone configuration from JSON
   * Processes cellRanges first (fill rectangular regions), then cells (specific overrides)
   */
  public loadZoneConfig(config: StadiumSceneConfig): void {
    if (DEBUG_PATHFIND) {
      console.log('[GridManager] loadZoneConfig called with:', {
        cellRanges: config.cellRanges.length,
        cells: config.cells.length,
        sections: config.sections.length,
        stairs: config.stairs.length,
      });
    }

    // Process cell ranges first
    if (config.cellRanges) {
      if (DEBUG_PATHFIND) console.log('[GridManager] Processing', config.cellRanges.length, 'cell ranges');
      for (const range of config.cellRanges) {
        this.applyCellRange(range);
      }
    }

    // Process individual cells (overrides ranges)
    if (config.cells) {
      if (DEBUG_PATHFIND) console.log('[GridManager] Processing', config.cells.length, 'individual cells');
      for (const cellDesc of config.cells) {
        this.applyCell(cellDesc);
      }
    }

    // Build boundary caches
    this.buildBoundaryCaches();

    // Emit event
    this.emit('zonesLoaded', { config });
    this.flagGridChanged({ type: 'zonesLoaded' });
    
    if (DEBUG_PATHFIND) {
      console.log('[GridManager] Zone config loaded. Sample cells:', {
        '0,0': this.getCell(0, 0)?.zoneType,
        '14,5': this.getCell(14, 5)?.zoneType,
        '15,5': this.getCell(15, 5)?.zoneType,
        '20,5': this.getCell(20, 5)?.zoneType,
      });
    }
  }

  /**
   * Apply zone properties to a rectangular range of cells
   */
  private applyCellRange(range: import('@/managers/interfaces/ZoneConfig').CellRangeDescriptor): void {
    const { rowStart, rowEnd, colStart, colEnd } = range;

    if (DEBUG_PATHFIND) console.log(`[GridManager] Applying range: rows ${rowStart}-${rowEnd}, cols ${colStart}-${colEnd}, zone: ${range.zoneType}`);
    
    // Debug: Check if directional flags are present in range
    if (range.zoneType === 'sky') {
      if (DEBUG_PATHFIND) {
        console.log(`[GridManager] Sky range allowedIncoming.top=${range.allowedIncoming?.top} bottom=${range.allowedIncoming?.bottom} left=${range.allowedIncoming?.left} right=${range.allowedIncoming?.right}`);
        console.log(`[GridManager] Sky range allowedOutgoing.top=${range.allowedOutgoing?.top} bottom=${range.allowedOutgoing?.bottom} left=${range.allowedOutgoing?.left} right=${range.allowedOutgoing?.right}`);
      }
    }

    // Validate bounds
    if (!this.isValidCell(rowStart, colStart) || !this.isValidCell(rowEnd, colEnd)) {
      if (DEBUG_PATHFIND) console.warn(`[GridManager] Invalid cell range bounds: (${rowStart},${colStart}) to (${rowEnd},${colEnd})`);
      return;
    }

    let cellsUpdated = 0;
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const cell = this.getCell(row, col);
        if (!cell) continue;

        this.applyCellProperties(cell, range);
        cellsUpdated++;
      }
    }
    
    if (DEBUG_PATHFIND) console.log(`[GridManager] Updated ${cellsUpdated} cells to zone type: ${range.zoneType}`);
  }

  /**
   * Apply zone properties to a single cell
   */
  private applyCell(cellDesc: import('@/managers/interfaces/ZoneConfig').CellDescriptor): void {
    const { row, col } = cellDesc;

    if (!this.isValidCell(row, col)) {
      if (DEBUG_PATHFIND) console.warn(`[GridManager] Invalid cell coords: (${row},${col})`);
      return;
    }

    const cell = this.getCell(row, col);
    if (!cell) return;

    this.applyCellProperties(cell, cellDesc);
  }

  /**
   * Apply zone properties to a cell from a descriptor
   */
  private applyCellProperties(
    cell: GridCellData,
    props: { 
      zoneType: ZoneType; 
      transitionType?: TransitionType; 
      allowedIncoming?: DirectionalFlags; 
      allowedOutgoing?: DirectionalFlags; 
      passable?: boolean;
    }
  ): void {
    cell.zoneType = props.zoneType;
    cell.transitionType = props.transitionType ?? null;

    // Debug: Log props for sky cells at edges
    if (props.zoneType === 'sky' && (cell.col === 0 || cell.col === 1 || cell.col === 30 || cell.col === 31) && cell.row === 0) {
      if (DEBUG_PATHFIND) console.log(`[GridManager] applyCellProperties for sky cell (${cell.row},${cell.col})`);
      console.log(`  props.allowedIncoming:`, props.allowedIncoming);
      console.log(`  props.allowedIncoming?.top:`, props.allowedIncoming?.top);
    }

    // Set default directional flags based on zone type (before applying explicit flags)
    const zoneDefaults = this.getZoneDirectionalDefaults(props.zoneType);
    cell.allowedIncoming = { ...zoneDefaults.incoming };
    cell.allowedOutgoing = { ...zoneDefaults.outgoing };

    // Apply explicit directional flags (override defaults)
    if (props.allowedIncoming) {
      CARDINAL_DIRECTIONS.forEach(dir => {
        if (typeof props.allowedIncoming![dir] === 'boolean') {
          cell.allowedIncoming[dir] = props.allowedIncoming![dir]!;
        }
      });
    }

    if (props.allowedOutgoing) {
      CARDINAL_DIRECTIONS.forEach(dir => {
        if (typeof props.allowedOutgoing![dir] === 'boolean') {
          cell.allowedOutgoing[dir] = props.allowedOutgoing![dir]!;
        }
      });
    }
    
    // Debug log for sky cells on edges
    if (props.zoneType === 'sky' && (cell.col === 0 || cell.col === 1 || cell.col === 30 || cell.col === 31)) {
      if (DEBUG_PATHFIND) console.log(`[GridManager] Sky cell (${cell.row},${cell.col}) IN: T=${cell.allowedIncoming.top} B=${cell.allowedIncoming.bottom} L=${cell.allowedIncoming.left} R=${cell.allowedIncoming.right} OUT: T=${cell.allowedOutgoing.top} B=${cell.allowedOutgoing.bottom} L=${cell.allowedOutgoing.left} R=${cell.allowedOutgoing.right}`);
    }

    // Apply passable if specified, otherwise derive from zoneType
    if (typeof props.passable === 'boolean') {
      cell.passable = props.passable;
    } else {
      // Sky and seat zones are not passable by default
      cell.passable = props.zoneType !== 'sky' && props.zoneType !== 'seat';
    }
  }

  /**
   * Get default directional flags for a zone type
   */
  private getZoneDirectionalDefaults(zoneType: ZoneType): {
    incoming: Record<CardinalDirection, boolean>;
    outgoing: Record<CardinalDirection, boolean>;
  } {
    switch (zoneType) {
      case 'sky':
        // Sky is completely impassable
        return {
          incoming: { top: false, right: false, bottom: false, left: false },
          outgoing: { top: false, right: false, bottom: false, left: false },
        };
      
      case 'seat':
        // Seats allow horizontal movement only (left/right within rows)
        return {
          incoming: { top: false, right: true, bottom: false, left: true },
          outgoing: { top: false, right: true, bottom: false, left: true },
        };
      
      case 'stair':
        // Stairs allow both vertical and horizontal ties into seats/corridors
        return {
          incoming: { top: true, right: true, bottom: true, left: true },
          outgoing: { top: true, right: true, bottom: true, left: true },
        };
      
      case 'ground':
      case 'corridor':
      case 'rowEntry':
        // Ground, corridors, and row entries are fully passable
        return {
          incoming: { top: true, right: true, bottom: true, left: true },
          outgoing: { top: true, right: true, bottom: true, left: true },
        };
      
      default:
        // Default: fully passable
        return {
          incoming: { top: true, right: true, bottom: true, left: true },
          outgoing: { top: true, right: true, bottom: true, left: true },
        };
    }
  }

  /**
   * Build boundary cell caches for quick lookup
   */
  private buildBoundaryCaches(): void {
    this.rowEntryCells = [];
    this.stairLandingCells = [];
    this.corridorEntryCells = [];

    let totalCellsChecked = 0;
    let cellsWithTransitionType = 0;

    for (const row of this.cells) {
      for (const cell of row) {
        totalCellsChecked++;
        if (cell.transitionType) {
          cellsWithTransitionType++;
          const boundaryCell: BoundaryCell = {
            row: cell.row,
            col: cell.col,
            transitionType: cell.transitionType
          };

          switch (cell.transitionType) {
            case 'rowBoundary':
              this.rowEntryCells.push(boundaryCell);
              break;
            case 'stairLanding':
              this.stairLandingCells.push(boundaryCell);
              break;
            case 'corridorEntry':
              this.corridorEntryCells.push(boundaryCell);
              break;
          }
        }
      }
    }

    if (DEBUG_PATHFIND) {
      console.log(`[GridManager] Built boundary caches: ${this.rowEntryCells.length} rowEntry, ${this.stairLandingCells.length} stairLanding, ${this.corridorEntryCells.length} corridorEntry`);
      console.log(`[GridManager] Total cells checked: ${totalCellsChecked}, cells with transitionType: ${cellsWithTransitionType}`);
    }
    
    // Sample check
    if (cellsWithTransitionType === 0) {
      if (DEBUG_PATHFIND) console.warn('[GridManager] No cells have transitionType set! Checking sample cells:');
      console.log('  Cell (14,2):', this.getCell(14, 2)?.transitionType);
      console.log('  Cell (14,10):', this.getCell(14, 10)?.transitionType);
      console.log('  Cell (19,10):', this.getCell(19, 10)?.transitionType);
    }
  }

  /**
   * Get zone type of a cell
   */
  public getZoneType(row: number, col: number): ZoneType | null {
    const cell = this.getCell(row, col);
    return cell ? cell.zoneType : null;
  }

  /**
   * Check if cell is a transition of specific type
   */
  public isTransition(row: number, col: number, type?: TransitionType): boolean {
    const cell = this.getCell(row, col);
    if (!cell || !cell.transitionType) return false;
    return type ? cell.transitionType === type : true;
  }

  /**
   * Get all boundary cells of a specific type
   */
  public getBoundarySet(type: TransitionType): BoundaryCell[] {
    switch (type) {
      case 'rowBoundary':
        return [...this.rowEntryCells];
      case 'stairLanding':
        return [...this.stairLandingCells];
      case 'corridorEntry':
        return [...this.corridorEntryCells];
      default:
        return [];
    }
  }

  /**
   * Check if movement from one cell to another is allowed (directional passability)
   * Considers: bounds, passability, walls, directional flags, and zone transition rules
   */
  public isPassableDirection(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // Bounds check
    if (!this.isValidCell(fromRow, fromCol) || !this.isValidCell(toRow, toCol)) {
      return false;
    }

    const fromCell = this.getCell(fromRow, fromCol);
    const toCell = this.getCell(toRow, toCol);

    // Early return if cells don't exist (prevents expansion beyond grid bounds)
    if (!fromCell || !toCell) return false;

    // Both cells must be passable
    if (!fromCell.passable || !toCell.passable) return false;

    // Determine direction
    const direction = this.getDirection(fromRow, fromCol, toRow, toCol);
    if (!direction) return false; // Not adjacent

    const oppositeDir = OPPOSITE_DIRECTION[direction];

    // Check walls
    if (fromCell.walls[direction] || toCell.walls[oppositeDir]) {
      return false;
    }

    // Check directional flags
    // When entering toCell, check the OPPOSITE direction (e.g., moving 'top' means entering from 'bottom')
    const outgoingAllowed = fromCell.allowedOutgoing[direction];
    const incomingAllowed = toCell.allowedIncoming[oppositeDir];
    
    if (!outgoingAllowed || !incomingAllowed) {
      if (DEBUG_PATHFIND) console.warn(`[GridManager] Directional check failed (${fromRow},${fromCol})->${direction}→(${toRow},${toCol}):`, {
        fromZone: fromCell.zoneType,
        toZone: toCell.zoneType,
        direction,
        oppositeDir,
        outgoingAllowed,
        incomingAllowed,
        fromAllowedOutgoing: fromCell.allowedOutgoing,
        toAllowedIncoming: toCell.allowedIncoming
      });
      return false;
    }

    // Zone transition rules
    return this.isZoneTransitionAllowed(fromCell, toCell);
  }

  /**
   * Get cardinal direction from one cell to an adjacent cell
   */
  private getDirection(fromRow: number, fromCol: number, toRow: number, toCol: number): CardinalDirection | null {
    const dRow = toRow - fromRow;
    const dCol = toCol - fromCol;

    if (dRow === -1 && dCol === 0) return 'top';
    if (dRow === 1 && dCol === 0) return 'bottom';
    if (dRow === 0 && dCol === -1) return 'left';
    if (dRow === 0 && dCol === 1) return 'right';

    return null; // Not adjacent or diagonal
  }

  /**
   * Check if zone transition is allowed between two cells
   */
  private isZoneTransitionAllowed(fromCell: GridCellData, toCell: GridCellData): boolean {
    const fromZone = fromCell.zoneType;
    const toZone = toCell.zoneType;

    // Same zone always allowed
    if (fromZone === toZone) return true;

    // Sky never accessible
    if (toZone === 'sky') return false;

    // Seat <-> stair always allowed (handles horizontal transitions at landings)
    if ((fromZone === 'seat' && toZone === 'stair') || (fromZone === 'stair' && toZone === 'seat')) {
      return true;
    }

    // Seat <-> corridor/ground must go via rowEntry boundary
    if ((fromZone === 'seat' && (toZone === 'corridor' || toZone === 'ground')) ||
        ((fromZone === 'corridor' || fromZone === 'ground') && toZone === 'seat')) {
      // At least one cell must be rowEntry transition
      return fromCell.transitionType === 'rowBoundary' || 
             toCell.transitionType === 'rowBoundary' ||
             toCell.zoneType === 'rowEntry' ||
             fromCell.zoneType === 'rowEntry';
    }

    // Stair transitions: stairs can connect to seats (horizontally at landings), ground, corridor, rowEntry
    if (fromZone === 'stair' || toZone === 'stair') {
      // All transitions allowed (stair <-> seat, stair <-> ground, stair <-> corridor, stair <-> rowEntry)
      return true;
    }

    // All other transitions allowed (corridor <-> ground, rowEntry <-> corridor, etc.)
    return true;
  }

  /**
   * Get nearest vertical access point (corridor or ground) for a given seat position
   * Evaluates corridor (row 14) and top ground (row 19) at the same column
   * Returns the closest passable access point using Manhattan distance
   * 
   * @param seatRow Row of the seat position
   * @param seatCol Column of the seat position
   * @returns Access cell info or null if both candidates blocked
   */
  public getNearestVerticalAccess(
    seatRow: number,
    seatCol: number
  ): { row: number; col: number; zone: 'corridor' | 'ground' } | null {
    // Hardcoded zone row indices based on stadium layout
    const corridorRow = 14;
    const topGroundRow = 19;

    // Evaluate corridor candidate
    const corridorCell = this.getCell(corridorRow, seatCol);
    const corridorValid = corridorCell && 
                         corridorCell.passable && 
                         corridorCell.zoneType === 'corridor';

    // Evaluate ground candidate
    const groundCell = this.getCell(topGroundRow, seatCol);
    const groundValid = groundCell && 
                       groundCell.passable && 
                       groundCell.zoneType === 'ground';

    // If both blocked, return null
    if (!corridorValid && !groundValid) {
      return null;
    }

    // If only one valid, return it
    if (corridorValid && !groundValid) {
      if (gameBalance.vendorDebug.logAccessSelection) {
        if (DEBUG_PATHFIND) console.log(`[GridManager] Nearest access for seat (${seatRow},${seatCol}): corridor (${corridorRow},${seatCol})`);
      }
      return { row: corridorRow, col: seatCol, zone: 'corridor' };
    }

    if (groundValid && !corridorValid) {
      if (gameBalance.vendorDebug.logAccessSelection) {
        if (DEBUG_PATHFIND) console.log(`[GridManager] Nearest access for seat (${seatRow},${seatCol}): ground (${topGroundRow},${seatCol})`);
      }
      return { row: topGroundRow, col: seatCol, zone: 'ground' };
    }

    // Both valid - pick closest by Manhattan distance (vertical only since column is same)
    const corridorDistance = Math.abs(seatRow - corridorRow);
    const groundDistance = Math.abs(seatRow - topGroundRow);

    const chosen = corridorDistance <= groundDistance ? 'corridor' : 'ground';
    const chosenRow = chosen === 'corridor' ? corridorRow : topGroundRow;

    if (gameBalance.vendorDebug.logAccessSelection) {
      if (DEBUG_PATHFIND) console.log(`[GridManager] Nearest access for seat (${seatRow},${seatCol}): ${chosen} (${chosenRow},${seatCol}) - distances: corridor=${corridorDistance}, ground=${groundDistance}`);
    }

    return { row: chosenRow, col: seatCol, zone: chosen };
  }
}
