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
  // Zone debug toggles
  private showZones: boolean = true;
  private showTransitions: boolean = true;
  private showDirectional: boolean = false;
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

  // Zone visualization toggles
  public toggleZones(): void {
    if (!this.visible) return;
    this.showZones = !this.showZones;
    this.needsRedraw = true;
    console.log(`[GridOverlay] Zone overlay: ${this.showZones ? 'ON' : 'OFF'}`);
  }

  public toggleTransitions(): void {
    if (!this.visible) return;
    this.showTransitions = !this.showTransitions;
    this.needsRedraw = true;
    console.log(`[GridOverlay] Transition markers: ${this.showTransitions ? 'ON' : 'OFF'}`);
  }

  public toggleDirectional(): void {
    if (!this.visible) return;
    this.showDirectional = !this.showDirectional;
    this.needsRedraw = true;
    console.log(`[GridOverlay] Directional arrows: ${this.showDirectional ? 'ON' : 'OFF'}`);
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

    // Draw zones first so grid lines sit on top
    if (this.showZones) {
      this.renderZones(cellSize);
    }

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

  // ------------------------------------------------------------
  // Zone Rendering
  // ------------------------------------------------------------
  private renderZones(cellSize: number): void {
    const cells = this.grid.getAllCells();
    // Zone color mapping
    const ZONE_COLORS: Record<string, number> = {
      ground: 0x2d5016,
      corridor: 0x0044aa,
      seat: 0x666666,
      rowEntry: 0xffd400,
      stair: 0xff8800,
      sky: 0x001020,
    };
    const origin = this.grid.getOrigin();

    cells.forEach(cell => {
      const color = ZONE_COLORS[cell.zoneType] ?? 0x333333;
      const bounds = this.grid.getCellBounds(cell.row, cell.col);
      // Fill zone background with low alpha so grid is visible
      this.fillStyle(color, 0.22);
      this.fillRect(bounds.x, bounds.y, cellSize, cellSize);

      // Draw transition markers
      if (this.showTransitions && cell.transitionType) {
        this.fillStyle(0xffffff, 0.85);
        // small diamond
        const cx = bounds.x + cellSize / 2;
        const cy = bounds.y + cellSize / 2;
        this.beginPath();
        this.moveTo(cx, cy - 4);
        this.lineTo(cx + 4, cy);
        this.lineTo(cx, cy + 4);
        this.lineTo(cx - 4, cy);
        this.closePath();
        this.fillPath();
      }

      // Directional arrows (outgoing) - optional
      if (this.showDirectional) {
        this.renderDirectionalArrows(cell, bounds.x, bounds.y, cellSize);
      }
    });
  }

  private renderDirectionalArrows(cell: any, x: number, y: number, size: number): void {
    if (!cell.allowedOutgoing) return;
    // Suppress directional arrow rendering for row entry boundary cells per design
    if (cell.zoneType === 'rowEntry') return;
    const arrowColor = 0x00ff00; // green
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const offset = size / 2 - 5;
    const headSize = 4;

    // Helper to draw a filled arrow pointing from center towards target point
    const drawArrow = (toX: number, toY: number, dir: CardinalDirection): void => {
      this.fillStyle(arrowColor, 0.85);
      this.beginPath();
      // Shaft from center to slightly before arrow head
      const shaftRatio = 0.65;
      const shaftX = centerX + (toX - centerX) * shaftRatio;
      const shaftY = centerY + (toY - centerY) * shaftRatio;
      this.moveTo(shaftX, shaftY); // start polygon at shaft end
      // Build triangle for head depending on direction
      switch (dir) {
        case 'top':
          this.lineTo(toX, toY - headSize);
          this.lineTo(toX - headSize, toY);
          this.lineTo(toX + headSize, toY);
          break;
        case 'bottom':
          this.lineTo(toX, toY + headSize);
          this.lineTo(toX - headSize, toY);
          this.lineTo(toX + headSize, toY);
          break;
        case 'left':
          this.lineTo(toX - headSize, toY);
          this.lineTo(toX, toY - headSize);
          this.lineTo(toX, toY + headSize);
          break;
        case 'right':
          this.lineTo(toX + headSize, toY);
          this.lineTo(toX, toY - headSize);
          this.lineTo(toX, toY + headSize);
          break;
      }
      this.closePath();
      this.fillPath();
      // Draw shaft line (thin) in same color
      this.lineStyle(1, arrowColor, 0.9);
      this.beginPath();
      this.moveTo(centerX, centerY);
      this.lineTo(shaftX, shaftY);
      this.strokePath();
    };

    if (cell.allowedOutgoing.top) {
      drawArrow(centerX, centerY - offset, 'top');
    }
    if (cell.allowedOutgoing.bottom) {
      drawArrow(centerX, centerY + offset, 'bottom');
    }
    if (cell.allowedOutgoing.left) {
      drawArrow(centerX - offset, centerY, 'left');
    }
    if (cell.allowedOutgoing.right) {
      drawArrow(centerX + offset, centerY, 'right');
    }
  }
}

export default GridOverlay;
