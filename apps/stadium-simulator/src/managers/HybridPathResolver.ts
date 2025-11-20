import type { VendorProfile, PathSegment, PathNodeType } from '@/managers/interfaces/VendorTypes';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { Fan } from '@/sprites/Fan';
import type { GridManager } from '@/managers/GridManager';
import type { ActorRegistry } from '@/actors/ActorRegistry';
import { gameBalance } from '@/config/gameBalance';

/**
 * Navigation node types for hybrid pathfinding
 * All nodes store grid coordinates (gridRow, gridCol) as source of truth
 * World coordinates (x, y) are cached for performance
 */

/** Corridor node (top or front of section) */
export interface CorridorNode {
  type: 'corridor';
  position: 'top' | 'front';
  sectionIdx: number;
  colIdx: number;
  gridRow: number;
  gridCol: number;
  x: number; // cached world coordinate
  y: number; // cached world coordinate
}

/** Stair node (left or right edge between sections) */
export interface StairNode {
  type: 'stair';
  side: 'left' | 'right';
  sectionIdx: number; // section it connects to
  gridRow: number;
  gridCol: number;
  x: number; // cached world coordinate
  y: number; // cached world coordinate
}

/** Row entry node (access point to a section row) */
export interface RowEntryNode {
  type: 'rowEntry';
  sectionIdx: number;
  rowIdx: number;
  colIdx: number;
  gridRow: number;
  gridCol: number;
  x: number; // cached world coordinate
  y: number; // cached world coordinate
}

/** Seat anchor node (specific fan location) */
export interface SeatNode {
  type: 'seat';
  sectionIdx: number;
  rowIdx: number;
  colIdx: number;
  gridRow: number;
  gridCol: number;
  x: number; // cached world coordinate
  y: number; // cached world coordinate
  fan?: Fan;
}

/** Ground node (open area below sections, allows diagonal movement) */
export interface GroundNode {
  type: 'ground';
  gridRow: number;
  gridCol: number;
  x: number; // cached world coordinate
  y: number; // cached world coordinate
  zone: number; // Ground zone index for grouping
}

/** Union type for all navigation nodes */
export type NavigationNode = CorridorNode | StairNode | RowEntryNode | SeatNode | GroundNode;

/**
 * Navigation graph structure
 * Maps node IDs to their neighbors with edge costs
 */
export interface NavigationGraph {
  nodes: Map<string, NavigationNode>;
  edges: Map<string, Array<{ targetNodeId: string; baseCost: number }>>;
}

/**
 * Target scoring result for vendor targeting
 */
export interface TargetScore {
  fan: Fan;
  sectionIdx: number;
  rowIdx: number;
  colIdx: number;
  score: number; // higher is better
  estimatedCost: number;
  thirstLevel: number;
  happinessLevel: number;
}

/**
 * HybridPathResolver implements layered heuristic pathfinding for vendors
 * 
 * Architecture:
 * - Phase 1: Global zone selection (which section, which side/stair)
 * - Phase 2: Intra-section approach (top vs front corridor entry)
 * - Phase 3: Row infiltration and seat micro-positioning
 * 
 * Cost Function:
 * - cost = manhattanDistance + terrainPenalty * (1 - vendorEfficiency) - targetValueScore
 * - terrainPenalty accounts for row slowdown, seat occupancy, grump presence
 * - vendorEfficiency from quality tier modifier
 * - targetValueScore prioritizes high-thirst or low-happiness fans
 * 
 * Detour Logic:
 * - Tracks cumulative penalty along path
 * - Triggers local detour search when penalty exceeds vendor's tolerance
 * - Expands small neighborhood (adjacent row entry, alternative stair) for lower-cost branch
 * 
 * Future Expansion:
 * - Full A* implementation can be swapped in using same node schema
 * - Multi-vendor collision avoidance via dynamic cost adjustments
 * - Stair connector geometry and vertical movement modeling
 */
export class HybridPathResolver {
  private graph: NavigationGraph;
  private sections: StadiumSection[];
  private gridManager?: GridManager;
  private actorRegistry?: ActorRegistry;

  constructor(sections: StadiumSection[], gridManager?: GridManager, actorRegistry?: ActorRegistry) {
    this.sections = sections;
    this.gridManager = gridManager;
    this.actorRegistry = actorRegistry;
    this.graph = this.buildNavigationGraph(sections);
  }

  /**
   * Helper to convert grid coordinates to world coordinates with cell centering
   * Returns the CENTER of the grid cell for proper alignment
   * Note: gridManager.gridToWorld() already returns cell center, no offset needed
   */
  private gridToWorldCentered(gridRow: number, gridCol: number): { x: number; y: number } {
    if (!this.gridManager) {
      // Fallback if no grid manager available
      return { x: gridCol * 32, y: gridRow * 32 };
    }
    
    // gridToWorld() already returns the cell center
    return this.gridManager.gridToWorld(gridRow, gridCol);
  }

