import { BaseManager } from '@/managers/helpers/BaseManager';
import { gameBalance } from '@/config/gameBalance';
import type {
  ZoneType,
  TransitionType,
  DirectionalFlags,
  CellDescriptor,
  CellRangeDescriptor,
  StadiumSceneConfig,
  BoundaryCell,
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

interface GridCell {
  row: number;
  col: number;
  passable: boolean;
  terrainPenalty: number;
  heightLevel: number;
  occupants: Map<string, GridOccupant>;
  walls: Record<CardinalDirection, boolean>;
  defaultWalls: Record<CardinalDirection, boolean>;
  // Zone system properties
  zoneType: ZoneType;
  transitionType?: TransitionType;
  allowedIncoming: DirectionalFlags;
  allowedOutgoing: DirectionalFlags;
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
  private cells: GridCell[][] = [];
  private pendingRedraw: boolean = false;

  // Boundary caches for efficient pathfinding
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
    const col = Math.round(localX / this.cellSize);
    const row = Math.round(localY / this.cellSize);
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

  public getCell(row: number, col: number): GridCell | null {
    if (!this.isValidCell(row, col)) return null;
    return this.cells[row][col];
  }

  public getCellAtWorld(x: number, y: number): GridCell | null {
    const coords = this.worldToGrid(x, y);
    if (!coords) return null;
    return this.getCell(coords.row, coords.col);
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

  public getAllCells(): GridCell[] {
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
      const rowCells: GridCell[] = [];
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
          // Initialize zone properties with corridor defaults (will be overridden by loadZoneConfig)
          zoneType: 'corridor',
          transitionType: undefined,
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

    for (let col = 0; col < this.cols; col++) {
      this.setWallState(targetRow, col, 'top', true, true, true);
    }
  }

  private recalculateWallsForCell(cell: GridCell): void {
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

  // ============================================================================
  // Zone Configuration Methods
  // ============================================================================

  /**
   * Load zone configuration from external data (JSON)
   * Processes cellRanges first, then individual cells for overrides
   */
  public loadZoneConfig(config: StadiumSceneConfig): void {
    this.log('[GridManager] loadZoneConfig called', 'debug');

    // Process cell ranges (bulk zone assignment)
    if (config.cellRanges && config.cellRanges.length > 0) {
      this.log(`[GridManager] Processing ${config.cellRanges.length} cell ranges`, 'debug');
      config.cellRanges.forEach((range) => this.applyCellRange(range));
    }

    // Process individual cells (overrides)
    if (config.cells && config.cells.length > 0) {
      this.log(`[GridManager] Processing ${config.cells.length} individual cells`, 'debug');
      config.cells.forEach((cellDesc) => this.applyCellProperties(cellDesc));
    }

    // Build boundary caches for efficient pathfinding
    this.buildBoundaryCaches();

    // Emit event for subscribers (pathfinders, overlays)
    this.emit('zonesLoaded', { config });
    this.flagGridChanged({ type: 'zonesLoaded' });

    this.log('[GridManager] Zone config loaded successfully', 'info');
  }

  /**
   * Apply zone properties to a range of cells
   */
  private applyCellRange(range: CellRangeDescriptor): void {
    let updatedCount = 0;

    for (let row = range.rowStart; row <= range.rowEnd; row++) {
      for (let col = range.colStart; col <= range.colEnd; col++) {
        if (!this.isValidCell(row, col)) continue;

        const cell = this.cells[row][col];
        
        // Set zone type
        cell.zoneType = range.zoneType;

        // Set transition type if specified
        if (range.transitionType !== undefined) {
          cell.transitionType = range.transitionType;
        }

        // Set passable if specified
        if (range.passable !== undefined) {
          cell.passable = range.passable;
        }

        // Apply zone-specific directional defaults
        const zoneDefaults = this.getZoneDirectionalDefaults(range.zoneType);
        cell.allowedIncoming = { ...zoneDefaults.allowedIncoming };
        cell.allowedOutgoing = { ...zoneDefaults.allowedOutgoing };

        // Override with explicit directional flags from range
        if (range.allowedIncoming) {
          Object.assign(cell.allowedIncoming, range.allowedIncoming);
        }
        if (range.allowedOutgoing) {
          Object.assign(cell.allowedOutgoing, range.allowedOutgoing);
        }

        updatedCount++;
      }
    }

    this.log(`[GridManager] Updated ${updatedCount} cells to zone type: ${range.zoneType}`, 'debug');
  }

  /**
   * Apply properties to a single cell (used for overrides)
   */
  private applyCellProperties(props: CellDescriptor): void {
    const cell = this.getCell(props.row, props.col);
    if (!cell) {
      this.log(`[GridManager] Invalid cell coordinates: (${props.row},${props.col})`, 'warn');
      return;
    }

    // Apply zone type
    if (props.zoneType !== undefined) {
      cell.zoneType = props.zoneType;

      // Reset to zone defaults before applying overrides
      const zoneDefaults = this.getZoneDirectionalDefaults(props.zoneType);
      cell.allowedIncoming = { ...zoneDefaults.allowedIncoming };
      cell.allowedOutgoing = { ...zoneDefaults.allowedOutgoing };

      // Set passable default based on zone
      if (props.passable === undefined) {
        cell.passable = props.zoneType !== 'sky' && props.zoneType !== 'seat';
      }
    }

    // Apply transition type
    if (props.transitionType !== undefined) {
      cell.transitionType = props.transitionType;
    }

    // Apply passable override
    if (props.passable !== undefined) {
      cell.passable = props.passable;
    }

    // Apply directional overrides
    if (props.allowedIncoming) {
      Object.assign(cell.allowedIncoming, props.allowedIncoming);
    }
    if (props.allowedOutgoing) {
      Object.assign(cell.allowedOutgoing, props.allowedOutgoing);
    }

    // Apply terrain penalty
    if (props.terrainPenalty !== undefined) {
      cell.terrainPenalty = props.terrainPenalty;
    }
  }

  /**
   * Get default directional flags based on zone type
   */
  private getZoneDirectionalDefaults(zoneType: ZoneType): {
    allowedIncoming: DirectionalFlags;
    allowedOutgoing: DirectionalFlags;
  } {
    switch (zoneType) {
      case 'sky':
        // Completely impassable
        return {
          allowedIncoming: { top: false, right: false, bottom: false, left: false },
          allowedOutgoing: { top: false, right: false, bottom: false, left: false },
        };

      case 'seat':
        // Seats allow horizontal traversal across a row but block vertical movement
        // Entry/exit to seat rows still expected via adjacent rowEntry cells near stairs
        return {
          allowedIncoming: { top: false, right: true, bottom: false, left: true },
          allowedOutgoing: { top: false, right: true, bottom: false, left: true },
        };

      case 'stair':
        // Stairs now allow movement in all directions (previously vertical-only)
        return {
          allowedIncoming: { top: true, right: true, bottom: true, left: true },
          allowedOutgoing: { top: true, right: true, bottom: true, left: true },
        };

      case 'ground':
      case 'corridor':
      case 'rowEntry':
      default:
        // Fully passable in all directions
        return {
          allowedIncoming: { top: true, right: true, bottom: true, left: true },
          allowedOutgoing: { top: true, right: true, bottom: true, left: true },
        };
    }
  }

  /**
   * Build boundary caches for fast pathfinding access
   */
  private buildBoundaryCaches(): void {
    this.rowEntryCells = [];
    this.stairLandingCells = [];
    this.corridorEntryCells = [];

    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const cell = this.cells[row][col];
        if (!cell.transitionType) continue;

        const boundaryCell: BoundaryCell = {
          row,
          col,
          transitionType: cell.transitionType,
          zoneType: cell.zoneType,
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

    this.log(
      `[GridManager] Built boundary caches: ${this.rowEntryCells.length} rowEntry, ${this.stairLandingCells.length} stairLanding, ${this.corridorEntryCells.length} corridorEntry`,
      'debug'
    );
  }

  /**
   * Get boundary cells by transition type
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
   * Get zone type for a cell
   */
  public getZoneType(row: number, col: number): ZoneType | null {
    const cell = this.getCell(row, col);
    return cell ? cell.zoneType : null;
  }

  /**
   * Check if a cell is a transition boundary
   */
  public isTransition(row: number, col: number, type?: TransitionType): boolean {
    const cell = this.getCell(row, col);
    if (!cell || !cell.transitionType) return false;
    return type ? cell.transitionType === type : true;
  }

  /**
   * Check if movement from one cell to another is allowed (directional passability)
   */
  public isPassableDirection(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    const fromCell = this.getCell(fromRow, fromCol);
    const toCell = this.getCell(toRow, toCol);

    // Basic validation
    if (!fromCell || !toCell) return false;
    if (!fromCell.passable || !toCell.passable) return false;

    // Determine direction of movement
    const rowDelta = toRow - fromRow;
    const colDelta = toCol - fromCol;

    let direction: CardinalDirection;
    if (rowDelta === -1 && colDelta === 0) direction = 'top';
    else if (rowDelta === 1 && colDelta === 0) direction = 'bottom';
    else if (rowDelta === 0 && colDelta === -1) direction = 'left';
    else if (rowDelta === 0 && colDelta === 1) direction = 'right';
    else return false; // Non-orthogonal movement not supported

    const oppositeDir = OPPOSITE_DIRECTION[direction];

    // Check walls
    if (fromCell.walls[direction] || toCell.walls[oppositeDir]) {
      return false;
    }

    // Check directional flags
    if (!fromCell.allowedOutgoing[direction] || !toCell.allowedIncoming[oppositeDir]) {
      return false;
    }

    // Zone-specific transition rules
    // Seat zones require rowEntry transition
    if (toCell.zoneType === 'seat' && fromCell.zoneType !== 'seat') {
      // Must enter seats via rowEntry boundary
      if (fromCell.transitionType !== 'rowBoundary' && toCell.transitionType !== 'rowBoundary') {
        return false;
      }
    }

    return true;
  }
}
