import { BaseManager } from '@/managers/helpers/BaseManager';
import { gameBalance } from '@/config/gameBalance';

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
  private readonly rows: number;
  private readonly cols: number;
  private cells: GridCell[][] = [];
  private pendingRedraw: boolean = false;

  constructor(options: GridManagerOptions) {
    super({ name: 'Grid', category: 'manager:grid', logLevel: 'info' });

    const cfg = gameBalance.grid;
    this.worldWidth = options.width;
    this.worldHeight = options.height;
    this.cellSize = options.cellSize ?? cfg.cellSize;
    this.offsetX = options.offsetX ?? cfg.offsetX;
    this.offsetY = options.offsetY ?? cfg.offsetY;
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
    const localX = x - this.offsetX;
    const localY = y - this.offsetY;
    if (localX < 0 || localY < 0) return null;

    const col = Math.floor(localX / this.cellSize);
    const row = Math.floor(localY / this.cellSize);

    if (!this.isValidCell(row, col)) return null;
    return { row, col };
  }

  /**
   * Convert grid coordinates to world coordinates (cell center).
   */
  public gridToWorld(row: number, col: number): { x: number; y: number } {
    return {
      x: this.offsetX + col * this.cellSize + this.cellSize / 2,
      y: this.offsetY + row * this.cellSize + this.cellSize / 2,
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
}