  /**
   * Helper to convert world coordinates to grid coordinates
   */
  private worldToGrid(x: number, y: number): { row: number; col: number } | null {
    if (!this.gridManager) {
      return { row: Math.floor(y / 32), col: Math.floor(x / 32) };
    }
    return this.gridManager.worldToGrid(x, y);
  }

  /**
   * Build navigation graph from stadium sections
   * Creates a hierarchical navigation graph with:
   * - Corridor nodes (top/front of each section)
   * - Ground nodes (open area for diagonal movement)
   * - Stair nodes (connections between sections)
   * - Row entry nodes (access points to each row)
   * - Uses grid coordinates as source of truth, caches world coordinates
   * 
   * @param sections Array of StadiumSection objects
   * @returns Navigation graph structure
   */
  private buildNavigationGraph(sections: StadiumSection[]): NavigationGraph {
    const nodes = new Map<string, NavigationNode>();
    const edges = new Map<string, Array<{ targetNodeId: string; baseCost: number }>>();

    // Get grid dimensions for ground calculation
    const gridRows = this.gridManager?.getRowCount() || 24;
    const gridCols = this.gridManager?.getColumnCount() || 32;

    // Phase 1: Create corridor nodes for each section (grid-based)
    sections.forEach((section, sectionIdx) => {
      const rows = section.getRows();
      if (rows.length === 0) return;
      
      // Get grid position from first seat of first row
      const firstRow = rows[0];
      const firstSeat = firstRow?.getSeats()[0];
      if (!firstSeat) return;
      
      const firstSeatGrid = firstSeat.getGridPosition();
      const lastRow = rows[rows.length - 1];
      const lastSeat = lastRow?.getSeats()[0];
      const lastSeatGrid = lastSeat?.getGridPosition();
      
      // Calculate corridor grid positions
      const topCorridorRow = firstSeatGrid.row - 1; // One row above section
      const frontCorridorRow = (lastSeatGrid?.row || firstSeatGrid.row) + 1; // One row below section
      const centerCol = Math.floor(firstRow.getSeats().length / 2) + firstSeatGrid.col;
      
      // Top corridor (above section)
      const topCorridorId = `corridor_top_${sectionIdx}`;
      const topWorld = this.gridToWorldCentered(topCorridorRow, centerCol);
      nodes.set(topCorridorId, {
        type: 'corridor',
        position: 'top',
        sectionIdx,
        colIdx: Math.floor(firstRow.getSeats().length / 2),
        gridRow: topCorridorRow,
        gridCol: centerCol,
        x: topWorld.x,
        y: topWorld.y,
      });

      // Front corridor (below section)
      const frontCorridorId = `corridor_front_${sectionIdx}`;
      const frontWorld = this.gridToWorldCentered(frontCorridorRow, centerCol);
      nodes.set(frontCorridorId, {
        type: 'corridor',
        position: 'front',
        sectionIdx,
        colIdx: Math.floor(firstRow.getSeats().length / 2),
        gridRow: frontCorridorRow,
        gridCol: centerCol,
        x: frontWorld.x,
        y: frontWorld.y,
      });
    });

    // Phase 1.5: Create ground nodes for open area below sections (grid-based)
    // Ground is the open space vendors can move diagonally through
    const groundRowsFromBottom = gameBalance.grid.groundLine.rowsFromBottom;
    const groundGridRow = gridRows - groundRowsFromBottom; // e.g., 24 - 6 = 18
    const groundNodeSpacing = 5; // Grid columns between ground nodes
    
    // Create ground nodes horizontally across the stadium
    for (let col = 2; col < gridCols - 2; col += groundNodeSpacing) {
      const groundNodeId = `ground_${col}`;
      const groundWorld = this.gridToWorldCentered(groundGridRow, col);
      nodes.set(groundNodeId, {
        type: 'ground',
        gridRow: groundGridRow,
        gridCol: col,
        x: groundWorld.x,
        y: groundWorld.y,
        zone: 0,
      });
    }
    
    // Connect ground nodes to each other (allowing diagonal movement)
    const groundNodes = Array.from(nodes.entries()).filter(([id, node]) => node.type === 'ground');
    groundNodes.forEach(([nodeId, node], idx) => {
      // Connect to next ground node (horizontal)
      if (idx < groundNodes.length - 1) {
        const [nextId, nextNode] = groundNodes[idx + 1];
        const distance = Math.sqrt(
          Math.pow(nextNode.x - node.x, 2) + Math.pow(nextNode.y - node.y, 2)
        );
        this.addEdge(edges, nodeId, nextId, distance * 0.5); // Low cost for ground movement
        this.addEdge(edges, nextId, nodeId, distance * 0.5);
      }
      
      // Connect to diagonal neighbors for true diagonal movement
      if (idx < groundNodes.length - 2) {
        const [diagId, diagNode] = groundNodes[idx + 2];
        const distance = Math.sqrt(
          Math.pow(diagNode.x - node.x, 2) + Math.pow(diagNode.y - node.y, 2)
        );
        this.addEdge(edges, nodeId, diagId, distance * 0.6); // Slightly higher cost
        this.addEdge(edges, diagId, nodeId, distance * 0.6);
      }
    });
    
    // Connect ground nodes to front corridor nodes (vertical transition from ground to corridor)
    groundNodes.forEach(([groundId, groundNode]) => {
      sections.forEach((section, sectionIdx) => {
        const frontCorridorId = `corridor_front_${sectionIdx}`;
        const frontCorridor = nodes.get(frontCorridorId);
        if (frontCorridor && frontCorridor.type === 'corridor') {
          const distance = Math.sqrt(
            Math.pow(frontCorridor.x - groundNode.x, 2) + Math.pow(frontCorridor.y - groundNode.y, 2)
          );
          // Only connect if ground node is reasonably close to this section
          if (distance < 300) {
            this.addEdge(edges, groundId, frontCorridorId, distance);
            this.addEdge(edges, frontCorridorId, groundId, distance);
          }
        }
      });
    });

    // Phase 2: Create stair nodes from ActorRegistry (grid-based)
    if (this.actorRegistry) {
      const stairsActors = this.actorRegistry.getByCategory('stairs');
      stairsActors.forEach((actor: any) => {
        const stairData = actor.getSnapshot();
        const stairId = `stair_${stairData.id}`;
        
        // Use grid bounds from StairsActor - center of stair area
        const centerGridRow = stairData.gridBounds.top + Math.floor(stairData.gridBounds.height / 2);
        const centerGridCol = stairData.gridBounds.left + Math.floor(stairData.gridBounds.width / 2);
        const centerWorld = this.gridToWorldCentered(centerGridRow, centerGridCol);
        
        // Create stair node at center of stairs
        nodes.set(stairId, {
          type: 'stair',
          side: 'right', // TODO: Determine from position relative to sections
          sectionIdx: -1, // Will be determined by connections
          gridRow: centerGridRow,
          gridCol: centerGridCol,
          x: centerWorld.x,
          y: centerWorld.y,
        });

        // Connect stairs to adjacent sections' corridor nodes
        // Find which sections this stairway connects
        const [sectionA, sectionB] = stairData.connectsSections;
        const sectionAIdx = sections.findIndex(s => s.getId() === sectionA);
        const sectionBIdx = sections.findIndex(s => s.getId() === sectionB);

        if (sectionAIdx !== -1 && sectionBIdx !== -1) {
          const stairCost = gameBalance.vendorMovement.stairTransitionCost * 1.5; // Apply stair traversal multiplier
          
          // Connect to both top and front corridors of both sections
          const topCorridorAId = `corridor_top_${sectionAIdx}`;
          const topCorridorBId = `corridor_top_${sectionBIdx}`;
          const frontCorridorAId = `corridor_front_${sectionAIdx}`;
          const frontCorridorBId = `corridor_front_${sectionBIdx}`;

          // Bidirectional connections
          this.addEdge(edges, topCorridorAId, stairId, stairCost);
          this.addEdge(edges, stairId, topCorridorAId, stairCost);
          this.addEdge(edges, stairId, topCorridorBId, stairCost);
          this.addEdge(edges, topCorridorBId, stairId, stairCost);
          this.addEdge(edges, frontCorridorAId, stairId, stairCost);
          this.addEdge(edges, stairId, frontCorridorAId, stairCost);
          this.addEdge(edges, stairId, frontCorridorBId, stairCost);
          this.addEdge(edges, frontCorridorBId, stairId, stairCost);
        }
      });
    } else {
      // Fallback: Create hardcoded stair nodes between adjacent sections (legacy behavior)
      for (let i = 0; i < sections.length - 1; i++) {
        const currentSection = sections[i];
        const nextSection = sections[i + 1];
        const currentBounds = currentSection.getBounds();
        const nextBounds = nextSection.getBounds();
        
        const rightStairId = `stair_right_${i}`;
        nodes.set(rightStairId, {
          type: 'stair',
          side: 'right',
          sectionIdx: i,
          gridRow: 0,
          gridCol: 0,
          x: currentBounds.x + currentBounds.width,
          y: (currentBounds.y + currentBounds.y + currentBounds.height) / 2,
        });

        const topCorridorCurrentId = `corridor_top_${i}`;
        const topCorridorNextId = `corridor_top_${i + 1}`;
        const frontCorridorCurrentId = `corridor_front_${i}`;
        const frontCorridorNextId = `corridor_front_${i + 1}`;

        this.addEdge(edges, topCorridorCurrentId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, rightStairId, topCorridorCurrentId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, rightStairId, topCorridorNextId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, topCorridorNextId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, frontCorridorCurrentId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, rightStairId, frontCorridorCurrentId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, rightStairId, frontCorridorNextId, gameBalance.vendorMovement.stairTransitionCost);
        this.addEdge(edges, frontCorridorNextId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
      }
    }

    // Phase 3: Create row entry nodes for each section row (grid-based)
    sections.forEach((section, sectionIdx) => {
      const rows = section.getRows();

      rows.forEach((row, rowIdx) => {
        const seats = row.getSeats();
        // Get row position from first seat's grid coordinates
        const firstSeat = seats[0];
        const lastSeat = seats[seats.length - 1];
        if (!firstSeat || !lastSeat) return;
        
        const firstGrid = firstSeat.getGridPosition();
        const lastGrid = lastSeat.getGridPosition();
        
        // Entry nodes at first and last columns of row
        const leftEntryId = `rowEntry_left_${sectionIdx}_${rowIdx}`;
        const rightEntryId = `rowEntry_right_${sectionIdx}_${rowIdx}`;
        
        const leftWorld = this.gridToWorldCentered(firstGrid.row, firstGrid.col);
        const rightWorld = this.gridToWorldCentered(lastGrid.row, lastGrid.col);

        nodes.set(leftEntryId, {
          type: 'rowEntry',
          sectionIdx,
          rowIdx,
          colIdx: 0,
          gridRow: firstGrid.row,
          gridCol: firstGrid.col,
          x: leftWorld.x,
          y: leftWorld.y,
        });

        nodes.set(rightEntryId, {
          type: 'rowEntry',
          sectionIdx,
          rowIdx,
          colIdx: seats.length - 1,
          gridRow: lastGrid.row,
          gridCol: lastGrid.col,
          x: rightWorld.x,
          y: rightWorld.y,
        });

        // Connect row entries to corridors ONLY if adjacent
        // First row connects to top corridor, last row connects to front corridor
        const isFirstRow = rowIdx === 0;
        const isLastRow = rowIdx === rows.length - 1;
        const entryToCorridor = gameBalance.vendorMovement.rowEntryToCorridor || 50;
        
        if (isFirstRow) {
          // First row connects to top corridor (above section)
          const topCorridorId = `corridor_top_${sectionIdx}`;
          this.addEdge(edges, leftEntryId, topCorridorId, entryToCorridor);
          this.addEdge(edges, topCorridorId, leftEntryId, entryToCorridor);
          this.addEdge(edges, rightEntryId, topCorridorId, entryToCorridor);
          this.addEdge(edges, topCorridorId, rightEntryId, entryToCorridor);
        }
        
        if (isLastRow) {
          // Last row connects to front corridor (below section)
          const frontCorridorId = `corridor_front_${sectionIdx}`;
          this.addEdge(edges, leftEntryId, frontCorridorId, entryToCorridor);
          this.addEdge(edges, frontCorridorId, leftEntryId, entryToCorridor);
          this.addEdge(edges, rightEntryId, frontCorridorId, entryToCorridor);
          this.addEdge(edges, frontCorridorId, rightEntryId, entryToCorridor);
        }

        // Connect left and right entries (traversing the row)
        const rowTraverseCost = seats.length * gameBalance.vendorMovement.baseSpeedRow;
        this.addEdge(edges, leftEntryId, rightEntryId, rowTraverseCost);
        this.addEdge(edges, rightEntryId, leftEntryId, rowTraverseCost);
      });

      // NOTE: Do NOT connect row entries vertically within sections
      // Vendors must use corridors and stairs to move between rows
      // This enforces proper pathfinding through the stadium architecture
    });

    // Phase 4: Use GridManager to refine costs if available
    if (this.gridManager) {
      // For each edge, check if GridManager provides better cost data
      // This would involve checking passability and terrain penalties
      // For now, we'll keep the basic graph but this is where grid integration happens
      console.log('[HybridPathResolver] GridManager available - graph costs can be refined with terrain data');
    }

    return { nodes, edges };
  }

  /**
   * Helper to add bidirectional edge to graph
   */
  private addEdge(
    edges: Map<string, Array<{ targetNodeId: string; baseCost: number }>>,
    fromId: string,
    toId: string,
    cost: number
  ): void {
    if (!edges.has(fromId)) {
      edges.set(fromId, []);
    }
    edges.get(fromId)!.push({ targetNodeId: toId, baseCost: cost });
  }

  /**
   * Plan a path from vendor's current position to target node
   * Uses Dijkstra's algorithm to find lowest-cost path through navigation graph
   * 
   * Algorithm:
   * 1. Find nearest node to vendor's current position
   * 2. Find nearest node to target position
   * 3. Use Dijkstra to find shortest path between nodes
   * 4. Convert node path to PathSegment array
   * 
   * @param vendor Vendor profile with quality and abilities
   * @param fromX Current X position
   * @param fromY Current Y position
   * @param toNode Target navigation node
   * @returns Array of path segments to follow
   */
  public planPath(
    vendor: VendorProfile,
    fromX: number,
    fromY: number,
    toNode: NavigationNode
  ): PathSegment[] {
    // Find nearest node to current position
    const startNode = this.findNearestNode(fromX, fromY);
    if (!startNode) {
      // No nodes available - return direct path
      return [{
        nodeType: 'seat',
        sectionIdx: 0,
        rowIdx: 0,
        colIdx: 0,
        x: toNode.x,
        y: toNode.y,
        cost: this.calculateDistance(fromX, fromY, toNode.x, toNode.y),
      }];
    }

    // If target is a seat, find the appropriate row entry node instead
    let actualTargetNode = toNode;
    if (toNode.type === 'seat') {
      // Determine which row entry (left or right) is closer to the seat
      const leftEntryId = `rowEntry_left_${toNode.sectionIdx}_${toNode.rowIdx}`;
      const rightEntryId = `rowEntry_right_${toNode.sectionIdx}_${toNode.rowIdx}`;
      
      const leftEntry = this.graph.nodes.get(leftEntryId);
      const rightEntry = this.graph.nodes.get(rightEntryId);
      
      if (leftEntry && rightEntry) {
        // Choose the entry point on the same side as the seat (or closer)
        const seatIsOnLeft = toNode.colIdx < 4; // Assuming ~8 seats per row, midpoint is 4
        actualTargetNode = seatIsOnLeft ? leftEntry : rightEntry;
      } else if (leftEntry) {
        actualTargetNode = leftEntry;
      } else if (rightEntry) {
        actualTargetNode = rightEntry;
      }
      // If neither entry exists, fall back to original seat node (will fail gracefully)
    }

    // Find node ID for target
    const targetNodeId = this.getNodeId(actualTargetNode);
    const startNodeId = this.getNodeId(startNode);

    // Run Dijkstra's algorithm
    const nodePath = this.dijkstra(startNodeId, targetNodeId);
    
    // Debug logging for pathfinding validation
    if (nodePath.length > 0) {
      const nodeTypes = nodePath.map(id => {
        const node = this.graph.nodes.get(id);
        return node ? `${node.type}(r${node.gridRow || '?'},c${node.gridCol || '?'})` : id;
      }).join(' → ');
      console.log(`[HybridPathResolver] Pathfinding result: ${nodePath.length} nodes\n  ${nodeTypes}`);
    }
    
    // Convert node path to PathSegment array
    const segments: PathSegment[] = [];
    
    // Add initial segment(s) from current position to first node
    // If vendor is above ground level, add vertical descent first to avoid crossing rows
    if (nodePath.length > 0) {
      const firstNode = this.graph.nodes.get(nodePath[0]);
      if (firstNode) {
        const GROUND_Y = 650; // Ground level Y coordinate

        // If vendor is significantly above ground and first node is ground type
        if (fromY < GROUND_Y - 10 && firstNode.type === 'ground') {
          // Add intermediate waypoint: move vertically to ground level first
          segments.push({
            nodeType: 'ground',
            sectionIdx: 0,
            rowIdx: 0,
            colIdx: 0,
            x: fromX, // Keep same X, only change Y
            y: GROUND_Y,
            cost: Math.abs(GROUND_Y - fromY),
          });
        }
        
        // Then add segment to first node
        segments.push(this.nodeToSegment(firstNode, this.calculateDistance(segments.length > 0 ? fromX : fromX, segments.length > 0 ? GROUND_Y : fromY, firstNode.x, firstNode.y)));
      }
    }

    // Add segments for each node in path, expanding to grid-cell waypoints
    // expandToGridPath will create waypoints from currentNode to nextNode (inclusive of nextNode)
    for (let i = 0; i < nodePath.length - 1; i++) {
      const currentNode = this.graph.nodes.get(nodePath[i]);
      const nextNode = this.graph.nodes.get(nodePath[i + 1]);
      if (currentNode && nextNode) {
        // Expand path between nodes to follow grid cells
        const gridWaypoints = this.expandToGridPath(currentNode, nextNode);
        console.log(`[HybridPathResolver] Expanding ${currentNode.type}→${nextNode.type}: ${gridWaypoints.length} waypoints`);
        segments.push(...gridWaypoints);
      }
    }
    
    // Note: We don't add a separate final node here because expandToGridPath
    // already includes the target node in its waypoints
    
    console.log(`[HybridPathResolver] Total path segments: ${segments.length}`);
    if (segments.length > 0) {
      console.log('[HybridPathResolver] Segment details:', segments.map((s, i) => 
        `${i}: ${s.nodeType} (${s.gridRow || '?'},${s.gridCol || '?'}) @ (${Math.round(s.x)},${Math.round(s.y)})`
      ).join('\n  '));
    }

    // If original target was a seat (not a row entry), add final segment from row entry to seat
    if (toNode.type === 'seat' && actualTargetNode.type === 'rowEntry') {
      const lastNode = nodePath.length > 0 ? this.graph.nodes.get(nodePath[nodePath.length - 1]) : null;
      if (lastNode) {
        segments.push({
          nodeType: 'seat',
          sectionIdx: toNode.sectionIdx,
          rowIdx: toNode.rowIdx,
          colIdx: toNode.colIdx,
          x: toNode.x,
          y: toNode.y,
          cost: this.calculateDistance(lastNode.x, lastNode.y, toNode.x, toNode.y),
        });
      }
    }

    return segments.length > 0 ? segments : [{
      nodeType: 'seat',
      sectionIdx: 0,
      rowIdx: 0,
      colIdx: 0,
      x: toNode.x,
      y: toNode.y,
      cost: this.calculateDistance(fromX, fromY, toNode.x, toNode.y),
    }];
  }

  /**
   * Dijkstra's algorithm for shortest path
   * @param startNodeId Starting node ID
   * @param targetNodeId Target node ID
   * @returns Array of node IDs representing the path
   */
  private dijkstra(startNodeId: string, targetNodeId: string): string[] {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    // Initialize all nodes
    for (const nodeId of this.graph.nodes.keys()) {
      distances.set(nodeId, nodeId === startNodeId ? 0 : Infinity);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentNodeId: string | null = null;
      let minDistance = Infinity;
      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId) ?? Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          currentNodeId = nodeId;
        }
      }

