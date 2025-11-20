import Phaser from 'phaser';

import { gameBalance } from '@/config/gameBalance';
import { GridManager, CardinalDirection } from '@/managers/GridManager';
import type { AIManager } from '@/managers/AIManager';
import type { HybridPathResolver } from '@/managers/HybridPathResolver';

export class GridOverlay extends Phaser.GameObjects.Graphics {
  private readonly grid: GridManager;
  private readonly debugConfig = gameBalance.grid.debug;
  private needsRedraw: boolean = true;
  private readonly gridChangedHandler: () => void;
  private aiManager?: AIManager;
  private stadiumScene?: Phaser.Scene;
  public showNodes: boolean = false;
  public showVendorPaths: boolean = false;
  private pulseAlpha: number = 0.5;
  private pulseDirection: number = 1;

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

  public setAIManager(aiManager: AIManager): void {
    this.aiManager = aiManager;
    
    // Subscribe to vendor path planning events
    aiManager.on('vendorPathPlanned', () => {
      if (this.showVendorPaths) {
        this.needsRedraw = true;
      }
    });
  }

  public setStadiumScene(stadiumScene: Phaser.Scene): void {
    this.stadiumScene = stadiumScene;
  }

  public setDebugVisible(visible: boolean): void {
    this.setVisible(visible);
    if (visible) {
      this.needsRedraw = true;
    } else {
      // Reset node and path visibility when grid disabled
      this.showNodes = false;
      this.showVendorPaths = false;
    }
    
    // Toggle background visibility
    this.setBackgroundVisible(!visible);
  }

  public toggleNodes(): void {
    if (!this.visible) return; // Only toggle if grid is visible
    this.showNodes = !this.showNodes;
    this.needsRedraw = true;
    console.log(`[GridOverlay] Navigation nodes: ${this.showNodes ? 'ON' : 'OFF'}`);
  }

  public toggleVendorPaths(): void {
    if (!this.visible) return; // Only toggle if grid is visible
    this.showVendorPaths = !this.showVendorPaths;
    this.needsRedraw = true;
    console.log(`[GridOverlay] Vendor paths: ${this.showVendorPaths ? 'ON' : 'OFF'}`);
  }

  private setBackgroundVisible(visible: boolean): void {
    if (!this.stadiumScene) return;
    
    // Call method on stadium scene to set background alpha
    const setAlpha = (this.stadiumScene as any).setBackgroundAlpha;
    if (typeof setAlpha === 'function') {
      setAlpha.call(this.stadiumScene, visible ? 1 : 0);
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
    
    // Update pulse animation for active vendor segment highlighting
    this.pulseAlpha += this.pulseDirection * 0.02;
    if (this.pulseAlpha >= 1.0) {
      this.pulseAlpha = 1.0;
      this.pulseDirection = -1;
    } else if (this.pulseAlpha <= 0.5) {
      this.pulseAlpha = 0.5;
      this.pulseDirection = 1;
    }
    
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

    console.log(`[GridOverlay.redraw] Clearing and redrawing. Visible: ${this.visible}, Depth: ${this.depth}, Alpha: ${this.alpha}`);

    this.clear();

    this.lineStyle(gridLineWidth, gridColor, gridAlpha);
    this.drawGridLines(rows, cols, cellSize, origin.x, origin.y);

    this.lineStyle(wallLineWidth, wallColor, wallAlpha);
    this.drawWalls(cellSize);

    // Render navigation nodes and edges if enabled
    if (this.showNodes) {
      console.log('[GridOverlay.redraw] Rendering navigation nodes...');
      this.renderNavigationNodes();
    }

    // Render vendor paths if enabled
    if (this.showVendorPaths) {
      console.log('[GridOverlay.redraw] Rendering vendor paths...');
      this.renderVendorPaths();
    }
    
    console.log('[GridOverlay.redraw] Redraw complete');
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

  private renderNavigationNodes(): void {
    if (!this.aiManager) {
      console.warn('[GridOverlay] Cannot render nodes: no AIManager');
      return;
    }
    
    const pathResolver = this.aiManager.getPathResolver();
    if (!pathResolver) {
      console.warn('[GridOverlay] Cannot render nodes: no PathResolver');
      return;
    }
    
    const graph = pathResolver.getGraph();
    if (!graph) {
      console.warn('[GridOverlay] Cannot render nodes: no navigation graph');
      return;
    }

    console.log(`[GridOverlay] Rendering ${graph.nodes.size} navigation nodes, ${graph.edges.size} edge sources`);

    // Define colors for each node type
    const nodeColors = {
      corridor: 0x0099ff,   // Blue
      stair: 0xffff00,      // Yellow
      rowEntry: 0x00ff00,   // Green
      seat: 0xff00ff,       // Purple
      ground: 0xff8800,     // Orange
    };

    // First, draw edges (connections between nodes)
    this.lineStyle(1, 0x666666, 0.3);
    let edgesDrawn = 0;
    for (const [nodeId, edges] of graph.edges.entries()) {
      const fromNode = graph.nodes.get(nodeId);
      if (!fromNode) continue;

      for (const edge of edges) {
        const toNode = graph.nodes.get(edge.targetNodeId);
        if (!toNode) continue;

        this.beginPath();
        this.moveTo(fromNode.x, fromNode.y);
        this.lineTo(toNode.x, toNode.y);
        this.strokePath();
        edgesDrawn++;
      }
    }
    console.log(`[GridOverlay] Drew ${edgesDrawn} edges`);

    // Then, draw nodes (so they appear on top of edges)
    let nodesDrawn = 0;
    for (const [nodeId, node] of graph.nodes.entries()) {
      const color = nodeColors[node.type] || 0xffffff;
      this.fillStyle(color, 0.8);
      this.fillCircle(node.x, node.y, 6);
      nodesDrawn++;
    }
    console.log(`[GridOverlay] Drew ${nodesDrawn} nodes`);
  }

  private renderVendorPaths(): void {
    if (!this.aiManager) {
      console.warn('[GridOverlay] Cannot render vendor paths: no AIManager');
      return;
    }
    
    const vendors = this.aiManager.getVendorInstances();
    console.log(`[GridOverlay] Rendering paths for ${vendors.size} vendors`);
    
    let pathsRendered = 0;
    for (const [vendorId, instance] of vendors.entries()) {
      if (!instance.currentPath || instance.currentPath.length === 0) continue;

      pathsRendered++;
      console.log(`[GridOverlay] Vendor ${vendorId} path: ${instance.currentPath.length} segments, current index: ${instance.currentSegmentIndex}`);

      // Draw bright red line through all path segments
      this.lineStyle(4, 0xff0000, 1.0);
      this.beginPath();
      
      // Start from vendor's current position
      this.moveTo(instance.position.x, instance.position.y);
      
      // Draw line through each segment
      for (const segment of instance.currentPath) {
        this.lineTo(segment.x, segment.y);
      }
      
      this.strokePath();

      // Highlight current target segment with pulsing circle
      const currentSegment = instance.currentPath[instance.currentSegmentIndex];
      if (currentSegment) {
        this.fillStyle(0xff0000, this.pulseAlpha);
        this.fillCircle(currentSegment.x, currentSegment.y, 8);
      }
    }
    
    console.log(`[GridOverlay] Rendered ${pathsRendered} vendor paths`);
  }
}

export default GridOverlay;
