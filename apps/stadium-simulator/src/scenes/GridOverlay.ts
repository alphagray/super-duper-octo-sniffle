import Phaser from 'phaser';

import { gameBalance } from '@/config/gameBalance';
import { GridManager, CardinalDirection } from '@/managers/GridManager';

export class GridOverlay extends Phaser.GameObjects.Graphics {
  private readonly grid: GridManager;
  private readonly debugConfig = gameBalance.grid.debug;
  private needsRedraw: boolean = true;
  private readonly gridChangedHandler: () => void;

  constructor(scene: Phaser.Scene, grid: GridManager) {
    super(scene);
    this.grid = grid;

    this.setDepth(this.debugConfig.depth);
    this.setScrollFactor(1);
    this.setVisible(this.debugConfig.initialVisible);

    this.gridChangedHandler = () => {
      this.needsRedraw = true;
    };

    this.grid.on('gridChanged', this.gridChangedHandler);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.handleSceneUpdate, this);

    scene.add.existing(this);
  }

  public setDebugVisible(visible: boolean): void {
    this.setVisible(visible);
    if (visible) {
      this.needsRedraw = true;
    }
  }

  public refresh(): void {
    this.needsRedraw = true;
  }

  public destroy(fromScene?: boolean): void {
    this.grid.off('gridChanged', this.gridChangedHandler);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.handleSceneUpdate, this);
    super.destroy(fromScene);
  }

  private handleSceneUpdate(): void {
    if (!this.visible) return;
    if (!this.needsRedraw) return;

    this.redraw();
    this.needsRedraw = false;
  }

  private redraw(): void {
    const { gridColor, gridAlpha, gridLineWidth, wallColor, wallAlpha, wallLineWidth } = this.debugConfig;
    const rows = this.grid.getRowCount();
    const cols = this.grid.getColumnCount();
    const { cellSize } = this.grid.getWorldSize();
    const origin = this.grid.getOrigin();

    this.clear();

    this.lineStyle(gridLineWidth, gridColor, gridAlpha);
    this.drawGridLines(rows, cols, cellSize, origin.x, origin.y);

    this.lineStyle(wallLineWidth, wallColor, wallAlpha);
    this.drawWalls(cellSize);
  }

  private drawGridLines(rows: number, cols: number, cellSize: number, originX: number, originY: number): void {
    for (let col = 0; col <= cols; col++) {
      const x = originX + col * cellSize;
      this.drawLine(x, originY, x, originY + rows * cellSize);
    }

    for (let row = 0; row <= rows; row++) {
      const y = originY + row * cellSize;
      this.drawLine(originX, y, originX + cols * cellSize, y);
    }
  }

  private drawWalls(cellSize: number): void {
    const cells = this.grid.getAllCells();

    cells.forEach((cell) => {
      const bounds = this.grid.getCellBounds(cell.row, cell.col);

      const startX = bounds.x;
      const startY = bounds.y;
      const endX = bounds.x + cellSize;
      const endY = bounds.y + cellSize;

      this.drawWallSegment(cell, 'top', startX, startY, endX, startY);
      this.drawWallSegment(cell, 'right', endX, startY, endX, endY);
      this.drawWallSegment(cell, 'bottom', startX, endY, endX, endY);
      this.drawWallSegment(cell, 'left', startX, startY, startX, endY);
    });
  }

  private drawWallSegment(cell: { walls: Record<CardinalDirection, boolean> }, direction: CardinalDirection, x1: number, y1: number, x2: number, y2: number): void {
    if (!cell.walls[direction]) return;
    this.drawLine(x1, y1, x2, y2);
  }

  private drawLine(x1: number, y1: number, x2: number, y2: number): void {
    this.beginPath();
    this.moveTo(x1, y1);
    this.lineTo(x2, y2);
    this.strokePath();
  }
}

export default GridOverlay;