      // No path exists
      if (currentNodeId === null || minDistance === Infinity) break;

      // Reached target
      if (currentNodeId === targetNodeId) break;

      unvisited.delete(currentNodeId);

      // Check all neighbors
      const edges = this.graph.edges.get(currentNodeId) ?? [];
      for (const edge of edges) {
        if (!unvisited.has(edge.targetNodeId)) continue;

        const altDistance = (distances.get(currentNodeId) ?? Infinity) + edge.baseCost;
        if (altDistance < (distances.get(edge.targetNodeId) ?? Infinity)) {
          distances.set(edge.targetNodeId, altDistance);
          previous.set(edge.targetNodeId, currentNodeId);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = targetNodeId;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
      if (current === startNodeId) {
        path.unshift(startNodeId);
        break;
      }
    }

    return path;
  }

  /**
   * Find nearest navigation node to a world position
   * Excludes row entries and seats - vendors can only enter via corridors, stairs, or ground
   */
  private findNearestNode(x: number, y: number): NavigationNode | null {
    let nearest: NavigationNode | null = null;
    let minDistance = Infinity;

    for (const node of this.graph.nodes.values()) {
      // Vendors can only start pathfinding from public access nodes
      // Row entries and seats are internal to sections
      if (node.type === 'rowEntry' || node.type === 'seat') {
        continue;
      }
      
      const dist = this.calculateDistance(x, y, node.x, node.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = node;
      }
    }

    return nearest;
  }

  /**
   * Generate unique node ID from node data
   */
  private getNodeId(node: NavigationNode): string {
    switch (node.type) {
      case 'corridor':
        return `corridor_${node.position}_${node.sectionIdx}`;
      case 'stair':
        return `stair_${node.side}_${node.sectionIdx}`;
      case 'rowEntry':
        return `rowEntry_${node.colIdx === 0 ? 'left' : 'right'}_${node.sectionIdx}_${node.rowIdx}`;
      case 'seat':
        return `seat_${node.sectionIdx}_${node.rowIdx}_${node.colIdx}`;
      case 'ground':
        return `ground_${node.gridRow}_${node.gridCol}`;
    }
  }

  /**
   * Expand path between two navigation nodes into grid-aligned waypoints
   * Uses Manhattan (orthogonal) movement to avoid diagonal cutting through rows
   */
  private expandToGridPath(fromNode: NavigationNode, toNode: NavigationNode): PathSegment[] {
    const segments: PathSegment[] = [];
    
    if (!this.gridManager) {
      // No grid manager - fall back to direct segment
      return [this.nodeToSegment(toNode, this.calculateDistance(fromNode.x, fromNode.y, toNode.x, toNode.y))];
    }
    
    // Convert world positions to grid coordinates
    const fromGrid = this.worldToGrid(fromNode.x, fromNode.y);
    const toGrid = this.worldToGrid(toNode.x, toNode.y);
    
    if (!fromGrid || !toGrid) {
      return [this.nodeToSegment(toNode, this.calculateDistance(fromNode.x, fromNode.y, toNode.x, toNode.y))];
    }
    
    // Use Manhattan path: move horizontally first, then vertically
    // This prevents diagonal movement across rows
    const currentRow = fromGrid.row;
    const currentCol = fromGrid.col;
    const targetRow = toGrid.row;
    const targetCol = toGrid.col;
    
    // Move horizontally
    if (currentCol !== targetCol) {
      const colStep = currentCol < targetCol ? 1 : -1;
      for (let col = currentCol + colStep; col !== targetCol + colStep; col += colStep) {
        const worldPos = this.gridManager.gridToWorld(currentRow, col);
        segments.push({
          nodeType: fromNode.type === 'ground' ? 'ground' : 'corridor',
          sectionIdx: 'sectionIdx' in fromNode ? fromNode.sectionIdx : 0,
          rowIdx: currentRow,
          colIdx: col,
          gridRow: currentRow,
          gridCol: col,
          x: worldPos.x,
          y: worldPos.y,
          cost: this.gridManager.getWorldSize().cellSize,
        });
      }
    }
    
    // Move vertically
    if (currentRow !== targetRow) {
      const rowStep = currentRow < targetRow ? 1 : -1;
      for (let row = currentRow + rowStep; row !== targetRow + rowStep; row += rowStep) {
        const worldPos = this.gridManager.gridToWorld(row, targetCol);
        segments.push({
          nodeType: toNode.type === 'stair' ? 'stair' : toNode.type,
          sectionIdx: 'sectionIdx' in toNode ? toNode.sectionIdx : 0,
          rowIdx: row,
          colIdx: targetCol,
          gridRow: row,
          gridCol: targetCol,
          x: worldPos.x,
          y: worldPos.y,
          cost: this.gridManager.getWorldSize().cellSize,
        });
      }
    }
    
    return segments;
  }

  /**
   * Convert navigation node to path segment
   */
  private nodeToSegment(node: NavigationNode, cost: number): PathSegment {
    const nodeType: PathNodeType = node.type === 'rowEntry' ? 'rowEntry' : 
                                    node.type === 'stair' ? 'stair' :
                                    node.type === 'corridor' ? 'corridor' :
                                    node.type === 'ground' ? 'ground' : 'seat';
    
    const colIdx = 'colIdx' in node ? node.colIdx : 0;
    const rowIdx = (node.type === 'rowEntry' || node.type === 'seat') ? node.rowIdx : 0;
    const sectionIdx = 'sectionIdx' in node ? node.sectionIdx : 0;
    
    return {
      nodeType,
      sectionIdx,
      rowIdx,
      colIdx,
      x: node.x,
      y: node.y,
      cost,
    };
  }

  /**
   * Calculate segment cost based on terrain and vendor profile
   * 
   * Cost breakdown:
   * - Base movement cost (distance * base speed for node type)
   * - Row base penalty (if in row)
   * - Occupied seat penalties (per seat crossed)
   * - Grump penalties (multiplied for difficult terrain fans)
   * - Vendor ability overrides (ignore certain penalties)
   * - Quality efficiency modifier (scales total cost)
   * 
   * @param segment Path segment to evaluate
   * @param vendor Vendor profile
   * @param seatOccupancy Optional seat occupancy data for row
   * @param grumpPresence Optional grump/difficult terrain flags
   * @returns Total movement cost for this segment
   */
  public calculateSegmentCost(
    segment: PathSegment,
    vendor: VendorProfile,
    seatOccupancy?: boolean[],
    grumpPresence?: boolean[]
  ): number {
    let cost = segment.cost; // base distance cost

    // Apply node type base speed modifier
    const speedModifiers: Record<PathNodeType, number> = {
      corridor: gameBalance.vendorMovement.baseSpeedCorridor,
      stair: gameBalance.vendorMovement.baseSpeedStair,
      rowEntry: gameBalance.vendorMovement.baseSpeedRow,
      seat: gameBalance.vendorMovement.baseSpeedRow,
      ground: gameBalance.vendorMovement.baseSpeedCorridor, // Ground uses corridor speed
    };

    cost = cost / speedModifiers[segment.nodeType];

    // Apply row base penalty if in row (unless vendor ignores it)
    if ((segment.nodeType === 'rowEntry' || segment.nodeType === 'seat') 
        && !vendor.abilities.ignoreRowPenalty) {
      cost *= (1 + gameBalance.vendorMovement.rowBasePenalty);
    }

    // Apply seat occupancy and grump penalties if provided
    if (seatOccupancy && segment.colIdx !== undefined) {
      const col = segment.colIdx;
      if (seatOccupancy[col]) {
        cost *= (1 + gameBalance.vendorMovement.occupiedSeatPenalty);
      }

      // Apply grump penalty if present and vendor doesn't ignore it
      if (grumpPresence && grumpPresence[col] && !vendor.abilities.ignoreGrumpPenalty) {
        const grumpPenalty = gameBalance.vendorMovement.rowBasePenalty 
          * gameBalance.vendorMovement.grumpPenaltyMultiplier;
        const cappedPenalty = Math.min(grumpPenalty, gameBalance.vendorMovement.maxTerrainPenalty);
        cost *= (1 + cappedPenalty);
      }
    }

    // Apply vendor quality efficiency modifier
    const qualityConfig = gameBalance.vendorQuality[vendor.qualityTier];
    cost = cost / qualityConfig.efficiencyModifier;

    return cost;
  }

  /**
   * Detect if cumulative path penalty exceeds tolerance threshold
   * Triggers local detour search to find alternative route
   * 
   * @param cumulativePenalty Current accumulated movement penalty
   * @param vendor Vendor profile with quality-based tolerance
   * @returns true if detour should be triggered
   */
  public detectDetourNeed(cumulativePenalty: number, vendor: VendorProfile): boolean {
    const qualityConfig = gameBalance.vendorQuality[vendor.qualityTier];
    const tolerance = qualityConfig.penaltyTolerance;
    return cumulativePenalty > tolerance;
  }

  /**
   * Find local detour around high-penalty segment
   * Currently a stub - returns null for Phase 1
   * 
   * Future implementation will:
   * 1. Expand small neighborhood around current position
   * 2. Consider alternative row entries or stair access
   * 3. Score alternative branches by cost reduction
   * 4. Return new segment array if better path found
   * 
   * @param fromNode Current position node
   * @param targetNode Destination node
   * @param avoidNodes Nodes to avoid (high penalty)
   * @returns Alternative path segments or null if no better route
   */
  public findLocalDetour(
    fromNode: NavigationNode,
    targetNode: NavigationNode,
    avoidNodes: Set<string>
  ): PathSegment[] | null {
    // TODO: Implement local detour search
    // For now, return null (no detour available)
    return null;
  }

  /**
   * Score potential target fans for drink vendor service
   * Considers thirst severity, distance, and path cost
   * 
   * @param vendor Vendor profile
   * @param fromX Current vendor X position
   * @param fromY Current vendor Y position
   * @param candidates Array of candidate fans with positions
   * @returns Sorted array of target scores (highest first)
   */
  public scoreTargets(
    vendor: VendorProfile,
    fromX: number,
    fromY: number,
    candidates: Array<{ fan: Fan; sectionIdx: number; rowIdx: number; colIdx: number; x: number; y: number }>
  ): TargetScore[] {
    const scores: TargetScore[] = [];

    for (const candidate of candidates) {
      const distance = this.calculateDistance(fromX, fromY, candidate.x, candidate.y);
      const thirst = candidate.fan.getThirst();
      const happiness = candidate.fan.getHappiness();

      // Score formula: thirstSeverity / (estimatedCost * efficiency)
      // Higher thirst = higher priority, lower cost = higher priority
      const thirstWeight = thirst / 100; // normalize to 0-1
      const estimatedCost = distance; // simplified for stub
      const qualityConfig = gameBalance.vendorQuality[vendor.qualityTier];
      const efficiency = qualityConfig.efficiencyModifier;

      const score = (thirstWeight * 100) / (estimatedCost * (1 / efficiency));

      scores.push({
        fan: candidate.fan,
        sectionIdx: candidate.sectionIdx,
        rowIdx: candidate.rowIdx,
        colIdx: candidate.colIdx,
        score,
        estimatedCost,
        thirstLevel: thirst,
        happinessLevel: happiness,
      });
    }

    // Sort descending by score
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate Manhattan distance between two points
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  /**
   * Get navigation graph (for debugging/visualization)
   */
  public getGraph(): NavigationGraph {
    return this.graph;
  }

  /**
   * Rebuild graph when sections change
   */
  public rebuildGraph(sections: StadiumSection[]): void {
    this.sections = sections;
    this.graph = this.buildNavigationGraph(sections);
    console.log(`[HybridPathResolver] Navigation graph rebuilt: ${this.graph.nodes.size} nodes, ${this.graph.edges.size} edge sets`);
  }
}
